import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import {
  attachProviderPayment,
  getOwnedOrder,
  OrderConflictError,
} from '@/services/payments/order.service';
import { attachPaymentSchema } from '@/validators/commerce';

export const runtime = 'nodejs';

type Context = { params: Promise<{ orderId: string }> };

/**
 * Bind a gateway payment id to an order, immediately before 3-D Secure.
 *
 * This is the whole of what the browser reports about a payment: an identifier.
 * No status, no amount, no card. Attaching grants nothing — the id only tells
 * the server which payment to ask the gateway about later.
 */
export const POST = routeHandler(
  'POST /api/orders/[orderId]/payments/attach',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const user = await requireAuth();

    // The in-process budget used for the rest of the callback traffic: attaching
    // happens once per checkout, in the same moment the gateway hands the
    // browser back, and a database write per call would cost more than it saves.
    await enforceRateLimit('paymentCallback', clientIdentifier(request));

    const { orderId } = await context.params;
    const input = attachPaymentSchema.parse(await request.json());

    const order = await getOwnedOrder(orderId, user.id);
    // Answered as "not found" rather than "forbidden": whether an order id
    // exists is not something a non-owner should be able to learn.
    if (!order) throw new HttpError(404, COPY.commerce.orderNotFound, 'order_not_found');

    if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
      throw new HttpError(409, COPY.commerce.orderNotPayable, 'order_not_payable');
    }

    try {
      const { paymentAttemptId, alreadyAttached } = await attachProviderPayment({
        orderId: order.id,
        paymentId: input.paymentId,
      });
      return apiSuccess({
        orderId: order.id,
        paymentAttemptId,
        alreadyAttached,
        resultPath: `/checkout/${order.id}/result`,
      });
    } catch (error) {
      if (error instanceof OrderConflictError) {
        return apiFailure(error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  },
);
