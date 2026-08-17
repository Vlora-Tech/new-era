import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { ProductForm, ProductStatusActions } from '@/components/admin/product-form';
import { ProductStatusBadge, ProductTypeBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card, ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatDateTime } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  getProductForAdmin,
  parseProductId,
  type AdminProductDetail,
} from '@/services/catalog/product-admin.service';

export const metadata: Metadata = { title: COPY.adminProducts.editTitle };

/**
 * Edit one product.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the product does not exist, or the path segment is not an id at all —
 *    `notFound()`, the honest answer to a bad address;
 *  - the query threw — `ErrorState`, never an empty form. A form pre-filled with
 *    blanks because a read failed is an invitation to overwrite a real product
 *    with nothing;
 *  - the product loaded — the summary, the transitions, and the form.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  let product: AdminProductDetail | null = null;
  let failed = false;
  try {
    product = await getProductForAdmin(parseProductId(productId));
  } catch (error) {
    // The service reports a malformed id as "no such product" rather than as a
    // fault, and that distinction has to survive into the page.
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin product load failed', { productId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminProducts.editTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/products">{COPY.adminCommon.actions.backToList}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={product.title}
        description={COPY.adminProducts.editDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/products">{COPY.adminCommon.actions.backToList}</Link>
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProductTypeBadge type={product.type} />
          <ProductStatusBadge status={product.status} />
          {/* The slug is Latin and part of a public URL; isolated so it cannot
              reorder against the Arabic labels beside it. */}
          <span className="text-ink-700 text-xs" dir="ltr">
            {product.slug}
          </span>
        </div>

        <dl className="text-ink-700 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex flex-wrap gap-x-2">
            <dt>{COPY.adminCommon.table.updatedAt}</dt>
            <dd className="text-ink-900 font-medium">{formatDateTime(product.updatedAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>{COPY.adminCommon.table.createdAt}</dt>
            <dd className="text-ink-900 font-medium">{formatDateTime(product.createdAt)}</dd>
          </div>
        </dl>

        <div className="border-line-200 border-t pt-4">
          <ProductStatusActions
            productId={product.id}
            status={product.status}
            // Deletion is refused by the server whenever a purchase points at
            // the product; the button is disabled here so the refusal is visible
            // before it is earned, not instead of the server check.
            deletable={product.orderCount === 0 && product.entitlementCount === 0}
          />
        </div>
      </Card>

      <ProductForm
        product={{
          id: product.id,
          type: product.type,
          slug: product.slug,
          title: product.title,
          shortDescription: product.shortDescription,
          longDescription: product.longDescription,
          coverAssetId: product.coverAssetId,
          // Resolved server-side so the picker can draw the current cover on
          // first paint rather than fetching it after mount.
          coverAsset: product.coverAsset,
          priceHalalas: product.priceHalalas,
          featured: product.featured,
        }}
      />
    </div>
  );
}
