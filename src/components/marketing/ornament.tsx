import { cn } from '@/lib/utils';

/**
 * The page's entire ornament inventory: two elements, three appearances.
 *
 * That budget is the design, not a limitation of it. Islamic geometry earns its
 * place here as construction — a real 4.8.8 lattice drawn with a compass and a
 * straightedge, framed by a drawn line — and stops earning it the moment it
 * becomes a mood. Everything below is inline SVG, server-rendered, first-party
 * markup, so no image host, no `data:` URI and no CSP directive is involved.
 *
 * THE PLACEMENT RULE. `KhatimField` has exactly four sanctioned placements, all
 * the same figure: a course of tile 80 in `text-brand-500`, on a light ground,
 * terminated by a drawn rule and never by a fade.
 *
 *   1. The homepage masthead, running from the logo toward the fore-edge at
 *      opacity 0.14.
 *   2. The full-bleed frieze that closes the hero, at 0.18.
 *   3. The identical frieze that closes the last chapter, at 0.18.
 *   4. The frieze that closes the student overview's greeting band, at 0.18 —
 *      the same figure as 2 and 3, one row tall, full width, terminated by the
 *      panel's own bottom border and sitting below the text rather than behind
 *      it. It earns its place because the student area is otherwise entirely
 *      unbranded chrome and this is the one screen a student returns to.
 *
 *      A half-width field beside the greeting was tried here first and removed:
 *      the lattice ended on a bare vertical line mid-panel and read as a
 *      rendering artefact, which is what the "terminated by a drawn rule and
 *      never by a fade" clause above exists to prevent. The clause covers every
 *      edge of the field, not only its trailing one.
 *
 *   5. The auth pages' brand panels (one field per page, ids
 *      neb-khatim-login / neb-khatim-register, at 0.18) — the identity's
 *      signature on the doorstep, below the tagline and clipped by the panel's
 *      own border, never behind the form.
 *
 * Two and three are bookends, and the second earns its place only because it
 * repeats the first exactly. A further placement, a different tile, another
 * opacity on the same page, or a field behind body text is decoration, and is
 * what this note exists to prevent. The inventory is mirrored in
 * docs/design-system.md.
 *
 * Still forbidden: directly behind body text; inside a card, a header or a
 * footer; ticks on a second element, which turns a registration mark into a
 * motif and a motif into decoration; any `fill`, `patternTransform` or gradient
 * on the field itself; any motion; and any new page or placement until it is
 * designed on purpose and written down here.
 */

/**
 * A regular octagon with across-flats 120, so its side is 120(√2−1) = 49.706 and
 * its eight vertices land on the tile edges at 35.147 and 84.853. 120 − 84.853
 * is 35.147, which is exactly why the field tiles seamlessly under pure
 * translation: every chord meets its neighbour's chord on the boundary.
 */
const OCTAGON =
  'M35.147 0 L84.853 0 L120 35.147 L120 84.853 L84.853 120 L35.147 120 L0 84.853 L0 35.147 Z';

/**
 * The {8/3} star polygon on the same eight vertices — k → k+3, and gcd(8, 3) = 1,
 * so it is one closed circuit rather than two overlaid squares. Every segment is
 * horizontal, vertical or exactly 45°, which is what makes the texture rhyme
 * with the logo's diagonal instead of reading as filigree.
 */
const KHATIM =
  'M84.853 0 L84.853 120 L0 35.147 L120 35.147 L35.147 120 L35.147 0 L120 84.853 L0 84.853 Z';

const TILE_BASE = 120;
const MIN_TILE = 72;
const MAX_TILE = 200;
const MAX_OPACITY = 0.2;

/**
 * The clamps below are the enforcement, not the documentation — the same pattern
 * `BrandLogo` uses for its 220px floor. A future caller physically cannot turn
 * this into wallpaper, and raising the ceiling is a design decision that belongs
 * in the placement rule above rather than at a call site.
 *
 * `id` is a required literal rather than `useId()`, which would force a client
 * boundary to buy uniqueness the placement rule already guarantees.
 */
export function KhatimField({
  id,
  tile = TILE_BASE,
  opacity = 0.18,
  className,
}: {
  id: string;
  tile?: number;
  opacity?: number;
  className?: string;
}) {
  const clampedTile = Math.min(Math.max(tile, MIN_TILE), MAX_TILE);
  const clampedOpacity = Math.min(Math.max(opacity, 0), MAX_OPACITY);
  const scale = clampedTile / TILE_BASE;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="100%"
      height="100%"
      // No viewBox, so one user unit is one CSS pixel and the pattern's pitch is
      // the number the caller asked for.
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      <defs>
        <pattern id={id} width={clampedTile} height={clampedTile} patternUnits="userSpaceOnUse">
          <g
            fill="none"
            stroke="currentColor"
            // Inside a scaled group this renders at exactly 1px at any tile
            // pitch, without vector-effect and without fractional-stroke fuzz.
            strokeWidth={1 / scale}
            strokeLinejoin="miter"
            strokeMiterlimit={4}
            transform={`scale(${scale})`}
          >
            {/* Two weights, not one. One weight is lined paper; two is a drawing. */}
            <path d={OCTAGON} strokeOpacity={clampedOpacity * 0.7} />
            <path d={KHATIM} strokeOpacity={clampedOpacity} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Physical `left`/`right` is the one sanctioned exception to this project's
 * logical-property rule: the four-tick set is symmetric, so mirroring it under
 * dir="rtl" is a no-op, and logical properties would only obscure that.
 */
const TICKS = [
  { d: 'M0 12 V0 H12', pos: 'top-[-8px] left-[-8px]' },
  { d: 'M0 0 H12 V12', pos: 'top-[-8px] right-[-8px]' },
  { d: 'M0 0 V12 H12', pos: 'bottom-[-8px] left-[-8px]' },
  { d: 'M12 0 V12 H0', pos: 'bottom-[-8px] right-[-8px]' },
] as const;

/**
 * Draughtsman's registration marks, 8px outside the corners of the element they
 * register. Hidden below `sm`, where 8px of outboard margin does not exist.
 * The parent must be `relative`.
 */
export function SheetTicks({ className }: { className?: string }) {
  return (
    <>
      {TICKS.map((tick) => (
        <svg
          key={tick.pos}
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={cn(
            'text-line-500 pointer-events-none absolute hidden sm:block',
            tick.pos,
            className,
          )}
        >
          <path
            d={tick.d}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </>
  );
}
