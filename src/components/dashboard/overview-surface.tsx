import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ClipboardList,
  GraduationCap,
  MonitorPlay,
  PencilLine,
  Target,
} from 'lucide-react';

import { KhatimField } from '@/components/marketing/ornament';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The student overview's colour-coded surface.
 *
 * The rest of the student area is a record: lists of things the student owns,
 * did and bought, and those stay quiet on purpose. This file is the one screen
 * that has to be worth arriving at, so it is where the colour code is spent.
 *
 * THE RULE THE COLOUR FOLLOWS. Every hue on this page is the colour code from
 * globals.css carrying its published meaning — blue opens the sequence and
 * marks the courses, gold marks effort and therefore the attempts, teal marks
 * the simulator, green marks readiness and therefore the score. Nothing here
 * picks a hue because a row of four tiles looks better in four colours: the
 * strip reads left to right as the four movements of the method, which is why
 * `JourneyStrip` can repeat the same four hues underneath without inventing a
 * second vocabulary. Orders stay neutral for the same reason — a purchase is
 * not one of the movements.
 *
 * And colour is never the only channel. Every tile carries its own icon and its
 * own Arabic label, so the strip survives greyscale exactly as the badges do.
 *
 * What is deliberately NOT here, because the brief rules it out: dark bands, an
 * elevation scale, cards that lift or scale under the cursor, and a tinted glow
 * under anything. Depth on this page is made of soft grounds, one hairline and
 * the gradient in the masthead — all of it inside the light scale.
 *
 * The only motion is the two sanctioned entrances: `enter` for the strip, which
 * is above the fold at load and is therefore the one place a stagger is visible,
 * and `reveal` for the blocks below it, which is scroll-driven and needs no
 * script. Both collapse under `prefers-reduced-motion` via the global rule.
 */

type Tone = 'brand' | 'gold' | 'teal' | 'green' | 'neutral';

/**
 * Full class strings per hue rather than interpolated names: Tailwind reads the
 * source statically, and `bg-accent-${tone}-soft` produces no CSS at all.
 *
 * Only `ink-700` and each hue's own ink appear on these grounds. `ink-600`
 * lands at 4.3–4.4:1 on a soft ground and is documented in globals.css as not
 * permitted there.
 *
 * The chip is the hue's saturated fill carrying a white glyph — the figure
 * `accent.ts` publishes as `fill` — so a tile here and a count tile in the
 * admin read as one recipe. Every fill's white glyph clears the 3:1 icon floor
 * by the same margin the hue's ink clears 4.5:1 on white. `ink` stays the dark
 * AA value because it is what the numeral and the labels are set in; `graphic`
 * is that same fill written as a text colour, so `currentColor` reaches the
 * ring's stroke — a ring draws, it does not read.
 */
const TONES: Record<
  Tone,
  { ground: string; edge: string; chip: string; ink: string; graphic: string }
> = {
  brand: {
    ground: 'bg-brand-100',
    edge: 'border-brand-700/20',
    chip: 'bg-brand-600 text-white',
    ink: 'text-brand-700',
    graphic: 'text-brand-600',
  },
  gold: {
    ground: 'bg-accent-gold-soft',
    edge: 'border-accent-gold/20',
    chip: 'bg-accent-gold-fill text-white',
    ink: 'text-accent-gold',
    graphic: 'text-accent-gold-fill',
  },
  teal: {
    ground: 'bg-accent-teal-soft',
    edge: 'border-accent-teal/20',
    chip: 'bg-accent-teal-fill text-white',
    ink: 'text-accent-teal',
    graphic: 'text-accent-teal-fill',
  },
  green: {
    ground: 'bg-accent-green-soft',
    edge: 'border-accent-green/20',
    chip: 'bg-accent-green-fill text-white',
    ink: 'text-accent-green',
    graphic: 'text-accent-green-fill',
  },
  /* Not a fifth hue — the absence of one. Orders are a receipt, not a movement
     of the method, so they get the grey the rest of the record area uses, and
     the chip stays tinted: the absence of a hue has no saturated fill. */
  neutral: {
    ground: 'bg-surface-muted',
    edge: 'border-line-200',
    chip: 'bg-ink-900/8 text-ink-700',
    ink: 'text-ink-900',
    graphic: 'text-ink-900',
  },
};

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

// ───────────────────────────── Masthead ─────────────────────────────

/**
 * The greeting band.
 *
 * A gradient across three tokens that already exist — `brand-100`, the pale
 * `canvas-blue`, and white — so the band has a hue without leaving the light
 * scale, which is the whole reason `canvas-blue` was added to the palette.
 *
 * The ornament placement is the one recorded in `ornament.tsx` as the student
 * masthead, and it is the frieze figure rather than the homepage masthead's
 * fore-edge course: one row of complete stars, full width, closing the band.
 * A half-width field was tried first and is why the frieze is here instead —
 * ending a lattice on a vertical line mid-panel reads as a rendering artefact,
 * which is exactly what the "terminated by a drawn rule" clause is about.
 */
export function DashboardMasthead({ userName }: { userName: string }) {
  return (
    <div
      className={cn(
        'rounded-panel border-brand-700/15 relative overflow-hidden border',
        'from-brand-100 via-canvas-blue to-surface bg-linear-to-bl',
      )}
    >
      <div className="flex flex-col gap-2 px-6 pt-8 pb-7 sm:px-8 sm:pt-10">
        <p className={cn('text-sm font-medium', TONES.brand.ink)}>{COPY.dashboard.title}</p>
        {/* `text-h2` rather than the old arbitrary 24/32px pair: the greeting is
            a page head, and the scale is what stops equal-rank heads drifting. */}
        <h1 className="text-ink-900 text-h2 text-balance">
          {COPY.dashboard.welcome}، {userName}
        </h1>
        <p className="text-ink-700 measure-ar-lg">{COPY.dashboard.overviewSubtitle}</p>
      </div>

      {/*
        Exactly one row of complete stars — `h-20` is the tile pitch — and it is
        terminated by the panel's own bottom border rather than by a fade. It
        sits below the text block, never behind it.
      */}
      <div className="text-brand-500 pointer-events-none relative h-20 w-full">
        <KhatimField id="dashboard-masthead-khatim" tile={80} opacity={0.18} />
      </div>
    </div>
  );
}

// ───────────────────────────── Stat strip ─────────────────────────────

function StatTile({
  tone,
  icon: Icon,
  label,
  value,
  hint,
  ring,
  delay = 0,
}: {
  tone: Tone;
  icon: IconType;
  label: string;
  value: string;
  hint?: string;
  /** 0–1 fraction. `ProgressRing` takes a percentage, so it is scaled below. */
  ring?: number;
  delay?: number;
}) {
  const t = TONES[tone];

  return (
    <li
      className={cn('rounded-panel enter border p-5', t.ground, t.edge)}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={cn('rounded-control inline-flex size-9 items-center justify-center', t.chip)}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {/* The spec's stat numeral: 30px display 700, tabular so the strip's
              four figures stay a row as the values change. */}
          <p
            className={cn(
              'font-display mt-2 text-[30px] leading-none font-bold tabular-nums',
              t.ink,
            )}
          >
            {value}
          </p>
          <p className="text-ink-700 truncate text-sm">{label}</p>
          {hint ? <p className="text-ink-700 text-xs">{hint}</p> : null}
        </div>
        {/*
          The shared ring primitive rather than a local one: same 56px box, same
          `aria-hidden` svg, and the figure to its start side is still the
          accessible value. It draws in the hue's `fill` — a ring is a graphic,
          so it takes the vivid value, not the text ink beside it.
        */}
        {ring !== undefined ? (
          <ProgressRing className={t.graphic} value={ring * 100} size={56} strokeWidth={5} />
        ) : null}
      </div>
    </li>
  );
}

export type OverviewStats = {
  courses: number;
  simulators: number;
  attempts: number;
  /** Of those attempts, how many the student could resume right now. */
  inProgressCount: number;
  /** Best graded attempt as a 0–1 fraction, or null when nothing is graded. */
  bestScore: number | null;
};

/**
 * Four counts, in the four hues, in the order the method runs.
 *
 * A student with an empty account still sees this strip. That is the point: the
 * zeros are the shape of the thing they are about to fill, and a screen that
 * only becomes colourful after a purchase is a screen nobody comes back to.
 *
 * The strip is above the fold, so the entrance is `enter` rather than `reveal`:
 * a scroll-driven timeline on content that never scrolls into view resolves to
 * "already finished", and the stagger — the whole point of a row of four — only
 * exists on `enter`. 70ms apart, so the row lands as one gesture.
 */
const STAT_STAGGER = 70;

export function StatStrip({ stats }: { stats: OverviewStats }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        tone="brand"
        icon={GraduationCap}
        label={COPY.dashboard.statCourses}
        value={formatNumber(stats.courses)}
        // Hidden at zero: "permanent access" to nothing reads as a taunt.
        hint={stats.courses > 0 ? COPY.dashboard.statCoursesHint : undefined}
        delay={0}
      />
      <StatTile
        tone="teal"
        icon={MonitorPlay}
        label={COPY.dashboard.statSimulators}
        value={formatNumber(stats.simulators)}
        hint={stats.simulators > 0 ? COPY.dashboard.statSimulatorsHint : undefined}
        delay={STAT_STAGGER}
      />
      <StatTile
        tone="gold"
        icon={ClipboardList}
        label={COPY.dashboard.statAttempts}
        value={formatNumber(stats.attempts)}
        // A live figure, not the design mock's fixed sentence.
        hint={
          stats.inProgressCount > 0
            ? COPY.dashboard.statAttemptsInProgress.replace(
                '{count}',
                formatNumber(stats.inProgressCount),
              )
            : undefined
        }
        delay={STAT_STAGGER * 2}
      />
      <StatTile
        tone="green"
        icon={Target}
        label={COPY.dashboard.statBestScore}
        // An ungraded account gets words, not a zero: `0%` is a result, and the
        // student has not got one yet.
        value={stats.bestScore === null ? '—' : formatPercent(stats.bestScore)}
        hint={stats.bestScore === null ? COPY.dashboard.statNoScore : undefined}
        ring={stats.bestScore ?? undefined}
        delay={STAT_STAGGER * 3}
      />
    </ul>
  );
}

// ───────────────────────────── Section heads ─────────────────────────────

/**
 * A section head whose icon chip carries the section's hue.
 *
 * The chip is the same figure as the stat tile's, at the same size, so a
 * section and its tile are visibly the same subject rather than two lists that
 * happen to share a word.
 *
 * The "عرض الكل" link stays brand blue in every hue, for the reason the buttons
 * do: globals.css exempts controls from the colour code, so a gold link would
 * read as a different kind of navigation rather than the same navigation in
 * another chapter.
 */
export function ToneSectionHead({
  tone,
  icon: Icon,
  title,
  href,
}: {
  tone: Tone;
  icon: IconType;
  title: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'rounded-control inline-flex size-9 items-center justify-center',
            TONES[tone].chip,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-ink-900 text-h3">{title}</h2>
      </div>

      <Link
        href={href}
        className={cn(
          'rounded-control text-brand-700 group inline-flex items-center gap-1.5 px-2 py-1',
          'text-sm font-medium hover:underline',
        )}
      >
        {COPY.dashboard.viewAll}
        <span className="sr-only"> — {title}</span>
        {/* Physical left is forward under `dir="rtl"`; lucide has no logical arrow.
            The nudge is the system's one sanctioned hover motion on an arrow. */}
        <ArrowLeft
          className="size-4 transition-transform duration-150 ease-out group-hover:-translate-x-1"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

// ───────────────────────────── The empty account ─────────────────────────────

/**
 * What a brand-new student sees instead of two dashed grey boxes.
 *
 * The old empty state was accurate and said nothing worth reading: an inbox
 * glyph, "you have not bought anything", and two buttons. This says the same
 * true thing as an invitation, in the two hues the two products already own, so
 * the first screen of an empty account still looks like the product.
 *
 * It is still an empty state and still tells the truth — it claims no content,
 * shows no fake progress, and every number on the strip above it is a real zero.
 */
function StartCard({
  tone,
  icon: Icon,
  title,
  body,
  href,
  action,
}: {
  tone: Tone;
  icon: IconType;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  const t = TONES[tone];

  return (
    <li className={cn('rounded-panel flex flex-col gap-3 border p-6', t.ground, t.edge)}>
      <span
        className={cn('rounded-control inline-flex size-11 items-center justify-center', t.chip)}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className={cn('text-lg font-semibold', t.ink)}>{title}</h3>
      <p className="text-ink-700 flex-1 text-sm leading-relaxed">{body}</p>
      <div>
        {/*
          The action stays brand blue in a teal card: globals.css exempts
          controls from the colour code, because a teal button would read as a
          different kind of action rather than the same action in another
          chapter.
        */}
        <Button asChild size="sm">
          <Link href={href}>{action}</Link>
        </Button>
      </div>
    </li>
  );
}

export function StartHere() {
  return (
    <section className="reveal flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-ink-900 text-h3">{COPY.dashboard.startHereTitle}</h2>
        <p className="text-ink-700 measure-ar-lg text-sm">{COPY.dashboard.startHereBody}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <StartCard
          tone="brand"
          icon={GraduationCap}
          title={COPY.dashboard.startCoursesTitle}
          body={COPY.dashboard.startCoursesBody}
          href={ROUTES.courses}
          action={COPY.dashboard.noCoursesAction}
        />
        <StartCard
          tone="teal"
          icon={MonitorPlay}
          title={COPY.dashboard.startSimulatorsTitle}
          body={COPY.dashboard.startSimulatorsBody}
          href={ROUTES.simulators}
          action={COPY.dashboard.noSimulatorsAction}
        />
      </ul>
    </section>
  );
}

// ───────────────────────────── The journey ─────────────────────────────

/**
 * The four movements, in their four hues, numbered.
 *
 * The copy is `home.pathSteps` — the same four steps the homepage states — read
 * from one source rather than restated, so the student area cannot drift into
 * describing a different method from the one that sold it.
 */
const JOURNEY_TONES: readonly Tone[] = ['brand', 'gold', 'teal', 'green'];
const JOURNEY_ICONS: readonly IconType[] = [BookOpen, PencilLine, MonitorPlay, BadgeCheck];

export function JourneyStrip() {
  return (
    <section className="reveal flex flex-col gap-4">
      {/*
        The heading alone. The line under it used to explain the page's own
        colour scheme back to the reader — the four tiles below already carry
        the four hues, and a caption saying so is the interface talking about
        itself rather than about the exam.
      */}
      <h2 className="text-ink-900 text-h3">{COPY.dashboard.journeyTitle}</h2>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COPY.home.pathSteps.map((step, index) => {
          const t = TONES[JOURNEY_TONES[index]];
          const Icon = JOURNEY_ICONS[index];

          return (
            <li
              key={step.title}
              className={cn('rounded-panel flex flex-col gap-2 border p-5', t.ground, t.edge)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-control inline-flex size-8 items-center justify-center',
                    t.chip,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {/* The ordinal is decoration on top of an <ol>, which already
                    carries the sequence to assistive technology. */}
                <span className={cn('text-sm font-semibold', t.ink)} aria-hidden="true">
                  {formatNumber(index + 1)}
                </span>
              </div>
              <h3 className={cn('text-base font-semibold', t.ink)}>{step.title}</h3>
              <p className="text-ink-700 text-sm leading-relaxed">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
