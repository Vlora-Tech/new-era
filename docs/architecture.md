# Architecture

## Layers

```
route handler / page / server action
        ↓            (validates input, checks authorization, maps errors)
      service
        ↓            (business rules, transactions, invariants)
repository / provider
        ↓            (Prisma queries, external HTTP)
   PostgreSQL / Moyasar / Bunny / storage
```

The direction is one-way. A page never issues a raw database query and never
speaks a provider's vocabulary; a service never reads a cookie or returns an HTTP
status. The rule keeps authorization in one place per surface and makes a
provider replaceable without touching a screen.

## Directory map

| Path                        | Holds                                                                     |
| --------------------------- | ------------------------------------------------------------------------- |
| `src/app/(public)/`         | Marketing, catalogue, legal, sign-in and registration                     |
| `src/app/dashboard/`        | Student area. A gate layout, then a `(with-shell)` group that adds chrome |
| `src/app/admin/`            | Administrator area, same two-tier shape                                   |
| `src/app/exam/[attemptId]/` | Full-screen attempt workspace, no site navigation                         |
| `src/app/api/`              | Route handlers                                                            |
| `src/components/ui/`        | Design-system primitives                                                  |
| `src/components/layout/`    | Shells, header, footer, brand marks                                       |
| `src/lib/`                  | Cross-cutting: env, db, auth, security, formatting, copy                  |
| `src/repositories/`         | Query helpers over Prisma                                                 |
| `src/services/`             | Business logic, grouped by domain                                         |
| `src/validators/`           | Zod schemas shared by client forms and server handlers                    |
| `prisma/`                   | Schema, migrations, seed                                                  |
| `docs/`                     | This documentation                                                        |
| `tests/`                    | Vitest unit and integration suites, Playwright end-to-end                 |

## Server and client boundary

Server Components are the default. `'use client'` appears only where interaction
requires it: the drawers, the forms, the exam workspace, the video player.

`import 'server-only'` marks every module that touches the database, a secret, or
a provider. Importing one of those from a client component fails the build rather
than shipping a secret to a browser.

## Authentication

Three layers, each doing only what it can do correctly:

1. **`src/proxy.ts`** — an optimistic check. Next.js 16 replaces the deprecated
   `middleware` convention with `proxy`. It verifies the cookie's signature and
   nothing else: it runs on every matched request including prefetches, and it
   cannot see whether an account was blocked a minute ago, because that lives in
   the database. It saves a signed-out visitor a wasted page load. **It is not
   the access control.**
2. **`src/lib/auth/guards.ts`** — the real decision. `getCurrentUser()` loads the
   user on every protected request and returns null when the account is missing,
   blocked, or carrying a retired `sessionVersion`. It is wrapped in React's
   `cache`, so a layout, a page and a component checking the session cost one
   query per render rather than three.
3. **Service-level checks** — entitlement is verified where access is granted,
   not merely where a link is drawn. Hiding a navigation item is not
   authorization.

### Sessions

A `jose` HS256 token in an HTTP-only, `SameSite=Lax`, `Secure`-in-production
cookie. The payload is `{ sub, role, sv }` and nothing else: since every
protected request loads the user anyway, putting a name or an address in the
token would only create a second copy that can go stale.

`sv` is the session version. Blocking an account or forcing a sign-out
increments the column, which retires every outstanding token at once. Logging in
does **not** increment it, so a student may stay signed in on more than one
device — the counter is a revocation lever, not single-session enforcement.

## Provider boundaries

Each external dependency sits behind a narrow interface with a development
implementation, so the whole product runs locally with no third-party account:

| Boundary          | Development                                            | Production                                     |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `PaymentProvider` | Mock, refused in production by three independent gates | Moyasar, test or live by configuration         |
| `VideoProvider`   | Unconfigured; the player reports it honestly           | Bunny Stream                                   |
| `StorageProvider` | Local disk under `.storage/`                           | Deferred, pending owner approval of a provider |

## Errors

Route handlers return one envelope: `{ ok: true, data }` or
`{ ok: false, error: { code, message } }`, where `message` is Arabic and safe to
display. A recognised failure carries its own message; anything unexpected is
logged with its stack and answered with a generic sentence, so a connection
string or a provider's English error cannot leak through an error path.

Logs are structured JSON with a request id. Values are redacted **by key** before
writing, so attaching an object to a log entry cannot accidentally publish a
secret.

## Failure is not emptiness

A query that throws renders a distinct Arabic error state, never an empty list or
a zero. The two are separate components (`EmptyState` and `ErrorState`) precisely
so the distinction cannot be lost by accident: an outage displayed as "no orders"
reads as a fact about the business.
