import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconCheck, IconInfo } from './icons';

/**
 * The landing page's shared vocabulary.
 *
 * The approved canvas is one artboard of inline styles in which the same dozen
 * figures recur — an eyebrow pill, a gradient glyph tile, a labelled meter, a
 * browser frame, a floating chip, a tinted mock frame with a white card inside
 * it. Written out at each site that is ~1400 lines of near-duplicate markup and
 * nine slightly different eyebrows. They live here instead, so a change to the
 * figure is one edit.
 *
 * Everything in this file is a Server Component. Nothing here holds state.
 *
 * ── How the canvas's hexes became tokens ───────────────────────────────────
 *
 * The canvas is an artboard: it writes a literal hex at every element, and uses
 * about a hundred and forty of them, most within a percent of each other. They
 * were collapsed onto the scale in `globals.css` rather than transcribed, and
 * the mapping is worth stating once because it is the answer to "why doesn't
 * this say #EEF0F7":
 *
 *   #e3eaf3 / #eef0f7 / #edeff7 / #eaf0f7   →  line-200 (at /70 for the
 *                                              lighter hairlines inside a
 *                                              drawing)
 *   #f1f3f9 / #edf2f8 / #f0f2f8             →  surface-muted
 *   #f7f9fc / #fafbfe / #fbfdff             →  canvas, or brand-50 at low alpha
 *   #f5fafe / #edf4fb / #e7f2fd / #eaf4fd   →  brand-50 / brand-100
 *   #d3e7f8 / #dcebfa / #dfedfa             →  brand-200
 *   #bcddf7 / #c2e1f8 / #a9d4f4             →  brand-300
 *   #3da0f0 / #57adf4 / #4fadf5             →  brand-400
 *   #2e96ee → brand-500   #0a7fe0 → brand-600   #0668c8 → brand-700
 *   #0a63bf / #0a5fb4 → brand-800            #054f9e / #0b5490 → brand-900
 *   #0b0e15 / #0d1119 / #0f1420 / #111623   →  ink-900
 *   #5a6175 / #4a5162 / #4e5568             →  ink-700
 *   #5f6779 / #616878 / #666d7d / #6b7385   →  ink-600
 *   #7a8194 / #828a9c / #8a91a2 / #98a0b0   →  ink-500  (see the restriction
 *                                              on that token — specimen chrome
 *                                              and non-text only)
 *   #3e9a6d → success-fill    #2f8259 → success
 *
 * No component in this directory writes a hex.
 *
 * ── The specimen rule ──────────────────────────────────────────────────────
 *
 * Several of these — `BrowserChrome`, `Meter`, `MiniBars`, `DayBars`,
 * `ProgressRing`, `FloatChip`, `MockFrame`, `MockCard`, `AttemptRow` — exist
 * only to draw a picture of the product. They are marked `aria-hidden` by their
 * callers and the figures inside them are invented. That is what keeps «٧٤٪»
 * legible as an illustration rather than as a claim about anybody's results.
 * Any drawing large enough to be mistaken for a screenshot also carries a
 * visible `SpecimenLabel`.
 */

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Inline `--reveal-delay`, for staggering the hero's `enter` group.
 *
 * `enter` ONLY. It runs on the document timeline and honours a delay; `reveal`
 * runs on `animation-timeline: view()`, where `animation-delay` is ignored by
 * spec, so passing this to a `reveal` element writes a property nothing reads.
 *
 * There is no `reveal` equivalent, and the note in `globals.css` explains why:
 * staggering a scroll-driven entrance by moving its range strands the last rows
 * of the last sections at `opacity: 0`, because the document runs out of scroll
 * before their range completes.
 */
export const revealDelay = (ms: number): CSSProperties =>
  ({ '--reveal-delay': `${ms}ms` }) as CSSProperties;

/* ── Container ─────────────────────────────────────────────────────────────
 *
 * The marketing grid is 1240px with a `clamp(16px, 3vw, 40px)` gutter, which is
 * narrower than the app's 1280/32 `Container`. It is a separate component
 * rather than a prop on that one because the two are measured against different
 * things: the app's grid is measured against a data table, this one against the
 * canvas.
 */
export function MarketingContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10', className)}>
      {children}
    </div>
  );
}

/* ── Section wrapper ───────────────────────────────────────────────────────
 *
 * `scroll-mt-36 lg:scroll-mt-44` matches the header's `h-36 lg:h-44` exactly.
 * The two are load-bearing on each other: an anchored section that forgets it
 * lands underneath the sticky bar.
 *
 * The canvas pads its sections `clamp(80px, 9vw, 130px)` at the top and **zero**
 * at the bottom — the bands run into one another and the rhythm comes from the
 * next section's top padding alone. `flow` is that; `full` pads both ends and is
 * for the two tinted bands, which need air inside their own ground.
 */
export function SectionShell({
  id,
  tone = 'plain',
  pad = 'flow',
  className,
  children,
}: {
  id?: string;
  /**
   * `band` and `closing` are the canvas's two full-bleed grounds. They are the
   * only two, and both are tinted light — the product has no dark sections and
   * this page did not introduce one.
   */
  tone?: 'plain' | 'band' | 'closing';
  pad?: 'flow' | 'full';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-36 lg:scroll-mt-44',
        pad === 'flow' ? 'pt-20 sm:pt-24 lg:pt-[130px]' : 'py-[70px] sm:py-20 lg:py-[110px]',
        tone === 'band' &&
          'border-line-200/70 via-canvas-blue to-brand-50 overflow-hidden border-y bg-linear-to-b from-white from-0% via-55% to-100%',
        tone === 'closing' &&
          'via-brand-200 to-brand-50 overflow-hidden bg-linear-to-b from-white from-0% via-70% to-100%',
        className,
      )}
    >
      <MarketingContainer>{children}</MarketingContainer>
    </section>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────────────────── */

/**
 * The canvas keeps an eyebrow on only three bands — §simulators, §products and
 * §journey. Everywhere else the head stands alone, which is why `SectionIntro`
 * takes the eyebrow as optional rather than required.
 */
export function Eyebrow({
  icon: Icon,
  children,
  className,
}: {
  icon: IconType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'border-line-200 bg-surface inline-flex items-center gap-2.5 rounded-full border py-[5px] ps-[5px] pe-4 shadow-xs',
        className,
      )}
    >
      <span className="bg-gradient-tile inline-flex size-[25px] shrink-0 items-center justify-center rounded-full text-white">
        <Icon className="size-[15px]" aria-hidden="true" />
      </span>
      <span className="text-ink-700 text-[14px] font-medium whitespace-nowrap">{children}</span>
    </span>
  );
}

/* ── Section intro ───────────────────────────────────────────────────────── */

export function SectionIntro({
  icon,
  eyebrow,
  title,
  lead,
  align = 'center',
  /** `tight` is the canvas's smaller head, for a two-column block. */
  size = 'lg',
  className,
}: {
  icon?: IconType;
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  align?: 'center' | 'start';
  size?: 'lg' | 'tight';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' && 'text-center', className)}>
      {icon && eyebrow ? (
        <div className="reveal">
          <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
        </div>
      ) : null}
      <h2
        className={cn(
          'text-ink-900 reveal',
          size === 'lg' ? 'text-h2' : 'text-h2-tight',
          icon && eyebrow ? 'mt-6' : null,
          align === 'center' && 'measure-head mx-auto',
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            'text-ink-700 text-lead reveal mt-5',
            align === 'center' ? 'measure-lead mx-auto' : 'max-w-[480px]',
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/* ── Check list ──────────────────────────────────────────────────────────── */

export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => (
        <li key={item} className="text-ink-700 flex items-start gap-2.5 text-[15px]">
          <IconCheck className="text-brand-700 mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Glyph tile ──────────────────────────────────────────────────────────── */

const TILE_SIZE = {
  sm: 'size-8 rounded-[9px] [&_svg]:size-4',
  md: 'size-9.5 rounded-[11px] [&_svg]:size-5',
  lg: 'size-13 rounded-[15px] [&_svg]:size-6',
  xl: 'size-24 rounded-[26px] [&_svg]:size-11',
} as const;

/**
 * The canvas's rounded icon square, in two tones.
 *
 * `vivid` is the gradient fill with a white glyph. It clears the 3:1 graphics
 * threshold but NOT the 4.5:1 text one, which is why this component takes an
 * icon and never a label — see the fill/ink split in docs/design-system.md.
 */
export function GlyphTile({
  icon: Icon,
  size = 'md',
  tone = 'vivid',
  className,
}: {
  icon: IconType;
  size?: keyof typeof TILE_SIZE;
  /**
   * Three tones, which is the whole set the canvas uses. `success` exists for
   * exactly one tile — the completed-lessons count in the dashboard drawing —
   * and is the only place the page leaves the blue.
   */
  tone?: 'vivid' | 'soft' | 'success';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        TILE_SIZE[size],
        tone === 'vivid' && 'bg-gradient-tile text-white',
        tone === 'soft' && 'bg-brand-100 text-brand-700',
        tone === 'success' && 'bg-success-soft text-success',
        className,
      )}
    >
      <Icon strokeWidth={size === 'lg' || size === 'xl' ? 1.75 : 2} />
    </span>
  );
}

/* ── Specimen label ──────────────────────────────────────────────────────── */

/**
 * The caption that turns a drawing into a specimen.
 *
 * Every large mockup on this page carries one. It is the reason the invented
 * figures inside them are not claims: the reader is told, in words and next to
 * the artwork, that what they are looking at is an illustration of the
 * interface.
 */
export function SpecimenLabel({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'text-ink-600 flex items-center justify-center gap-2 text-center text-[12.5px]',
        className,
      )}
    >
      <IconInfo className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{COPY.legal.sampleContentLabel}</span>
    </p>
  );
}

/* ── Cards ───────────────────────────────────────────────────────────────── */

/**
 * The canvas's marketing card: a 24px plate with a faint sheen running out of
 * its top edge, one hairline, and the shared hover lift.
 *
 * The sheen is `brand-50` at 45% over white rather than the canvas's literal
 * #fbfcff, which is the same colour to within a percent and keeps the card on
 * the token scale.
 */
export function PlateCard({
  className,
  interactive = true,
  style,
  children,
}: {
  className?: string;
  interactive?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cn(
        'border-line-200 from-brand-50/45 rounded-[24px] border bg-linear-to-b from-0% to-white to-45% p-6 shadow-xs sm:p-7',
        interactive && 'lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The tinted frame that every drawing sits inside, and the white card inside
 * that. Two components because the canvas nests them everywhere and the pair
 * carries the whole "this is a picture of a screen" convention: tinted ground,
 * inset white sheet, hairline on both.
 */
export function MockFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'border-line-200/70 rounded-panel from-brand-50 to-brand-100 border bg-linear-to-b p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MockCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-line-200/70 bg-surface rounded-[12px] border p-3.5', className)}>
      {children}
    </div>
  );
}

/* ── Chips ───────────────────────────────────────────────────────────────── */

/**
 * The canvas's two small pills: a blue one that labels a section of the exam,
 * and a neutral one that carries a count. `brand-800` on `brand-100` is 6.4:1,
 * so both are legible at the 11–12.5px these are set at.
 */
export function Chip({
  tone = 'brand',
  className,
  children,
}: {
  tone?: 'brand' | 'neutral';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap',
        tone === 'brand' && 'bg-brand-100 text-brand-800 px-3 py-[5px] text-[11.5px] font-semibold',
        tone === 'neutral' &&
          'border-line-200/70 bg-canvas text-ink-700 border px-3.5 py-[7px] text-[12.5px]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Answer option ───────────────────────────────────────────────────────── */

/**
 * One answer row inside any of the drawn question cards.
 *
 * Three drawings use it — the drill in the bento, the compact question card in
 * §simulators and the full screen in §demo — and it lived in two of them at
 * once before this, at two slightly different scales. `size` is the only thing
 * that ever actually differed.
 *
 * The selection is carried by three signals and never by colour alone: the
 * ground changes, the weight goes up, and a glyph appears — which is the same
 * rule the real exam workspace follows.
 */
export function OptionRow({
  letter,
  label,
  selected = false,
  size = 'md',
  icon: Icon = IconCheck,
}: {
  letter: string;
  label: string;
  selected?: boolean;
  size?: 'sm' | 'md';
  icon?: IconType;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[12px] border',
        size === 'md' ? 'px-3.5 py-3 text-[13.5px]' : 'px-3 py-2.5 text-[12.5px]',
        selected
          ? 'border-brand-300 text-ink-900 from-brand-100 to-brand-50 bg-linear-to-l font-semibold'
          : 'border-line-200/70 bg-canvas text-ink-700',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg font-bold',
          size === 'md' ? 'size-6.5 text-[12px]' : 'size-5.5 text-[11px]',
          selected
            ? 'bg-brand-700 text-white'
            : 'border-line-200/70 bg-surface-muted text-ink-500 border',
        )}
      >
        {letter}
      </span>
      <span className="flex-1">{label}</span>
      {selected ? (
        <Icon className={cn('text-brand-700 shrink-0', size === 'md' ? 'size-4.5' : 'size-4')} />
      ) : null}
    </div>
  );
}

/* ── Browser chrome ──────────────────────────────────────────────────────── */

/**
 * The window frame around the two big product drawings.
 *
 * The strip is `dir="ltr"` because window chrome is not Arabic text — the dots
 * belong at the left in every OS, including on an RTL page.
 *
 * The canvas puts a fabricated address (`exam.example.sa/simulator`) in the URL
 * pill. It is deliberately NOT reproduced: an invented domain shaped like an
 * exam authority's is exactly the confusion the independence disclaimer exists
 * to prevent. The pill renders empty, as it does in the hero.
 */
export function BrowserChrome({ title }: { title?: string }) {
  return (
    <div
      dir="ltr"
      className="border-line-200/70 bg-canvas flex items-center gap-3.5 border-b px-4 py-2.5"
    >
      <span className="flex gap-1.5">
        <span className="bg-line-500/45 size-2.5 rounded-full" />
        <span className="bg-line-500/45 size-2.5 rounded-full" />
        <span className="bg-line-500/45 size-2.5 rounded-full" />
      </span>
      {title ? (
        <span dir="rtl" className="text-ink-500 truncate text-[12px]">
          {title}
        </span>
      ) : null}
      <span className="flex flex-1 justify-center">
        <span className="border-line-200/70 bg-surface h-6 w-2/5 max-w-[420px] min-w-[180px] rounded-lg border" />
      </span>
    </div>
  );
}

/* ── Meter ───────────────────────────────────────────────────────────────── */

export function Meter({
  label,
  value,
  percent,
  className,
}: {
  label: string;
  value: string;
  percent: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-ink-600 mb-1.5 flex items-baseline justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-display text-ink-900 text-[14px] font-bold">{value}</span>
      </div>
      <div className="bg-surface-muted h-[7px] overflow-hidden rounded-full">
        <div className="bg-gradient-meter h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ── Bar charts ──────────────────────────────────────────────────────────── */

/**
 * The five-week, two-series column chart.
 *
 * Heights are inline and final; `grow-bar` animates *from* zero on the
 * element's own scroll timeline. That direction matters — a browser without
 * `animation-timeline`, or a reader who asked for less motion, gets a finished
 * chart rather than an empty one.
 */
export function MiniBars({
  groups,
  className,
}: {
  groups: readonly (readonly [number, number])[];
  className?: string;
}) {
  return (
    <div className={cn('flex h-full items-end justify-between gap-2.5', className)}>
      {groups.map((pair, groupIndex) => (
        <div key={groupIndex} className="flex h-full flex-1 items-end gap-[5px]">
          {pair.map((height, seriesIndex) => (
            <span
              key={seriesIndex}
              className={cn(
                'grow-bar flex-1 rounded-t-[5px]',
                seriesIndex === 0 ? 'bg-gradient-meter' : 'bg-brand-200',
              )}
              style={
                {
                  height: `${height}%`,
                  '--bar-delay': `${groupIndex * 80 + seriesIndex * 100}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The single-series column chart in §benefits, where each column sits in its own
 * rounded track with a day label under it.
 *
 * The track is what makes this read as "minutes out of a day" rather than as a
 * bare bar — the canvas draws the empty remainder, and dropping it would turn a
 * 20% Friday into an invisible one.
 */
export function DayBars({
  days,
  className,
}: {
  days: readonly { readonly label: string; readonly percent: number }[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-end gap-2.5', className)}>
      {days.map((day, index) => (
        <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="bg-canvas flex h-[78px] w-full items-end overflow-hidden rounded-lg">
            <div
              className="grow-bar from-brand-400 to-brand-700 w-full rounded-t-lg bg-linear-to-b"
              style={
                { height: `${day.percent}%`, '--bar-delay': `${index * 70}ms` } as CSSProperties
              }
            />
          </div>
          <span className="text-ink-500 text-[11px] whitespace-nowrap">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Progress ring ───────────────────────────────────────────────────────── */

const RING_RADIUS = 50;
const RING_CIRCUMFERENCE = Math.round(2 * Math.PI * RING_RADIUS);

const RING_SIZE = {
  lg: { box: 'size-[150px]', label: 'text-[30px]', stroke: 13 },
  md: { box: 'size-[70px]', label: 'text-[17px]', stroke: 14 },
  sm: { box: 'size-[56px]', label: 'text-[12px]', stroke: 15 },
} as const;

/**
 * The SVG progress ring.
 *
 * `gradientId` is required and has no default on purpose. Several rings render
 * on this page; had they shared a hardcoded `<linearGradient id>` — as the
 * artboard did, with one `id="ringGrad"` — every ring after the first would
 * silently paint with the first's definition, and would lose its stroke
 * entirely if the first were ever removed.
 *
 * The centred label scales with the ring rather than inheriting one size: at
 * `sm` the 30px numeral of the large ring overruns a 56px circle.
 */
export function ProgressRing({
  percent,
  label,
  caption,
  gradientId,
  size = 'lg',
  className,
}: {
  percent: number;
  label: string;
  caption?: string;
  gradientId: string;
  size?: keyof typeof RING_SIZE;
  className?: string;
}) {
  const offset = Math.round(RING_CIRCUMFERENCE * (1 - percent / 100));
  const spec = RING_SIZE[size];

  return (
    <div className={cn('relative shrink-0', spec.box, className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--neb-brand-500)" />
            <stop offset="100%" stopColor="var(--neb-brand-900)" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--neb-surface-muted)"
          strokeWidth={spec.stroke}
        />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={spec.stroke}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="draw-ring"
          style={{ '--ring-circumference': RING_CIRCUMFERENCE } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display text-ink-900 font-bold', spec.label)}>{label}</span>
        {/* The caption does not survive the smaller rings' inner diameter. */}
        {caption && size === 'lg' ? (
          <span className="text-ink-500 text-[11.5px]">{caption}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Attempt row ─────────────────────────────────────────────────────────── */

/** One line of the "last attempts" list in §benefits. */
export function AttemptRow({
  icon: Icon,
  title,
  meta,
  value,
  tone = 'ink',
}: {
  icon: IconType;
  title: string;
  meta: string;
  value: string;
  tone?: 'ink' | 'success';
}) {
  return (
    <div className="border-line-200/70 bg-surface flex items-center gap-3 rounded-[13px] border px-3.5 py-3">
      <span className="bg-brand-100 text-brand-700 flex size-8.5 shrink-0 items-center justify-center rounded-[10px]">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block text-[13px] font-semibold">{title}</span>
        <span className="text-ink-500 mt-0.5 block text-[11.5px]">{meta}</span>
      </span>
      <span
        className={cn(
          'font-display text-[14.5px] font-bold whitespace-nowrap',
          tone === 'success' ? 'text-success' : 'text-ink-900',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Float chip ──────────────────────────────────────────────────────────── */

/**
 * A card that floats beside a mockup.
 *
 * Hidden below `lg` and never rendered into the accessibility tree. Both are
 * deliberate: the chips are positioned outside their parent's box (the canvas
 * places them at `-2%` / `-3%`), which on a narrow viewport either overlaps the
 * drawing or forces the page to scroll sideways — and their content is a
 * duplicate of what the drawing behind them already shows.
 */
export function FloatChip({
  float,
  className,
  children,
}: {
  float: 'a' | 'b' | 'c';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'border-line-200 bg-surface/95 shadow-float absolute hidden items-center gap-3.5 rounded-[20px] border px-5.5 py-4.5 backdrop-blur-sm lg:flex',
        float === 'a' && 'float-a',
        float === 'b' && 'float-b',
        float === 'c' && 'float-c',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The chip's two-line body: a small label over a display numeral. */
export function ChipStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-ink-600 text-[13px]">{label}</span>
      <span className="font-display text-ink-900 mt-0.5 text-[19px] font-bold">{value}</span>
    </span>
  );
}
