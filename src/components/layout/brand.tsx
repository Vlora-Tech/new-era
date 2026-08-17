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

/** The guidelines' legibility floor: below this the two wordmarks stop reading. */
const LOGO_MIN_WIDTH_PX = 220;

/** height ÷ width of the supplied artwork (1397 × 1126). */
const LOGO_ASPECT_RATIO = 1126 / 1397;

export function BrandLogo({
  className,
  width = LOGO_MIN_WIDTH_PX,
  priority = false,
}: {
  className?: string;
  width?: number;
  priority?: boolean;
}) {
  // The legibility floor is enforced here rather than trusted to each caller:
  // rendering this lockup smaller is a brand violation, not a layout preference.
  const renderedWidth = Math.max(width, LOGO_MIN_WIDTH_PX);
  // Derived from the file's own pixel dimensions so the mark is never stretched.
  const height = Math.round(renderedWidth * LOGO_ASPECT_RATIO);

  return (
    <Image
      src="/brand/new-era-logo.png"
      alt={`${BRAND.name} — ${BRAND.fullName}`}
      width={renderedWidth}
      height={height}
      priority={priority}
      className={className}
      // Both dimensions are set together: constraining only one would leave the
      // rendered aspect ratio at the browser's discretion.
      style={{ width: renderedWidth, height: 'auto' }}
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
