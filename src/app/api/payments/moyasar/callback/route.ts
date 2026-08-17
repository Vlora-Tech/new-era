import { NextResponse } from 'next/server';

import { routeHandler } from '@/lib/api';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { safeRedirectOrDefault } from '@/lib/safe-redirect';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { configuredProviderName } from '@/services/payments/payment-provider';
import { reconcilePayment } from '@/services/payments/reconcile.service';
import { attachPaymentSchema } from '@/validators/commerce';

export const runtime = 'nodejs';

/**
 * Where the gateway returns the browser after 3-D Secure.
 *
 * Moyasar appends `id`, `status` and `message` to this URL. **The `status`
 * parameter is ignored entirely.** It is a value the person being redirected can
 * edit, so treating it as a payment outcome would mean anyone could grant
 * themselves a product by typing `&status=paid`. Only `id` is used, and only as
 * a lookup key: the payment's real state is fetched from the gateway with the
 * server secret inside `reconcilePayment`.
 *
 * There is no same-origin check here, and there cannot be: the browser arrives
 * from the bank's 3-D Secure page, so no trustworthy `Origin` accompanies it.
 * That costs nothing, because this handler trusts nothing it is given.
 */
export const GET = routeHandler('GET /api/payments/moyasar/callback', async (request) => {
  await enforceRateLimit('paymentCallback', clientIdentifier(request));

  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(safeRedirectOrDefault(path, '/dashboard/orders'), appUrl), 303);

  const rawId = new URL(request.url).searchParams.get('id');
  const parsed = attachPaymentSchema.safeParse({ paymentId: rawId ?? '' });
  if (!parsed.success) {
    logger.warn('payment callback arrived without a usable payment id');
    return redirectTo('/dashboard/orders');
  }
  const paymentId = parsed.data.paymentId;

  // Looked up so the student can be returned to the right result page even when
  // reconciliation cannot resolve the payment. This is navigation only; it plays
  // no part in deciding whether anything is fulfilled.
  const attempt = await prisma.paymentAttempt.findUnique({
    where: {
      provider_providerPaymentId: {
        provider: configuredProviderName(),
        providerPaymentId: paymentId,
      },
    },
    select: { orderId: true },
  });

  const outcome = await reconcilePayment({ paymentId, source: 'callback' });
  const orderId = outcome.orderId ?? attempt?.orderId ?? null;

  logger.info('payment callback reconciled', { paymentId, outcome: outcome.outcome, orderId });

  return redirectTo(orderId ? `/checkout/${orderId}/result` : '/dashboard/orders');
});
