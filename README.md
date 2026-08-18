# بناء العهد الجديد — New Era learning platform

An Arabic-only, right-to-left, light-theme platform for Saudi secondary-school
students preparing for **اختبار القدرات العامة**.

Two things are sold, each bought once:

- **Video courses** — modules, lessons, protected playback, and a short
  multiple-choice quiz attached to a lesson.
- **Exam simulators** — timed sections, autosaved answers, irreversible section
  advance, and a training-only performance review.

The interface is Arabic throughout. Source code, route segments and this
documentation are English.

## Requirements

- Node.js 22 or newer (developed on 24)
- Docker, for the local PostgreSQL 17 database
- npm

No AWS, Moyasar, Bunny or storage account is needed to run the project locally.

## Getting started

```bash
cp .env.example .env       # then set SESSION_SECRET and INTERNAL_JOBS_SECRET
npm install
npm run db:up              # PostgreSQL 17 on localhost:5544
npm run db:migrate         # apply migrations
npm run db:seed            # fictional development content
npm run dev
```

Generate the two secrets with `openssl rand -base64 48` (or any 32+ character
random string). The application refuses to start without them.

Seeded development accounts:

| Role          | Address                   | Password                     |
| ------------- | ------------------------- | ---------------------------- |
| Administrator | `ADMIN_EMAIL` from `.env` | `ADMIN_PASSWORD` from `.env` |
| Student       | `student@example.com`     | `NewEraLocal!2026`           |

The seed never runs against production, and it never overwrites the password of
an account that already exists.

## Commands

| Command                           | Does                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                     | Development server                                                 |
| `npm run build` / `npm start`     | Production build and serve                                         |
| `npm run typecheck`               | TypeScript, no emit                                                |
| `npm run lint`                    | ESLint                                                             |
| `npm run format` / `format:check` | Prettier                                                           |
| `npm test` / `test:watch`         | Vitest unit and integration suites                                 |
| `npm run test:e2e`                | Playwright                                                         |
| `npm run db:up` / `db:down`       | Start and stop PostgreSQL                                          |
| `npm run db:migrate`              | Create and apply a migration in development                        |
| `npm run db:deploy`               | Apply existing migrations (release step)                           |
| `npm run db:seed`                 | Idempotent development seed                                        |
| `npm run db:reset-test`           | Reset **only** `new_era_test`; refuses any other target (see note) |
| `npm run db:studio`               | Prisma Studio                                                      |
| `npm run admin:bootstrap`         | Create the first administrator                                     |

### A note on `db:reset-test`

The script checks that `TEST_DATABASE_URL` names `new_era_test` and refuses to
run otherwise, because `prisma migrate reset` drops every table in whatever it is
pointed at.

Prisma adds a second gate of its own: when it detects that it is being driven by
an automated agent rather than a person, it refuses a destructive reset until a
human has explicitly consented. Run the command yourself in a terminal and it
behaves normally.

If the reset ever fails, the script says so and exits non-zero. It will not
report success without having reset anything — which is the failure mode that
matters, since a test suite would then run against stale data and quietly prove
nothing.

Integration tests create their own uniquely-named fixtures and do not clean up
after themselves, so `new_era_test` accumulates rows over time. That is harmless
for correctness; reset it when it gets large.

## The first administrator

There is no public administrator sign-up, and the seed is a development
convenience only. In production:

```bash
npm run admin:bootstrap
```

It prompts for an address, a display name and a hidden password; it refuses to
run when an administrator already exists; and it never resets an existing
password. For an automated first boot, set `ADMIN_BOOTSTRAP_PASSWORD` for a
single run — the command then tells you to remove it, and nothing else in the
codebase ever reads that variable.

## Database

PostgreSQL 17 via `docker-compose.yml`, on host port **5544** so a locally
installed PostgreSQL does not clash.

The cluster is initialised with the **ICU** collation provider and the `ar-SA`
locale. On Alpine this is not optional: musl ignores libc collations other than
`C`, so Arabic would otherwise sort by code point. Uniqueness-critical columns
are ASCII-normalised in the application layer so that uniqueness never depends on
collation, which also means an ICU version difference between Alpine and a
managed host cannot corrupt a unique index.

Some constraints cannot be expressed in the Prisma schema language and are
appended by hand to the initial migration:

- a unique index on `lower(email)`, so case-insensitive uniqueness holds even if
  a write path forgets to normalise;
- a partial unique index enforcing exactly one correct option per question;
- a partial unique index allowing one live full-simulation attempt per student
  per exam version, which is what makes attempt creation idempotent;
- `CHECK` constraints keeping money non-negative and currency `SAR`.

Migrations are never applied automatically at startup. Generate them locally,
verify them against a clean database, and apply them once through a controlled
release step.

## Provider modes

Everything external has a boundary with a local implementation:

| Variable           | Development | Notes                                                      |
| ------------------ | ----------- | ---------------------------------------------------------- |
| `PAYMENT_PROVIDER` | `mock`      | Rejected at startup when `NODE_ENV=production`             |
| `MOYASAR_MODE`     | `test`      | Key prefixes are cross-checked against the mode            |
| `BUNNY_STREAM_*`   | unset       | Playback reports itself unavailable rather than pretending |
| `STORAGE_PROVIDER` | `local`     | Rejected in production; uploads disable themselves         |

Card details go from the browser to the payment provider directly. They never
reach this application's servers and are never logged.

## Testing

```bash
npm test          # Vitest, against new_era_test
npm run test:e2e  # Playwright
```

Integration tests point at `new_era_test` through `TEST_DATABASE_URL`, so a suite
that truncates tables cannot touch development data.

## Documentation

| Document                                                              | Covers                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [architecture.md](docs/architecture.md)                               | Layers, the server/client boundary, authentication, provider boundaries |
| [haitham-reference-audit.md](docs/haitham-reference-audit.md)         | What was reused, rewritten and excluded from the reference project      |
| [content-and-legal-checklist.md](docs/content-and-legal-checklist.md) | Intellectual-property rules and the outstanding legal blockers          |
| [client-inputs-required.md](docs/client-inputs-required.md)           | Everything still needed from you, ordered by what it unblocks           |
| [brand-assets-needed.md](docs/brand-assets-needed.md)                 | Why the header uses set type, and which assets to commission            |

## Known state

This is an MVP under construction. What is **not** finished is listed honestly in
the handoff notes rather than implied to be working. In particular, commerce is
not production-ready until the tax and invoicing questions in the legal checklist
are answered, and the platform must not serve real students until the personal
data review recorded there is complete.
