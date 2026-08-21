# Admin dashboard — visual and content reference

What the administration area looks like, why it looks that way, and the rules its
Arabic obeys. Written from the shipped implementation, not from an intention.

Scope: everything under `/admin`. The student area and the marketing site share
the same token set but follow different rules, and are not covered here.

Related: `docs/design-system.md` owns the tokens and the hard rules for the whole
product; this document only describes how the admin surface spends them.
`docs/data-model.md` explains why the sections are split the way they are.

---

## 1. What it is

Twelve sections behind one shell, all server-rendered, all reading live rows.
There is no analytics layer, no chart and no derived metric anywhere in it — the
area is a **tool for operating the platform**, not a dashboard for looking at it.

| #   | Section            | Route                     | Purpose                                                   |
| --- | ------------------ | ------------------------- | --------------------------------------------------------- |
| 1   | نظرة عامة          | `/admin`                  | State of the platform, and what is waiting on somebody    |
| 2   | المنتجات           | `/admin/products`         | What is for sale: price, type, publication                |
| 3   | الدورات            | `/admin/courses`          | Course content: modules, lessons, videos, lesson quizzes  |
| 4   | بنك الأسئلة        | `/admin/questions`        | Question authoring, review workflow, versions             |
| 5   | محاكيات الاختبار   | `/admin/simulators`       | Exam versions, sections, timing, blueprint rules          |
| 6   | الطلاب             | `/admin/students`         | Student accounts — read, block, reactivate                |
| 7   | الطلبات والمدفوعات | `/admin/orders`           | Orders, payment attempts, refunds                         |
| 8   | الصلاحيات والوصول  | `/admin/entitlements`     | Granting and revoking product access                      |
| 9   | المحاولات والنتائج | `/admin/attempts`         | Exam attempts and their training results                  |
| 10  | رسائل التواصل      | `/admin/contact-messages` | Read-only messages submitted from the public contact page |
| 11  | الإعدادات          | `/admin/settings`         | Contact details, legal document versions                  |
| 12  | سجل النشاط         | `/admin/audit-log`        | Append-only trail of every admin action                   |

Sections 2–5 build the catalogue; 6–10 operate it; 11–12 govern it. The rail is
ordered in that sequence and the order is meaningful — it runs from "what we
sell" through "who bought it" to "what we changed".

---

## 2. The frame

Every screen is the same three regions. Under `dir="rtl"` the inline start is the
**right** edge, and the layout uses logical properties throughout, so nothing is
mirrored by hand.

```
┌────────────────────────── viewport ──────────────────────────┐
│  main column                              │   rail (264px)   │
│ ┌───────────────────────────────────────┐ │ ┌──────────────┐ │
│ │ top bar · 64px · sticky · blurred     │ │ │ brand + chip │ │
│ ├───────────────────────────────────────┤ │ ├──────────────┤ │
│ │                                       │ │ │ نظرة عامة  ▸ │ │
│ │   main · max-w-5xl · centred          │ │ │ المنتجات     │ │
│ │   ┌───────────────────────────────┐   │ │ │ الدورات      │ │
│ │   │ AdminPageHead (h1 + desc)     │   │ │ │ …            │ │
│ │   ├───────────────────────────────┤   │ │ │ سجل النشاط   │ │
│ │   │ [Notice]   optional           │   │ │ └──────────────┘ │
│ │   │ [Filters]  optional           │   │ │   sticky h-dvh   │
│ │   │ [Content]  table / panels     │   │ │   border-e       │
│ │   │ [Pagination]                  │   │ │                  │
│ │   └───────────────────────────────┘   │ │                  │
│ └───────────────────────────────────────┘ │                  │
└──────────────────────────────────────────────────────────────┘
                        canvas: #f6f9fc
```

**The rail** (`src/components/layout/admin-shell.tsx`). 272px, white, sticky
full-height, hairline on its inline end. The eleven items sit in three labelled
groups — الكتالوج / التشغيل / الحكم — each a `<section aria-label>`, so the
build → operate → govern order is stated rather than merely implied. The header carries the compact wordmark
plus a `لوحة التحكم` chip in `brand-100`/`brand-700` — a chip and not a second
line of muted text, so the tool reads as separate from the brand rather than as a
continuation of the wordmark. One icon family at one size, 44px minimum row
height. An item's icon takes the brand hue only while active; at rest it stays
`ink-600`, so the rail reads as one quiet index rather than eleven coloured
lines.

The active item is carried by **four signals, never colour alone**:
`aria-current`, `font-semibold`, a `brand-100` ground, and a 3px `brand-700` bar
on the rail's own reading edge (`inset-y-2`, so it reads as a tab marker rather
than a broken border). `/admin` matches exactly; every other item claims its own
subtree, so a future `/admin/orders/[id]` still lights الطلبات.

Below `lg` the rail becomes a Radix Dialog drawer entering from the inline start —
the same side, no physical offset — and it dismisses on click rather than on the
resulting route change, so it closes at the moment the intent is expressed and
still fires when the destination is the page already open.

**The top bar.** 64px, sticky, `bg-surface/85` with `backdrop-blur-xl`, so
content scrolling under it reads as beneath rather than clipped — the blur is
constant, CSS-only, and identical at scroll 0 and scroll 4000. It carries, in
reading order: the drawer trigger (mobile only), a **locator** — the current
section's icon and label in `brand-700` — then the signed-in name, the address in
`<bdi dir="ltr">`, a decorative initial avatar, and the logout button. The locator
is a `<p>`, not a heading: the page below owns the only `h1`.

**The main column.** `max-w-5xl` centred, `px-4 → lg:px-8`, `py-6 → lg:py-8`, on
the `canvas` ground. Sections stack in a `flex-col gap-6`.

---

## 3. The visual system

### 3.1 Colour — one code, two vocabularies

`src/lib/accent.ts` is the only place a hue becomes a class name, so a marketing
chapter head, a catalogue badge and an admin count tile can never drift to
different blues. The public site reads the four hues as the four movements of the
method; the admin area reads the same four as its **four subject domains**. A
reader who learns the code on the marketing site already knows it inside the tool.

| Hue   | Admin domain        | Ink            | Soft ground         | Vivid fill          |
| ----- | ------------------- | -------------- | ------------------- | ------------------- |
| Blue  | Products, catalogue | `brand-700`    | `brand-100`         | `brand-600`         |
| Gold  | Questions           | `accent-gold`  | `accent-gold-soft`  | `accent-gold-fill`  |
| Teal  | Students            | `accent-teal`  | `accent-teal-soft`  | `accent-teal-fill`  |
| Green | Orders, money       | `accent-green` | `accent-green-soft` | `accent-green-fill` |

Coral exists but is a celebration accent and is deliberately unreachable from the
`accentAt()` rotation — a hue that can turn up by index is structure, not
punctuation. Reach for it explicitly or not at all.

Assignment is **by subject, not by position**. On the overview the two product
counts, the three question counts and the two order counts each read as one
block; reordering the list regroups the colour automatically.

Three contrast tiers, and mixing them is a bug:

- `ink` — text at any size. Clears 4.5:1 on white, on canvas and on its own soft ground.
- `fill` — the vivid solid. Carries white **glyphs** only (the 3:1 graphics floor). White _text_ on `fill` is a contrast bug.
- `inkFill` — the dark solid, for the rare chip that must carry white text.

**Status colour is a separate system** from the domain code. `status-badge.tsx`
maps each Prisma enum to a badge variant through an exhaustive
`Record<$Enums.X, BadgeVariant>`, so adding an enum member fails the typecheck
rather than shipping a pill that renders `undefined` or an untranslated English
identifier. Every badge renders its Arabic label, so state survives greyscale.

Notable status decisions: a draft is `neutral`, not a warning — it is the
ordinary starting state of everything, not a problem. `IN_REVIEW` is the only
warning in the question workflow, because it is the state waiting on a person.
`APPROVED` is brand rather than success, because the question still is not
reachable by any student; only `PUBLISHED` is.

### 3.2 Type

Two families: `--font-sans` for body, `--font-display` for headings and figures.
The sanctioned steps are `text-h1 / text-h2 / text-h3 / text-lead`, plus
`text-display` which belongs to the landing page alone. Nothing drops under 1.3
line-height — Arabic needs the air — and `letter-spacing` is always 0, because
the script is cursive and tracking breaks the joins between letters.

In the admin area specifically: the page `h1` is `text-2xl font-bold`; panel
headings are `text-lg font-semibold`; table text is `text-sm`; hints and meta are
`text-xs`. Counts use `font-display` with `tabular-nums`, so a column of figures
stays a column as the values change.

Descriptions are held to `max-w-prose`. The only sanctioned Arabic measures are
`measure-ar`, `measure-ar-sm` and `measure-ar-lg`.

### 3.3 Shape, elevation, motion

Radii: `control` 10px (buttons, inputs, chips), `panel` 14px (tables, tiles),
`card` 18px.

Elevation is `shadow-xs` for inputs and `shadow-card` for panels.
`shadow-overlay` is reserved for genuinely overlaid surfaces — a modal, the
mobile rail. There is no elevation _scale_: rank is carried by rule, fill and
position. A table nested inside a card drops its own shadow rather than stacking
a second one.

Motion is `--neb-duration-micro` (150ms) for colour and
`--neb-duration-component` (220ms) for components, on `--neb-ease`. The admin
area transitions **colour only** — never `transition-all`, which would animate
whatever happens to change, including layout properties at a breakpoint.
`prefers-reduced-motion` is handled globally and nothing opts out.

---

## 4. The four screen archetypes

Every admin screen is one of four shapes. Knowing which shape a screen is tells
you which components it uses and where its states come from.

### A. Overview — `/admin`

Three independently-degrading panels, in decreasing order of urgency.

**1. أعداد حالية** — eight `CountTile`s in an `auto-fill` grid against a 232px
floor, so the column count follows the width available rather than three
hand-picked breakpoints. Each tile is a soft-ground panel with a hairline; the
filled icon chip and the 13px label share one row as a single caption, with the
30px display figure beneath them. The icon is the same mark the
rail gives that section, which makes it wayfinding rather than ornament.

Read in **one Prisma transaction**, so the eight numbers describe a single
consistent moment rather than eight different ones. No trend, no delta, no
sparkline, no comparison against a previous period — the page loads one number
per query and a second number to compare it against does not exist.

**2. يحتاج إلى إجراء** — the work queue. Deliberately _not_ a second block of
statistics: the counts above describe the platform, these describe an obligation,
and a payment held for somebody's decision must not sit in the same grid as "we
have 264 questions". Every row carries a count, a one-line note and a
**destination** — a number an administrator cannot act on does not belong in a
queue. Rows with a zero count are filtered out; an empty queue renders
`EmptyState` with words, never a blank space.

**3. آخر النشاط** — six rows from the audit reader, using that screen's own
default window. A glimpse of `/admin/audit-log`, not a second implementation of
it.

Panels 2 and 3 sit side by side in an `auto-fit` grid against a 340px floor,
collapsing to one column on a narrow viewport without a breakpoint. Stacked
full-width they pushed the trail below the fold on every laptop and gave both a
measure far wider than their content.

Each panel try/catches on its own: a failed audit read must not take the work
queue down with it, because the three answer different questions.

### B. List

Products, courses, questions, simulators, students, orders, entitlements,
attempts, audit log. The most common shape. Composition, top to bottom:

```
AdminPageHead   h1 · description · optional primary action
Notice          only where the screen has a standing caveat
Filters         a Card of selects + search + تطبيق + إزالة كل عوامل التصفية
activeNote      rendered only while the list is narrowed
DataTable       rows | empty | failed
Pagination      range summary + previous/next
```

**Filtering, searching and paging all happen in SQL and travel in the URL.** The
page reads `searchParams`, hands them to a Zod schema whose every field
`.catch()`es, and renders what came back. A filtered view is therefore a real
address that can be reloaded, bookmarked and sent to a colleague, and a
hand-edited query string degrades to the default view rather than answering a
browsing request with a 400. A repeated parameter arrives as an array and the
first value wins.

`DataTable` refuses to conflate three outcomes:

- **rows** → the table;
- **an empty result** → the caller's `empty` node, a _required_ prop precisely so
  the caller has to decide between "nothing exists yet" and "nothing matches this
  filter". They need different words and different actions.
- **a failed query** → `ErrorState`. Never an empty table, because «لا توجد
  منتجات» is a claim about the business that a database outage is not entitled to
  make.

The table's scroll container is `role="region"`, labelled and `tabIndex={0}`, so
a table wider than its column is reachable by keyboard and not only by pointer.

### C. Record

One student, one order, one attempt, one entitlement, one audit entry.

`DetailPanel`: a definition list, not a table of one row. One, two or three
responsive columns; `span: 'full'` for a long value; `dir: 'ltr'` for addresses,
UUIDs, slugs, ISO dates and amounts, so a value starting with a digit or a hyphen
cannot reorder the Arabic label beside it. A `null` value renders
`COPY.common.notAvailable`, never a blank cell — an empty `<dd>` is
indistinguishable from a field that failed to render.

It has **no `failed` prop**, unlike `DataTable`. A list screen can lose one table
while the rest of the page is sound; a record's fields all come from the one read
that produced the record, so if it threw there is no record to draw a panel
around and the page renders `ErrorState` instead of the panel.

### D. Builder

The two editing surfaces: `course-builder.tsx` and `exam-version-editor.tsx`.
One client component owns the whole tree, because the tree is one editing
session — splitting it per module would let a reorder in one card and a
publication in another disagree about what the list currently contains, and the
disagreement would surface only as a saved order nobody chose.

Four decisions worth naming, each a place the obvious implementation is wrong:

1. **A reorder is one request carrying the whole list.** `position` is not unique
   on `CourseModule` or `Lesson`, so an ordering is only ever consistent as a
   set; sending "move this one up" as its own call would let two half-applied
   orderings interleave.
2. **Publication is never a form field.** Every transition goes through its own
   confirmed action and its own `intent: 'transition'` body, and each
   confirmation says what actually changes for a student — which, for a lesson
   inside a draft module, is nothing.
3. **Refusals are shown before they are earned.** A lesson somebody has watched
   cannot be deleted; the button is disabled with the reason printed beside it
   rather than left live to produce a 409.
4. **One confirmation slot for the whole screen**, which takes focus and scrolls
   itself into view when it opens. Two open confirmations describing destructive
   actions on different targets is how the wrong one gets confirmed.

Module and lesson authoring use **contextual editor dialogs**, not panels appended
after the course tree. The trigger stays visually anchored to the unit being
worked on, the outline does not jump, and focus returns to that trigger when the
editor closes. A module title uses the compact dialog; a lesson uses the wider,
internally scrolling authoring dialog. On a phone the same surface becomes a
near-full-height bottom sheet. Clicking the backdrop does not discard a
half-written lesson: dismissal remains explicit through Escape, the close button
or إلغاء. Video registration may open as a nested dialog from the lesson field;
Radix owns both focus traps and restores focus in the correct order.

Within a builder table, dense rows follow three further rules, learned from the
lesson table that once stood 300px per row:

- Reorder controls live in the الترتيب column. The control that changes a
  position belongs in the column that shows it, not at the far inline end.
- An item's own attributes — duration, video, preview flag — live under its title
  as one muted meta line, not one column each. They describe a single row and are
  not compared across rows the way a status or a threshold is.
- Only actions an icon can genuinely carry become icon buttons: an arrow, a bin.
  The word moves to both `aria-label` and `title`. Publication stays in words,
  because no glyph distinguishes «نشر» from «أرشفة» without teaching one first.
  Nothing goes behind an overflow menu — every action stays one click away.

---

## 5. Component inventory

| Component                         | Archetype     | Notes                                                                                               |
| --------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `AdminPageHead`                   | all           | `h1` + description + `ms-auto` action slot. Deliberately not the public site's marketing `PageHead` |
| `DataTable`                       | list          | Three outcomes kept apart; labelled, focusable scroll region                                        |
| `DetailPanel`                     | record        | Definition list, 1/2/3 columns, explicit absence, no `failed` prop                                  |
| `CountTile`                       | overview      | Soft ground + filled icon chip + display figure                                                     |
| `status-badge`                    | list, record  | Exhaustive enum → variant maps                                                                      |
| `Notice`                          | list          | Standing caveat, `role="note"` — never `role="alert"`                                               |
| `EmptyState` / `ErrorState`       | all           | Dashed + inbox vs solid border + warning icon + `role="alert"`                                      |
| `*-list`                          | list          | Filters, table columns and pagination per section                                                   |
| `*-form`, `*-editor`, `*-builder` | create / edit | Client forms that `fetch` route handlers                                                            |

There are **no server actions anywhere in the codebase**. Every mutation is a
client form posting to a route handler — one way to write a mutation, one place
to audit.

---

## 6. The content system

### 6.1 Where the words live

All user-facing Arabic is in `src/lib/copy.ts` and `src/lib/copy/*.ts`. Nothing
is inlined in a component. The admin strings are split per section
(`admin-products.ts`, `admin-orders.ts`, …) and composed into `COPY.adminX`.

`admin-common.ts` holds only what is genuinely shared: table headings,
pagination, search, filter, sort, generic actions. **The test is the noun** — the
moment a sentence has to say «منتج» or «سؤال» it has stopped being shareable and
belongs in that section's module. The alternative is a string generic enough to
fit everywhere, which reads as machine translation on every screen that borrows
it.

### 6.2 The voice

Six rules, all observable in the shipped strings:

1. **A description says what a thing is, never why the system works that way.**
   A heading plus one orienting sentence. A second sentence that explains the
   design, or denies something nobody claimed, is padding. That genre was audited
   out of the whole admin area — «أعداد حالية» once carried "actual counts at the
   moment the page opened, not performance indicators or trends", which restated
   its own heading and then denied two things.
2. **A heading that explains itself gets no description at all.** أعداد حالية and
   يحتاج إلى إجراء carry none.
3. **Consequences before a destructive action are not padding and stay.**
   «يُحذف معها كل درس بداخلها» changes what someone clicks.
4. **Two different absences are worded apart.** "No video provider configured in
   this environment" and "the library is empty" are different facts with
   different next steps; collapsing them into "no videos available" would send
   somebody to a provider dashboard that does not exist.
5. **Legal text is not editorial.** The independence disclaimer, «نتيجة تدريبية
   وليست درجة رسمية», and «لا يُنقل إلى المنصة أي سؤال… من مادة اختبار رسمية» are
   governed by `docs/content-and-legal-checklist.md` and are not trimmed for tone.
6. **Placeholders are named, not positional** — `{count}`, `{from}`, `{to}`,
   `{total}`, `{current}` — so a translator can reorder a sentence.

### 6.3 Standing notices

Seven list screens carry a single `Notice tone="neutral" role="note"` under the
head. Each states a boundary the screen cannot enforce by layout alone:

| Screen                     | What it states                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| الدورات / محاكيات الاختبار | A course or simulator cannot exist without its product; create it first       |
| الطلاب                     | Account data is read-only; there are no password tools on this screen         |
| الطلبات والمدفوعات         | Payment state is read from the provider and is never edited here              |
| الصلاحيات والوصول          | Granting access is not money; grant and refund are separate on purpose        |
| المحاولات والنتائج         | These figures describe one attempt; the platform computes no official score   |
| سجل النشاط                 | The trail is append-only and is written in the same transaction as the change |

`role="note"` and never `role="alert"` — nothing has gone wrong, and alerting on
a fact that is always true would interrupt a screen reader for no reason.
`ErrorState` is the only thing in the product that alerts.

The settings screen carries its notices inside the form instead: one neutral
("no secrets are stored here") and one warning attached to the legal version
fields.

### 6.4 Numbers and dates

Arabic-Indic numerals throughout via `formatNumber` (`ar-SA`). Dates are
Gregorian in `Asia/Riyadh` regardless of where the server runs, via
`ar-SA-u-ca-gregory-nu-arab`, while the stored values stay UTC. Money is an
integer count of halalas, split rather than divided, so no amount drifts through
binary floating point.

One consequence worth knowing: **Arabic-Indic zero is `٠`, a dot.** In a large
display figure on an empty account it reads as a speck. That is correct locale
rendering rather than a bug, but it is the single place the numeral system costs
legibility.

---

## 7. Accessibility contract

- **Colour is never the only channel.** Every badge carries its Arabic label,
  every count tile carries a label and an icon, and the active rail item carries
  four signals.
- **Logical properties only** — `ps/pe/ms/me/start/end`. Forward arrows point
  left (`ArrowLeft`), because forward under RTL is left. The one sanctioned
  exception is a physical `left-1/2` paired with a physical `-translate-x-1/2`
  for centring a dialog: `start-1/2` resolves to `right: 50%` under RTL and then
  shifts the panel a further half-width the wrong way.
- **Latin runs are isolated** in `<bdi dir="ltr">` or a `dir="ltr"` cell —
  addresses, UUIDs, slugs, amounts — so a leading digit cannot reorder the Arabic
  around it.
- **Icon-only controls carry both** `aria-label` and `title`: the first names the
  control for a screen reader, the second for a pointer. A tooltip alone leaves
  the button unnamed.
- **An action column's `<th>` is `headerHidden`, not absent.** A header cell with
  no accessible name leaves every control in that column unannounced when a
  screen reader walks the table by column.
- **Forms derive their ids from `useId()`.** A form rendered twice on one page —
  the video register form appears in both the lesson dialog and the library panel
  — would otherwise have both copies claim the same id, and `htmlFor` binds to
  the first match in the document.
- Focus is a 2px `brand-500` outline at 2px offset, globally. Overlays are Radix,
  which supplies the focus trap, focus restoration, Escape-to-close and the body
  scroll lock.

---

## 8. What is deliberately absent

Listed because each was considered and rejected. Re-adding one is a regression,
not a feature.

- **Charts, trends, sparklines, deltas.** A count is a fact; a trend drawn over
  two counts read at two different moments is not.
- **Dark theme, dark sections, dark bands.** Light only, one theme, no toggle.
- **An elevation scale.** Two shadows and an overlay shadow.
- **Cards that lift, scale or glow on hover.** Rank is rule, fill and position.
- **Server actions.** One mutation pattern, one audit surface.
- **Bulk destructive operations.** Every delete is confirmed individually, and
  every foreign key touching money, entitlement history or a submitted attempt is
  `Restrict` in the schema — so the refusal is shown before it is earned rather
  than discovered as a 409.
- **Password tools on the student screen.** Hashes are one-way; a control
  offering to reveal or set one would be lying about what it can do.

---

## 9. Changing it

- Tokens and product-wide hard rules: `docs/design-system.md`.
- Why the sections are split this way: `docs/data-model.md`.
- Legal and content obligations: `docs/content-and-legal-checklist.md`.
- New copy goes in that section's own module — never inline, and never in
  `admin-common.ts` unless it can be written without naming a noun.
- A new screen picks one of the four archetypes in §4. A fifth shape needs a
  reason written down here first.
