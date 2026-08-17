# What the client needs to supply

Ordered by what unblocks the most. Items 1 and 2 are the critical path; nothing
about AWS can proceed past item 1.

---

## 1. Data-residency and personal-data advice — BLOCKS AWS AND LAUNCH

**Who:** a Saudi-qualified lawyer or privacy adviser.
**Blocks:** the AWS region, which blocks costing, provisioning and deployment.
Also blocks launch on its own.

The platform's audience is secondary-school students, so some users will be
minors. That single fact drives most of the questions below.

### Questions to put to counsel

Copy this section to them directly.

> **About the business**
> We operate an online training platform for students preparing for اختبار
> القدرات العامة. Users register with a name, email address, optional mobile
> number, and a password. We store their lesson progress, their exam attempts and
> answers, and their order and payment references. Card details are handled
> entirely by our payment provider and never reach our servers. A substantial
> share of our users will be under 18.
>
> **What we need you to determine, for our legal entity and these activities:**
>
> 1. What is our lawful basis for processing this personal data?
> 2. Do we need a guardian's consent, and below what age? What form must it take,
>    and what evidence of it must we retain? _(We have deliberately not invented
>    an age threshold or a guardian flow — we need your answer first.)_
> 3. How long may we retain: account records, exam attempts and answers, payment
>    metadata, audit logs? What must happen to each when an account is deleted?
> 4. May personal data be stored outside Saudi Arabia? Specifically, may we host
>    our database in a cloud region in the UAE, Bahrain, or the EU? If a transfer
>    outside the Kingdom is permitted, what conditions apply?
> 5. Our payment provider and video provider process data on our behalf. What
>    must our agreements with them contain, and must we disclose them by name?
> 6. How must a user request access to, correction of, or deletion of their data,
>    and within what period must we respond?
> 7. Please review and complete our privacy notice and terms of service. Both
>    currently carry placeholder text behind a visible "not final" notice.

### What we already do, which they should know

- Every acceptance of the terms and privacy notice is recorded with the exact
  document version and a timestamp. That records _what happened_; it is not by
  itself a lawful basis.
- Passwords are stored only as bcrypt hashes.
- Card details never reach our servers or our logs.
- Logs redact sensitive values by key before writing.

**Once question 4 is answered, tell me the region and I will produce a costed
proposal for your approval.**

---

## 2. VAT and e-invoicing decision — BLOCKS LAUNCH

**Who:** your accountant, plus whoever holds the tax registration.

- Is the entity VAT-registered? Does VAT apply to these sales?
- Does the entity fall inside the ZATCA e-invoicing mandate, and in which phase?
- If so, which e-invoicing solution will be used?

Until this is answered, the order receipt is **not** a tax invoice and is not
labelled as one. No VAT is calculated or displayed. Commerce is not
production-ready regardless of whether payments technically work.

---

## 3. Legal entity and policy text — BLOCKS LAUNCH

- Registered legal name and commercial registration number.
- Registered address, and the support email and phone to publish.
- **The refund window and conditions.** A full refund automatically withdraws
  access; we need your policy before that behaviour goes live.
- Final terms of service and privacy notice text (see item 1).

---

## 4. Question content — BLOCKS LAUNCH

The platform currently ships 264 practice questions written for this project, all
labelled as sample content. They exist so the engine has a pool to work with;
they are not a syllabus.

We need your real content, and for each question: the author or licensor, and
whether it is original or licensed. Publication is blocked without it.

**Hard constraint, and it is not negotiable.** The regulation governing the
official examination treats its questions and forms as confidential intellectual
property. We can only accept original material, or material you hold documented
written rights to. We cannot accept — and the platform will not carry — leaked
questions, تجميعات, recalled questions from real sittings, or anything described
as "questions that appeared previously". This also means that phrase cannot be
used in marketing.

---

## 5. Credentials for the integrations

These do not block each other and can be supplied as they become available. Each
unblocks final verification of a subsystem that is otherwise built and tested
against a mock.

| Needed                                               | For                  | Effect while missing                                                                   |
| ---------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| Moyasar **test** publishable + secret key            | Payments             | The development mock is used. Real card flows, 3-D Secure and refunds are unverified.  |
| Moyasar webhook secret + the production domain       | Payment confirmation | Webhooks cannot be registered or tested.                                               |
| Bunny library id, token-security key, management key | Video                | Playback reports itself unconfigured. No lesson has a video attached.                  |
| Production domain name                               | Both                 | Needed for the payment callback, the webhook endpoint, and Bunny's referrer allowlist. |

Supply Moyasar **test** keys first, never live keys. Send them through a secure
channel, not email or chat.

---

## 6. Storage provider approval

Product covers and question images need somewhere durable to live. Local disk is
refused in production because it is ephemeral on typical hosting.

Now that an AWS account exists, **S3 in the same region is the natural choice** —
but it needs your explicit approval, and it cannot be created until the region is
settled (item 1). It is a small, predictable cost.

---

## 7. Brand assets

**Who:** your designer.

The supplied logo is a single raster file, and the guidelines forbid cropping it
or extracting its symbol. We therefore use set type in the header rather than an
improvised lockup.

Still needed:

1. A **horizontal lockup** (symbol beside wordmark) as SVG, for navigation bars.
2. A **symbol-only mark** as SVG plus PNG at 512, 192, 180, 32 and 16 px, for the
   favicon and app icon.
3. A **vector master** of the current stacked lockup, since the supplied file is
   raster and cannot scale for print.

Until 1 and 2 exist, the browser tab uses a plain generated icon.

---

## Summary

| #   | Item                                      | Owner      | Blocks                  |
| --- | ----------------------------------------- | ---------- | ----------------------- |
| 1   | Data-residency and PDPL advice            | Counsel    | **AWS region + launch** |
| 2   | VAT / ZATCA decision                      | Accountant | Launch                  |
| 3   | Entity details, refund policy, legal text | Client     | Launch                  |
| 4   | Original or licensed questions            | Client     | Launch                  |
| 5   | Moyasar and Bunny credentials, domain     | Client     | Final verification      |
| 6   | Storage provider approval                 | Client     | Uploads in production   |
| 7   | Compact logo lockup and favicon           | Designer   | Polish                  |
