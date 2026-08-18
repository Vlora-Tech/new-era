import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { parseOrderId, requestOrderReconcile } from '@/services/payments/order-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ orderId: string }> };

/**
 * Re-check an order's payment against the provider.
 *
 * This is the only mutating endpoint on the orders screen, and it does not move
 * money. It asks the gateway what it holds for this order's payment and lets
 * `reconcile.service.ts` apply whatever that implies — grant, revoke, or nothing
 * at all. The platform never asserts a payment outcome on its own say-so, so
 * there is no "mark as paid" and no "issue refund" beside it.
 *
 * **The request body is not read.** The caller names an order in the path; the
 * server derives which gateway payment that means from the order's own attempts.
 * The worst this endpoint can be used for is causing an order to be checked
 * again — never pointing a check at a payment of the caller's choosing.
 *
 * Guard order matters and is the same everywhere: origin first, because a
 * cross-site POST should be refused before it costs a session lookup; then
 * `requireAdmin()`, before a rate-limit budget is spent or the provider is
 * called; then the budget, keyed by administrator, because reconciliation makes
 * an outbound request to a third party and a stuck retry loop should exhaust one
 * person's allowance rather than the gateway's patience.
 */
export const POST = routeHandler(
  'POST /api/admin/orders/[orderId]/reconcile',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    await enforceRateLimit('reconcilePayment', admin.id);

    const { orderId } = await context.params;

    const result = await requestOrderReconcile(parseOrderId(orderId), {
      actor: { id: admin.id, email: admin.email },
    });

    // The order's own status and the outcome the service reported. The
    // provider's raw status string is deliberately not exposed to a browser.
    return apiSuccess(result);
  },
);
