import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { ProductForm } from '@/components/admin/product-form';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.adminProducts.createTitle };

/**
 * Add a product.
 *
 * The screen reads nothing from the database, so there is no query to fail and
 * no error state to draw. It creates a draft: the create endpoint cannot accept
 * a status, which is what makes "a product is never born published" a property
 * of the request shape rather than a habit of this page.
 */
export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminProducts.createTitle}
        description={COPY.adminProducts.createDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/products">{COPY.adminCommon.actions.backToList}</Link>
          </Button>
        }
      />

      <ProductForm />
    </div>
  );
}
