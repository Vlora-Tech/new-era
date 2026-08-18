import { COPY } from '@/lib/copy';

import { IconJourney } from '../icons';
import {
  JourneyDrillMini,
  JourneyLessonMini,
  JourneyResultMini,
  JourneyTimedMini,
} from '../mockups/minis';
import { revealDelay, SectionIntro, SectionShell } from '../parts';

/**
 * How the platform works, in four steps.
 *
 * The section keeps `id="how-it-works"` in addition to the design's `#journey`.
 * That id has been the header's third nav target since the previous page and
 * may be bookmarked or linked from outside; dropping it would break those links
 * for the sake of a rename nobody sees. `#journey` is the alias the new pill
 * nav and the design's own anchors use.
 *
 * The step numerals are Arabic-Indic via `toLocaleString('ar-SA')` rather than
 * hardcoded, so they match every other counted thing in the product. They are
 * `aria-hidden` because the ordered list already conveys the sequence — a
 * screen reader announcing «١» before «ابدأ بالتأسيس» in an `<ol>` is saying
 * it twice.
 */
const JOURNEY = COPY.landing.journey;

const STEP_ART = [
  <JourneyLessonMini key="lesson" />,
  <JourneyDrillMini key="drill" />,
  <JourneyTimedMini key="timed" />,
  <JourneyResultMini key="result" />,
];

export function Journey() {
  return (
    <SectionShell id="journey" className="scroll-mt-20 lg:scroll-mt-24">
      {/*
       * The legacy anchor, offset to clear the sticky bar the same way the
       * section itself is. An empty span rather than a second id on the section,
       * because an element cannot carry two.
       */}
      <span id="how-it-works" aria-hidden="true" className="block scroll-mt-20 lg:scroll-mt-24" />

      <SectionIntro
        icon={IconJourney}
        eyebrow={JOURNEY.eyebrow}
        title={JOURNEY.title}
        lead={JOURNEY.lead}
      />

      <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY.steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-plate border-line-200 bg-surface shadow-card reveal flex flex-col border p-6 text-start"
            style={revealDelay(index * 80)}
          >
            {/*
             * The four drawings are naturally different heights — a ring, a
             * three-option list, a progress strip. Without a common box the
             * numerals and titles below them land on four different baselines
             * and the row stops reading as a sequence.
             */}
            <div aria-hidden="true" className="flex min-h-[212px] items-center">
              {STEP_ART[index]}
            </div>

            <span
              aria-hidden="true"
              className="font-display text-brand-700 mt-6 text-[15px] font-bold tabular-nums"
            >
              {(index + 1).toLocaleString('ar-SA')}
            </span>
            <h3 className="font-display text-ink-900 mt-1.5 text-[18px] font-semibold">
              {step.title}
            </h3>
            <p className="text-ink-700 mt-2 text-[14.5px] leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
