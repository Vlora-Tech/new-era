# Production database plan — Amazon RDS for PostgreSQL

> **Status: PLAN ONLY. NOTHING HAS BEEN CREATED.**
>
> No AWS resource has been provisioned, no Terraform has been applied, no CLI or
> console action has been taken, and no billable object exists as a result of
> this work. Everything below is a proposal awaiting the owner's decisions and
> explicit approval.

## Decisions required before anything is created

None of these can be assumed on the owner's behalf; each changes the cost or the
security posture of the result.

| #   | Decision                                         | Why it matters                                                                                           |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1   | AWS region                                       | Latency to Saudi users, and where personal data physically resides — which the privacy review depends on |
| 2   | Application hosting platform                     | Decides whether the database can be reached privately at all                                             |
| 3   | Existing VPC and subnet layout, or a new VPC     | Determines the network design                                                                            |
| 4   | Expected concurrent users and connection pattern | Instance size, and whether a proxy is warranted                                                          |
| 5   | Budget ceiling and availability target           | Multi-AZ roughly doubles instance cost                                                                   |
| 6   | Whether staging is separate from production      | Two instances, or one with separate databases                                                            |
| 7   | Backup retention and recovery objectives         | Proposed 14 days; confirm against the retention policy                                                   |
| 8   | Credential strategy                              | Secrets Manager rotation, or IAM database authentication                                                 |

Question 2 is the one that most often goes wrong. If the frontend is hosted
outside AWS, the answer is **not** to make the database publicly accessible. It
is to place the application inside the VPC, or to connect privately. A publicly
reachable production database is not an acceptable outcome of a hosting choice.

## Proposed baseline

Subject to the decisions above.

### Engine

- PostgreSQL 17, matching the local major version exactly.
- The database created explicitly with the ICU provider and the `ar-SA` locale,
  so Arabic ordering matches development:
  ```sql
  CREATE DATABASE newera
    TEMPLATE template0
    ENCODING 'UTF8'
    LOCALE_PROVIDER icu
    ICU_LOCALE 'ar-SA';
  ```
  ICU library versions will still differ between the Alpine development image
  and RDS. Collation-aware indexes must be rebuilt after a major ICU change.
  Uniqueness-critical columns are ASCII-normalised in the application precisely
  so that no unique index can be corrupted by such a difference.

### Network

- Private subnets across at least two Availability Zones.
- **`PubliclyAccessible = false`.** Not negotiable.
- A security group permitting TCP 5432 **only** from the application's security
  group. Never `0.0.0.0/0`, and never a raw CIDR where a security-group
  reference would do.
- No database subnet route to an internet gateway.

### Durability

- Multi-AZ for production. Single-AZ is a legitimate, deliberate choice for a
  low-cost staging instance, and should be recorded as such.
- Encryption at rest with KMS, enabled **at creation** — it cannot be turned on
  in place afterwards.
- Automated backups with point-in-time recovery. Proposed retention: 14 days.
- Deletion protection enabled.
- A final snapshot required on deletion.
- **A restore must actually be rehearsed.** An untested backup is a belief, not
  a recovery plan.

### Access

- TLS enforced with the `rds.force_ssl=1` parameter, and the application
  verifying the server certificate against the current RDS CA bundle with
  hostname verification. Encryption without verification stops eavesdropping but
  not impersonation.
- Master credentials in AWS Secrets Manager with rotation.
- Two application identities, not one:
  - a **runtime** user with `SELECT`/`INSERT`/`UPDATE`/`DELETE` on application
    tables and no DDL rights;
  - a **migration** role with DDL rights, used only by the controlled release
    job.
    The runtime credential lives in its own secret. **The application must never
    fall back to the master secret** — a runtime compromise should not be able to
    drop a table.

### Connections

- Bound the Prisma pool below the instance's `max_connections`, leaving headroom
  for migrations and administrative sessions.
- RDS Proxy only when the deployment is serverless or autoscaling, or genuinely
  produces high short-lived connection churn. A stable container deployment
  should start with a bounded pool; a proxy adds cost and its own failure mode.
  If a proxy is adopted, watch for session pinning rather than assuming it makes
  connection limits disappear.
- The runtime URL points at the proxy when one exists. Migrations use a separate
  direct URL, from inside the VPC, in the release job only.

### Observability

- CloudWatch Database Insights, with PostgreSQL logs exported.
- Alarms on CPU, freeable storage, connection count, read and write latency, and
  failed connection attempts.
- A tested minor-version maintenance window. Major upgrades performed
  deliberately, never automatically.

## Migration strategy

Migrations are **never** applied automatically at application startup. A process
that migrates on boot will, on the day it matters, run a schema change from
several instances at once during a rolling deploy.

The intended flow:

1. Generate the migration locally against the Docker database.
2. CI applies it to a clean database and runs the suite.
3. A controlled release step runs `prisma migrate deploy` once, from inside the
   VPC, using the migration role.
4. Only then does the new application version roll out.

For a breaking change, expand → migrate → contract: add the new shape, move the
data, switch the code, and only then remove the old shape — so a rollback at any
point still meets a schema it understands.

## Estimated shape of the cost

Deliberately unpriced. Cost depends on region, instance class, storage, Multi-AZ,
backup retention and data transfer — all of which are open decisions above.
Quoting a figure before those are settled would be a guess presented as a budget.

Once decisions 1, 5 and 6 are made, a costed proposal can be produced from the
AWS pricing calculator and attached here.

## What happens next

1. The owner answers the eight decisions.
2. A costed, specific proposal is written into this document.
3. The owner approves it explicitly.
4. Only then is any resource created, whether by Terraform or by hand.

A reviewed Terraform skeleton may be prepared in advance, but it stops at
`terraform plan`. `terraform apply` requires step 3.
