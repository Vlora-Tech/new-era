# Deployment — AWS

> **Status: infrastructure code written and validated. NOTHING HAS BEEN CREATED.**
>
> `terraform validate` and `terraform fmt` pass. No `terraform apply` has been
> run, no AWS resource exists, and nothing is billing. Per
> [aws-rds-production-plan.md](aws-rds-production-plan.md), `apply` requires the
> owner's explicit approval.

The shape: a Next.js container on a **single EC2 instance**, with **Caddy**
terminating TLS, talking to a **private RDS PostgreSQL 17** instance and an
**S3** media bucket. Configuration comes from **SSM Parameter Store**. Schema
changes run as a one-off container on the same box, never at boot.

## Why not App Runner

The first version of this used App Runner. It was replaced because of what it
cost, and the cost was not where you would guess.

App Runner reaches a private database through a VPC connector, and a VPC
connector forces **all** egress through the VPC — so reaching Moyasar and Bunny
required a NAT gateway at roughly $32/month. That single line item cost more
than the server now does. App Runner's own compute added $22–40 on top, and
Secrets Manager billed $0.40 per secret per month for about a dozen values.

|                     | App Runner            | EC2 + Caddy                 |
| ------------------- | --------------------- | --------------------------- |
| Compute             | ~$22–40               | ~$12 (t4g.small)            |
| NAT gateway         | ~$32                  | — none needed               |
| Load balancer / TLS | included              | ~$0 (Caddy + Let's Encrypt) |
| Config store        | ~$4 (Secrets Manager) | $0 (Parameter Store)        |
| RDS                 | ~$25 (t4g.small)      | ~$14 (t4g.micro)            |
| Other               | ~$8                   | ~$8                         |
| **Total**           | **~$95–125**          | **~$36–45**                 |

Figures are order-of-magnitude for us-east-1; confirm with the AWS pricing
calculator before committing.

**What is given up**, stated plainly so it is a decision rather than a surprise:

- **One instance is a single point of failure.** A hardware failure means
  downtime until the box recovers. The auto-recovery alarm rebuilds it in place,
  keeping the instance id, Elastic IP and volume — but that is minutes, not
  seconds, and there is nothing to fail over to. This is the same posture already
  accepted for Single-AZ RDS.
- **No autoscaling.** Growth is a bigger instance, by hand.
- **You own the box** — OS patching, the Docker daemon, a disk that can fill.
  The disk alarm exists for exactly that.

**What is _not_ given up:** routine deploys still cause no downtime. The
blue/green script starts the new container on the idle port, waits for
`/api/health`, and only then stops the old one — and leaves the old one serving
if the new one never comes up.

## Region — decided, with a caveat on the record

**us-east-1 (N. Virginia)**, chosen by the owner on 2026-08-22.

This supersedes the deferral in `aws-rds-production-plan.md`, which had made the
region contingent on the PDPL data-residency review. It is recorded here rather
than only in `variables.tf` so the decision is deliberate and attributable
rather than implied by a default.

What the choice carries:

- **Personal data leaves the Kingdom.** Saudi students' records — and the
  audience includes minors — sit in Northern Virginia. Saudi PDPL restricts
  cross-border transfer of personal data. This remains a question for the
  client's counsel; the platform being deployable does not settle it.
- **Latency.** Every route in the application is `force-dynamic` and
  server-rendered, so each page load pays a Riyadh↔Virginia round trip of
  roughly 200ms+. Video is unaffected — that is Bunny's CDN, not AWS.
- **Reversal is a migration, not a variable.** Changing region later means
  moving RDS (snapshot, copy across regions, restore, cutover) and re-uploading
  the S3 objects. Cheap while the data is small; not cheap afterwards.

If counsel later requires in-Kingdom residency, do it before real student data
accumulates.

## What exists in code

| File                          | What it creates                                                             |
| ----------------------------- | --------------------------------------------------------------------------- |
| `network.tf`                  | VPC, public/private subnets, internet gateway, S3 endpoint, security groups |
| `database.tf`                 | RDS PostgreSQL 17, KMS key, parameter group                                 |
| `storage.tf`                  | Media bucket, public access blocked, versioning, lifecycle                  |
| `parameters.tf`               | All configuration in SSM Parameter Store                                    |
| `iam.tf`                      | The instance role: S3, Parameter Store, ECR pull, SSM shell                 |
| `registry.tf`                 | ECR repository and lifecycle policy                                         |
| `app.tf`                      | EC2 instance, Elastic IP, cloud-init, log group                             |
| `observability.tf`            | SNS topic, RDS alarms, instance status and auto-recovery                    |
| `files/cloud-init.yaml.tftpl` | Docker, Caddy, and the fetch/deploy/migrate scripts                         |

### The non-negotiables, and where they live

- **`publicly_accessible = false`** on the instance — `database.tf`.
- **Port 5432 from the app's security group only**, by group reference and never
  a CIDR — `network.tf`.
- **No route from private subnets to the internet gateway.** The private route
  table has no `0.0.0.0/0` entry at all — `network.tf`.
- **No SSH port.** Shell access is SSM Session Manager: nothing open, no key
  pair, an audit trail in CloudTrail — `network.tf`, `iam.tf`.
- **IMDSv2 required.** Closes the path from a server-side request forgery in the
  application to theft of the instance's role credentials — `app.tf`.
- **KMS encryption enabled at creation.** It cannot be turned on in place
  afterwards — `database.tf`.
- **`rds.force_ssl = 1`**, plus `sslmode=verify-full` in the connection strings.
  Encryption without verification stops eavesdropping but not impersonation —
  `database.tf`.
- **Deletion protection, final snapshot, and `prevent_destroy`** — three
  independent guards — `database.tf`.
- **The application cannot read the master credential, nor the migration one.**
  The instance policy is scoped to the `/env` parameter path; the DDL credential
  deliberately lives outside it, and the RDS master secret is not granted at all
  — `iam.tf`, `parameters.tf`.

## Order of operations

Terraform cannot express all of this ordering, because parts of it happen inside
the database and inside the registry.

**1. Account hygiene first.** MFA on root, an IAM Identity Center admin, stop
using root, and a budget alarm. None of it needs a decision from anyone.

**2. State backend.** Uncomment the `backend "s3"` block in `versions.tf` and
create the bucket. Local state is fine to `plan` with and wrong to `apply` with.

**3. Apply.** `terraform plan`, read it, then apply. The instance boots, installs
Docker and Caddy, and deliberately does **not** start the application — there is
no schema yet, and a container crash-looping against an empty database is a
confusing way to discover that.

**4. Point DNS at the Elastic IP.** Take `app_public_ip` from the outputs and
create the A record. Caddy cannot obtain a certificate until the name resolves;
Let's Encrypt validates the domain, and no public certificate exists for a bare
address.

**5. Push both images.**

```sh
aws ecr get-login-password --region us-east-1   | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker build -t <repo>:latest .
docker build --target migrate -t <repo>:migrate-latest .
docker push <repo>:latest
docker push <repo>:migrate-latest
```

Both. The migrate target carries the Prisma CLI the runtime image deliberately
does not.

**6. Bootstrap the database.** See below — the part Terraform cannot do.

**7. Real third-party keys.** Terraform seeded placeholders in Parameter Store
and will not overwrite what you replace them with:

```sh
aws ssm put-parameter --name /new-era-production/env/MOYASAR_SECRET_KEY   --value 'sk_test_...' --type SecureString --overwrite
```

The application refuses to start on a `_test_` key with `MOYASAR_MODE=live`, so
a mismatch fails loudly rather than charging real cards against test books.

**8. Set `app_url` and `domain_name`** in `terraform.tfvars` and apply again.
Until `NEXT_PUBLIC_APP_URL` matches the real origin, the origin check rejects
every authenticated write.

**9. Start it.** `sudo new-era-deploy` over an SSM session — the `deploy_command`
output has the full invocation.

## Bootstrapping the database

Terraform creates the credential _containers_ and generates the passwords. It
cannot create the Postgres roles, because that means connecting to a database
that is — correctly — unreachable from anywhere Terraform runs.

Run both files once, from a shell on the instance (`aws ssm start-session`,
then `psql` against the private endpoint), as the RDS master user — its
credential is the `database_master_secret_arn` output:

1. `infra/sql/01-create-database.sql` — creates `newera` with the ICU provider
   and `ar-SA` locale. `database.tf` deliberately omits `db_name` because RDS
   would otherwise create it with the default collation, and Arabic ordering
   would not match development.
2. `infra/sql/02-create-roles.sql` — creates `newera_migrate` (owns the schema)
   and `newera_app` (rows only, no DDL). Take the two passwords from the
   `/env/DATABASE_URL` and `/migrate/DATABASE_URL` parameters — they are inside
   the connection strings Terraform already generated.

The second file ends with a `SELECT` that prints whether each role can create
schema objects. `newera_app` must come back false.

Then run `sudo new-era-migrate` once and confirm it exits 0.

**Create the first administrator with `npm run admin:bootstrap`, never the
seed.** The seed's admin is development-only.

## Releasing a new version

The order is fixed, and it is the reason nothing migrates at boot:

1. Build and push both images with the new tag.
2. `sudo new-era-migrate <tag>`. Confirm exit 0.
3. `sudo new-era-deploy <tag>`.

The deploy script starts the new container on the idle port, waits for
`/api/health`, then stops the old one. Caddy's health checks move traffic
without a reload. **If the new container never becomes healthy the script leaves
the old one serving** and exits non-zero — a failed deploy is not an outage.

Nothing deploys on push. An image reaching the registry should not become
production on its own.

For a breaking schema change, expand → migrate → contract: add the new shape,
move the data, switch the code, and only then remove the old shape, so a
rollback at any point still meets a schema it understands.

## Still open

- [ ] **PDPL sign-off on us-east-1.** The one item that is a legal question
      rather than an engineering one.
- [ ] **Rehearse a restore.** The plan doc is blunt: an untested backup is a
      belief, not a recovery plan. Nothing here has proved a restore works.
- [ ] **Moyasar live credentials.** Usually needs a Saudi commercial
      registration; likely the longest lead time on the whole list.
- [ ] **Bunny Stream library and keys.**
- [ ] Costed proposal now that the region is fixed — the plan doc deliberately
      left cost unpriced until this point.
- [ ] Multi-AZ, and a second NAT gateway, once real students depend on it.
- [ ] Retention for uploads belonging to deleted accounts
      ([media-storage.md](media-storage.md)).
- [ ] A custom domain, and CloudFront in front of the media bucket. Both
      optional: `S3_PUBLIC_BASE_URL` may stay blank and objects stream through
      the application instead.

## Known gaps in the application itself

- **`INTERNAL_JOBS_SECRET` is required in production but nothing reads it.**
  There is no `/api/internal/jobs/*` route, and `ENABLE_EMBEDDED_SCHEDULER` is
  declared in the environment schema and consumed nowhere. The secret is
  generated and injected so the application starts; it currently does nothing.
- **The S3 adapter has never run against real S3.** It is typechecked and the
  container boots with `STORAGE_PROVIDER=s3`, but no upload or read has been
  exercised against a real bucket. First things to test after apply: upload a
  product cover, load it, delete it.
- **`IfNoneMatch` on upload** is a conditional-write feature of current S3. If a
  future storage target does not support it, uploads fail loudly rather than
  silently overwriting — a one-line change in `s3-provider.ts`.
