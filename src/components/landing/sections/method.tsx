import { Container } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

import {
  IconAttempts,
  IconImprovement,
  IconLearn,
  IconMethod,
  IconPractice,
  IconTimer,
} from '../icons';
import { ChipStat, Eyebrow, FloatChip, GlyphTile, revealDelay, SpecimenLabel } from '../parts';

/**
 * The method band — the page's one tinted full-bleed section.
 *
 * Left column: three steps, each an icon tile beside a card. Right column: a
 * nested-hexagon figure built from `clip-path`, standing in for the khatim
 * geometry the rest of the product uses. It is drawn, not photographed, for the
 * same reason the lesson player has no video still: there is nothing real to
 * photograph yet, and a stock image of a student would be invented evidence.
 *
 * The two chips beside the hexagon («تحسّن الكمي +12%», «محاولات مكتملة 3»)
 * are the most misreadable figures on the page — they float outside any browser
 * frame and could be taken for platform statistics. They are therefore inside
 * the illustration's own `aria-hidden` group and under its specimen caption,
 * which is what marks them as one imagined student's chips rather than a claim.
 */
const METHOD = COPY.landing.method;
const MOCK = COPY.landing.mock;

const STEP_ICONS = [IconLearn, IconPractice, IconTimer] as const;

export function Method() {
  return (
    <section
      id="benefits"
      className="border-line-200/70 via-canvas to-brand-50 relative scroll-mt-20 overflow-hidden border-y bg-linear-to-b from-white py-20 sm:py-24 lg:scroll-mt-24 lg:py-28"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="reveal">
              <Eyebrow icon={IconMethod}>{METHOD.eyebrow}</Eyebrow>
            </div>
            <h2 className="text-ink-900 text-h2 reveal mt-6" style={revealDelay(60)}>
              {METHOD.title}
            </h2>
            <p className="text-ink-700 text-lead measure-ar reveal mt-5" style={revealDelay(110)}>
              {METHOD.lead}
            </p>

            <ol className="mt-10 flex flex-col gap-4">
              {METHOD.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="reveal flex items-stretch gap-3.5"
                  style={revealDelay(index * 90)}
                >
                  <GlyphTile icon={STEP_ICONS[index]} size="lg" className="self-start" />
                  <div className="rounded-panel border-line-200 bg-surface/85 flex-1 border px-5 py-3.5">
                    <p className="font-display text-ink-900 text-[17px] font-semibold">
                      {step.title}
                    </p>
                    <p className="text-ink-700 mt-1.5 text-[14px] leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* The figure */}
          <div className="reveal" style={revealDelay(140)}>
            <div
              aria-hidden="true"
              className="relative flex min-h-[420px] items-center justify-center lg:min-h-[520px]"
            >
              <span className="bg-grid-fade absolute inset-0 [mask-image:radial-gradient(closest-side,black_40%,transparent_78%)]" />

              <span className="to-brand-100/45 absolute size-[min(400px,80vw)] bg-linear-to-b from-white/80 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
              <span className="to-brand-100/60 absolute size-[min(300px,60vw)] bg-linear-to-b from-white/95 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />

              <span className="bg-gradient-tile shadow-plate relative flex size-[min(210px,42vw)] items-center justify-center [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
                <IconLearn className="size-16 text-white" strokeWidth={1.5} />
              </span>

              <span className="bg-gradient-tile float-a absolute end-[16%] top-[22%] size-5.5 rounded-full" />
              <span className="bg-gradient-brand-deep float-b absolute start-[18%] bottom-[20%] size-6.5 rounded-full" />
              <span className="bg-brand-300 float-c absolute start-[8%] top-[32%] size-4 rounded-full" />

              <FloatChip float="a" className="start-[2%] top-[12%] flex-col !items-start gap-2">
                <span className="flex items-center gap-2">
                  <GlyphTile icon={IconImprovement} size="sm" />
                  <span className="text-ink-900 text-[12.5px] font-semibold">
                    {MOCK.quantImprovement}
                  </span>
                </span>
                {/*
                 * `+12%` is a left-to-right run inside a right-to-left page:
                 * without an isolate the bidi algorithm moves the sign to the
                 * far end and it renders as «12%+».
                 */}
                <bdi dir="ltr" className="font-display text-ink-900 text-[17px] font-bold">
                  {MOCK.quantImprovementValue}
                </bdi>
              </FloatChip>

              <FloatChip float="b" className="end-0 bottom-[14%]">
                <GlyphTile icon={IconAttempts} size="sm" tone="teal" />
                <ChipStat label={MOCK.attemptsDone} value={MOCK.attemptsDoneValue} />
              </FloatChip>
            </div>

            <SpecimenLabel className="mt-2" />
          </div>
        </div>
      </Container>
    </section>
  );
}
