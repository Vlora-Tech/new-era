import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { EntitlementGrantForm } from '@/components/admin/entitlement-grant-form';
import {
  EntitlementFilters,
  EntitlementList,
  EntitlementPagination,
  isEntitlementQueryFiltered,
} from '@/components/admin/entitlement-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  listEntitlements,
  listGrantableProducts,
  type AdminEntitlementPage,
  type GrantableProduct,
} from '@/services/access/entitlement-admin.service';
import { entitlementListQuerySchema } from '@/validators/admin-entitlement';

export const metadata: Metadata = { title: COPY.admin.entitlements };

/**
 * The access list, plus the manual grant.
 *
 * Two reads, tracked separately on purpose. The list is the screen; the product
 * catalogue is only what fills two `<select>`s. If the catalogue read fails the
 * list still draws — with the product filter and the grant form withheld, since
 * neither can offer a choice it does not have — and if the list read fails the
 * table becomes `ErrorState` rather than an empty table. "لا توجد صلاحيات وصول
 * بعد" would be a claim about the business, and an outage must not make it on
 * the one screen an administrator opens to check whether a paying student can
 * still open what they bought.
 */
export default async function AdminEntitlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter arrives as an array; the first value wins rather than
  // the request being rejected, since every field in the schema `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = entitlementListQuerySchema.parse(flat);

  let result: AdminEntitlementPage | null = null;
  try {
    result = await listEntitlements(query);
  } catch (error) {
    logger.error('admin entitlement list failed', { error });
  }

  let products: GrantableProduct[] | null = null;
  try {
    products = await listGrantableProducts();
  } catch (error) {
    logger.error('admin grantable products load failed', { error });
  }

  const filtered = isEntitlementQueryFiltered(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminEntitlements.listTitle}
        description={COPY.adminEntitlements.listDescription}
      />

      {/* The assumption an administrator most plausibly brings to this screen —
          that access and money move together — corrected before they act. */}
      <Notice tone="neutral" role="note">
        {COPY.adminEntitlements.notices.accessIsNotMoney}
      </Notice>

      {products ? <EntitlementGrantForm products={products} /> : null}

      {products ? <EntitlementFilters query={query} products={products} /> : null}

      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <EntitlementList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <EntitlementPagination result={result} query={query} /> : null}

      <p className="text-ink-700 text-sm">{COPY.adminEntitlements.notices.historyIsAppendOnly}</p>
      <p className="text-ink-700 text-sm">
        {COPY.adminEntitlements.notices.refundRevokesAutomatically}
      </p>
    </div>
  );
}
