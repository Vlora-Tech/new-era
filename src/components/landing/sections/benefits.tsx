import { COPY } from '@/lib/copy';

import { IconAttempt, IconFoundation, IconUnderPressure, IconVerified } from '../icons';
import {
  AttemptRow,
  Chip,
  DayBars,
  GlyphTile,
  Meter,
  SectionIntro,
  SectionShell,
  SpecimenLabel,
} from '../parts';

/**
 * §benefits — the method, beside a week of it.
 *
 * The left column is the three-movement argument the previous page made on its
 * own; the right column is new, and is what turns the argument into a picture.
 * It draws one student's week — minutes trained per day, mastery per skill, the
 * last two attempts — because "follow your progress" is the one claim on this
 * page that is much more persuasive shown than stated.
 *
 * The whole panel is specimen artwork: `aria-hidden`, values from
 * `COPY.landing.mock`, and a visible `SpecimenLabel` beneath it. Nothing in it
 * is anybody's data.
 *
 * The three step tiles carry ONE gradient between them. The canvas draws three
 * slightly different blues; three near-identical gradients in a vertical stack
 * is the drift `--neb-gradient-tile` exists to prevent, and at 52px the
 * difference between them is not visible anyway.
 */
const BENEFITS = COPY.landing.benefits;
const MOCK = COPY.landing.mock;

const STEP_ICONS = [IconFoundation, IconVerified, IconUnderPressure] as const;

export function Benefits() {
  return (
    <SectionShell id="benefits" tone="band" pad="full">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-[70px]">
        {/* ── The argument ──────────────────────────────────────────────── */}
        <div>
          <SectionIntro title={BENEFITS.title} lead={BENEFITS.lead} align="start" size="tight" />

          <div className="mt-9 flex flex-col gap-4">
            {BENEFITS.steps.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <div key={step.title} className="reveal flex items-stretch gap-3.5">
                  <GlyphTile icon={Icon} size="lg" className="shadow-glow size-13 rounded-[15px]" />
                  {/*
                    The nudge is toward the inline END, which under RTL is the
                    canvas's `translateX(-6px)`. Written logically so it still
                    points away from the tile if this block is ever shown LTR.
                  */}
                  <div className="border-line-200 rounded-panel bg-surface/85 flex-1 border px-5 py-3.5 transition-transform duration-200 ease-out hover:-translate-x-1.5 rtl:hover:translate-x-1.5">
                    <p className="font-display text-ink-900 text-[17px] font-semibold">
                      {step.title}
                    </p>
                    <p className="text-ink-600 mt-1.5 text-[14px] leading-[1.75] font-light">
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── The week ──────────────────────────────────────────────────── */}
        <div className="reveal mx-auto w-full max-w-[640px]">
          <div
            aria-hidden="true"
            className="border-line-200 bg-surface shadow-card-lg flex flex-col gap-3 rounded-[22px] border p-4.5"
          >
            <div className="flex items-start justify-between gap-3.5">
              <div>
                <p className="font-display text-ink-900 text-[16px] font-semibold">
                  {MOCK.weekTitle}
                </p>
                <p className="text-ink-500 mt-1.5 text-[13px]">{MOCK.weekMeta}</p>
              </div>
              <Chip>{MOCK.weekRange}</Chip>
            </div>

            <div className="border-line-200/70 rounded-panel to-brand-50/60 border bg-linear-to-b from-white p-3.5">
              <div className="mb-3.5 flex items-baseline justify-between gap-2">
                <span className="text-ink-600 text-[13px]">{MOCK.dailyMinutes}</span>
                <span className="font-display text-ink-900 text-[17px] font-bold">
                  {MOCK.dailyMinutesValue}
                </span>
              </div>
              <DayBars days={MOCK.days} />
            </div>

            <div className="border-line-200/70 rounded-panel flex flex-col gap-2.5 border p-3.5">
              <span className="text-ink-600 text-[13px]">{MOCK.masteryTitle}</span>
              {MOCK.mastery.map((skill) => (
                <Meter
                  key={skill.label}
                  label={skill.label}
                  value={skill.value}
                  percent={skill.percent}
                />
              ))}
            </div>

            <div className="border-line-200/70 rounded-panel bg-canvas flex flex-col gap-2 border p-3.5">
              <span className="text-ink-600 text-[13px]">{MOCK.recentTitle}</span>
              {MOCK.recent.map((attempt, index) => (
                <AttemptRow
                  key={attempt.title}
                  icon={IconAttempt}
                  title={attempt.title}
                  meta={attempt.meta}
                  value={attempt.value}
                  tone={index === 1 ? 'success' : 'ink'}
                />
              ))}
            </div>
          </div>

          <SpecimenLabel className="mt-4" />
        </div>
      </div>
    </SectionShell>
  );
}
