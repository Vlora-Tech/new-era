# Data model

PostgreSQL 17 through Prisma. UUIDv7 primary keys, `timestamptz` everywhere,
money as an integer count of halalas.

## Shape

```
User ──< ConsentRecord
 │
 ├──< Order >── Product ──┬── Course ──< CourseModule ──< Lesson ──< LessonProgress
 │      │                 │                                  │
 │      └──< PaymentAttempt│                                  └── LessonQuiz ──< LessonQuizQuestion >── Question
 │                        │
 └──< Entitlement ────────┘                                   LessonQuizAttempt ──< LessonQuizAnswer
        │                 │
        └──< EntitlementEvent
                          │
                          └── ExamSimulator ──< ExamVersion ──< ExamSection ──┬──< ExamSectionQuestion >── Question
                                    │                                          └──< ExamBlueprintRule
                                    │
                                    └──< ExamAttempt ──< AttemptSection ──< AttemptQuestion ──1 AttemptAnswer

Question ──< QuestionOption          Question ──< QuestionVersion       Question >── QuestionStimulus
MediaAsset          VideoAsset ──< PlaybackSession          WebhookEvent          AuditLog          SiteSetting
```

## The constraints that carry weight

Each of these exists because of a specific way the system could otherwise go
wrong.

### Money cannot drift

`priceHalalas` and `amountHalalas` are integers, with `CHECK (… >= 0)`, and
currency is pinned to `SAR` by a check constraint. There is no floating-point
value anywhere in the money path; display splits the integer rather than dividing
it.

`Product.priceHalalas` is the current catalogue price and administrators may
change it. `Order.amountHalalas` is a snapshot taken when the order was created,
so changing a price never moves an existing order — and an order can always be
reconciled against what the customer actually agreed to pay.

### Access is granted exactly once

`Entitlement` has `@@unique([userId, productId])`.

A single payment can be reported by a browser callback, a webhook, and the
reconciliation sweep, potentially at the same moment. The unique constraint is
the backstop that makes "grant access" idempotent no matter how many of those
arrive: the first wins, the rest are no-ops. `Order` is additionally locked with
`SELECT … FOR UPDATE` during reconciliation so the paths serialise rather than
race.

### Access history is never rewritten

`EntitlementEvent` is append-only. A refund does not edit the grant; it adds a
revocation. A repurchase adds a reactivation. The current state lives in
`Entitlement`, and the sequence of events that produced it stays legible — which
is the difference between "this account has access" and "we can explain why".

No foreign key from `Entitlement`, `EntitlementEvent`, `Order`, `PaymentAttempt`
or `AuditLog` cascades on delete. Deleting a product must not be able to erase
the record of money that changed hands.

### One order per checkout request

`Order` has `@@unique([userId, checkoutRequestKey])`.

The client generates the key. Pressing "pay" twice, or retrying after a dropped
connection, returns the original order instead of creating a second one. Reusing
a key for a different product is rejected outright rather than quietly repointing
an existing order at something else.

### One payment record per provider payment

`PaymentAttempt` has `@@unique([provider, providerPaymentId])`, so repeated
reconciliation of the same payment updates one row.

`configuredMode` records whether this application was in test or live mode when
the attempt was created. Moyasar's fetch-payment response carries no `live`
field, so mode is verified against this column and against the webhook envelope —
never against the payment body, which does not report it.

### One webhook event, processed once

`WebhookEvent` has `@@unique([provider, providerEventId])`, with a deterministic
digest as the identifier when a provider omits one. Delivery is retried by
design, so duplicates are expected rather than exceptional.

The row is committed *before* processing begins. The HTTP 200 acknowledges
durable receipt, not successful handling, so a processing failure leaves a
`PENDING` row for the retry sweep instead of dropping the event.

### Exactly one correct option

A partial unique index, `question_options_one_correct_key ON (questionId) WHERE isCorrect`.

A question with no correct answer, or two, is unmarkable. Enforcing it in the
database means a bad import or a future code path cannot create one, rather than
relying on every write path remembering to validate.

### One live attempt per student per exam version

A partial unique index over `(userId, examVersionId)` where the attempt is
`CREATED` or `IN_PROGRESS`, in full-simulation mode, and not a dry run.

This is what makes attempt creation idempotent. A double-click or a duplicated
tab loses the insert race and the caller returns the existing attempt, instead of
generating a second exam with a second clock.

### Attempts are frozen at creation

`AttemptQuestion` stores the question's content, its ordered options, the correct
key, and the explanation as they were when the attempt was generated. It also
denormalises domain, subskill and difficulty so results aggregate without joining
back to the bank.

A student's attempt therefore cannot change underneath them because an author
edited a question mid-exam, and a result stays explainable years later. Crucially
`contentSnapshot` holds only what a student may see; `correctOptionKey`,
`explanationSnapshot` and `hintSnapshot` are **separate columns**, so the
student-facing serialiser cannot leak an answer by forgetting to strip a field.

### Published question content is immutable

`Question` is the editable head row. Publishing copies its content into a
`QuestionVersion`, unique on `(questionId, version)`, and `currentVersion` points
at what is being served. Re-opening a published question for editing leaves the
served version in place until the new one is published.

`LessonQuizAnswer` records `questionVersion` alongside the answer, so it is
always possible to say which wording the student actually responded to.

### Progress cannot be forged

`LessonProgress` is unique on `(userId, lessonId)` and carries a `CHECK` that
keeps the counters non-negative and `furthestPositionSec >= lastPositionSec`.

Growth is bounded in the service layer: watched time may only increase as fast as
real time has passed on the server since that playback session's previous
heartbeat. Completion is measured against that bounded total, not against the
player's position, so seeking to the end does not complete a lesson.

### Email uniqueness does not depend on remembering to normalise

`User.email` is unique, and the initial migration adds
`CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email))`.

The service layer lowercases on write. The functional index means that even a
write path that skips normalisation cannot create `Ali@example.com` alongside
`ali@example.com`. Uniqueness is decided on ASCII-normalised values, so it never
depends on collation — which is what keeps it stable across ICU versions.

## Deletion policy

`Cascade` appears in exactly two places: inside draft content trees
(`Course → CourseModule → Lesson`, `ExamVersion → ExamSection`), where removing
the parent genuinely means removing the children, and inside an attempt's own
snapshot subtree.

Everything else is `Restrict` or `SetNull`. `AuditLog.actorId` and
`Question.createdById` are `SetNull` with the actor's address kept as a snapshot,
so history survives the removal of a user without pointing at a row that is gone.

## Collation

The cluster uses the ICU provider with the `ar-SA` locale, because musl on Alpine
ignores libc collations other than `C` and Arabic would otherwise sort by code
point. The visible difference: `آدم، ابتسام، أحمد، إياد` orders by the second
letter, interleaving the alef forms, as an Arabic reader expects.

Because uniqueness-critical columns are ASCII-normalised, an ICU version
difference between the development image and a managed production host can change
sort order but cannot corrupt a unique index. Collation-aware indexes should
still be rebuilt after a major ICU upgrade.
