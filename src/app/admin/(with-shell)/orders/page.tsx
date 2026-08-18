import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  isOrderQueryFiltered,
  OrderFilters,
  OrderList,
  OrderPagination,
} from '@/components/admin/order-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listOrders, type AdminOrderPage } from '@/services/payments/order-admin.service';
import { orderListQuerySchema } from '@/validators/admin-order';

export const metadata: Metadata = { title: COPY.admin.orders };

/**
 * The orders ledger.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL, so a
 * narrowed view is a real address that can be reloaded, bookmarked and pasted
 * into a support thread.
 *
 * The query is wrapped in try/catch and the result kept nullable. A thrown query
 * renders `ErrorState` through the table's `failed` prop and must never render
 * an empty table: "لا توجد طلبات بعد" means nobody has bought anything, and a
 * database outage is not entitled to say that.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter (`?status=PAID&status=FAILED`) arrives as an array. The
  // first value wins rather than the request being rejected: this is a browsing
  // surface, and every field in the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = orderListQuerySchema.parse(flat);

  let result: AdminOrderPage | null = null;
  try {
    result = await listOrders(query);
  } catch (error) {
    logger.error('admin order list failed', { error });
  }

  const filtered = isOrderQueryFiltered(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminOrders.listTitle}
        description={COPY.adminOrders.listDescription}
      />

      {/* Said on the list rather than only on the record: somebody arriving here
          to "change an order's status" should learn immediately that the gateway
          decides that, not this screen. */}
      <Notice tone="neutral" role="note">
        {COPY.adminOrders.notices.providerIsAuthority}
      </Notice>

      <OrderFilters query={query} />

      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <OrderList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <OrderPagination result={result} query={query} /> : null}
    </div>
  );
}
