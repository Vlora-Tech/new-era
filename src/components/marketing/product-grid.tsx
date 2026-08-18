import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

import { Badge, EmptyState, ErrorState } from '@/components/ui/surface';
import { ACCENT } from '@/lib/accent';
import { COPY } from '@/lib/copy';
import { formatHalalas } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CatalogProduct = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  priceHalalas: number;
  /**
   * Facts the list query actually holds, every one of them optional: a card
   * renders a meta item only where its row has a value, and never a dash, a
   * zero or a placeholder standing in for one.
   *
   * `category` and `level` are free-text values entered by an administrator, so
   * they are printed exactly as stored rather than passed through a label map.
   */
  category?: string | null;
  level?: string | null;
  /** The simulator's track, shown through the enum's own Arabic label. */
  track?: keyof typeof COPY.statusLabels.questionTrack | null;
};

/**
 * Catalogue listing.
 *
 * A grid of product cards. The catalogue is the page where the decision is
 * made, so each entry carries what a buyer weighs — what it is, what it covers,
 * what it costs — inside one bounded object that lifts under the pointer,
 * rather than as a row in a record that reads like a database export.
 *
 * Three outcomes are kept distinct: products to show, a catalogue that is
 * genuinely empty, and a failure to load. Collapsing the last two would present
 * an outage as a statement about the catalogue.
 */
export function ProductGrid({
  products,
  basePath,
  typeLabel,
  typeVariant = 'brand',
  icon: Icon,
  emptyTitle,
  emptyDescription,
  failed = false,
}: {
  products: CatalogProduct[];
  basePath: string;
  typeLabel: string;
  /** The colour code: courses are brand blue, simulators are teal. */
  typeVariant?: 'brand' | 'teal';
  /** The domain's glyph, drawn white on the vivid fill. Omitted, no tile. */
  icon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  failed?: boolean;
}) {
  if (failed) return <ErrorState />;
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  // The label's hue and the tile's fill are read from one place, so a card can
  // never carry a teal badge above a blue tile.
  const accent = typeVariant === 'teal' ? ACCENT.teal : ACCENT.blue;

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const meta = [
          { id: 'category', value: product.category },
          { id: 'level', value: product.level },
          {
            id: 'track',
            value: product.track ? COPY.statusLabels.questionTrack[product.track] : null,
          },
        ].filter((item): item is { id: string; value: string } => Boolean(item.value));

        return (
          <li
            key={product.id}
            // `relative` anchors the title link's full-card hit area below;
            // `lift` is the shared hover contract, so the catalogue cannot drift
            // to a lift of its own. The column is full height so every footer in
            // a row sits on the same line whatever the description's length.
            className="group rounded-card border-line-200 bg-surface shadow-card lift hover:border-brand-500/40 relative flex h-full flex-col border p-6"
          >
            <div className="flex items-center justify-between gap-3">
              {/* Taxonomy, not status: square, and coloured by the domain's hue. */}
              <Badge variant={typeVariant} shape="square">
                {typeLabel}
              </Badge>

              {Icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'rounded-panel flex size-11 shrink-0 items-center justify-center text-white',
                    // The vivid fill carries a white glyph, never white text.
                    accent.fill,
                  )}
                >
                  <Icon className="size-5" />
                </span>
              ) : null}
            </div>

            <h3 className="text-h3 mt-5">
              {/*
               * `after:inset-0` makes the whole card the target instead of a
               * single line of text. The trailing affordance below stays plain
               * aria-hidden text rather than a second anchor: two links to the
               * same href, one covering the other, is a duplicated tab stop.
               */}
              <Link
                href={`${basePath}/${product.slug}`}
                className="text-ink-900 group-hover:text-brand-700 rounded-control transition-colors duration-150 ease-out after:absolute after:inset-0"
              >
                {product.title}
              </Link>
            </h3>

            {/* Three lines, so a long description cannot set the row's height. */}
            <p className="text-ink-700 mt-3 line-clamp-3 text-[15px] leading-[1.75]">
              {product.shortDescription}
            </p>

            {meta.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {meta.map((item) => (
                  <Badge key={item.id} variant="outline" shape="square">
                    {item.value}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="border-line-200 mt-auto flex items-center justify-between gap-4 border-t pt-5">
              {/* The price is a stat numeral: display face, 700, tabular. */}
              <span className="text-ink-900 font-display text-[20px] font-bold tabular-nums">
                {formatHalalas(product.priceHalalas)}
              </span>
              <span
                aria-hidden="true"
                className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium"
              >
                {COPY.common.details}
                {/* Forward is inline-end, which under dir="rtl" points left. */}
                <ArrowLeft className="size-4 transition-transform duration-150 ease-out group-hover:-translate-x-1" />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
