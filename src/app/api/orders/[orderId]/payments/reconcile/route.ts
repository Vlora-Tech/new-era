import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { latestProviderPaymentId } from '@/services/payments/order.service';
import { reconcilePayment } from '@/services/payments/reconcile.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ orderId: string }> };

/**
 * Re-verify an order's payment against the provider.
 *
 * The request body is not read at all. The caller identifies an order; the
 * server derives which payment that means from the order's own attempts, and
 * then asks the gateway. So the worst a caller can do with this endpoint is
 * cause their own order to be checked again — never point it at a payment of
 * their choosing.
 */
export const POST = routeHandler(
  'POST /api/orders/[orderId]/payments/reconcile',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const user = await requireAuth();

    await enforceRateLimit('reconcilePayment', user.id);

    const { orderId } = await context.params;

    // Owner or administrator. An administrator is answering a support request,
    // so they may re-check an order that is not theirs.
    const order = await prisma.order.findFirst({
      where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, userId: user.id },
      select: { id: true, status: true },
    });
    if (!order) throw new HttpError(404, COPY.commerce.orderNotFound, 'order_not_found');

    const paymentId = await latestProviderPaymentId(order.id);
    if (!paymentId) {
      throw new HttpError(409, COPY.commerce.paymentNotAttached, 'payment_not_attached');
    }

    const outcome = await reconcilePayment({
      paymentId,
      source: user.role === 'ADMIN' ? 'admin' : 'manual',
      actorUserId: user.role === 'ADMIN' ? user.id : undefined,
    });

    // The order's status is the only fact returned. The provider's own status
    // string is deliberately not exposed to a browser.
    return apiSuccess({
      orderId: order.id,
      status: outcome.orderStatus ?? order.status,
      changed: outcome.outcome === 'FULFILLED' || outcome.outcome === 'REVOKED',
    });
  },
);
