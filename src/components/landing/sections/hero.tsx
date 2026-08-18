import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

import {
  IconAutosave,
  IconBadge,
  IconForward,
  IconQuantitative,
  IconVerified,
  IconVerbal,
} from '../icons';
import { DashboardMockup } from '../mockups/dashboard';
import { ChipStat, FloatChip, GlyphTile, revealDelay, SpecimenLabel } from '../parts';

/**
 * The hero.
 *
 * Three things about it are deliberate and easy to undo by accident:
 *
 * THE LOGO IS NOT HERE. The header bar sits directly above this section and
 * carries the mark already; a second lockup a hundred pixels below the first
 * reads as an accident rather than as a masthead. This was true of the page
 * this replaced and it is still true.
 *
 * THE HEADING IS TWO RUNS. `headingLead` and `headingAccent` are separate
 * elements so the second can carry the gradient clip, with a real space between
 * them — without it a screen reader announces the halves as one joined word.
 * The clip degrades to solid brand blue, never to invisible text; see
 * `text-gradient-brand` in globals.css.
 *
 * THE DRAWING IS A DRAWING. The dashboard below is `aria-hidden` and captioned
 * as a specimen. Nothing in it — 68%, 74%, 1,240 — is anybody's result, and
 * nothing on this page claims a student count, a pass rate or a rating.
 */
const HERO = COPY.landing.hero;
const MOCK = COPY.landing.mock;

export function Hero() {
  return (
    <section id="top" className="bg-hero-glow relative scroll-mt-20 pt-16 lg:scroll-mt-24 lg:pt-24">
      <Container>
        <div className="mx-auto max-w-[1000px] text-center">
          <span className="border-line-200 bg-surface/90 enter inline-flex items-center gap-2.5 rounded-full border py-1.5 ps-1.5 pe-4 shadow-xs">
            <span className="bg-gradient-tile inline-flex size-6.5 shrink-0 items-center justify-center rounded-full text-white">
              <IconBadge className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-ink-700 text-[14.5px] font-medium">{HERO.badge}</span>
          </span>

          <h1 className="text-ink-900 text-display enter mt-7" style={revealDelay(80)}>
            {HERO.headingLead} <span className="text-gradient-brand">{HERO.headingAccent}</span>
          </h1>

          <p
            className="text-ink-700 text-lead measure-ar-lg enter mx-auto mt-6"
            style={revealDelay(150)}
          >
            {HERO.lead}
          </p>

          <div
            className="enter mt-9 flex flex-wrap items-center justify-center gap-3.5"
            style={revealDelay(220)}
          >
            <Button asChild variant="gradient" shape="pill" size="xl">
              <Link href="/register">
                {HERO.ctaPrimary}
                <IconForward className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="xl">
              <Link href="/simulators">{HERO.ctaSecondary}</Link>
            </Button>
          </div>

          <p className="text-ink-600 enter mt-5 text-sm" style={revealDelay(280)}>
            {HERO.finePrint}
          </p>
        </div>

        {/*
         * The plate. `relative` is load-bearing: the float chips are positioned
         * against it, and they sit slightly outside its box on purpose. The
         * chips are `hidden lg:flex` so that overhang can never produce a
         * sideways scrollbar on a phone.
         */}
        <div className="enter relative mt-16" style={revealDelay(340)}>
          <span
            aria-hidden="true"
            className="glow-pulse pointer-events-none absolute inset-x-[8%] top-[30%] bottom-[-40px] rounded-[50%] bg-[radial-gradient(closest-side,rgb(38_134_200/0.30),transparent)]"
          />

          <div className="rounded-plate shadow-plate to-brand-50/75 relative border border-white/90 bg-linear-to-b from-white/90 p-2.5">
            <div aria-hidden="true">
              <DashboardMockup />
            </div>
          </div>

          <FloatChip float="a" className="end-[-2%] top-[16%]">
            <GlyphTile icon={IconVerbal} />
            <ChipStat label={MOCK.verbal} value={MOCK.verbalValue} />
          </FloatChip>

          <FloatChip float="b" className="start-[-3%] top-[44%]">
            <GlyphTile icon={IconQuantitative} tone="teal" />
            <ChipStat label={MOCK.quantitative} value={MOCK.quantitativeValue} />
          </FloatChip>

          <FloatChip float="c" className="end-[-1%] bottom-[16%]">
            <IconVerified className="text-accent-green size-4.5 shrink-0" />
            <span className="text-ink-900 text-[13px] font-medium">{MOCK.lastAttemptDone}</span>
          </FloatChip>

          <FloatChip float="a" className="start-[-1%] bottom-[30%]">
            <IconAutosave className="text-brand-600 size-4.5 shrink-0" />
            <span className="text-ink-900 text-[13px] font-medium">{MOCK.progressSaved}</span>
          </FloatChip>
        </div>

        <SpecimenLabel className="mt-5" />
      </Container>
    </section>
  );
}
