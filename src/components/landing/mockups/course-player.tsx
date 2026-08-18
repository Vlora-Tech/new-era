import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconForward, IconLocked, IconPlay, IconTick } from '../icons';

/**
 * The courses panel's drawing of the lesson player.
 *
 * The video area is a deep brand plate rather than a photograph: the product
 * has no lesson videos attached yet, and a stock still of somebody studying
 * would be exactly the invented evidence the rest of this page avoids. It is
 * also the one dark surface the design permits — a drawn screen inside a card,
 * not a dark section, which is why the no-dark-sections rule still holds.
 */
const MOCK = COPY.landing.mock;

const MODULE_STATE = ['done', 'done', 'playing', 'locked'] as const;

export function CoursePlayerMockup() {
  return (
    <div className="rounded-card border-line-200/70 bg-surface shadow-card overflow-hidden border">
      <div className="border-line-200/60 border-b px-4 py-3">
        <p className="font-display text-ink-900 text-[14.5px] font-semibold">
          {MOCK.coursePlayerTitle}
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div>
          <p className="text-ink-600 mb-2 text-[12px] font-semibold">{MOCK.modulesLabel}</p>
          <ul className="flex flex-col gap-1.5">
            {MOCK.modules.map((title, index) => {
              const state = MODULE_STATE[index];
              return (
                <li
                  key={title}
                  className={cn(
                    'rounded-control flex items-center gap-2 px-2.5 py-2 text-[12.5px]',
                    state === 'playing'
                      ? 'bg-brand-100 text-brand-700 font-semibold'
                      : 'text-ink-700',
                    state === 'locked' && 'text-ink-600',
                  )}
                >
                  {state === 'done' ? (
                    <IconTick className="text-accent-green size-3.5 shrink-0" />
                  ) : null}
                  {state === 'playing' ? (
                    <IconPlay className="text-brand-700 size-3.5 shrink-0" />
                  ) : null}
                  {state === 'locked' ? (
                    <IconLocked className="text-ink-600 size-3.5 shrink-0" />
                  ) : null}
                  <span className="truncate">{title}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {/* The lesson screen */}
          <div className="rounded-panel from-brand-950 via-brand-900 to-brand-800 relative flex aspect-video items-center justify-center overflow-hidden bg-linear-to-br">
            <span className="bg-surface/95 text-brand-700 shadow-card flex size-12 items-center justify-center rounded-full">
              <IconPlay className="ms-0.5 size-5" />
            </span>
            <span className="bg-ink-900/55 absolute end-2.5 bottom-2.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white tabular-nums">
              {MOCK.lessonClock}
            </span>
          </div>

          <p className="text-ink-900 mt-3 text-[14px] leading-relaxed font-semibold">
            {MOCK.lessonTitle}
          </p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-ink-600 text-[12px] whitespace-nowrap">
              {MOCK.resumePosition}
            </span>
            <span className="text-brand-700 text-[12px] font-semibold tabular-nums">34%</span>
          </div>
          <div className="bg-surface-muted mt-1.5 h-[6px] overflow-hidden rounded-full">
            <div className="bg-gradient-brand-deep h-full w-[34%] rounded-full" />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="bg-gradient-brand flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white">
              {MOCK.resumeAction}
              <IconForward className="size-3.5" />
            </span>
            <span className="border-line-200 text-ink-700 rounded-full border px-4 py-2 text-[12.5px] font-medium">
              {MOCK.lessonExercise}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
