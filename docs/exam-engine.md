# Exam engine

## What the product claims, and what it does not

The simulator is an independent training product. It reproduces the publicly
described _structure_ of the official test — how many sections, how long, how
navigation behaves — so that the format is familiar on the day.

It does not claim to be official, approved, equivalent, or predictive. Results
are labelled `نتيجة تدريبية`. There is no percentile, no scaled score, no
pass/fail, and no admission estimate anywhere in the product — **the schema has
no column for one**, which is a stronger guarantee than a policy about what to
display.

## The preset, and how its provenance is recorded

The seeded preset reproduces the guide's described structure: five sections,
24 questions each, 120 in total, 125 minutes, multiple choice, calculator
disabled, electronic scratchpad available, review confined to the current
section, and no return to a section once left.

Two points of honesty are stored **in the data**, not merely in a comment:

- `sourceRetrievedAt` is 2026-08-17, and `sourceNote` states that this is the
  date New Era reviewed the source — not the date the source was published or
  last revised.
- The source establishes the 125-minute total. It does not, in the material
  collected for this build, establish an equal 25-minute split across the five
  sections. `sourceNote` therefore records the per-section duration as a New Era
  implementation default derived from the total, and every section duration is
  versioned and editable.

Nothing about the structure is hardcoded as an eternal rule. When the official
guide changes, an administrator publishes a new version.

## Blueprints

> **Blueprint rules are stored and not applied.** At the client's request the
> question bank stopped asking authors for a skill, a sub-skill, a difficulty or
> a track, so a rule naming one of those would select nothing an author writes —
> a teacher could fill the bank and watch the simulator ignore every question.
> A blueprint section therefore means one thing today: **take this many questions
> from the published bank**, drawn at random from a stored seed, with no question
> repeated anywhere in the attempt. The simulator's own track no longer narrows
> the draw either.
>
> The rules, their editor, their API and this arithmetic are all intact. What
> changed is one branch in `attempt-selection.service.ts` and the coverage report
> in `exam-version-admin.service.ts`; the commented-out blocks in both are the
> restore path, and they come back with the classification editor described at
> the head of `src/components/admin/question-form.tsx`. The rest of this section
> describes what those rules mean when they are applied again.

Domain shares come from the published percentages, per track:

| Domain          | Scientific | Theoretical |
| --------------- | ---------: | ----------: |
| التناظر اللفظي  |        17% |         21% |
| إكمال الجمل     |         7% |         13% |
| الخطأ السياقي   |        10% |         16% |
| استيعاب المقروء |        21% |         25% |
| الحساب          |        23% |         13% |
| الهندسة         |        10% |          8% |
| الجبر           |         4% |          0% |
| تفسير البيانات  |         8% |          4% |

Percentages of 24 rarely land on integers. Rounding each share independently
gives sections of 23 or 25 questions, so allocation uses the largest-remainder
method: floor every share, then give the leftovers to the largest fractional
parts. The total is then exact by construction.

For a 24-question section this yields `[4,2,2,5,6,2,1,2]` scientific and
`[5,3,4,6,3,2,0,1]` theoretical — 55/45 and 75/25 verbal-to-quantitative, as
published. Both vectors are pinned in unit tests.

Ties break deterministically (remainder, then percentage, then declared order),
because an administrator previewing an allocation must be shown what publishing
will actually produce. An explicit per-rule count override is honoured first, and
the remainder is reallocated across what is left.

## Creating an attempt

Creation and starting are separate. Creation freezes the paper; the clock does
not begin until the student has seen the instructions and the disclaimer and
chosen to start. An attempt that is created and abandoned costs nothing.

The creation transaction:

1. Verify an active entitlement, and that the version is published. (An
   administrator dry run is the one exception, and is flagged as such so it never
   pollutes analytics.)
2. Store a random seed, so the selection can be reproduced later.
3. Select per section — each section's `questionCount` drawn from the published
   bank — with **no question repeated anywhere in the attempt**.
4. Shuffle questions, and options too — except where a question declares
   `shuffleOptions: false`, because some option sets carry a deliberate order.
5. Write an immutable snapshot of every question.
6. Write the section rows as `PENDING`.

**If a section cannot be filled, the whole transaction aborts.** The student is
told the attempt could not be prepared and no time is consumed. Quietly serving a
short section would corrupt the one thing the product exists to provide. The
publication check runs the same code first, so the shortfall — what the version
needs against what the bank holds — is normally an administrator's problem
rather than a student's.

Creation is idempotent. A partial unique index permits one live full-simulation
attempt per student per version, so a double-click or a duplicated tab loses the
insert race and the caller receives the existing attempt rather than a second
exam with a second clock.

## Snapshots

`AttemptQuestion` stores the stem, the ordered options, the correct key, the
explanation and the classification as they were at creation. An author editing a
question mid-exam cannot change what a student is looking at, and a result stays
explainable years later.

The correct key, explanation and hint are **separate columns** from
`contentSnapshot`. The student-facing serialiser reads only the latter, so
leaking an answer would require actively adding a field rather than merely
forgetting to strip one. A test walks every student-facing payload and asserts no
answer-bearing key appears.

## Time

The clock is server-authoritative. The client's countdown is presentational: it
computes remaining time from the server's `serverTime` and `deadlineAt`, recomputes
from timestamps rather than decrementing a counter — so a throttled background
tab cannot drift — and when it reaches zero it **refetches** rather than advancing
itself.

Expiry is evaluated lazily, at the top of every attempt-scoped request. There is
no background worker, and none is needed: the truth is the stored `deadlineAt`,
so a request arriving one second or one hour late resolves to the same state.

When a section's deadline has passed it is locked with `lockedAt = deadlineAt` —
the deadline, not the moment the server noticed — and the next section is chained
from the previous deadline rather than from now. A student who was offline for
forty minutes loses that time; they never gain it. When the final section expires,
the attempt is finalised and scored.

The cost of lazy evaluation is cosmetic: an abandoned attempt reads as in
progress in a list until something touches it. `maxEndAt` lets list queries show
the correct status without walking every stale row.

## Answers

Autosave uses optimistic concurrency. Each save carries the `saveVersion` it read;
the update is a compare-and-set. If a second tab saved in between, the write is
refused with a 409 carrying the current server state, and the client rebases —
rather than silently overwriting an answer the student gave elsewhere.

Saves are rejected for any section that is not currently in progress. A locked
section is closed at the API, not merely hidden in the interface, so advancing
early cannot be undone by a crafted request.

The client debounces, queues only the latest state per question, flushes on
navigation and on tab-hide, and shows the save state in Arabic. A student needs
to know whether their answer is safe.

## Advancing and submitting

Advancing is irreversible and the interface says so, showing how many questions
are unanswered and how many are flagged before asking for confirmation. The
transition is a rowcount-guarded update, so two clicks cannot skip two sections.

Submission is idempotent: replaying it returns the existing result. Submit and
expiry race safely — the guarded transition means exactly one of them wins, and
both produce the same scored outcome.

## Results

Scoring runs on the server, from the snapshot, for both submission and expiry.
It computes correct, incorrect and unanswered totals, accuracy by domain and
subskill, and time per section.

**What the student is shown is narrower than what is computed.** At the client's
request the two skill breakdowns are commented out of the result screen: an
attempt review shows the four totals, the accuracy figure, time per section, and
then every question with the answer given, the correct one, and the explanation.
The same two tables are commented out of the administration attempt record. The
figures are still computed and still frozen into `AttemptResult`, so uncommenting
the blocks in `src/components/exam/exam-results.tsx` and
`src/components/admin/attempt-detail.tsx` brings them back for attempts already
in the database — see the note at the head of
`src/components/admin/question-form.tsx`, which is where the classification was
removed from authoring.

Per-question timings are client-reported and server-clamped, and are described as
indicative. They are the one number here that cannot be measured exactly, and the
product says so rather than implying precision it does not have.

## Training mode

Training shares the same tables, snapshot code, autosave, scoring and clock. The
differences are a derived policy object, not a parallel implementation: topic and
difficulty selection, an optional timer, immediate feedback, hints, and retrying
incorrect questions.

The two modes are labelled distinctly — `محاكاة كاملة` and `تدريب` — and the
policy is what keeps training's flexibility from leaking into the strict rules of
a full simulation.

## Intellectual property

Only original or documented-licensed questions may enter the bank. Provenance,
rights, author and reviewer are recorded per question and publication is blocked
without them. Nothing recalled from a real sitting, and nothing described as
"questions that appeared previously", may be ingested. See
[content-and-legal-checklist.md](./content-and-legal-checklist.md).
