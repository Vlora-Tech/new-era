import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { getOrderForAdmin, parseOrderId } from '@/services/payments/order-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ orderId: string }> };

/**
 * One order, with its payments, the provider notices behind them, and what the
 * order did to the student's access.
 *
 * `GET` is the only verb on this path. There is deliberately no `PATCH` and no
 * `DELETE`:
 *
 *  - An order's amount, currency and product snapshot were taken at checkout and
 *    are the evidence of what was agreed. A handler that could edit them is a
 *    handler that can rewrite a receipt, and the refusal is expressed by the
 *    verb not existing rather than by a check inside one that does.
 *  - Deleting an order would orphan its payments and leave the entitlement it
 *    granted pointing at nothing. `COPY.adminOrders.errors.deleteUnavailable`
 *    states that, and points at cancelling or refunding instead.
 */
export const GET = routeHandler(
  'GET /api/admin/orders/[orderId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { orderId } = await context.params;
    const order = await getOrderForAdmin(parseOrderId(orderId));
    if (!order) {
      throw new HttpError(404, COPY.adminOrders.errors.notFound, 'order_not_found');
    }

    return apiSuccess(order);
  },
);
