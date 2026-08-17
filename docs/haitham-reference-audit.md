# Reference audit: the Haitham LMS

The brief names an existing Next.js LMS as the architectural reference for this
build. This document records what was reused as an idea, what was rewritten, and
what was deliberately left behind.

## What was inspected, and how

Two copies of the reference exist on this machine:

| Path | Contents | Used |
|---|---|---|
| `D:\A-Projects\haitham` | The canonical project, including `.env.local` and `credentials.txt` | **No.** Never opened. |
| `d:\A-Projects\Vlora\LMS\haitham` | A sanitised copy: same source, no secret-bearing files, `.env.example` present | Yes, read-only |

All inspection used the sanitised copy. No secret-bearing file was read, and
nothing in either directory was modified, formatted, or committed. Only variable
*names* were taken from `.env.example`; no value was copied.

The reference runs Next.js 16.2.5, React 19.2.4, Tailwind 4, Mongoose 9, `jose`,
`bcryptjs`, Zod 4, React Hook Form, Sonner, Lucide, Cloudinary and Resend.

## Deviation from the brief: target directory

The brief specifies `D:\A-Projects\new-era-platform`. The owner chose
`d:\A-Projects\Vlora\LMS\new-era-platform` instead, so the new project sits
inside the working session's workspace beside the sanitised reference. Nothing
else about the layout changed.

## Deviation from the brief: Next.js version

The brief sets the reference's versions as the compatibility baseline "unless the
audit identifies a concrete reason to change them". There is one.

`create-next-app@16.2.5` installs a Next.js with ten open advisories, including
**a middleware/proxy bypass in App Router applications**
([GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6),
[GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24)). This
product routes every protected surface past a proxy check, so a bypass in that
layer is directly load-bearing.

The project therefore runs **Next.js 16.3.1**, the patched release in the same
major line. `npm audit` reports zero vulnerabilities. React stays pinned at
19.2.4 to match the reference exactly.

## Reused as an idea

None of the reference's code was copied. These patterns were adopted:

- **Layering.** `route handler → service → model`, with guards that throw an
  error carrying an HTTP status which the handler maps. This build adds the
  `repositories/` layer the brief asks for.
- **Session design.** A `jose` HS256 token in an HTTP-only, `SameSite=Lax`
  cookie, with the algorithm pinned on verify and every claim shape-checked
  rather than trusted.
- **`sessionVersion` as an invalidation lever.** The reference re-checks a
  version counter on each protected request so a blocked account stops working
  immediately instead of at token expiry. Adopted, with one change: the
  reference bumps the counter on *every login*, which silently enforces
  single-device sessions. The brief says not to, so login here leaves it alone
  and only blocking or a forced sign-out increments it.
- **Two-tier dashboard gating.** A gate layout with no chrome, wrapped by a
  `(with-shell)` route group. This is what lets the full-screen exam workspace
  inherit authentication without inheriting a sidebar.
- **One Zod schema per form, shared by the client and the server**, with Arabic
  messages in the schema, and separate `z.input`/`z.infer` types where coercion
  changes the shape.
- **A central Arabic copy object** so wording cannot drift between a page, a
  toast and an email.
- **Bunny playback signing.** `SHA256_HEX(securityKey + videoId + expires)`
  against `iframe.mediadelivery.net`, behind an entitlement check, with a moving
  watermark carrying the viewer's identity as a deterrent.
- **Audit entries around administrator mutations.**

## Rewritten

| Reference | This build | Why |
|---|---|---|
| MongoDB + Mongoose | PostgreSQL 17 + Prisma with versioned migrations | The brief requires it; the domain is relational, and money and entitlements need real constraints |
| Flat lessons | `course → modules → lessons → optional quiz` | Required curriculum shape |
| Application + approval registration | Immediate active registration | Required; no OTP, no review queue |
| Manual receipts, PayPal, crypto, geographic pricing | One-time SAR orders through Moyasar | Required |
| Fake progress (a heartbeat that posted `progressSeconds: 0`, consumed by nothing) | Real progress, bounded by elapsed server time, with resume and a completion threshold | The reference's progress feature did not work |
| No question bank | Central bank with versions, provenance, stimuli, workflow, blueprints and immutable attempt snapshots | The simulator is the product |
| No environment validation | One Zod-validated module that fails fast and refuses unsafe production combinations | The reference read `process.env` ad hoc |
| No rate limiting, CSRF, CSP or security headers | All present | The reference had none of these |
| Cloudinary | `StorageProvider` boundary, local in development, production adapter deferred pending owner approval | Cloudinary is out of scope |
| Dark green theme with glow, glass and animated blobs | Light-only New Era palette, flat surfaces, hairline borders | Required identity |

## Deliberately excluded

- `.git`, `.next`, `node_modules`, any `.env*` value, `credentials.txt`, and
  every hardcoded client id and payment identifier found in the reference.
- `Root/`, `Root.rar`, `source/`, `other-pages/`, and the unrelated `offer/` and
  `eternal-game/` funnels.
- The dark theme, the green palette, glow and glass utilities, animated blobs,
  and the marquee and tilt-card motion components.
- Applications, approval queues, application questions, coupons, manual
  receipts, PayPal, crypto, geographic pricing, and Resend email (email is out
  of scope for this MVP).
- `framer-motion`. Motion here is short, functional CSS that honours
  `prefers-reduced-motion`.

## Defects in the reference that this build avoids

Recorded because each one is a trap worth not repeating:

1. **The progress endpoint verified nothing.** `PATCH /api/watch-progress/[lessonId]`
   checked neither that the lesson existed nor that the caller was enrolled, so
   any signed-in user could write progress against any id. Here, progress
   requires a live, entitlement-checked playback session.
2. **Playback tokens expired mid-video.** A fixed 45-minute token with no refresh
   path breaks any longer lesson. Here the token is sized to the video's duration
   and the client refreshes before expiry.
3. **`videoAssetId` accepted any non-empty string**, so a typo produced a lesson
   that looked playable and was not. Here the GUID is format-validated and, when
   a management key is configured, confirmed against the library.
4. **The video provider factory silently fell back to Bunny** for an unknown
   provider name instead of failing.
5. **Raw error messages reached clients**, including an English string naming
   the missing Bunny environment variables. Here every unexpected error is
   logged server-side and answered with a generic Arabic message.
6. **The audit helper was duplicated across services and had no reader.** The
   README advertised an audit log viewer that did not exist.
7. **A payment approval could half-succeed.** When running without transactions,
   a coupon-exhaustion conflict could leave the receipt already marked approved.
