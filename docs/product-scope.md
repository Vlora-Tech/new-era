# Product scope

## What this is

An Arabic-only, right-to-left, light-theme platform for Saudi secondary-school
students preparing for **اختبار القدرات العامة**, selling exactly two things,
each bought once:

- **Video courses** — modules, lessons, protected playback, and an optional short
  quiz attached to a lesson.
- **Exam simulators** — timed sections, autosaved answers, irreversible section
  advance, and a training-only performance review.

## Fixed decisions

These are settled, and the code assumes them rather than accommodating both ways:

- Arabic only. No English interface, no locale switcher, no `/en`, no i18n
  scaffolding held in reserve.
- Right-to-left from the document root.
- Light theme only. No dark tokens, no toggle.
- Saudi riyal, stored as integer halalas.
- Business time is `Asia/Riyadh`; storage is UTC.
- One-time purchases. No subscriptions, no cart, no coupons, no bundles.
- Registration is immediate. No one-time codes, no email or phone verification,
  no administrator approval, no application form.
- No public administrator sign-up.
- Access follows a server-verified payment. No receipt uploads, no manual
  approval.
- Bunny Stream for video; PostgreSQL for data; Moyasar for payments.

## Journeys

**A visitor** reads the homepage, browses courses and simulators, opens a product
page, and sees an honest empty state when nothing is published rather than
placeholder content.

**A student** registers and is signed in immediately; buys one product; watches
lessons that resume where they stopped and complete on watched time; takes a
simulator attempt with a server-authoritative clock, autosaved answers and
irreversible section advance; and reviews a result labelled as training
analytics, broken down by skill.

**An administrator** signs in through an account created by a deliberate CLI
command; manages products, courses, the question bank and simulator versions;
reviews orders, entitlements and attempts; and can grant or withdraw access with
a recorded reason.

## Out of scope

Not "later" — deliberately absent, and adding any of them is a scope change:

subscriptions and recurring payments; carts, coupons, bundles, gifting,
affiliates and referrals; scheduled publishing; one-time codes and email or phone
verification; administrator approval queues and student applications; manual
receipts, bank transfer review, PayPal, crypto, wallets; multilingual or English
interface, language switching, dark mode; certificates, badges, points,
leaderboards, streaks, comments, forums, messaging, live classes; multiple
instructors and marketplace payouts; native mobile apps; AI question generation,
chatbots, automated tutoring; scraping or importing real test questions,
`تجميعات`, or official imagery; official-score, percentile or admission
prediction; analytics SDKs, A/B testing, CRM.

## Present but honest about their state

- **Legal pages** carry placeholder text behind a visible "not final" notice.
  Publishing plausible unreviewed terms would read as settled policy.
- **Moyasar** has a complete, tested boundary but has never run against real
  credentials.
- **Bunny** is integrated but no video is attached in the seed, because inventing
  a GUID would produce a lesson that looks playable and is not.
- **Production storage** is unchosen, pending the owner's approval.

## Launch blockers

Not engineering backlog — the product must not serve real students until each is
resolved. See [content-and-legal-checklist.md](./content-and-legal-checklist.md).

1. Original or licensed question content, with provenance.
2. A Saudi personal-data review covering minors, lawful basis, retention and
   cross-border transfer.
3. A VAT and e-invoicing decision from the client and their accountant.
4. Final legal text and the client's entity details.
5. The refund window and conditions.
