import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/surface';
import { formatHalalas } from '@/lib/format';

export type CatalogProduct = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  priceHalalas: number;
};

/**
 * Catalogue listing.
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
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <Card className="flex h-full flex-col gap-3 p-6">
            <Badge variant="brand">{typeLabel}</Badge>
            <h2 className="text-ink-900 text-lg font-semibold">{product.title}</h2>
            <p className="text-ink-700 flex-1 text-sm leading-relaxed">
              {product.shortDescription}
            </p>
            <div className="border-line-200 flex items-center justify-between gap-3 border-t pt-4">
              <span className="text-ink-900 font-medium">
                {formatHalalas(product.priceHalalas)}
              </span>
              <Button asChild variant="secondary" size="sm">
                <Link href={`${basePath}/${product.slug}`}>التفاصيل</Link>
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
