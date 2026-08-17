import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { requireStudent } from '@/lib/auth/guards';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { isCommerceEnabled } from '@/lib/env';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createOrder, OrderConflictError } from '@/services/payments/order.service';
import { createOrderSchema } from '@/validators/commerce';

export const runtime = 'nodejs';

/**
 * Start a purchase.
 *
 * The body names a product and an idempotency key. It does not — and cannot —
 * name a price: the schema has no such field, and the service reads the amount,
 * currency, title and type from the product row.
 */
export const POST = routeHandler('POST /api/orders', async (request) => {
  assertSameOrigin(request);
  const user = await requireStudent();

  if (!isCommerceEnabled()) {
    throw new HttpError(503, COPY.commerce.commerceDisabled, 'commerce_disabled');
  }

  // Keyed by user rather than by address: this budget exists to stop one account
  // opening unbounded pending orders, and an address is not an identity.
  await enforceRateLimit('createOrder', user.id);

  const input = createOrderSchema.parse(await request.json());

  try {
    const { order, paymentAttemptId, reused } = await createOrder({
      userId: user.id,
      productId: input.productId,
      checkoutRequestKey: input.checkoutRequestKey,
    });

    return apiSuccess({
      orderId: order.id,
      paymentAttemptId,
      status: order.status,
      amountHalalas: order.amountHalalas,
      currency: order.currency,
      productTitle: order.productTitle,
      checkoutPath: `/checkout/${order.id}`,
      reused,
    });
  } catch (error) {
    // A conflict carries a pointer the client can navigate to, which the shared
    // error envelope would otherwise drop.
    if (error instanceof OrderConflictError) {
      return apiFailure(error.status, error.code, error.message, error.details);
    }
    throw error;
  }
});
