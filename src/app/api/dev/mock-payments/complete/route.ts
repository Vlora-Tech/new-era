import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { attachProviderPayment, getOwnedOrder } from '@/services/payments/order.service';
import { getPaymentProvider } from '@/services/payments/payment-provider';
import { createMockPayment } from '@/services/payments/providers/mock.provider';
import { reconcilePayment } from '@/services/payments/reconcile.service';
import { mockPaymentCompletionSchema } from '@/validators/commerce';

export const runtime = 'nodejs';

/**
 * Development-only completion of a mock payment.
 *
 * The third of three independent gates keeping the mock out of production:
 * `env()` refuses to parse such a configuration, `getPaymentProvider()` refuses
 * to return the mock adapter, and this route refuses to exist. The check reads
 * `process.env.NODE_ENV` directly so it does not depend on the same parsed
 * configuration the other two gates use.
 *
 * What this route does *not* do is grant anything. It writes a canonical mock
 * payment, attaches its id, and then runs the ordinary reconcile — the same
 * function a Moyasar callback runs, with the same amount and currency
 * verification. The development flow is therefore a test of fulfilment, not a
 * bypass of it.
 */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    // Indistinguishable from a route that was never deployed.
    throw new HttpError(404, COPY.errors.notFound, 'not_found');
  }
}

export const POST = routeHandler('POST /api/dev/mock-payments/complete', async (request) => {
  assertNotProduction();
  assertSameOrigin(request);
  const user = await requireAuth();

  await enforceRateLimit('paymentCallback', clientIdentifier(request));

  const provider = getPaymentProvider();
  if (provider.name !== 'MOCK') {
    throw new HttpError(404, COPY.errors.notFound, 'not_found');
  }

  const input = mockPaymentCompletionSchema.parse(await request.json());

  const order = await getOwnedOrder(input.orderId, user.id);
  if (!order) throw new HttpError(404, COPY.commerce.orderNotFound, 'order_not_found');
  if (order.status === 'PAID') {
    return apiSuccess({
      orderId: order.id,
      status: order.status,
      redirectTo: `/checkout/${order.id}/result`,
    });
  }

  // The canonical payment is written first, so the attempt is bound to a
  // payment that genuinely exists in the mock store rather than to a
  // placeholder. Amount and currency come from the order, exactly as a gateway
  // would read them from the checkout configuration this server produced.
  const mockPayment = createMockPayment({
    rawStatus: input.outcome === 'paid' ? 'paid' : 'failed',
    amountHalalas: order.amountHalalas,
    currency: order.currency,
    metadata: { order_id: order.id },
    failureMessage: input.outcome === 'failed' ? 'Simulated decline' : null,
  });

  const { paymentAttemptId } = await attachProviderPayment({
    orderId: order.id,
    paymentId: mockPayment.id,
  });
  // Mirrors what a real checkout sends, so the attempt-ownership check in
  // reconciliation is exercised here too rather than skipped.
  mockPayment.metadata.payment_attempt_id = paymentAttemptId;

  const outcome = await reconcilePayment({ paymentId: mockPayment.id, source: 'callback' });

  return apiSuccess({
    orderId: order.id,
    paymentAttemptId,
    status: outcome.orderStatus ?? order.status,
    redirectTo: `/checkout/${order.id}/result`,
  });
});
