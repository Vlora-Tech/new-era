import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import {
  IconAutosave,
  IconCheck,
  IconForward,
  IconHistory,
  IconLocked,
  IconPermanent,
  IconPlay,
  IconSelected,
  IconTimer,
} from '../icons';
import { MiniBars, ProgressRing } from '../parts';

/**
 * The small drawings inside the feature bento and the journey steps.
 *
 * Nine of them, none more than about forty lines, and they only ever appear
 * together — hence one file. Each is a fragment of the same interface the two
 * large mockups draw in full, cropped to whatever the card beside it is
 * claiming. Like every other figure on this page they are specimen artwork:
 * `aria-hidden` at the call site, values from `COPY.landing.mock`.
 */
const MOCK = COPY.landing.mock;

/** The tinted well every mini sits in, so nine cards frame their art the same way. */
function MiniFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-panel bg-brand-50/70 border-line-200/50 border p-3', className)}>
      <div className="rounded-control border-line-200/60 bg-surface border p-3 shadow-xs">
        {children}
      </div>
    </div>
  );
}

/* ── §features ─────────────────────────────────────────────────────────── */

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
    <MiniFrame>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-ink-900 truncate text-[12.5px] font-semibold">{MOCK.unitLabel}</span>
        <bdi dir="ltr" className="text-ink-600 text-[11.5px] tabular-nums">
          {MOCK.unitPosition}
        </bdi>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className={cn(
              'rounded-control flex items-center gap-2 px-2.5 py-2 text-[12px]',
              row.tone === 'active' ? 'bg-brand-100 text-brand-700 font-semibold' : 'text-ink-700',
              row.tone === 'locked' && 'text-ink-600',
            )}
          >
            <row.icon
              className={cn(
                'size-3.5 shrink-0',
                row.tone === 'done' && 'text-accent-green',
                row.tone === 'active' && 'text-brand-700',
                row.tone === 'locked' && 'text-ink-600',
              )}
            />
            <span className="flex-1 truncate">{row.label}</span>
            {row.meta ? <span className="text-ink-600 tabular-nums">{row.meta}</span> : null}
          </li>
        ))}
      </ul>
    </MiniFrame>
  );
}

export function TimedExamMini() {
  return (
    <MiniFrame>
      <div className="flex items-center justify-between gap-2">
        <span className="bg-brand-100 text-brand-700 rounded-full px-2.5 py-1 text-[11.5px] font-semibold">
          {MOCK.quantSection}
        </span>
        <span className="text-ink-900 flex items-center gap-1.5 text-[12.5px] font-semibold">
          <IconTimer className="size-3.5" />
          <span className="tabular-nums">{MOCK.sectionClock}</span>
        </span>
      </div>
      <p className="text-ink-600 mt-2.5 text-[11.5px]">{MOCK.questionFifteen}</p>
      <div className="bg-surface-muted mt-2 h-[6px] overflow-hidden rounded-full">
        <div className="bg-gradient-brand-deep h-full w-[62%] rounded-full" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <span className="bg-surface-muted h-2.5 w-full rounded-full" />
        <span className="bg-surface-muted h-2.5 w-4/5 rounded-full" />
      </div>
    </MiniFrame>
  );
}

export function WeeklyBarsMini() {
  return (
    <MiniFrame>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-900 text-[12.5px] font-semibold">
          {MOCK.performanceIndicator}
        </span>
        <span className="border-line-200 text-ink-600 rounded-full border px-2 py-0.5 text-[11px]">
          {MOCK.weekly}
        </span>
      </div>
      <div className="mt-3 h-[70px]">
        <MiniBars
          groups={[
            [40, 28],
            [55, 38],
            [48, 58],
            [72, 50],
            [84, 66],
          ]}
        />
      </div>
      <p className="text-ink-600 mt-2 text-[11.5px]">{MOCK.lessonsThisWeek}</p>
    </MiniFrame>
  );
}

export function QuickQuizMini() {
  return (
    <MiniFrame>
      <p className="text-ink-600 text-[11.5px]">{MOCK.quickDrill}</p>
      <p className="text-ink-900 mt-1.5 text-[12.5px] leading-relaxed font-semibold">
        {MOCK.quickDrillStem}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-accent-green flex items-center gap-1.5 text-[11.5px] font-medium">
          <IconAutosave className="size-3.5" />
          {MOCK.answerSaved}
        </span>
        <span className="bg-gradient-brand flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-white">
          {MOCK.next}
          <IconForward className="size-3" />
        </span>
      </div>
    </MiniFrame>
  );
}

export function PermanentAccessMini() {
  const rows = [
    {
      icon: IconPermanent,
      title: MOCK.entitlementCourse,
      note: MOCK.entitlementCourseNote,
    },
    {
      icon: IconTimer,
      title: MOCK.entitlementSimulator,
      note: MOCK.entitlementSimulatorNote,
    },
  ] as const;

  return (
    <MiniFrame>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.title} className="flex items-center gap-2.5">
            <span className="bg-brand-100 text-brand-700 flex size-8 shrink-0 items-center justify-center rounded-[9px]">
              <row.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink-900 block truncate text-[12px] font-semibold">
                {row.title}
              </span>
              <span className="text-ink-600 block truncate text-[11px]">{row.note}</span>
            </span>
            <span className="bg-accent-green-soft text-accent-green rounded-full px-2 py-0.5 text-[10.5px] font-semibold">
              {MOCK.entitlementActive}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-ink-600 border-line-200/60 mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-[11px]">
        <IconHistory className="size-3.5 shrink-0" />
        {MOCK.historyNote}
      </p>
    </MiniFrame>
  );
}

/* ── §journey ──────────────────────────────────────────────────────────── */

export function JourneyLessonMini() {
  return (
    <MiniFrame>
      <p className="text-ink-900 text-[11.5px] font-semibold">{MOCK.journeyUnit}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        <span className="bg-surface-muted h-2 w-full rounded-full" />
        <span className="bg-surface-muted h-2 w-3/4 rounded-full" />
        <span className="bg-surface-muted h-2 w-5/6 rounded-full" />
      </div>
      <p className="text-brand-700 mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold">
        <IconPlay className="size-3.5" />
        {MOCK.journeyStartLesson}
      </p>
    </MiniFrame>
  );
}

export function JourneyDrillMini() {
  return (
    <MiniFrame>
      <p className="text-ink-900 text-[11.5px] font-semibold">{MOCK.journeyDrill}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {MOCK.journeyOptions.map((option, index) => (
          <span
            key={option}
            className={cn(
              'rounded-control flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]',
              index === 1
                ? 'border-brand-500 bg-brand-50 text-ink-900 border font-semibold'
                : 'border-line-200/70 text-ink-700 border',
            )}
          >
            <span className="flex-1">{option}</span>
            {index === 1 ? <IconCheck className="text-accent-green size-3.5" /> : null}
          </span>
        ))}
      </div>
    </MiniFrame>
  );
}

export function JourneyTimedMini() {
  return (
    <MiniFrame>
      <div className="flex items-center justify-between gap-2">
        <span className="bg-brand-100 text-brand-700 rounded-full px-2.5 py-1 text-[11px] font-semibold">
          {MOCK.quantSection}
        </span>
        <span className="text-ink-900 flex items-center gap-1.5 text-[11.5px] font-semibold">
          <IconTimer className="size-3.5" />
          <span className="tabular-nums">{MOCK.journeyClock}</span>
        </span>
      </div>
      <div className="bg-surface-muted mt-2.5 h-[6px] overflow-hidden rounded-full">
        <div className="bg-gradient-brand-deep h-full w-[45%] rounded-full" />
      </div>
      <div className="mt-2.5 grid grid-cols-6 gap-1">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-4 rounded-[4px]',
              index < 3 ? 'bg-brand-600' : 'bg-surface-muted',
              index === 3 && 'ring-brand-500 bg-brand-100 ring-2',
            )}
          />
        ))}
      </div>
    </MiniFrame>
  );
}

export function JourneyResultMini() {
  return (
    <MiniFrame>
      <div className="flex items-center gap-3">
        <ProgressRing
          percent={72}
          label={MOCK.journeyRingValue}
          caption={MOCK.attemptIndicator}
          gradientId="neb-ring-journey"
          size="sm"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-[11.5px] font-semibold">{MOCK.attemptIndicatorLabel}</p>
          <div className="bg-surface-muted mt-2 h-[6px] overflow-hidden rounded-full">
            <div className="bg-gradient-brand-deep h-full w-[72%] rounded-full" />
          </div>
          <p className="text-ink-600 mt-2 flex items-center gap-1.5 text-[11px]">
            <IconSelected className="size-3 shrink-0" />
            {MOCK.attemptIndicator}
          </p>
        </div>
      </div>
    </MiniFrame>
  );
}
