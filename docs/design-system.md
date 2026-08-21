# بناء العهد الجديد — Design System 2026

The product's visual identity, decided once here. Every surface — marketing site,
student dashboard, admin portal, checkout, exam workspace — draws from this file.
When a screen and this file disagree, the screen is wrong.

## Identity in one paragraph

A confident Saudi EdTech product: cool cloud neutrals instead of warm paper, one
vivid brand blue (#0668c8) with a full scale, a four-hue functional colour code
in the tools, geometric khatim tilework as the cultural signature, **Alexandria**
display type — tracked tight at display sizes — over **IBM Plex Sans Arabic**
body text at weight 300, 10/14/18px radii, and a quiet navy-tinted elevation
scale. Depth is allowed but earned: one shadow step per surface, no gradients
heavier than a tinted ground, no motion beyond 150–200ms micro-transitions.
Light theme only.

> **Re-derived 2026-08-21** from the approved homepage canvas «بناء العهد الجديد —
> الصفحة الرئيسية», superseding the 2026-08-18 entry. Owner-authorised. The brand
> ramp, the neutral ramp and the whole type scale moved; every screen in the
> product inherited the change through `globals.css` alone.

## Typography

| Role                                      | Family               | Token                 | Notes                                               |
| ----------------------------------------- | -------------------- | --------------------- | --------------------------------------------------- |
| Display & headings (h1–h4, stat numerals) | Alexandria           | `font-display`        | weights 600/700/800; tracked NEGATIVE at ≥19px      |
| Body, UI, forms, tables                   | IBM Plex Sans Arabic | `font-sans` (default) | weights 300/400/500/600/700; 300 is the lead weight |

Both load via `next/font/google` in `src/app/layout.tsx`; no runtime font
requests. Both carry **300** and Alexandria carries **800** — the lead steps are
weight 300, and a missing weight is synthesised by thinning the outline, which on
Arabic breaks the letter joins the way faux bold does.

### The scale

Eight steps, all lifted from the canvas. These are the sanctioned sizes; an
arbitrary `text-[30px] leading-[1.28]` anywhere in the product is a drift.

| Utility         | Family / weight | Size                        | LH   | Tracking | Use                                  |
| --------------- | --------------- | --------------------------- | ---- | -------- | ------------------------------------ |
| `text-display`  | Alexandria 700  | `clamp(46px, 7.2vw, 104px)` | 1.34 | −0.035em | the homepage h1, and nothing else    |
| `text-h1`       | Alexandria 700  | `clamp(30px, 4.6vw, 60px)`  | 1.20 | −0.03em  | the closing conversion band          |
| `text-h2`       | Alexandria 700  | `clamp(28px, 4vw, 52px)`    | 1.24 | −0.025em | a section head over centred copy     |
| `text-h2-tight` | Alexandria 700  | `clamp(26px, 3vw, 40px)`    | 1.30 | −0.025em | a section head in a two-column block |
| `text-h3`       | Alexandria 600  | `clamp(19px, 1.6vw, 24px)`  | 1.35 | −0.01em  | a card title                         |
| `text-h4`       | Alexandria 600  | `clamp(15px, 1.3vw, 18px)`  | 1.50 | 0        | a disclosure summary, a panel title  |
| `text-lead`     | Plex **300**    | `clamp(15px, 1.1vw, 17px)`  | 1.85 | 0        | the paragraph under a section head   |
| `text-lead-lg`  | Plex **300**    | `clamp(15px, 1.2vw, 18px)`  | 1.85 | 0        | the hero's and closing band's lead   |

Below the scale: page heads in tools 24px display 700; card titles 17–19px
600–700; body 15–17px at line-height ≥1.7; metadata/labels 12–13px 500–600.

Measures: `measure-ar-sm` 26rem, `measure-ar` 33rem, `measure-ar-lg` 46rem, and
the canvas's two — `measure-lead` 620px, `measure-head` 760px.

## Colour

Tokens live in `src/app/globals.css` (`--neb-*` → `@theme` names). Never
hardcode a hex in a component.

- **Brand scale** `brand-50…950` — `brand-700` (#0668c8, 5.49:1) is the anchor
  and the only blue that carries white text at body sizes. `brand-500` (#2e96ee,
  3.13:1) clears the graphics floor and not the text one: icons and large
  accents only. `brand-600` (#0a7fe0, 4.10:1) is large text only.
  `brand-50/100/200` are grounds. Legacy names `brand-hover` (=800, #0a5fb4) and
  `brand-active` (=900, #054f9e) remain valid.
- **Neutrals** — `canvas` #f7f9fc (cool cloud, the app ground), `surface` white,
  `surface-muted` #f1f3f9, `canvas-blue` #eef6fc (tinted bands), inks
  `ink-900` #0b0e15 / `ink-700` #5a6175 / `ink-600` #616878, lines `line-200`
  #e3eaf3 and `line-500` #8a91a2.
- **`ink-500` (#8a91a2) is restricted, not just faint.** It is 3.16:1 — the
  graphics floor, not the text one. Legal on NON-TEXT (hairlines, chart axes,
  disabled glyphs) and inside the `aria-hidden` drawings on the marketing page,
  where the whole picture is an illustration. Putting it on a live UI label
  anywhere in the product is a contrast bug, not a style choice.
- **The colour code** (`src/lib/accent.ts`) — blue/gold/teal/green, one ink + one
  soft ground each. **The landing page no longer uses it**: the 2026 canvas is
  monochrome blue, and the public site follows it. The code is kept for the
  tools, where four domains genuinely need telling apart (products=blue,
  questions=gold, students=teal, orders=green). The inks are unchanged — they are
  audited — and only the soft grounds moved, onto the new cooler axis.
  Every ink clears 4.5:1 on white, canvas and its own soft ground. `ink-700` is
  the smallest text allowed on a soft ground; `ink-600` is not. Colour never
  carries meaning alone — always pair with a numeral, label or icon.
- **Semantic** — `success` #247a4a (5.31:1), `warning` #8a5a0a, `error` #b33a3a,
  plus their `-soft` grounds. `success-fill` #3e9a6d is the canvas's green at
  3.47:1 — a GRAPHICS value, for glyphs and status dots, never for text.
- **Controls are exempt from the code**: every button is brand blue whatever the
  hue of the block around it.

## v3 "Momentum" — energy layer

The v2 system was correct but low-energy. Three changes fix that:

**1. Three values per hue, not two.** Every coded hue now ships `ink` (AA text),
`soft` (ground) and **`fill`** (vivid solid). Previously `fill` _was_ `ink`, so
every icon tile rendered as a small brown or bottle-green square. Fills carry
white **glyphs** only — they clear the 3:1 graphics threshold, not 4.5:1 text.
Use `inkFill` for the rare chip needing white text. Coral joins as a
celebration-only accent: it is _not_ in `ACCENTS`, so `accentAt()` can never
land on it; reach for `ACCENT.coral` explicitly.

**2. A motion system, CSS-only** (no dependency was added, and none should be):

| Utility  | Use                                                                                   |
| -------- | ------------------------------------------------------------------------------------- |
| `reveal` | section entrance, scroll-driven via `animation-timeline: view()`; degrades to visible |
| `enter`  | above-the-fold entrance; stagger with inline `--reveal-delay`                         |
| `pop-in` | a panel appearing after an interaction                                                |
| `lift`   | the hover contract for any card that is or contains a link                            |

Durations: micro 150ms, component 220ms, reveal 420ms, all on `--neb-ease`.
Only `opacity`/`transform` animate. Buttons press with `active:scale-[0.98]`.

**3. A real type scale** — see § Typography. It grew to eight steps and was
re-derived from the 2026 canvas; use those instead of arbitrary
`text-[30px] leading-[1.28]` values, which is why equal-rank headings drifted
between pages.

**Brand texture**: `bg-brand-mesh` (radial brand/cyan glows) and `bg-grid-fade`
(masked geometric grid). These are the sanctioned alternative to tinting a whole
section — use at most one per band, never behind body text.

## Elevation

Navy-tinted, one step per surface, no stacking:

| Token            | Use                                              |
| ---------------- | ------------------------------------------------ |
| `shadow-xs`      | resting buttons, form controls on tinted grounds |
| `shadow-card`    | cards, tiles, panels                             |
| `shadow-card-lg` | hero plates, hovered interactive cards           |
| `shadow-overlay` | modals, drawers, menus only                      |

Interactive cards may add `hover:-translate-y-0.5 hover:shadow-card-lg` with
`transition-all duration-200 ease-out`. Nothing else moves on hover except
colour and the arrow-nudge (`group-hover:-translate-x-1` — forward is left in
RTL).

## Shape

`rounded-control` 10px (buttons, inputs, chips-square), `rounded-panel` 14px
(cards, tiles, notices), `rounded-card` 18px (hero plates, marketing feature
panels), `rounded-full` (pills, avatars, status badges). Never mix radii on
nested corners tighter than parent.

## Component recipes

- **Button** (`ui/button.tsx`): primary = `bg-brand-700 text-white shadow-xs
hover:bg-brand-hover hover:shadow-card active:translate-y-px`; secondary =
  `border-line-200 bg-surface text-brand-700 shadow-xs hover:border-brand-500/40
hover:bg-brand-50`; ghost/outline/link/danger keep their roles. Weight 600.
- **Form control** (`ui/field.tsx`): `border-line-200 bg-surface shadow-xs
rounded-control`, hover `border-line-500`, focus `border-brand-500` + 3px soft
  ring (`--neb-focus`), invalid `border-error` + ring in error. Label: sm 600
  ink-900.
- **Card** (`ui/surface.tsx`): `rounded-panel border-line-200 bg-surface border
shadow-card`. `interactive` adds the hover lift.
- **Stat tile**: soft accent ground + accent hairline border, domain icon in a
  filled accent square (white glyph), 30px display 700 tabular numeral.
- **Table**: wrapper `rounded-panel border shadow-card overflow-hidden`; header
  row `bg-surface-muted text-ink-600 text-[13px] font-semibold`; body rows
  `divide-y divide-line-200`, hover `bg-brand-50/50`; numeric cells
  `tabular-nums`.
- **Empty/Error states**: icon in a `size-12 rounded-panel` tinted tile
  (surface-muted / error-soft), then title 600, then body ink-700.
- **App shell (admin + dashboard, identical language)**: white rail, brand
  wordmark + tool chip (`bg-brand-100 text-brand-700 rounded-full`); nav item =
  `rounded-control min-h-11` with icon, active = soft ground + 3px
  `inset-y-2 start-0` brand bar + semibold + `aria-current`; header 64px
  `bg-surface/85 backdrop-blur-xl border-line-200/70` with section locator in
  brand + avatar initial disc.
- **Page head (tools)**: 24px display 700 + ink-700 description + action slot.

## Marketing surface (the landing page)

The public landing page — `src/app/(public)/page.tsx` and `src/components/landing/*` —
is the **one** surface allowed a gradient and an ambient-motion set. It is a
conversion page seen before anyone signs in; the app shell, dashboard, admin,
checkout and exam workspace stay flat and remain governed by the Hard rules below.

Owner-authorised, re-derived 2026-08-21 from the approved canvas, superseding the
2026-08-18 entry. Nothing here may leak into a signed-in surface.

**The bands, in order** — `Hero` (#top), `Features` (#features), `Benefits`
(#benefits), `Catalogue` (#courses, containing #sims), `Demo` (#demo),
`Products` (#products), `Journey` (#journey), `Faq` (#faq), `Closing`. Sections
pad `clamp(80px, 9vw, 130px)` at the top and **zero** at the bottom — the bands
run into one another — except the two tinted grounds, which pad both ends. The
marketing grid is 1240px (`MarketingContainer`), not the app's 1280.

Two bands the previous page carried are gone with the canvas: «لماذا المنصة؟»
and the content-rights band. The load-bearing statement the second one wrapped,
`INDEPENDENCE_DISCLAIMER`, is unaffected — it still renders in the public footer,
on `/simulators`, on `/terms` and in the exam workspace.

**The sanctioned gradients** — all monochrome blue. The previous set ran brand
blue into the teal accent; the canvas runs blue into blue, and the landing page
now uses no second hue at all:

| Token / utility          | Value                                      | Use                                      |
| ------------------------ | ------------------------------------------ | ---------------------------------------- |
| `bg-gradient-brand`      | `95deg, #2e96ee → #0668c8`                 | the pill CTAs                            |
| `bg-gradient-brand-deep` | `95deg, #0a4e9b → #062f63`                 | the CTA's deep/pressed state             |
| `bg-gradient-meter`      | `90deg, #2e96ee → #0668c8`                 | every progress fill, meter and chart bar |
| `bg-gradient-tile`       | `140deg, brand-400 → brand-700`            | icon tiles carrying a white glyph        |
| `text-gradient-brand`    | clips `95deg, #2e96ee → #0668c8 → #0a4e86` | the hero h1's second run                 |

`text-gradient-brand` declares a solid `brand-700` first, so a browser without
`background-clip: text` gets brand blue rather than invisible type.

**The aurora field** — `aurora-a` … `aurora-e` plus `bg-aurora-scrim`, the
weather behind the top ~880px of the page. Five radial blobs on 8–13s
out-of-phase drifts under a white scrim that fades them out before they reach any
body text. It replaces `bg-hero-glow`, which is gone. Every blob is under 0.62
alpha, `pointer-events-none` and `aria-hidden`.

**The sanctioned motion** — ambient only, all decorative, all inside
`@media (prefers-reduced-motion: no-preference)`:

| Utility                           | Use                                                  |
| --------------------------------- | ---------------------------------------------------- |
| `aurora-a` … `aurora-e`           | the hero's ambient field                             |
| `float-a` / `float-b` / `float-c` | the hero's four floating stat chips                  |
| `glow-pulse`                      | the hero plate's radial glow                         |
| `grow-bar` / `draw-ring`          | chart bars and the SVG progress rings, scroll-driven |
| `lift`                            | the hover contract for any card that is a link       |

`reveal`, `grow-bar` and `draw-ring` run on `animation-timeline: view()`, and
their finished state is the default — so the charts are complete, not empty,
where the timeline is unsupported. **A scroll-driven animation cannot be
staggered with `animation-delay`**: the delay is ignored outright when the
timeline is not `auto`. Stagger by moving the range instead, via `revealStep()`
in `landing/parts.tsx`. `revealDelay()` is for `enter` only.

The landing page therefore ships **no** `IntersectionObserver` — the canvas has
one and it is deliberately not ported — and one small client island (the demo's
play overlay).

**Marketing elevation and shape** — `shadow-cta`, `shadow-float`, `shadow-plate`;
`rounded-plate` 26px and `rounded-shell` 24px. These are larger than the app's
scale because the plates they wrap are marketing objects, not UI surfaces.

**The mockup convention.** The page pictures the product with inert, `aria-hidden`
drawings — a browser chrome around a dashboard, an exam question, a week of
training. Every figure inside one (74%، 12:42، «الدرس 4 من 12») is illustration,
not a claim, and is kept out of the accessibility tree for exactly that reason.
Anything large enough to be mistaken for a screenshot also carries a visible
`SpecimenLabel`. What is still never claimed anywhere: student counts, pass
rates, ratings, testimonials, countdowns, prices.

**§products is the catalogue, not a prospectus.** The canvas draws six invented
course cards; the band reads the published `COURSE` products from Prisma instead
— same filter, ordering and published-only counting as `/courses`, so the two
screens cannot drift. Covers fall back to the composed brand field when an
administrator has attached none. The cards still carry no price and no purchase
control: they are an index into the catalogue, and each one links to its own
product page.

Empty and failed both render **nothing** — the band removes itself. This is the
one place the marketing page differs from `/courses`, which shows an empty state
and an error state: a homepage that announces «لا توجد دورات» is worse than one
that does not raise the subject, and an outage must not put an error panel in the
middle of it.

**Buttons.** `size="hero"` exists only for the homepage hero's CTA. The marketing
pill (`variant="gradient"`, `shape="pill"`) exists here and — since 2026-08-22,
owner-authorised — on the exam workspace's one terminal action; see _Exam
workspace_ for why that single control earns it. Every other control on a
signed-in surface stays `bg-brand-700`.

## Catalogue detail — the cover plate

Re-derived 2026-08-21 from the approved canvas «تفاصيل الدورة — بناء العهد
الجديد», owner-authorised. It governs `/courses/[slug]`
(`marketing/course-masthead.tsx`, `course-curriculum.tsx`, `breadcrumbs.tsx`).
`/simulators/[slug]` has **not** been moved onto it yet and still renders the
previous ruled document; the two catalogue detail pages are therefore
inconsistent until that page gets its own canvas.

**The page, in order**: breadcrumb trail → cover plate → a two-column body of
`minmax(0,1fr) 340px`, curriculum and About in the main column, a sticky rail
(`lg:top-28`, clearing the 96px bar) beside it. Above the fold uses `enter`;
the two body panels use `reveal`. The rail is deliberately outside both — a
scroll-driven transform on a sticky element's ancestor is a fight nobody wins.

**The plate is a cover, not a dark section.** This is the one thing to
understand before changing it. `marketing/course-cover.tsx` already draws this
navy field on every catalogue card, and states the argument there: imagery
inside a bounded frame may be dark for the same reason a photograph may be, and
the frame is what stops it becoming a theme. The plate is that same component at
`scale="plate"`, so a product with an administrator's cover carries it from the
grid into the masthead. **No-dark-sections still holds everywhere else**, and
nothing below may leave a cover frame.

| Token / utility          | Use                                                   |
| ------------------------ | ----------------------------------------------------- |
| `cover-900/800/700`      | the field's navy — `course-cover.tsx` only            |
| `cover-mint` (#9be0be)   | the owned-state glyph on the plate; 7.9:1 worst case  |
| `cover-drift-a/-b`       | the plate's two ambient glows, 16s/21s                |
| `bg-cover-grid`          | 5% white at a 44px pitch, over image and field alike  |
| `bg-cover-scrim-plate`   | the canvas's ramp, 0.18→0.93 — over the DEFAULT field |
| `bg-cover-scrim-photo`   | 0.72→0.95 — over an administrator's photograph        |
| `Button variant="cover"` | white pill, `cover-900` ink; the plate's one control  |

Two scrims because the plate carries body text across its whole width, not one
line along its bottom edge. Over the default field the light end may be 0.18 —
that ground is navy already. Over a photograph it may not: white type needs the
ground at L ≤ 0.12 to clear 4.5:1, which a white image reaches at about 0.63 of
`rgb(4 16 32)`, and 0.72 buys the margin that keeps the small labels at
`white/70`. The canvas never had to solve this because an artboard draws no
photograph. Both angles are physical and do not mirror under RTL, because they
balance the drift glows, which are placed physically for the same reason.

The drift is the second sanctioned ambient motion in the product and the first
outside the landing page. It is gated at the source (`prefers-reduced-motion:
no-preference`) like every other one, because the global rule clamps duration,
which for an infinite drift is a jitter rather than a stillness.

**Where the canvas was not followed, and why.** Each of these is a claim the
database cannot support or a contrast floor, not a preference:

1. **«ماذا ستكسب من الدورة» and its four bullets are gone.** There is no
   learning-outcomes column, and the artboard's four lines are about the
   quantitative course specifically. The slot renders `longDescription` under
   «عن الدورة» when an administrator has written one, and nothing when they
   have not.
2. **The support card claims no turnaround.** The canvas offers a reply «خلال
   يوم عمل»; nobody has made that promise. The card carries
   `contact.eyebrow` + `contact.description`, which is what the product does say.
3. **«الغلاف يُضاف من لوحة التحكم» is gone.** It is a note from the designer to
   the owner, and it was addressed to an administrator on a student's page.
4. **Locked lessons stay locked.** The artboard draws every row openable,
   because an artboard naturally shows the owner's view. Preview-or-owned still
   decides, and a locked row is still not a link and not a tab stop.
5. **The panel is state-chosen, not the artboard's one state.** The canvas draws
   only «هذه الدورة في حسابك». `PurchasePanel` still picks between owned,
   pending-order and buy; the plate supplies a ground and nothing else.
6. **`ink-500` is not used.** The canvas sets its trail, meta and figures in
   #8a91a2. That is the restricted ink — 3.16:1, non-text only — so live labels
   here are `ink-600`, and the small white labels on the plate are `white/70`
   rather than the canvas's 0.6.
7. **The plate is `rounded-plate` (26px), not 30px**, and the inner panels use
   `rounded-card`/`rounded-shell` — no seventh radius was added.
8. **Counted nouns are correctly inflected.** The canvas writes «وحدة واحدة ·
   درسان», which the catalogue card's «{n} + plural» shortcut cannot produce.
   `formatCount` in `lib/format.ts` selects the form with `Intl.PluralRules`;
   the card is unchanged and keeps its documented shortcut.

## Exam workspace

Re-derived 2026-08-22 from the approved canvas «صفحة الاختبار — بناء العهد
الجديد», owner-authorised. It governs the live attempt only —
`components/exam/exam-workspace.tsx` on `/exam/[attemptId]`. The instructions
screen before it and the review screen after it are unchanged; neither is in the
canvas.

**The command bar is dark, and this is the second and last exemption.** The
argument is not the cover-frame one — a full-width strip is not bounded imagery.
It is that this route has no site header, no rail and no footer _by design_
(`exam/[attemptId]/layout.tsx`: a running clock makes every navigation control a
trap). The band is what tells a student which pixels are the exam's chrome and
which are the paper they are working on, and that distinction is load-bearing on
the one screen where clicking the wrong thing costs time that does not come
back. It reuses `cover-900/800/700` and `cover-drift-a`; it adds
`cover-amber`. **No third dark surface follows from this** — a band is dark here
because the screen has no other chrome, which is true of exactly one route.

| Token / class         | Use                                                 |
| --------------------- | --------------------------------------------------- |
| `cover-amber` #f2a93b | caution INSIDE a cover ground; 7.1:1 on `cover-800` |
| `bg-gradient-meter`   | the answered meter, on a `bg-white/15` track        |
| `variant="gradient"`  | the section's terminal action — see below           |

`warning` (#8a5a0a) is audited against white and lands near 1.6:1 on the bar, so
the timer's warning state uses `cover-amber` on ground, border and glyph — and
**never on the numerals**, which stay white in both states. A clock that warns
by recolouring its own digits warns nobody who cannot see the colour.

**`variant="gradient"` off the landing page.** The canvas draws «إنهاء القسم
والانتقال» as the marketing pill, and it is adopted for that one control. The
rule it narrows — "every control on a signed-in surface stays `brand-700`" —
still holds for every other button in the product, including the two beside it.
The case for the exception is that this is the only irreversible control a
student meets, it competes with nothing else on the screen, and the canvas
weights it accordingly. If the owner disagrees, `variant="primary"` restores the
previous rule with no other change.

**Where the canvas was not followed, and why.** Every one of these is an
accessibility floor or a piece of state the artboard had no reason to draw:

1. **The options are still radio inputs.** The canvas draws each one as a `div`
   with a click handler — unreachable by keyboard, silent to a screen reader, on
   the one screen where a missed input costs a mark. The input is `sr-only` and
   the lettered chip is its rendering, so arrow keys still move between options
   and the group is still a group. Verified: four exposed radios, `ArrowDown`
   selects, no horizontal overflow from the hidden inputs.
2. **Question cells are 44px, not the canvas's 40px.** 40 is under the touch
   target floor. The grid is `auto-fill` so it reflows rather than shrinking.
3. **The save indicator exists.** The canvas has no such state. It is the third
   rule of this component — an unsaved answer does not count — and it is drawn in
   the on-cover values, with the FAILURE alone as a solid `error` chip with white
   text (5.86:1) rather than a tinted glass, because that one is worth shouting.
4. **The flag button's label names the action** («إزالة العلامة»), not the state.
   `aria-pressed` and the ochre ground carry the state; a toggle whose label
   becomes a statement leaves nobody sure what pressing it does.
5. **The advance warning is on the page, not only in the dialog.** Same sentence
   (`advanceWarning` / `submitWarning`), shown in the rail beside the control. A
   warning first met in a modal is read while already committed.
6. **The header's meter is a COUNT** — «٧ من ٢٤», never a percentage. The bar is
   `aria-hidden` like every bar in the product, so the figure is the accessible
   value. The screen still computes no score.
7. **Option letters are positional** (`optionLetters` in `copy.ts`), because
   `option.key` is the bank's identifier and a student says «اخترت ب». The review
   screen shows the option's text rather than its letter, so the two cannot
   contradict each other.

Nothing in the component's logic moved: the countdown still recomputes against
`serverTime`, zero still refetches rather than advancing, autosave still rebases
on a 409, and the exit guard is untouched. The diff is the return statement.

## Signature elements

- **KhatimField** (`marketing/ornament.tsx`): the cultural signature. Three
  sanctioned placements: the student overview's greeting frieze, and the two auth
  brand panels. Always framed by drawn rules or the panel's own edge, never
  faded, never behind body text. **The homepage is not one of them** — the 2026
  canvas draws no khatim, and its ambient layer is the aurora field instead;
  putting a lattice over that is two atmospheres on one page.
- **Photography**: documentary, cropped tight on hands/materials, never faces,
  never behind text, always through `next/image` with explicit `sizes`.

## Hard rules

- RTL logical properties only (`ps/pe/ms/me/start/end`); forward arrows point
  left (`ArrowLeft`).
- **Tracking is display-only.** Negative letter-spacing is permitted on
  Alexandria display type at 19px and above — that is `text-display` through
  `text-h3`, which carry it themselves — and nowhere else. Body, UI, form and
  table text stay at `letter-spacing: 0`, because Arabic is cursive and tracking
  breaks the joins between letters at reading sizes. Positive tracking is legal
  only on runs of LATIN numerals (the journey ordinals). Setting
  `letter-spacing` by hand on any Arabic run is a bug.
  _This narrows the previous absolute rule, and it is owner-authorised: the
  approved canvas tracks its headlines and the identity depends on it._
- All user-facing Arabic comes from `src/lib/copy.ts`. Never invent copy.
- `prefers-reduced-motion` is handled globally; never opt an element out.
- Contrast floors: 4.5:1 body text, 3:1 large text/icons — the token pairings
  above are pre-audited; do not invent new pairings.
- No dark sections and no dark theme, anywhere. No gradients beyond tinted
  grounds and no animation beyond the transitions named here — **except** in
  three places, each with a closed set listed in its own section: the landing
  page (_Marketing surface_), a **cover frame** (_Catalogue detail_), and the
  live attempt's command bar (_Exam workspace_). A gradient or ambient keyframe
  anywhere else is a bug. A cover frame is bounded imagery; a band that runs to
  the page's edges is not one, whatever it is called — the exam bar is dark for
  a different reason, and that reason applies to exactly one route.
- Never change: routes, handlers, aria wiring, focus management, exam timing
  logic, the independence disclaimer's placements. Prisma queries are equally
  fixed, with two recorded exceptions, both on the landing page:
  1. 2026-08-18 — the featured-products query was removed, because the
     replacement design had no ledger to render.
  2. 2026-08-21 — a published-courses query was added to §products, replacing
     the canvas's six invented cards, which makes `/` a `force-dynamic` route
     again. The band catches its own failure and disappears, so an outage still
     cannot degrade the rest of the page.

  A third, off the landing page:

  3. 2026-08-21 — `getCourseDetail` selects `coverAsset`, so the course page's
     plate can draw the cover the catalogue card already drew. Four columns,
     the same four and for the same reason as `(public)/courses/page.tsx`. No
     query that decides access, price or progress was touched.
