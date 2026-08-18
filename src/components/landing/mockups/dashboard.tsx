import { BrandWordmark } from '@/components/layout/brand';
import { COPY } from '@/lib/copy';

import {
  IconBell,
  IconCourses,
  IconForward,
  IconPlay,
  IconQuiz,
  IconSearch,
  IconTimer,
  IconVerified,
} from '../icons';
import { BrowserChrome, GlyphTile, Meter, MiniBars, ProgressRing } from '../parts';

/**
 * The hero's drawing of the student dashboard.
 *
 * The largest figure on the page and the one most likely to be mistaken for a
 * screenshot, so it is the one that most needs the specimen convention: the
 * whole tree is `aria-hidden` from its caller and a `SpecimenLabel` sits
 * directly beneath the plate. Every value in it — 68%, 74%, 1,240, the five
 * weeks of bars, «الدرس 4 من 12» — describes an imagined student and comes from
 * `COPY.landing.mock`.
 *
 * The in-product bar carries `BrandWordmark`, the set-type mark, and NOT the
 * supplied lockup. The brand guidelines forbid the artwork below 220px and on a
 * tinted ground; a 30px tile inside a drawing would break both, and a real
 * lockup inside a drawn browser window would read as a screenshot rather than
 * as an illustration.
 */
const MOCK = COPY.landing.mock;

const BAR_GROUPS = [
  [46, 34],
  [58, 44],
  [52, 62],
  [74, 56],
  [86, 70],
] as const;

const STAT_TILES = [
  { icon: IconCourses, label: MOCK.courseProgress, value: MOCK.courseProgressValue, tone: 'vivid' },
  { icon: IconTimer, label: MOCK.lastAttempt, value: MOCK.lastAttemptValue, tone: 'teal' },
  { icon: IconQuiz, label: MOCK.answered, value: MOCK.answeredValue, tone: 'soft' },
  { icon: IconVerified, label: MOCK.lessonsDone, value: MOCK.lessonsDoneValue, tone: 'green' },
] as const;

export function DashboardMockup() {
  return (
    <div className="rounded-card border-line-200/70 bg-surface overflow-hidden border">
      <BrowserChrome />

      {/* The product's own header, drawn */}
      <div className="border-line-200/60 flex items-center justify-between gap-5 border-b px-5 py-4">
        <BrandWordmark compact />

        <span className="border-line-200/70 bg-brand-50 hidden max-w-[360px] flex-1 items-center gap-2 rounded-full border px-3.5 py-2 sm:flex">
          <IconSearch className="text-ink-600 size-4 shrink-0" />
          <span className="text-ink-600 truncate text-[13px]">{MOCK.searchPlaceholder}</span>
        </span>

        <span className="flex items-center gap-3">
          <IconBell className="text-ink-600 size-5" />
          <span className="bg-brand-100 text-brand-700 flex size-8 items-center justify-center rounded-full text-[12.5px] font-semibold">
            {MOCK.avatarInitials}
          </span>
        </span>
      </div>

      <div className="to-brand-50/70 bg-linear-to-b from-white px-5 pt-6 pb-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-ink-900 text-[21px] font-semibold">{MOCK.greeting}</p>
            <p className="text-ink-600 mt-1.5 text-[13.5px]">{MOCK.greetingBody}</p>
          </div>
          <span className="bg-gradient-brand shadow-cta flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white">
            <IconPlay className="size-4" />
            {MOCK.startTraining}
          </span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <div
              key={tile.label}
              className="rounded-panel border-line-200/70 bg-surface flex items-center gap-3 border p-4 shadow-xs"
            >
              <GlyphTile icon={tile.icon} tone={tile.tone} />
              <div className="min-w-0">
                <p className="text-ink-600 truncate text-[12px]">{tile.label}</p>
                <p className="font-display text-ink-900 text-[19px] font-bold">{tile.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
          {/* Weekly progress */}
          <div className="rounded-card border-line-200/70 bg-surface border p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-ink-900 text-[15.5px] font-semibold">
                {MOCK.progressTitle}
              </p>
              <span className="text-ink-600 flex items-center gap-3.5 text-[11.5px]">
                <span className="flex items-center gap-1.5">
                  <span className="bg-brand-600 size-2.5 rounded-[3px]" />
                  {MOCK.quantitative}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-brand-200 size-2.5 rounded-[3px]" />
                  {MOCK.verbal}
                </span>
              </span>
            </div>

            <div className="border-line-200/60 relative mt-4 h-[150px] border-b pb-5">
              <span className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
                <span className="border-line-200/50 border-t border-dashed" />
                <span className="border-line-200/50 border-t border-dashed" />
                <span className="border-line-200/50 border-t border-dashed" />
                <span className="border-line-200/50 border-t border-dashed" />
              </span>
              <MiniBars groups={BAR_GROUPS} className="relative" />
            </div>

            <div className="text-ink-600 mt-2.5 flex justify-between text-[11.5px]">
              {MOCK.weeks.map((week) => (
                <span key={week}>{week}</span>
              ))}
            </div>
          </div>

          {/* Simulator performance */}
          <div className="rounded-card border-line-200/70 bg-surface flex flex-col border p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-ink-900 text-[15.5px] font-semibold">
                {MOCK.simulatorPerformance}
              </p>
              <span className="border-line-200 text-ink-600 rounded-full border px-2.5 py-1 text-[11.5px]">
                {MOCK.lastFourAttempts}
              </span>
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-center gap-6 pt-4 pb-1.5">
              <ProgressRing
                percent={74}
                label={MOCK.ringValue}
                caption={MOCK.attemptIndicator}
                gradientId="neb-ring-dashboard"
              />
              <div className="flex min-w-[130px] flex-col gap-3">
                <Meter label={MOCK.verbal} value={MOCK.verbalValue} percent={72} />
                <Meter label={MOCK.quantitative} value={MOCK.quantitativeValue} percent={64} />
                <p className="text-ink-600 text-[11.5px] leading-relaxed">{MOCK.indicatorNote}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resume */}
        <div className="rounded-card border-line-200/70 bg-surface mt-3.5 flex flex-wrap items-center gap-4 border p-4 shadow-xs">
          <GlyphTile icon={IconCourses} size="lg" tone="soft" />
          <div className="min-w-[220px] flex-1">
            <p className="text-ink-600 text-[12px]">{MOCK.resumeLabel}</p>
            <p className="font-display text-ink-900 mt-1 text-[15.5px] font-semibold">
              {MOCK.resumeTitle}
            </p>
            <div className="bg-surface-muted mt-2.5 h-[7px] overflow-hidden rounded-full">
              <div className="bg-gradient-brand-deep h-full w-[34%] rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-600 text-[12.5px] whitespace-nowrap">
              {MOCK.resumePosition}
            </span>
            <span className="bg-ink-900 flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white">
              {MOCK.resumeAction}
              <IconForward className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
