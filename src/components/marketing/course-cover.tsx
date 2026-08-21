import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A catalogue item's cover.
 *
 * Two states, and the second is the reason this file exists. An administrator
 * attaches a cover per product from the administration area, but a catalogue
 * cannot wait for all of them: a card with an empty rectangle where the others
 * carry an image reads as broken, and a card with no cover at all breaks the
 * grid's rhythm. So an unset cover draws a composed brand field rather than a
 * gap — deliberate, identical for every product that lacks one, and obviously
 * not a photograph anybody chose.
 *
 * The field is CSS, not a raster: a gradient, a drawn grid, two glows. That
 * keeps it first-party markup with no image host and no CSP entry, and it scales
 * to any card size without a second asset. It is dark, which the light-only rule
 * permits here for the same reason a photograph may be dark — this is imagery
 * inside a bounded frame, not a section ground.
 *
 * `sizes` is set from the grid the cards actually sit in, so a phone does not
 * download a 1600px cover to draw it at 340.
 *
 * ── Two scales ─────────────────────────────────────────────────────────────
 *
 * `card` is the catalogue grid's cover. `plate` is the product page's masthead:
 * the same frame at ~1240×420, carrying the title, the badges and the purchase
 * panel on top of it. The plate differs in exactly three ways, and all three
 * follow from the size rather than from taste:
 *
 *  - the scrim runs on the inline axis instead of bottom-up, because the text
 *    over it sits in a column beside the image rather than along its bottom edge;
 *  - the two glows drift, because at plate size a static radial gradient reads
 *    as a printed shape rather than as a light source;
 *  - the glows and the grid are drawn OVER an administrator's photograph too,
 *    not only over the default field, so the plate is one atmosphere whether or
 *    not a cover was ever uploaded.
 *
 * The navy is `cover-900/800/700` in `globals.css`. Those tokens belong to this
 * file: they are the only dark values in a light-only product, and they are
 * legal because a cover is a bounded frame. Nothing outside a cover frame may
 * reach for them, and no other surface may borrow this file's drift utilities.
 */

/**
 * The centred mark on the default field.
 *
 * Null until the isolated mark lands in `public/brand/`. The supplied artwork is
 * the stacked lockup, whose two wordmarks are illegible below about 220px and
 * which the brand guidelines forbid cropping to extract the symbol from — so the
 * field draws without a centre mark until a proper one exists, rather than with
 * a smudge. Set this to that file's path and every default cover on the site
 * picks it up at once. Same pattern, and the same reason, as
 * `HORIZONTAL_LOCKUP_SRC` in `brand.tsx`.
 */
const DEFAULT_COVER_MARK_SRC: string | null = null;

export type CoverImage = {
  url: string;
  width: number | null;
  height: number | null;
};

export function CourseCover({
  cover,
  alt,
  sizes,
  priority = false,
  scale = 'card',
  className,
}: {
  cover: CoverImage | null;
  /**
   * Empty when the card's own heading already names the product — a cover that
   * repeats the title makes a screen reader read it twice for one card.
   */
  alt: string;
  sizes: string;
  priority?: boolean;
  scale?: 'card' | 'plate';
  className?: string;
}) {
  const isPlate = scale === 'plate';

  return (
    <div className={cn('bg-cover-900 relative overflow-hidden', className)}>
      {cover ? (
        <Image
          src={cover.url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <DefaultCoverField ambient={isPlate} />
      )}

      {/*
        At plate scale the atmosphere goes over the photograph as well, so the
        masthead does not change character the day somebody uploads a cover.
        On a card it would be noise at 340px wide, and it is left off.
      */}
      {isPlate && cover ? <AmbientField /> : null}

      {/*
        The scrim, over every state. It is what lets the white badges and the
        meta line sit on an arbitrary photograph and stay legible — a cover the
        administrator chose could be any brightness at the edge that matters,
        and the overlay text cannot be re-tuned per image.

        At plate scale it comes in two strengths, because the plate carries body
        text across its whole width rather than one line along its bottom edge.
        Over the default field the canvas's ramp is right: that ground is navy
        already. Over a photograph it is not — a bright image under 0.18 of
        near-black is a white headline on a white background — so a cover gets
        the heavier ramp, whose light end is set from the contrast arithmetic in
        `globals.css` rather than by eye.
      */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0',
          !isPlate && 'bg-linear-to-b from-transparent from-42% to-[rgb(4_16_32/0.72)]',
          isPlate && (cover ? 'bg-cover-scrim-photo' : 'bg-cover-scrim-plate'),
        )}
      />
    </div>
  );
}

/** The composed field an unset cover falls back to. */
function DefaultCoverField({ ambient = false }: { ambient?: boolean }) {
  return (
    <span aria-hidden="true" className="absolute inset-0">
      <span className="from-cover-900 via-cover-800 to-cover-700 absolute inset-0 bg-linear-150 via-48%" />

      {ambient ? (
        <AmbientField />
      ) : (
        <>
          {/*
            A drawn grid at a 38px pitch. Two one-pixel gradients rather than an
            SVG pattern: it is two declarations, it costs no element, and at 6%
            white it is texture rather than a figure competing with the badges
            over it.
          */}
          <span
            className="absolute inset-0 opacity-100"
            style={{
              backgroundImage:
                'linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)',
              backgroundSize: '38px 38px',
            }}
          />

          {/* Two off-canvas glows, so the field has a light source rather than a flat wash. */}
          <span className="absolute -top-[70px] -right-10 size-[300px] rounded-full bg-[radial-gradient(closest-side,rgb(46_150_238/0.5),transparent)]" />
          <span className="absolute -bottom-[90px] -left-[50px] size-[280px] rounded-full bg-[radial-gradient(closest-side,rgb(120_190_245/0.32),transparent)]" />
        </>
      )}

      {DEFAULT_COVER_MARK_SRC && !ambient ? (
        <Image
          src={DEFAULT_COVER_MARK_SRC}
          alt=""
          fill
          sizes="150px"
          // Silhouetted white: the mark is a shape here, not a coloured logo,
          // and the field behind it is too dark for the brand blue to read.
          className="object-contain p-[30%] opacity-90 brightness-0 invert"
        />
      ) : null}
    </span>
  );
}

/**
 * The plate's weather: two large glows on long, out-of-phase drifts under a
 * drawn grid.
 *
 * The offsets are PHYSICAL (`-left`, `-right`) rather than logical, and stay
 * that way under `dir="rtl"`. The scrim they balance is a physical angle too —
 * mirroring one without the other is what would make the plate's light source
 * and its darkest corner end up on the same side.
 */
function AmbientField() {
  return (
    <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <span className="cover-drift-a absolute -top-[140px] -left-20 size-[640px] rounded-full will-change-transform" />
      <span className="cover-drift-b absolute -right-[60px] -bottom-[200px] size-[620px] rounded-full will-change-transform" />
      <span className="bg-cover-grid absolute inset-0" />
    </span>
  );
}
