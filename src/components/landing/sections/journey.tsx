import { COPY } from '@/lib/copy';

import { IconJourney } from '../icons';
import {
  JourneyDrillMini,
  JourneyLessonMini,
  JourneyResultMini,
  JourneyTimedMini,
} from '../mockups/minis';
import { PlateCard, SectionIntro, SectionShell } from '../parts';

/**
 * §journey — the four steps.
 *
 * Each card is a drawing, an ordinal and a claim, in that order. The drawing
 * comes first because the ordinal alone («01») says nothing; what makes the
 * sequence legible is that the four pictures are visibly four different screens.
 *
 * ── The ordinals ──────────────────────────────────────────────────────────
 *
 * They are `brand-700`, not the canvas's `#4fadf5`. That value is about 2.4:1
 * on white, and these are 13px — real text, carrying real ordering information,
 * well under the floor. Everything else about them is the canvas's: Alexandria
 * 700 at 13px with +0.06em tracking.
 *
 * The positive tracking is legal here and nowhere else on the page: these are
 * LATIN numerals, and the no-tracking rule exists because Arabic is cursive.
 */
const JOURNEY = COPY.landing.journey;

const STEP_DRAWINGS = [
  JourneyLessonMini,
  JourneyDrillMini,
  JourneyTimedMini,
  JourneyResultMini,
] as const;

export function Journey() {
  return (
    <SectionShell id="journey">
      <SectionIntro
        icon={IconJourney}
        eyebrow={JOURNEY.eyebrow}
        title={JOURNEY.title}
        lead={JOURNEY.lead}
      />

      <ol className="mt-13 grid gap-5 text-start sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY.steps.map((step, index) => {
          const Drawing = STEP_DRAWINGS[index];
          return (
            <li key={step.title} className="flex">
              <PlateCard className="reveal flex flex-1 flex-col p-5.5">
                <Drawing />
                <p
                  className="font-display text-brand-700 mt-4.5 text-[13px] font-bold tracking-[0.06em] tabular-nums"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="text-ink-900 text-h3 mt-1.5 text-[19px]">{step.title}</h3>
                <p className="text-ink-600 mt-2.5 text-[14px] leading-[1.8] font-light">
                  {step.body}
                </p>
              </PlateCard>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}
