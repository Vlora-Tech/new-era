# Content and legal checklist

Items marked **BLOCKER** must be resolved before the platform serves real
students. They are client and counsel decisions; this project deliberately does
not guess at them.

## 1. Question content and intellectual property

The regulation governing the official examination treats its questions, forms and
related material as confidential intellectual property, and separately prohibits
copying, disclosing, writing down, recording or photographing test content and
screens.

The platform's rules follow from that:

- Only original New Era questions, or material covered by documented written
  licensing, may enter the bank.
- Never ingest, store or publish leaked questions, `تجميعات`, screenshots,
  recordings, or anything described as "questions that appeared previously". The
  client's original phrase `الأسئلة التي ظهرت في الاختبارات السابقة` **must not**
  be used in marketing unless documented rights exist and counsel approves.
- Official practice questions and instructional wording may not be copied or
  rehosted anywhere — free surface, paid product, seed, demo or marketing. Link
  to the official source instead.
- Every question stores author or licensor, provenance, a rights declaration,
  reviewer and version. Publication is blocked when any of those is missing.
- `اختبار القدرات العامة` is used descriptively only. No official name or mark
  appears in the platform name, domain, favicon, app icon, artwork or metadata in
  any way that could imply sponsorship, approval or affiliation.
- No official logo, no official screen, no pixel copy of an official interface.

### What ships in the seed today

Thirty questions, all authored for this platform, all carrying the provenance
note `محتوى تدريبي تجريبي من إعداد المنصة` and a rights declaration of
`ORIGINAL`. They exist so the engine has a pool to select from in development.

**BLOCKER — real content.** The client must supply original or licensed questions
before launch, with provenance for each.

## 2. Independence statement

Displayed on every simulator page, before every full attempt, and on every result:

> منصة نيو إيرا منصة تدريبية مستقلة، وليست تابعة لهيئة تقويم التعليم والتدريب أو
> للمركز الوطني للقياس، ولا تمثل نتائجها نتيجة رسمية أو ضمانًا لدرجة الاختبار.

Results are labelled `نتيجة تدريبية` or `مؤشر أداء تدريبي`. The product does not
compute, store or display a percentile, an official score, a pass/fail verdict,
an admission probability, or any prediction of an official result. The schema has
no column for one.

## 3. Source dating

The seeded preset records the official guide's URL and
`sourceRetrievedAt: 2026-08-17`, described in the stored note as **the date New
Era reviewed the source** — not the source's own publication or version date.

The source establishes a 125-minute total. It does **not**, in the material
collected for this build, establish an equal 25-minute split across the five
sections. The seeded 25-minute section length is therefore labelled in the data
itself as a New Era implementation default derived from the total, and every
section duration is versioned and editable.

**Action:** re-check the official guide before launch and again periodically; the
structure is stored as editable data precisely so it is not hardcoded as an
eternal rule.

## 4. Personal data — BLOCKER

The intended audience is secondary-school students, so some users will be minors.

`ConsentRecord` stores the exact terms and privacy versions accepted and when.
That records what happened. It does **not** by itself establish a lawful basis
for processing, and it is not a substitute for the review below.

The client's Saudi-qualified counsel must determine, for the client's own legal
entity and processing activities:

- the lawful basis for processing;
- whether a guardian's consent is required, and from what age — **this project
  has deliberately not invented an age threshold or a guardian flow**;
- retention and deletion periods for accounts, attempts, payment metadata and
  audit logs;
- processor locations and any cross-border transfer;
- how a data-subject request is received and answered.

Until this is documented, the privacy page carries a visible notice that it is a
non-final draft, and launch is blocked.

## 5. Tax and invoicing — BLOCKER

Whether VAT applies, and whether the client falls inside the e-invoicing
mandate, depends on the client's legal entity and tax registration. Both are
client and accountant decisions.

Until they are documented:

- the order receipt is **not** labelled a tax invoice, and must not be;
- no VAT is calculated or displayed;
- commerce is not "production ready" regardless of whether the payment
  integration works.

## 6. Legal pages — BLOCKER

`/terms`, `/privacy` and `/refund-policy` currently carry placeholder wording
behind a visible "not final, not reviewed" notice. Publishing plausible-looking
terms that nobody approved would be worse than an obvious placeholder, because it
reads as settled policy.

Still required from the client: legal entity name, commercial registration,
address, support contact, and the final refund window and conditions.

## 7. Marketing claims

Permitted: `تدريبات أصلية تحاكي المهارات والأنماط المعلنة رسميًا لاختبار القدرات العامة.`

Not permitted anywhere: invented student counts, success rates, ratings,
testimonials, partner logos, live-activity or "students online" indicators,
countdown urgency, or any guarantee about an official score. The seeded data
contains none of these, and the homepage shows an honest empty state when the
catalogue is empty rather than filling the space.

## 8. Brand assets

The supplied logo is a raster stacked lockup that may not be cropped, recoloured
or have its symbol extracted. A horizontal lockup and a symbol-only mark must be
commissioned for compact placements and the favicon. See
[brand-assets-needed.md](./brand-assets-needed.md).

## Summary

| Item | Owner | State |
|---|---|---|
| Original or licensed question content | Client | **BLOCKER** |
| PDPL review, including minors | Client's counsel | **BLOCKER** |
| VAT and e-invoicing decision | Client + accountant | **BLOCKER** |
| Final legal page text and entity details | Client | **BLOCKER** |
| Refund window and conditions | Client | **BLOCKER** |
| Compact brand lockup and favicon | Client's designer | Required |
| Re-check the guide's source date | New Era | Recurring |
| Independence statement | New Era | Implemented |
| No official score or prediction | New Era | Implemented, enforced by the schema |
