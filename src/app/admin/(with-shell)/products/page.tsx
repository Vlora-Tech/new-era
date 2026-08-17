import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { ProductFilters, ProductList, ProductPagination } from '@/components/admin/product-list';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listProducts, type AdminProductPage } from '@/services/catalog/product-admin.service';
import { productListQuerySchema } from '@/validators/admin-product';

export const metadata: Metadata = { title: COPY.admin.products };

/**
 * The catalogue list.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL. The
 * page reads `searchParams`, hands them to the schema, and renders whatever came
 * back — which means a filtered view is a real address that can be reloaded,
 * bookmarked and sent to a colleague.
 *
 * The query is wrapped in try/catch and the result kept nullable, exactly as the
 * overview screen does. A thrown query renders `ErrorState` through the table's
 * `failed` prop; it must never render an empty table, because "لا توجد منتجات"
 * is a claim about the business that a database outage is not entitled to make.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter (`?status=DRAFT&status=PUBLISHED`) arrives as an array.
  // The first value wins rather than the request being rejected: this is a
  // browsing surface, and every field in the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = productListQuerySchema.parse(flat);

  let result: AdminProductPage | null = null;
  try {
    result = await listProducts(query);
  } catch (error) {
    logger.error('admin product list failed', { error });
  }

  const filtered =
    Boolean(query.q) ||
    query.type !== undefined ||
    query.status !== undefined ||
    query.featured !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminProducts.listTitle}
        description={COPY.adminProducts.listDescription}
        action={
          <Button asChild size="sm">
            <Link href="/admin/products/new">{COPY.adminProducts.createAction}</Link>
          </Button>
        }
      />

      <ProductFilters query={query} />

      {/* Stated plainly whenever the list is narrowed, so a filtered result is
          never read as the whole catalogue. */}
      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <ProductList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <ProductPagination result={result} query={query} /> : null}
    </div>
  );
}
