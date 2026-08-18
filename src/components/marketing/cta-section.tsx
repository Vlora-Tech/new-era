import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BRAND, COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * The closing invitation.
 *
 * A contained plate rather than a full-width band: the tinted ground and the
 * brand mesh stop at a `rounded-card` edge, so the page ends on an object the
 * reader can see the whole of instead of on a colour that runs off the screen.
 * The mesh is the band's one texture and it sits behind a headline and two
 * controls only — there is no body copy for it to interfere with.
 *
 * There is no countdown, no seat count, no discount and no claim of any kind.
 * The only persuasion here is the offer itself, because everything else would
 * have to be invented.
 *
 * The props exist so a page can retarget the band (a catalogue closing on its
 * own catalogue, say) without a second copy of this treatment. Every default is
 * the homepage's.
 */
export function CtaSection({
  eyebrow = BRAND.name,
  title = BRAND.tagline,
  primaryLabel = COPY.home.ctaPrimary,
  primaryHref = '/register',
  secondaryLabel = COPY.home.ctaSecondary,
  secondaryHref = '/courses',
  className,
}: {
  eyebrow?: string;
  title?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'reveal rounded-card bg-canvas-blue border-brand-700/15 relative isolate border',
        'px-6 py-16 text-center sm:px-10 lg:py-20',
        className,
      )}
    >
      {/*
       * The mesh is a layer rather than a second class on the section: `cn`
       * merges through tailwind-merge, which reads every `bg-*` as a colour and
       * would drop `bg-canvas-blue` for it. `isolate` keeps the negative z here.
       */}
      <span
        aria-hidden="true"
        className="bg-brand-mesh rounded-card pointer-events-none absolute inset-0 -z-10"
      />

      <p className="text-brand-700 flex items-center justify-center gap-2.5 text-[13px] font-semibold">
        <span aria-hidden="true" className="bg-brand-700 block h-px w-7" />
        {eyebrow}
      </p>

      <h2 className="text-ink-900 text-h2 measure-ar-lg mx-auto mt-4">{title}</h2>

      <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {/*
         * The one place on the site that glows. `shadow-glow` is declared after
         * the button's own `shadow-xs` in the theme, so it wins at rest; the
         * hover pair keeps it from being traded for `shadow-card` on hover.
         */}
        <Button asChild size="xl" className="shadow-glow hover:shadow-glow group/cta">
          <Link href={primaryHref}>
            {primaryLabel}
            {/* Forward is inline-end, which under dir="rtl" points left. */}
            <ArrowLeft
              className="size-4 transition-transform duration-200 group-hover/cta:-translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </Button>
        <Button asChild size="xl" variant="secondary">
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
