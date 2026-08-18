import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react';

import { Container } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconCheck, IconInfo } from './icons';

/**
 * The landing page's shared vocabulary.
 *
 * The approved design is one artboard of inline styles in which the same eight
 * or nine figures recur — an eyebrow pill, a gradient glyph tile, a labelled
 * meter, a browser frame, a floating chip. Written out at each site that is
 * ~1200 lines of near-duplicate markup and nine slightly different eyebrows.
 * They live here instead, so a change to the figure is one edit.
 *
 * Everything in this file is a Server Component. Nothing here holds state.
 *
 * ── The specimen rule ──────────────────────────────────────────────────────
 *
 * Several of these — `BrowserChrome`, `Meter`, `MiniBars`, `ProgressRing`,
 * `FloatChip` — exist only to draw a picture of the product. They are marked
 * `aria-hidden` by their callers and the figures inside them are invented. That
 * is the convention the page this replaced already used for `StudyArtifact`,
 * and it is what keeps «٧٤٪» legible as an illustration rather than as a claim
 * about anybody's results. Any drawing large enough to be mistaken for a
 * screenshot also carries a visible `SpecimenLabel`.
 */

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** Inline `--reveal-delay`, for staggering a group of `reveal` children. */
export const revealDelay = (ms: number): CSSProperties =>
  ({ '--reveal-delay': `${ms}ms` }) as CSSProperties;

/* ── Section wrapper ───────────────────────────────────────────────────────
 *
 * `scroll-mt-20 lg:scroll-mt-24` matches the header's `h-20 lg:h-24` exactly.
 * The two are load-bearing on each other: an anchored section that forgets it
 * lands underneath the sticky bar.
 */
export function SectionShell({
  id,
  tone = 'plain',
  className,
  children,
}: {
  id?: string;
  /**
   * `band` and `closing` are the design's two full-bleed gradient grounds. They
   * are the only two, and both are tinted light — the product has no dark
   * sections and this page did not introduce one.
   */
  tone?: 'plain' | 'band' | 'closing';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-20 py-20 sm:py-24 lg:scroll-mt-24 lg:py-32',
        tone === 'band' &&
          'border-line-200/70 via-canvas to-brand-50 overflow-hidden border-y bg-linear-to-b from-white',
        tone === 'closing' && 'via-brand-100 to-brand-50 overflow-hidden bg-linear-to-b from-white',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────────────────── */

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
        'border-line-200 bg-surface/90 inline-flex items-center gap-2.5 rounded-full border py-1.5 ps-1.5 pe-4 shadow-xs',
        className,
      )}
    >
      <span className="bg-gradient-tile inline-flex size-6 shrink-0 items-center justify-center rounded-full text-white">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="text-ink-700 text-[14px] font-medium">{children}</span>
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
  className,
}: {
  icon: IconType;
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  align?: 'center' | 'start';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' && 'text-center', className)}>
      <div className="reveal">
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      </div>
      <h2 className="text-ink-900 text-h2 reveal mt-6" style={revealDelay(60)}>
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            'text-ink-700 text-lead reveal mt-5',
            align === 'center' ? 'measure-ar-lg mx-auto' : 'measure-ar',
          )}
          style={revealDelay(110)}
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
 * The design's rounded icon square, in two tones.
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
  tone?: 'vivid' | 'soft' | 'teal' | 'green';
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
        tone === 'teal' && 'bg-accent-teal-soft text-accent-teal',
        tone === 'green' && 'bg-accent-green-soft text-accent-green',
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
 * interface. `COPY.legal.sampleContentLabel` is the same string the previous
 * page used above `StudyArtifact`.
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

/* ── Browser chrome ──────────────────────────────────────────────────────── */

/**
 * The window frame around the two big product drawings.
 *
 * The strip is `dir="ltr"` because window chrome is not Arabic text — the dots
 * belong at the left in every OS, including on an RTL page.
 *
 * The design put a fabricated address (`exam.example.sa/simulator`) in the URL
 * pill. It is deliberately NOT reproduced: an invented domain shaped like an
 * exam authority's is exactly the confusion the independence disclaimer exists
 * to prevent. The pill renders empty, as it does in the hero.
 */
export function BrowserChrome() {
  return (
    <div
      dir="ltr"
      className="border-line-200/70 bg-brand-50 flex items-center gap-3.5 border-b px-4 py-2.5"
    >
      <span className="flex gap-1.5">
        <span className="bg-line-500/45 size-2.5 rounded-full" />
        <span className="bg-line-500/45 size-2.5 rounded-full" />
        <span className="bg-line-500/45 size-2.5 rounded-full" />
      </span>
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
      <div className="text-ink-700 mb-1.5 flex justify-between text-[12.5px]">
        <span>{label}</span>
        <span className="text-ink-900 font-semibold">{value}</span>
      </div>
      <div className="bg-surface-muted h-[7px] overflow-hidden rounded-full">
        <div
          className="bg-gradient-brand-deep h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ── Bar chart ───────────────────────────────────────────────────────────── */

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
                seriesIndex === 0 ? 'bg-gradient-brand-deep' : 'bg-brand-200',
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

/* ── Progress ring ───────────────────────────────────────────────────────── */

const RING_RADIUS = 50;
const RING_CIRCUMFERENCE = Math.round(2 * Math.PI * RING_RADIUS);

/**
 * The SVG progress ring.
 *
 * `gradientId` is required and has no default on purpose. Two rings render on
 * this page; had they shared a hardcoded `<linearGradient id>` — as the artboard
 * did — the second would silently paint with the first's definition, and would
 * lose its stroke entirely if the first were ever removed.
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
  caption: string;
  gradientId: string;
  /**
   * The centred label has to scale with the ring, not just inherit it. At `sm`
   * the 30px numeral of the large ring overruns the 86px circle and collides
   * with its own caption, which is what the journey step's ring did before this
   * prop existed.
   */
  size?: 'lg' | 'sm';
  className?: string;
}) {
  const offset = Math.round(RING_CIRCUMFERENCE * (1 - percent / 100));
  const small = size === 'sm';

  return (
    <div className={cn('relative', small ? 'size-[86px]' : 'size-[150px]', className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--neb-brand-600)" />
            <stop offset="100%" stopColor="var(--neb-accent-teal)" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--neb-surface-muted)"
          strokeWidth="13"
        />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="draw-ring"
          style={{ '--ring-circumference': RING_CIRCUMFERENCE } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            'font-display text-ink-900 font-bold',
            small ? 'text-[19px]' : 'text-[30px]',
          )}
        >
          {label}
        </span>
        {/* The caption does not survive the small ring's inner diameter. */}
        {small ? null : <span className="text-ink-600 text-[11.5px]">{caption}</span>}
      </div>
    </div>
  );
}

/* ── Float chip ──────────────────────────────────────────────────────────── */

/**
 * A card that floats beside a mockup.
 *
 * Hidden below `lg` and never rendered into the accessibility tree. Both are
 * deliberate: the chips are positioned outside their parent's box (the design
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
        'border-line-200 bg-surface/95 shadow-float rounded-panel absolute hidden items-center gap-2.5 border px-4 py-3 backdrop-blur-sm lg:flex',
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
      <span className="text-ink-600 text-[11.5px]">{label}</span>
      <span className="font-display text-ink-900 text-[16px] font-bold">{value}</span>
    </span>
  );
}
