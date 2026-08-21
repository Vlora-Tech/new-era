import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

import { MarketingContainer } from '../parts';

/**
 * The closing band.
 *
 * The page's one conversion band, and the only place besides the hero where a
 * control is the primary object rather than one control among several.
 *
 * Its ground is the deepest tint on the site — white into `brand-200` and back
 * out again — with two blown-out blobs and a masked grid over it. That is a lot
 * of decoration for one band, and it is deliberate: the reader has scrolled the
 * whole page by now, and the change in weather is what says the argument is
 * over. It is still entirely inside the light scale; there is no dark section
 * here and the product has none anywhere.
 *
 * The secondary action is a text link with a rule under it rather than a second
 * button. Two buttons of equal weight at the end of a page is two decisions;
 * this is one decision with an escape hatch.
 */
const CLOSING = COPY.landing.closing;

export function Closing() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24 lg:py-[140px]">
      {/* The ground and its weather. All three are decoration. */}
      <span
        aria-hidden="true"
        className="from-brand-100 via-brand-200 to-brand-50 absolute inset-0 bg-linear-to-b from-0% via-30% to-100%"
      />
      <span
        aria-hidden="true"
        className="absolute -top-40 right-[8%] size-[620px] rounded-full bg-[radial-gradient(closest-side,rgb(87_173_244/0.55),transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-56 left-[6%] size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(120_190_245/0.5),transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgb(90 140 190 / 0.09) 1px, transparent 1px), linear-gradient(90deg, rgb(90 140 190 / 0.09) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(closest-side, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(closest-side, #000 30%, transparent 75%)',
        }}
      />

      <MarketingContainer className="relative">
        <div className="mx-auto max-w-[820px] text-center">
          <h2 className="text-ink-900 text-h1 reveal">{CLOSING.title}</h2>
          <p className="text-ink-700 text-lead-lg reveal mx-auto mt-5.5 max-w-[620px] leading-[1.9]">
            {CLOSING.lead}
          </p>

          <div className="reveal mt-9 flex flex-col items-center gap-4">
            <Button asChild variant="gradient" shape="pill" size="xl" className="px-11 text-[17px]">
              <Link href="/register">{CLOSING.ctaPrimary}</Link>
            </Button>
            <Link
              href="/courses"
              className="text-ink-700 hover:text-ink-900 decoration-ink-700/25 focus-visible:outline-brand-700 pb-0.5 text-[14.5px] underline underline-offset-[6px] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {CLOSING.ctaSecondary}
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
