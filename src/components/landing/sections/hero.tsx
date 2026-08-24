import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

import { IconAutosave, IconCheck, IconQuantitative, IconVerbal } from '../icons';
import { DashboardMockup } from '../mockups/dashboard';
import {
  ChipStat,
  FloatChip,
  GlyphTile,
  MarketingContainer,
  revealDelay,
  SpecimenLabel,
} from '../parts';

/**
 * The hero.
 *
 * Four things about it are deliberate and easy to undo by accident:
 *
 * ONE ACTION. The canvas removed the badge pill, the secondary button and the
 * fine print that used to sit here, leaving a single oversized gradient pill.
 * That is the design: everything the removed controls pointed at is still one
 * click away in the bar directly above.
 *
 * THE LOGO IS NOT HERE. The header bar sits directly above this section and
 * carries the mark already; a second lockup a hundred pixels below the first
 * reads as an accident rather than as a masthead.
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

/**
 * The aurora field.
 *
 * Five blobs and a scrim, drawn from the canvas's own geometry. Their offsets
 * are the canvas's minus the header's height, because the canvas measures from
 * the top of the document and this section starts below a sticky bar.
 *
 * `right`/`left` are PHYSICAL here, not logical, and that is intentional: the
 * field is a composition, not content, and mirroring it under RTL would put the
 * heavy blob on the wrong side of the artwork it was balanced against.
 *
 * The section clips on the inline axis only (`overflow-x-clip`), so the blobs
 * can rise behind the header without any of them producing a sideways
 * scrollbar.
 */
function AuroraField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 h-[880px]">
      <span className="aurora-a absolute -top-[424px] -right-[220px] h-[1060px] w-[1180px] rounded-full" />
      <span className="aurora-b absolute -top-[384px] -left-[240px] h-[1000px] w-[1060px] rounded-full" />
      <span className="aurora-c absolute -top-[164px] left-1/2 h-[700px] w-[1600px] rounded-full" />
      <span className="aurora-d absolute top-6 right-[6%] h-[560px] w-[620px] rounded-full" />
      <span className="aurora-e absolute top-[84px] left-[4%] h-[520px] w-[560px] rounded-full" />
      <span className="bg-aurora-scrim absolute inset-0" />
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative scroll-mt-36 overflow-x-clip pt-16 lg:scroll-mt-44 lg:pt-24"
    >
      <AuroraField />

      <MarketingContainer className="relative">
        <div className="mx-auto max-w-[1180px] text-center">
          <h1 className="text-ink-900 text-display enter" style={revealDelay(80)}>
            {HERO.headingLead} <span className="text-gradient-brand">{HERO.headingAccent}</span>
          </h1>

          <p
            className="text-ink-700 text-lead-lg enter mx-auto mt-6 max-w-[660px]"
            style={revealDelay(150)}
          >
            {HERO.lead}
          </p>

          <div className="enter mt-9 flex justify-center" style={revealDelay(220)}>
            <Button asChild variant="gradient" shape="pill" size="hero">
              <Link href="/register">{HERO.ctaPrimary}</Link>
            </Button>
          </div>
        </div>

        {/*
         * The plate. `relative` is load-bearing: the float chips are positioned
         * against it, and they sit slightly outside its box on purpose. The
         * chips are `hidden lg:flex` so that overhang can never produce a
         * sideways scrollbar on a phone.
         *
         * The mask is the canvas's: the drawing fades out at its own bottom
         * edge rather than ending on a hard rule, which is what stops a 900px
         * mockup from reading as a second page.
         */}
        <div className="enter relative mt-16 lg:mt-[70px]" style={revealDelay(340)}>
          <span
            aria-hidden="true"
            className="glow-pulse pointer-events-none absolute inset-x-[8%] top-[30%] bottom-[-40px] rounded-[50%] bg-[radial-gradient(closest-side,rgb(6_104_200/0.34),transparent)]"
          />

          <div
            className="rounded-plate shadow-plate to-brand-50/75 relative border border-white/90 bg-linear-to-b from-white/90 p-2.5"
            style={{
              maskImage:
                'linear-gradient(180deg,#000 0%,#000 55%,rgb(0 0 0 / 0.35) 82%,transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(180deg,#000 0%,#000 55%,rgb(0 0 0 / 0.35) 82%,transparent 100%)',
            }}
          >
            <div aria-hidden="true">
              <DashboardMockup />
            </div>
          </div>

          {/*
           * The canvas places these with PHYSICAL right/left, and they are
           * written here as logical start/end — which under this page's `rtl`
           * resolve to the same edges. Two carry a stat, two carry a line of
           * status, and they alternate sides down the plate.
           */}
          <FloatChip float="a" className="start-[-4%] top-[14%]">
            <GlyphTile icon={IconVerbal} className="size-[42px] rounded-[13px] [&_svg]:size-5.5" />
            <ChipStat label={MOCK.verbalLevel} value={MOCK.verbalLevelValue} />
          </FloatChip>

          <FloatChip float="b" className="end-[-5%] top-[34%]">
            <GlyphTile
              icon={IconQuantitative}
              className="size-[42px] rounded-[13px] [&_svg]:size-5.5"
            />
            <ChipStat label={MOCK.quantLevel} value={MOCK.quantLevelValue} />
          </FloatChip>

          <FloatChip float="c" className="start-[-3%] top-[48%]">
            <IconCheck className="text-success-fill size-5.5 shrink-0" />
            <span className="text-ink-900 text-[15px] font-medium">{MOCK.simulatorFinished}</span>
          </FloatChip>

          <FloatChip float="a" className="end-[-3%] top-[52%]">
            <IconAutosave className="text-brand-800 size-5.5 shrink-0" />
            <span className="text-ink-900 text-[15px] font-medium">{MOCK.progressSaved}</span>
          </FloatChip>
        </div>

        <SpecimenLabel className="mt-5" />
      </MarketingContainer>
    </section>
  );
}
