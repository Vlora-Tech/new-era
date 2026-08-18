# بناء العهد الجديد — Design System 2026

The product's visual identity, decided once here. Every surface — marketing site,
student dashboard, admin portal, checkout, exam workspace — draws from this file.
When a screen and this file disagree, the screen is wrong.

## Identity in one paragraph

A confident Saudi EdTech product: cool cloud neutrals instead of warm paper, one
vivid brand blue with a full scale, a four-hue functional colour code, geometric
khatim tilework as the cultural signature, **Alexandria** display type for
headline confidence over **IBM Plex Sans Arabic** body text, 10/14/18px radii,
and a quiet navy-tinted elevation scale. Depth is allowed but earned: one shadow
step per surface, no gradients heavier than a tinted ground, no motion beyond
150–200ms micro-transitions. Light theme only.

## Typography

| Role                                      | Family               | Token                 | Notes                                                    |
| ----------------------------------------- | -------------------- | --------------------- | -------------------------------------------------------- |
| Display & headings (h1–h4, stat numerals) | Alexandria           | `font-display`        | weights 600/700; never letter-spaced (Arabic is cursive) |
| Body, UI, forms, tables                   | IBM Plex Sans Arabic | `font-sans` (default) | weights 400/500/600/700                                  |

Both load via `next/font/google` in `src/app/layout.tsx`; no runtime font
requests. `text-display` (homepage h1 only) uses the display family at clamp
40→68px. Section heads: 26/32px display 700. Page heads in tools: 24px display 700. Card titles: 17–19px sans 600–700. Body: 15–17px, line-height ≥1.7.
Metadata/labels: 12–13px sans 500–600.

## Colour

Tokens live in `src/app/globals.css` (`--neb-*` → `@theme` names). Never
hardcode a hex in a component.

- **Brand scale** `brand-50…950` — `brand-700` (#1066a4) is the only blue that
  carries white text at body sizes. `brand-500` for icons/large accents only.
  `brand-50/100/200` are grounds. Legacy names `brand-hover` (=800) and
  `brand-active` (=900) remain valid.
- **Neutrals** — `canvas` #f4f7fa (cool cloud, the app ground), `surface` white,
  `surface-muted` #ecf1f5, `canvas-blue` #eef6fb (tinted bands), inks
  `ink-900/700/600`, lines `line-200/500`.
- **The colour code** (`src/lib/accent.ts`) — blue/gold/teal/green, one ink + one
  soft ground each. Public site: the four movements of the method. Tools: the
  four domains (products=blue, questions=gold, students=teal, orders=green).
  Every ink clears 4.5:1 on white, canvas and its own soft ground. `ink-700` is
  the smallest text allowed on a soft ground; `ink-600` is not. Colour never
  carries meaning alone — always pair with a numeral, label or icon.
- **Semantic** — success/warning/error + their `-soft` grounds, unchanged.
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

**3. A real type scale** — `text-display`, `text-h1`, `text-h2`, `text-h3`,
`text-lead`. Use these instead of arbitrary `text-[30px] leading-[1.28]` values,
which is why equal-rank headings drifted between pages.

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

Owner-authorised, 2026-08-18, when the previous editorial landing page was replaced.
Nothing here may leak into a signed-in surface.

**The sanctioned gradients** — three, all built from the brand blue flowing into the
existing teal accent, none invented per-component:

| Token / utility          | Value                                  | Use                                                            |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| `bg-gradient-brand`      | `95deg, brand-500 → accent-teal-fill`  | the pill primary CTA                                           |
| `bg-gradient-brand-deep` | `95deg, brand-600 → accent-teal`       | text-clip on the hero h1 span, progress fills                  |
| `bg-gradient-tile`       | `140deg, brand-400 → accent-teal-fill` | small icon tiles carrying a white glyph                        |
| `bg-hero-glow`           | radial brand/teal blobs                | the hero's ambient field — a larger sibling of `bg-brand-mesh` |

`text-gradient-brand` clips `bg-gradient-brand-deep` to text and declares a solid
`brand-700` colour first, so a browser without `background-clip: text` gets brand
blue rather than invisible type.

**The sanctioned motion** — ambient only, all decorative, all inside
`@media (prefers-reduced-motion: no-preference)`:

| Utility                           | Use                                                 |
| --------------------------------- | --------------------------------------------------- |
| `float-a` / `float-b` / `float-c` | the hero's four floating stat chips                 |
| `glow-pulse`                      | the hero plate's radial glow                        |
| `grow-bar` / `draw-ring`          | chart bars and the SVG progress ring, scroll-driven |

`grow-bar` and `draw-ring` use `animation-timeline: view()` like `reveal`, and their
finished state is the default — so the charts are complete, not empty, where the
timeline is unsupported. The landing page therefore ships **no** `IntersectionObserver`
and one small client island (the demo's play overlay).

**Marketing elevation and shape** — `shadow-cta`, `shadow-float`, `shadow-plate`;
`rounded-plate` 26px and `rounded-shell` 28px. These are larger than the app's scale
because the plates they wrap are marketing objects, not UI surfaces.

**The mockup convention.** The page pictures the product with inert, `aria-hidden`
drawings — a browser chrome around a dashboard, an exam question, a lesson list. Every
figure inside one (74%، 12:42، «الدرس 4 من 12») is illustration, not a claim, and is
kept out of the accessibility tree for exactly that reason. What is still never
claimed anywhere: student counts, pass rates, ratings, testimonials, countdowns.

**Buttons.** The marketing pill (`variant="gradient"`, `shape="pill"`) exists only
here. Every control on a signed-in surface stays `bg-brand-700`.

## Signature elements

- **KhatimField** (`marketing/ornament.tsx`): the cultural signature. Sanctioned
  placements: homepage masthead/friezes (existing), hero plate ground, and the
  auth brand panel. Always framed by drawn rules or the panel's own edge, never
  faded, never behind body text.
- **Photography**: documentary, cropped tight on hands/materials, never faces,
  never behind text, always through `next/image` with explicit `sizes`.

## Hard rules

- RTL logical properties only (`ps/pe/ms/me/start/end`); forward arrows point
  left (`ArrowLeft`).
- All user-facing Arabic comes from `src/lib/copy.ts`. Never invent copy.
- `prefers-reduced-motion` is handled globally; never opt an element out.
- Contrast floors: 4.5:1 body text, 3:1 large text/icons — the token pairings
  above are pre-audited; do not invent new pairings.
- No dark sections and no dark theme, anywhere. No gradients beyond tinted
  grounds and no animation beyond the transitions named here — **except** on the
  landing page, whose closed set of both is listed under _Marketing surface_
  above. A gradient or ambient keyframe on any other surface is a bug.
- Never change: routes, handlers, aria wiring, focus management, exam timing
  logic, the independence disclaimer's placements. Prisma queries are equally
  fixed, with one recorded exception: the landing page's featured-products query
  was removed on 2026-08-18 because the replacement design has no ledger to
  render, which returned `/` to a static route.
