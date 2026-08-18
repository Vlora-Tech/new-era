# بناء العهد الجديد — project overview

An Arabic-only, right-to-left training platform for Saudi secondary-school
students preparing for **اختبار القدرات العامة** (the General Aptitude Test).

The interface is Arabic throughout. Source code, route names and documentation
are English.

---

## The idea

Two things are sold, each bought once, each granting permanent access:

| Product | What it is |
| --- | --- |
| **دورة** (course) | Video lessons grouped into modules, with a short quiz after a lesson |
| **محاكي اختبار** (exam simulator) | A timed, sectioned mock exam that reproduces the real test's shape |

A student registers, buys a product, and gets access to it. Courses teach;
simulators measure. Results are explicitly **training indicators, never an
official score** — the platform is independent of the National Center for
Assessment, and says so on every results screen.

### Two constraints that shape everything

1. **Content law.** The regulation governing the official exam treats its
   questions as confidential intellectual property. The platform will only
   carry original or documented-licensed material — never leaked questions,
   تجميعات, or "questions that appeared before". Every question row carries a
   required `authorOrLicensor` and a rights declaration.
2. **Personal data.** A large share of users are minors. Data-residency and
   guardian-consent questions are still with legal counsel, and they are what
   currently block a production launch and the choice of hosting region.

---

## Current state

**Working end to end, locally.** The whole product runs with no third-party
account: payments, video and file storage each sit behind an interface with a
local or mock implementation.

| Area | State |
| --- | --- |
| Public catalogue, legal pages, register / login | ✅ built |
| Student dashboard, course player, progress tracking | ✅ built |
| Exam engine — timed sections, autosave, irreversible advance, scoring | ✅ built |
| Checkout and entitlements (mock payment provider) | ✅ built |
| Admin dashboard — all 15 screens | ✅ built |
| Media upload + Bunny video registration | ✅ built |
| Real payments (Moyasar) | ⛔ needs live credentials |
| Video playback | ⚙️ Bunny credentials configured; no videos attached yet |
| Production deployment | ⛔ blocked on the legal review |

Roughly: **45 pages, 39 admin API routes, 40 services, 461 passing tests.**

Seed data: 264 practice questions, 4 products, 2 courses, 2 simulators,
32 accounts. All sample content authored for this project.

### The admin dashboard

Every screen is built and writes an audit row for each change:

منتجات · دورات · بنك الأسئلة · محاكيات الاختبار · الطلاب · الطلبات والمدفوعات ·
الصلاحيات والوصول · المحاولات والنتائج · الإعدادات · سجل النشاط

A few deliberate rules worth knowing:

- **Exam attempts are read-only.** No admin screen can alter a student's answers
  or score — that would destroy the record's evidentiary value.
- **Orders don't move money.** The admin action is *re-check with the provider*;
  refunds happen at Moyasar and are reconciled back.
- **Published exam versions are immutable.** Editing one would change an exam
  under a student mid-attempt, so the flow is clone-to-new-draft.
- **The audit log has no delete or edit endpoint**, for anyone.
- **Publishing a question snapshots it**, so a live attempt never changes.

---

## Stack

- **Next.js 16** (App Router, React 19) · **TypeScript** · **Tailwind 4**
- **PostgreSQL 17** via **Prisma 6** — ICU collation, `ar-SA` locale
- **Zod 4** for every request body; **bcrypt** passwords; **jose** sessions
- **Vitest** (unit + integration) and **Playwright** (end-to-end)

### Architecture in one line

```
route handler / page  →  service  →  repository / provider  →  Postgres / Moyasar / Bunny
```

One direction only. A page never queries raw; a service never reads a cookie or
returns an HTTP status. Every user-facing Arabic string lives in one `COPY`
object, so nothing is hardcoded in a component.

### External providers

| Boundary | Development | Production |
| --- | --- | --- |
| Payments | mock, refused in production | Moyasar |
| Video | Bunny Stream (identifiers registered by an admin) | Bunny Stream |
| File storage | local disk under `.storage/` | S3, pending approval |

---

## Running it

```bash
cp .env.example .env      # set SESSION_SECRET and INTERNAL_JOBS_SECRET
npm install
npm run db:up             # PostgreSQL 17 on localhost:5544
npm run db:migrate
npm run db:seed
npm run dev               # http://localhost:3005
```

Seeded accounts: an administrator from `ADMIN_EMAIL`, and
`student@example.com`. Both use the password in `.env`.

Note that an administrator **cannot buy a product** — checkout requires the
`STUDENT` role, so use the student account to test purchases.

---

## What's still needed

1. **Legal advice on data residency and minors' consent** — blocks the hosting
   region and the launch.
2. **VAT / ZATCA e-invoicing decision** — until then a receipt is not a tax
   invoice and no VAT is shown.
3. **Real question content** with rights documentation.
4. **Live Moyasar credentials** and a production domain.
5. **Brand assets** — a vector logo and a proper favicon set.

See `docs/client-inputs-required.md` for the full list, and
`docs/architecture.md` for how the layers fit together.
