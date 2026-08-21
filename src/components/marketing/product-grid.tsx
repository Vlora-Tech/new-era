import Link from 'next/link';
import { ArrowLeft, Clock, Layers, PlayCircle } from 'lucide-react';

import { CourseCover, type CoverImage } from '@/components/marketing/course-cover';
import { EmptyState, ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatHalalas, formatNumber } from '@/lib/format';
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
  /** Null when the administrator has not attached one; the cover composes a field. */
  cover?: CoverImage | null;
  /** Counted from the published content. Absent items are omitted, never zeroed. */
  moduleCount?: number | null;
  lessonCount?: number | null;
  durationSec?: number | null;
};

/**
 * Catalogue listing.
 *
 * A grid of product cards. The catalogue is the page where the decision is made,
 * so each entry carries what a buyer weighs — what it is, what it covers, how
 * much of it there is, and what it costs — inside one bounded object.
 *
 * The cover is what changed the card's shape. A catalogue of text blocks asks
 * the reader to parse every card before choosing; a cover gives each one a face
 * to recognise, and it is where the taxonomy badges and the size of the course
 * now sit, which frees the body below for the two things a cover cannot say —
 * the title and what the course is about.
 *
 * Three outcomes are kept distinct: products to show, a catalogue that is
 * genuinely empty, and a failure to load. Collapsing the last two would present
 * an outage as a statement about the catalogue.
 */

/** Matches the grid below, so a phone never downloads a full-width cover. */
const COVER_SIZES = '(min-width: 1280px) 380px, (min-width: 640px) 45vw, 100vw';

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
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-5 lg:gap-7">
      {products.map((product, index) => {
        /*
         * The cover's own meta line: how much course there is. Every item is
         * dropped when its value is missing or zero — "٠ دروس" on a catalogue
         * card is a reason not to buy, and an unfinished course should carry one
         * item fewer rather than a discouraging zero.
         */
        const size = [
          {
            id: 'modules',
            icon: Layers,
            value: product.moduleCount
              ? `${formatNumber(product.moduleCount)} ${COPY.catalog.units}`
              : null,
          },
          {
            id: 'lessons',
            icon: PlayCircle,
            value: product.lessonCount
              ? `${formatNumber(product.lessonCount)} ${COPY.catalog.lessons}`
              : null,
          },
          {
            id: 'duration',
            icon: Clock,
            value: product.durationSec ? formatDurationWords(product.durationSec) : null,
          },
        ].filter((item): item is { id: string; icon: typeof Layers; value: string } =>
          Boolean(item.value),
        );

        const taxonomy = [product.category, product.level].filter(Boolean) as string[];

        return (
          <li key={product.id} className="h-full">
            {/*
              The whole card is the link. One anchor rather than a card wrapper
              plus a title link plus a "details" link: three tab stops to one
              destination is three times the keyboard cost for no extra reach.
            */}
            <Link
              href={`${basePath}/${product.slug}`}
              className={cn(
                'group rounded-card border-line-200 bg-surface shadow-card relative flex h-full flex-col overflow-hidden border',
                'transition-[transform,box-shadow,border-color] duration-[280ms] ease-out',
                'hover:border-brand-300 hover:shadow-card-lg hover:-translate-y-1.5',
                'focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2',
                'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
              )}
            >
              <div className="relative aspect-video w-full">
                <CourseCover
                  cover={product.cover ?? null}
                  // Empty: the heading below names the product, and a cover that
                  // repeats it makes a screen reader read the title twice.
                  alt=""
                  sizes={COVER_SIZES}
                  // The first row is above the fold on every viewport.
                  priority={index < 3}
                  className="absolute inset-0"
                />

                {/* Taxonomy, over the cover's scrim. */}
                <div className="pointer-events-none absolute end-3.5 top-3.5 flex flex-wrap gap-1.5">
                  <span className="bg-surface/90 text-brand-800 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold backdrop-blur-sm">
                    {typeLabel}
                  </span>
                  {taxonomy.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-[rgb(11_14_21/0.55)] px-3.5 py-1.5 text-[11.5px] font-medium text-white backdrop-blur-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {size.length > 0 ? (
                  <div className="pointer-events-none absolute inset-x-4 bottom-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-white/90">
                    {size.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1.5">
                        <item.icon className="size-4 shrink-0" aria-hidden="true" />
                        {item.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5 sm:p-[22px]">
                <h3 className="text-ink-900 group-hover:text-brand-700 font-display text-[21px] leading-[1.45] font-bold transition-colors duration-150">
                  {product.title}
                </h3>

                {/* Three lines, so a long description cannot set the row's height. */}
                <p className="text-ink-700 line-clamp-3 text-[14.5px] leading-[1.8]">
                  {product.shortDescription}
                </p>

                <div className="border-line-200 mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4.5">
                  {/* The price is a stat numeral: display face, 700, tabular. */}
                  <span className="text-ink-900 font-display text-[22px] font-bold tabular-nums">
                    {formatHalalas(product.priceHalalas)}
                  </span>

                  {/*
                    Plain text, not a nested link or button: the card is already
                    the anchor, and a control inside it would be a second tab
                    stop to the same place.
                  */}
                  <span
                    aria-hidden="true"
                    className="bg-brand-700 group-hover:bg-brand-hover inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150"
                  >
                    {COPY.common.details}
                    {/* Forward is inline-end, which under dir="rtl" points left. */}
                    <ArrowLeft className="size-4 transition-transform duration-150 ease-out group-hover:-translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
