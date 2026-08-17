import Image from 'next/image';
import Link from 'next/link';

import { BRAND } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Brand marks.
 *
 * The supplied logo is a raster file with a white background and a stacked
 * Arabic/Latin lockup. The brand guidelines forbid cropping it, extracting the
 * symbol from it, or placing it on a tinted surface, and they ask for a compact
 * lockup to be commissioned rather than improvised.
 *
 * So there are two marks here, and the split is deliberate:
 *
 *  - `BrandLogo` renders the supplied artwork unmodified, at no less than the
 *    220px the guidelines require for legibility, on white, with clear space.
 *    It is for places with room: the sign-in card, the footer, print-like pages.
 *  - `BrandWordmark` is set type, not a derived logo. The slim header has
 *    nowhere near 220px of vertical room, and shrinking or cropping the PNG to
 *    fit would breach the guidelines. Typography is the honest alternative
 *    until a proper horizontal lockup exists.
 *
 * See docs/brand-assets-needed.md.
 */

const LOGO_MIN_WIDTH_PX = 220;

export function BrandLogo({
  className,
  width = LOGO_MIN_WIDTH_PX,
  priority = false,
}: {
  className?: string;
  width?: number;
  priority?: boolean;
}) {
  // The artwork's own proportions; height follows so it is never stretched.
  const height = Math.round((width * 1120) / 1400);

  return (
    <Image
      src="/brand/new-era-logo.png"
      alt={`${BRAND.name} — ${BRAND.fullName}`}
      width={width}
      height={height}
      priority={priority}
      className={cn('h-auto', className)}
      style={{ minWidth: LOGO_MIN_WIDTH_PX }}
    />
  );
}

/** The logo on the white ground and clear space the guidelines require. */
export function BrandLogoBlock({ className, width }: { className?: string; width?: number }) {
  return (
    <div className={cn('logo-clear-space rounded-panel inline-block', className)}>
      <BrandLogo width={width} />
    </div>
  );
}

/** Typographic mark for compact placements. Not derived from the artwork. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-brand-700 text-lg font-semibold tracking-normal', className)}>
      {BRAND.name}
    </span>
  );
}

export function BrandWordmarkLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('rounded-control inline-flex items-center focus-visible:outline-2', className)}
      aria-label={`${BRAND.name} — ${BRAND.tagline}`}
    >
      <BrandWordmark />
    </Link>
  );
}
