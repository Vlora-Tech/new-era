import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { OrderDetail } from '@/components/admin/order-detail';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  getOrderForAdmin,
  parseOrderId,
  type AdminOrderDetail,
} from '@/services/payments/order-admin.service';

export const metadata: Metadata = { title: COPY.adminOrders.detailTitle };

/**
 * One order.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the order does not exist, or the path segment is not an id at all —
 *    `notFound()`, the honest answer to a bad address;
 *  - the query threw — `ErrorState`. A record screen has one read behind it, so
 *    there is no half-loaded order to draw a panel around; a page that rendered
 *    empty payment tables after a failed read would say "this order was never
 *    paid", which is a claim about money;
 *  - the order loaded — the record.
 */
export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  let order: AdminOrderDetail | null = null;
  let failed = false;
  try {
    order = await getOrderForAdmin(parseOrderId(orderId));
  } catch (error) {
    // The service reports a malformed id as "no such order" rather than as a
    // fault, and that distinction has to survive into the page.
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin order load failed', { orderId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminOrders.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/orders">{COPY.adminOrders.backToList}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={order.productTitle}
        description={COPY.adminOrders.detailDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/orders">{COPY.adminOrders.backToList}</Link>
          </Button>
        }
      />

      <OrderDetail order={order} />
    </div>
  );
}
