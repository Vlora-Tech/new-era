import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Badge, EmptyState, ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatHalalas, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CatalogProduct = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  priceHalalas: number;
};

/** ٠١ … ١٢ — Arabic-Indic, zero-padded so the column stays a column. */
const arabicIndex = (value: number) => formatNumber(value).padStart(2, formatNumber(0));

/**
 * Catalogue listing.
 *
 * An index, not a wall of cards. Real catalogue data reads as a record: a
 * numbered row, a title, what it is, and what it costs, separated by hairlines
 * rather than boxed six times over. Six bordered rectangles say "we had six
 * things to fill"; a ruled index says "this is the catalogue".
 *
 * Three outcomes are kept distinct: products to show, a catalogue that is
 * genuinely empty, and a failure to load. Collapsing the last two would present
 * an outage as a statement about the catalogue.
 */
export function ProductGrid({
  products,
  basePath,
  typeLabel,
  emptyTitle,
  emptyDescription,
  failed = false,
}: {
  products: CatalogProduct[];
  basePath: string;
  typeLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  failed?: boolean;
}) {
  if (failed) return <ErrorState />;
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="border-line-200 divide-line-200 divide-y border-y">
      {products.map((product, index) => (
        <li
          key={product.id}
          // `relative` anchors the title link's full-row hit area below. The
          // white ground lifts the row off the page's warm canvas, and the title
          // colour changes with it, so hover is never carried by a background
          // alone.
          className={cn(
            'group hover:bg-surface relative grid items-baseline transition-colors duration-150 ease-out',
            'grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 py-7',
            'lg:grid-cols-[3rem_minmax(0,1fr)_8rem_11rem] lg:gap-x-6 lg:gap-y-0',
          )}
        >
          <span className="text-ink-600 text-[13px] font-medium tabular-nums">
            {arabicIndex(index + 1)}
          </span>

          <Badge
            variant="outline"
            shape="square"
            className="justify-self-start lg:col-start-3 lg:row-start-1"
          >
            {typeLabel}
          </Badge>

          <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <h2 className="text-[19px] leading-[1.45] font-semibold">
              {/*
               * `after:inset-0` makes the whole ~110px row the target instead of
               * a 28px line of text. The trailing affordance below stays plain
               * aria-hidden text rather than a second anchor: two links to the
               * same href, one covering the other, is a duplicated tab stop.
               */}
              <Link
                href={`${basePath}/${product.slug}`}
                className="text-ink-900 group-hover:text-brand-700 rounded-control transition-colors duration-150 ease-out after:absolute after:inset-0"
              >
                {product.title}
              </Link>
            </h2>
            <p className="text-ink-700 mt-2 max-w-[46ch] text-[15px] leading-[1.75]">
              {product.shortDescription}
            </p>
          </div>

          <div className="col-span-2 flex items-center justify-between gap-4 lg:col-span-1 lg:col-start-4 lg:row-start-1">
            <span className="text-ink-900 text-[17px] font-semibold">
              {formatHalalas(product.priceHalalas)}
            </span>
            <span
              aria-hidden="true"
              className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              {COPY.common.details}
              {/* Forward is inline-end, which under dir="rtl" points left. */}
              <ArrowLeft className="size-4" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
