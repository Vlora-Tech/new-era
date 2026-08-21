import type { CSSProperties } from 'react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import {
  IconAutosave,
  IconCheck,
  IconForward,
  IconImprovement,
  IconLocked,
  IconPlay,
  IconTimer,
} from '../icons';
import { Chip, MockCard, MockFrame, OptionRow, ProgressRing } from '../parts';

/**
 * The small drawings inside the feature bento and the journey steps.
 *
 * Nine of them, none more than about sixty lines, and they only ever appear
 * together — hence one file. Each is a fragment of the same interface the two
 * large mockups draw in full, cropped to whatever the card beside it is
 * claiming. Like every other figure on this page they are specimen artwork:
 * `aria-hidden` at the call site, values from `COPY.landing.mock`.
 *
 * The bento's top row (`LessonListMini`, `TimedExamMini`, `WeeklyBarsMini`)
 * draws a small fragment; its bottom row is two wide cards, so `DrillMini` and
 * `AttemptReportMini` draw a whole panel instead. That asymmetry is the canvas's
 * and is the reason the second row reads as the more substantial claim.
 */
const MOCK = COPY.landing.mock;

/** The six-column week in the third bento card. */
const WEEK_BARS = [38, 55, 46, 88, 64, 72] as const;

/* ── §features, top row ─────────────────────────────────────────────────── */

export function LessonListMini() {
  const rows = [
    { icon: IconCheck, label: MOCK.lessonRatioConcept, meta: null, tone: 'done' },
    {
      icon: IconPlay,
      label: MOCK.lessonRatioProblems,
      meta: MOCK.lessonRatioClock,
      tone: 'active',
    },
    { icon: IconLocked, label: MOCK.lessonUnitExercise, meta: null, tone: 'locked' },
  ] as const;

  return (
    <MockFrame>
      <MockCard>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-ink-900 truncate text-[12.5px] font-semibold">
            {MOCK.unitLabel}
          </span>
          <bdi dir="ltr" className="text-ink-500 text-[11.5px] tabular-nums">
            {MOCK.unitPosition}
          </bdi>
        </div>
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={row.label}
              className={cn(
                'rounded-control flex items-center gap-2 px-2.5 py-2 text-[12px]',
                row.tone === 'active'
                  ? 'bg-brand-100 text-brand-800 font-semibold'
                  : 'text-ink-700',
                row.tone === 'locked' && 'text-ink-600',
              )}
            >
              <row.icon
                className={cn(
                  'size-3.5 shrink-0',
                  row.tone === 'done' && 'text-success-fill',
                  row.tone === 'active' && 'text-brand-700',
                  row.tone === 'locked' && 'text-ink-500',
                )}
              />
              <span className="flex-1 truncate">{row.label}</span>
              {row.meta ? <span className="text-ink-500 tabular-nums">{row.meta}</span> : null}
            </li>
          ))}
        </ul>
      </MockCard>
    </MockFrame>
  );
}

/**
 * The timed section, with the question-number strip the canvas draws under it.
 *
 * The strip is three states, not two: answered-and-current (filled), reachable
 * (tinted), and not yet reached (faint). It is what makes the picture read as a
 * section in progress rather than as a row of buttons.
 */
export function TimedExamMini() {
  return (
    <MockFrame>
      <MockCard>
        <div className="flex items-center justify-between gap-2">
          <Chip>{MOCK.quantSection}</Chip>
          <span className="font-display text-ink-900 flex items-center gap-1.5 text-[14px] font-bold">
            <IconTimer className="text-brand-700 size-4" />
            <span className="tabular-nums">{MOCK.sectionClock}</span>
          </span>
        </div>
        <div className="bg-surface-muted mt-3.5 h-[6px] overflow-hidden rounded-full">
          <div className="bg-gradient-meter h-full w-[62%] rounded-full" />
        </div>
        <p className="text-ink-500 mt-2.5 text-[11.5px]">{MOCK.questionFifteen}</p>
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {[15, 16, 17, 18, 19, 20].map((n, index) => (
            <span
              key={n}
              className={cn(
                'flex size-6.5 items-center justify-center rounded-lg text-[11px] tabular-nums',
                index === 0 && 'bg-brand-800 font-semibold text-white',
                index > 0 && index < 4 && 'bg-brand-100 text-ink-700',
                index >= 4 && 'bg-canvas text-ink-500',
              )}
            >
              {n}
            </span>
          ))}
        </div>
      </MockCard>
    </MockFrame>
  );
}

export function WeeklyBarsMini() {
  return (
    <MockFrame>
      <MockCard>
        <div className="text-ink-500 flex items-center justify-between gap-2 text-[11.5px]">
          <span>{MOCK.performanceIndicator}</span>
          <span>{MOCK.weekly}</span>
        </div>
        {/*
          Six single columns, and only the fourth is the gradient. The canvas
          alternates two flat tints behind it so the one filled bar reads as
          "this week" rather than as the tallest of six equals.
        */}
        <div className="mt-4 flex h-[96px] items-end gap-2">
          {WEEK_BARS.map((height, index) => (
            <span
              key={index}
              className={cn(
                'grow-bar flex-1 rounded-t-[5px]',
                index === 3
                  ? 'bg-gradient-meter'
                  : index % 2 === 0
                    ? 'bg-brand-200'
                    : 'bg-brand-300',
              )}
              style={{ height: `${height}%`, '--bar-delay': `${index * 80}ms` } as CSSProperties}
            />
          ))}
        </div>
        <div className="border-line-200/70 mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-ink-600 text-[12px]">{MOCK.lessonsThisWeek}</span>
          <span className="font-display text-ink-900 text-[16px] font-bold">
            {MOCK.lessonsThisWeekValue}
          </span>
        </div>
      </MockCard>
    </MockFrame>
  );
}

/* ── §features, bottom row ──────────────────────────────────────────────── */

export function DrillMini() {
  return (
    <MockFrame className="p-5">
      <MockCard className="shadow-card p-4.5">
        <div className="flex items-center justify-between gap-3">
          <Chip>{MOCK.drillUnit}</Chip>
          <span className="text-ink-500 flex items-center gap-1.5 text-[12px]">
            <IconTimer className="text-brand-700 size-4" />
            <span className="tabular-nums">{MOCK.drillClock}</span>
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <span className="bg-surface-muted h-[6px] flex-1 overflow-hidden rounded-full">
            <span className="bg-gradient-meter block h-full w-[33%] rounded-full" />
          </span>
          <bdi dir="ltr" className="text-ink-500 text-[11.5px] tabular-nums">
            {MOCK.drillPosition}
          </bdi>
        </div>

        <p className="font-display text-ink-900 mt-4 text-[16px] leading-[1.65] font-semibold">
          {MOCK.quickDrillStem}
        </p>

        <div className="mt-3.5 flex flex-col gap-2">
          {MOCK.drillOptions.map((option, index) => (
            <OptionRow
              key={option}
              letter={MOCK.optionLetters[index]}
              label={option}
              selected={index === 1}
            />
          ))}
        </div>

        <div className="border-line-200/70 mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
          <span className="text-success flex items-center gap-1.5 text-[12px]">
            <IconAutosave className="size-4" />
            {MOCK.answerSaved}
          </span>
          <span className="bg-gradient-brand flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12.5px] font-semibold whitespace-nowrap text-white">
            {MOCK.nextQuestion}
            <IconForward className="size-4" />
          </span>
        </div>
      </MockCard>
    </MockFrame>
  );
}

export function AttemptReportMini() {
  return (
    <MockFrame className="flex flex-1 p-5">
      <MockCard className="shadow-card flex min-w-0 flex-1 flex-col gap-4 p-4.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chip>{MOCK.attemptReport}</Chip>
          <span className="text-ink-500 text-[12px]">{MOCK.attemptReportMeta}</span>
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing
            percent={73}
            label={MOCK.attemptReportValue}
            gradientId="neb-ring-attempt-report"
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-ink-900 text-[15px] font-semibold">
              {MOCK.attemptReportTitle}
            </p>
            <p className="text-success mt-1.5 flex items-center gap-1.5 text-[12.5px]">
              <IconImprovement className="size-4 shrink-0" />
              {MOCK.attemptReportDelta}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          {MOCK.attemptReportSkills.map((skill) => (
            <div key={skill.label}>
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="text-ink-700 text-[13px]">{skill.label}</span>
                <span className="text-ink-500 text-[11.5px]">{skill.meta}</span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="bg-surface-muted h-2 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-gradient-meter block h-full rounded-full"
                    style={{ width: `${skill.percent}%` }}
                  />
                </span>
                <span className="font-display text-ink-900 text-[13.5px] font-bold whitespace-nowrap">
                  {skill.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-line-200/70 mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
          <span className="text-ink-500 text-[12px]">{MOCK.attemptReportPace}</span>
          <span className="bg-gradient-brand flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12.5px] font-semibold whitespace-nowrap text-white">
            {MOCK.attemptReportAction}
            <IconForward className="size-4" />
          </span>
        </div>
      </MockCard>
    </MockFrame>
  );
}

/* ── §journey ──────────────────────────────────────────────────────────── */

/**
 * The journey steps' drawings share a fixed 180px well so the four cards line
 * their headings up regardless of what is inside them — without it the ring in
 * step four pushes its title 30px below the other three.
 */
function JourneyWell({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="border-line-200/70 rounded-panel from-brand-50 flex h-[180px] border bg-linear-to-b to-white p-4"
    >
      <div className="border-line-200/70 bg-surface flex min-w-0 flex-1 flex-col justify-center rounded-[11px] border p-3">
        {children}
      </div>
    </div>
  );
}

export function JourneyLessonMini() {
  return (
    <JourneyWell>
      <p className="text-ink-500 text-[10.5px]">{MOCK.journeyUnit}</p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        <span className="bg-brand-200 h-2 w-[90%] rounded-full" />
        <span className="bg-surface-muted h-2 w-[70%] rounded-full" />
        <span className="bg-surface-muted h-2 w-[80%] rounded-full" />
      </div>
      <p className="text-brand-800 mt-3 flex items-center gap-1.5 text-[10.5px]">
        <IconPlay className="size-3.5" />
        {MOCK.journeyStartLesson}
      </p>
    </JourneyWell>
  );
}

export function JourneyDrillMini() {
  return (
    <JourneyWell>
      <p className="text-ink-500 text-[10.5px]">{MOCK.journeyDrill}</p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {MOCK.journeyOptions.map((option, index) => (
          <span
            key={option}
            className={cn(
              'flex items-center gap-1.5 rounded-[9px] border px-2.5 py-[7px] text-[10.5px]',
              index === 1
                ? 'border-brand-200 text-ink-900 from-brand-100 to-brand-50 bg-linear-to-l font-semibold'
                : 'border-line-200/70 bg-brand-50/60 text-ink-600',
            )}
          >
            <span className="flex-1">{option}</span>
            {index === 1 ? <IconCheck className="text-brand-800 size-3.5 shrink-0" /> : null}
          </span>
        ))}
      </div>
    </JourneyWell>
  );
}

export function JourneyTimedMini() {
  return (
    <JourneyWell>
      <div className="flex items-center justify-between gap-2">
        <span className="bg-brand-100 text-brand-800 rounded-full px-2 py-[3px] text-[9.5px] font-semibold">
          {MOCK.quantSection}
        </span>
        <span className="font-display text-ink-900 flex items-center gap-1 text-[11px] font-bold">
          <IconTimer className="text-brand-700 size-3" />
          <span className="tabular-nums">{MOCK.journeyClock}</span>
        </span>
      </div>
      <div className="bg-surface-muted mt-3 h-[5px] overflow-hidden rounded-full">
        <div className="bg-gradient-meter h-full w-[44%] rounded-full" />
      </div>
      <div className="mt-2.5 grid grid-cols-6 gap-1">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'aspect-square rounded-[5px]',
              index < 2 && 'bg-brand-200',
              index === 2 && 'bg-brand-800',
              index > 2 && 'bg-surface-muted',
            )}
          />
        ))}
      </div>
    </JourneyWell>
  );
}

export function JourneyResultMini() {
  return (
    <JourneyWell>
      <div className="flex items-center gap-3">
        <ProgressRing
          percent={72}
          label={MOCK.journeyRingValue}
          gradientId="neb-ring-journey"
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink-500 text-[10.5px]">{MOCK.attemptIndicatorLabel}</p>
          <div className="bg-surface-muted mt-1.5 h-[6px] overflow-hidden rounded-full">
            <div className="bg-gradient-meter h-full w-[72%] rounded-full" />
          </div>
          <p className="text-ink-500 mt-2 text-[10px]">{MOCK.attemptIndicator}</p>
        </div>
      </div>
    </JourneyWell>
  );
}
