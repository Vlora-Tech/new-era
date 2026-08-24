import Image from 'next/image';
import Link from 'next/link';

import { BRAND } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Brand marks.
 *
 * The supplied logo is a raster file with a white background and a stacked
 * Arabic/Latin lockup. The brand guidelines forbid cropping it, extracting the
 * symbol from it, recolouring it, or placing it on a tinted surface, and they
 * ask for a compact horizontal lockup to be commissioned rather than improvised
 * from this file.
 *
 * So there are three marks here, and the split is deliberate:
 *
 *  - `BrandLogo` renders the supplied artwork unmodified, at no less than the
 *    220px the guidelines require for legibility, on white, with clear space.
 *    It is for places with room, and it is used in all of them: the footer, and
 *    the sign-in and registration pages.
 *  - `BrandBarLogo` renders the same artwork at 128px (96px on a phone) for the
 *    public bar, which is sized to the mark rather than the mark to the bar.
 *    That is under the 220px floor and is an owner-directed deviation; the
 *    waiver, and the way out of it, are recorded in docs/brand-assets-needed.md.
 *  - `BrandWordmark` is set type, not a derived logo. It backs the chrome that
 *    still cannot take a lockup at all — the 264px dashboard and admin rails,
 *    which already carry a section title beside the mark, and the checkout bar.
 *
 * Two earlier attempts are recorded so they are not repeated: the artwork at
 * 56px in a 64px bar, where both wordmarks collapse into a smudge, and a
 * `mix-blend-multiply` to drop its white ground into a translucent bar, which is
 * a modification of the artwork and is forbidden. Neither is in the code.
 *
 * See docs/brand-assets-needed.md.
 */

/** The guidelines' legibility floor: below this the two wordmarks stop reading. */
const LOGO_MIN_WIDTH_PX = 220;

/**
 * The bar mark's rendered width, and the reason the public bar is tall.
 *
 * The owner asked for the supplied artwork in the navigation bar rather than set
 * type. The earlier objection to that was sound but assumed a 64px bar, where
 * the lockup renders about 56px tall and both wordmarks collapse into a smudge.
 * The answer is to size the bar to the mark instead of shrinking the mark to the
 * bar. The width moved from 112px to 128px with the 2026-08-25 artwork, and
 * the reason is measured rather than guessed: the Arabic wordmark is 140px tall
 * in both files, but that is 12.4% of the old file's height and only 7.0% of
 * the new one's, because the new lockup gives far more of its canvas to the
 * tile. Rendering it at the old 112px would have shrunk the wordmark from about
 * 11px to under 10px. 128px holds the previous legibility.
 *
 * This is still below the guidelines' 220px floor, and it is a deliberate,
 * owner-directed deviation recorded in docs/brand-assets-needed.md. The
 * commissioned horizontal lockup removes the compromise entirely — set
 * HORIZONTAL_LOCKUP_SRC below and every bar on the site switches at once.
 *
 * Nothing is cropped, recoloured or stretched, and the artwork's own white
 * ground sits on the bar's white surface, so no blend mode is involved.
 */
const BAR_LOGO_WIDTH_PX = 128;
const BAR_LOGO_WIDTH_PX_SM = 96;

/**
 * height ÷ width of the supplied artwork (1610 × 2000).
 *
 * The 2026-08-25 artwork is TALLER than wide, where the file it replaced was
 * wider than tall (1397 × 1126, ratio 0.806). Anything that assumed the old
 * proportion has to move with it — deriving one dimension from the other is
 * how a lockup gets stretched, which is why next/image is given both.
 */
const LOGO_ASPECT_RATIO = 2000 / 1610;

/**
 * The primary lockup: dark tile, blue calligraphy, white accents.
 *
 * Three colourways were supplied. This one is the owner's choice
 * (2026-08-25). The other two stay in public/brand/ unused rather than
 * deleted, named for their ink and their tile so the next person does not have
 * to open them to find out which is which:
 *
 *   new-era-lockup-white-on-dark.png  — dark tile, white calligraphy
 *   new-era-lockup-blue-on-light.png  — light tile, blue calligraphy
 *
 * All three carry the wordmarks. None of them is a symbol-only mark, so the
 * favicon is still unresolved — see docs/brand-assets-needed.md item 2.
 */
const LOGO_SRC = '/brand/new-era-lockup-blue-on-dark.png';

/** The guidelines' clear space: 12% of the logo's own width, on every side. */
const CLEAR_SPACE_RATIO = 0.12;

/** Rounded UP to the 4px grid so the clear space is never short. 220 → 28. */
const clearSpaceFor = (width: number) => Math.ceil((width * CLEAR_SPACE_RATIO) / 4) * 4;

/**
 * Set to the commissioned horizontal lockup's path when that asset exists, and
 * set the two intrinsic dimensions below from the delivered file at the same
 * time. Until then every header is set as type, which derives nothing from the
 * stacked raster. One value changes the whole site on delivery day.
 */
const HORIZONTAL_LOCKUP_SRC: string | null = null;

/**
 * Placeholders — replace with the delivered file's true pixel dimensions.
 * next/image needs both, and deriving one from the other is how a lockup gets
 * stretched.
 */
const HORIZONTAL_LOCKUP_INTRINSIC_WIDTH = 640;
const HORIZONTAL_LOCKUP_INTRINSIC_HEIGHT = 128;

/** Rendered height of the commissioned lockup inside a 64px bar. */
const HORIZONTAL_LOCKUP_HEIGHT_PX = 32;

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
      src={LOGO_SRC}
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

/**
 * The logo on the white ground and clear space the guidelines require.
 *
 * `flush` pulls the plate by exactly its own clear space on the inline-start
 * axis, so the ARTWORK's edge lands on the layout grid rather than its padding
 * box. That is legal only where the pulled-into margin is genuinely empty — the
 * first element of an otherwise empty cell — which today means the homepage
 * masthead row and the footer's first column, and nowhere else. It never pulls
 * on the block axis: a negative top margin would slide the artwork under the
 * sticky header on scroll-to-top and eat the clear space the guidelines require.
 */
export function BrandLogoBlock({
  className,
  width = LOGO_MIN_WIDTH_PX,
  priority = false,
  flush = false,
}: {
  className?: string;
  width?: number;
  priority?: boolean;
  flush?: boolean;
}) {
  const renderedWidth = Math.max(width, LOGO_MIN_WIDTH_PX);
  const pad = clearSpaceFor(renderedWidth);

  return (
    <div
      className={cn('logo-clear-space inline-block', className)}
      // In px, from the logo's own width. A percentage would resolve against
      // whatever the parent happens to be. No radius: a 10px corner on a white
      // box sitting on a white ground does nothing, and would be wrong anywhere
      // else the guidelines allow this plate to appear.
      style={flush ? { padding: pad, marginInlineStart: -pad } : { padding: pad }}
    >
      <BrandLogo width={renderedWidth} priority={priority} />
    </div>
  );
}

/**
 * The running head: both wordmarks as set type, horizontal.
 *
 * Horizontal is the point: in a rail or a bar this reads as a different
 * structural layer from the stacked artwork rather than as a shrunken, competing
 * copy of it.
 *
 * `compact` drops the second half for narrow chrome — the dashboard and admin
 * rails, where a 264px column already carries a section title beside the mark.
 */
export function BrandWordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap', className)}>
      <span className="text-brand-700 text-[18px] leading-none font-semibold">{BRAND.name}</span>
      {compact ? null : (
        <>
          <span className="bg-line-200 mx-3 hidden h-4 w-px sm:block" aria-hidden="true" />
          <span className="text-ink-600 hidden text-[13px] leading-none font-normal sm:inline">
            {BRAND.fullName}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * The supplied lockup, sized for a navigation bar.
 *
 * Deliberately not clamped to LOGO_MIN_WIDTH_PX — see BAR_LOGO_WIDTH_PX above
 * for why that floor is waived here and where the waiver is recorded. When the
 * commissioned horizontal lockup arrives, this renders that instead and the
 * bar can lose its extra height.
 */
export function BrandBarLogo({ className }: { className?: string }) {
  if (HORIZONTAL_LOCKUP_SRC) {
    return (
      <Image
        src={HORIZONTAL_LOCKUP_SRC}
        alt={`${BRAND.name} — ${BRAND.fullName}`}
        width={HORIZONTAL_LOCKUP_INTRINSIC_WIDTH}
        height={HORIZONTAL_LOCKUP_INTRINSIC_HEIGHT}
        priority
        className={className}
        style={{ height: HORIZONTAL_LOCKUP_HEIGHT_PX, width: 'auto' }}
      />
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt={`${BRAND.name} — ${BRAND.fullName}`}
      width={BAR_LOGO_WIDTH_PX}
      height={Math.round(BAR_LOGO_WIDTH_PX * LOGO_ASPECT_RATIO)}
      priority
      sizes={`(max-width: 640px) ${BAR_LOGO_WIDTH_PX_SM}px, ${BAR_LOGO_WIDTH_PX}px`}
      className={cn('h-auto w-[88px] sm:w-[112px]', className)}
    />
  );
}

/** The bar mark, wrapped as the home link. */
export function BrandBarLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('rounded-control inline-flex items-center focus-visible:outline-2', className)}
      aria-label={`${BRAND.name} — ${BRAND.fullName}`}
    >
      <BrandBarLogo />
    </Link>
  );
}

export function BrandWordmarkLink({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn('rounded-control inline-flex items-center focus-visible:outline-2', className)}
      aria-label={`${BRAND.name} — ${BRAND.fullName}`}
    >
      {HORIZONTAL_LOCKUP_SRC ? (
        <Image
          src={HORIZONTAL_LOCKUP_SRC}
          alt={`${BRAND.name} — ${BRAND.fullName}`}
          width={HORIZONTAL_LOCKUP_INTRINSIC_WIDTH}
          height={HORIZONTAL_LOCKUP_INTRINSIC_HEIGHT}
          style={{ height: HORIZONTAL_LOCKUP_HEIGHT_PX, width: 'auto' }}
        />
      ) : (
        <BrandWordmark compact={compact} />
      )}
    </Link>
  );
}
