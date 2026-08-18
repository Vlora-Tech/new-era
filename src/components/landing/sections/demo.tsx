'use client';

import { useState } from 'react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconDemo, IconPlay } from '../icons';
import { SimulatorScreenMockup } from '../mockups/exam';
import { Eyebrow, revealDelay, SpecimenLabel } from '../parts';
import { Container } from '@/components/ui/surface';

/**
 * The simulator preview.
 *
 * The page's ONLY client component, and it is one for a reason worth stating:
 * everything else here — the scroll reveals, the chart entrances, the FAQ
 * disclosures — is CSS, so the landing page renders and works completely with
 * JavaScript disabled. This overlay is the single interaction that does not
 * have an honest CSS form.
 *
 * The `<details>` trick was considered and rejected. Making the overlay a
 * `<summary>` and hiding it with `group-open:` leaves a focusable element that
 * is invisible, which is worse for a keyboard user than the twenty lines of
 * state below. A real `<button>` with `aria-expanded` says what it does.
 *
 * The screen behind the overlay is inert artwork — `aria-hidden`, no controls,
 * nothing to reach. Revealing it changes nothing for assistive technology,
 * which is why the button's own label carries the whole meaning.
 */
const DEMO = COPY.landing.demo;
const MOCK = COPY.landing.mock;

export function Demo() {
  const [revealed, setRevealed] = useState(false);

  return (
    <section id="demo" className="relative scroll-mt-20 py-20 sm:py-24 lg:scroll-mt-24 lg:py-32">
      <Container>
        <div className="text-center">
          <div className="reveal">
            <Eyebrow icon={IconDemo}>{DEMO.eyebrow}</Eyebrow>
          </div>
          <h2 className="text-ink-900 text-h2 reveal mt-6" style={revealDelay(60)}>
            {DEMO.title}
          </h2>
          <p
            className="text-ink-700 text-lead measure-ar-lg reveal mx-auto mt-5"
            style={revealDelay(110)}
          >
            {DEMO.lead}
          </p>
        </div>

        <div className="reveal mt-14" style={revealDelay(160)}>
          <p className="text-ink-600 mb-3 text-center text-[13px]">{MOCK.demoWindowTitle}</p>

          <div className="rounded-plate shadow-plate border-line-200 bg-surface relative overflow-hidden border">
            <div aria-hidden="true">
              <SimulatorScreenMockup />
            </div>

            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                'bg-ink-900/15 backdrop-blur-[3px]',
                'transition-opacity duration-300 ease-out',
                revealed && 'pointer-events-none opacity-0',
              )}
              // Once dismissed the layer is gone for good, so it must leave the
              // tab order too — an invisible button that still takes focus is
              // the exact failure the `<details>` version had.
              inert={revealed || undefined}
            >
              <button
                type="button"
                onClick={() => setRevealed(true)}
                aria-expanded={revealed}
                className="bg-surface text-ink-900 shadow-card-lg focus-visible:outline-brand-500 flex items-center gap-3 rounded-full py-3 ps-3 pe-6 text-[15px] font-semibold transition-transform duration-200 ease-out hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-100"
              >
                <span className="bg-gradient-brand flex size-10 items-center justify-center rounded-full text-white">
                  <IconPlay className="ms-0.5 size-4.5" aria-hidden="true" />
                </span>
                {DEMO.playLabel}
              </button>
            </div>
          </div>

          <SpecimenLabel className="mt-4" />
        </div>
      </Container>
    </section>
  );
}
