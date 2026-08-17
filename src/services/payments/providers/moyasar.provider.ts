import 'server-only';

import { env } from '@/lib/env';

import { fetchMoyasarPayment, refundMoyasarPayment, type MoyasarPayment } from '../moyasar-client';
import { normalizePaymentStatus } from '../moyasar-status';
import type {
  CanonicalPayment,
  CheckoutConfig,
  CheckoutOrderView,
  PaymentProviderAdapter,
} from '../payment-provider';

/**
 * Moyasar adapter.
 *
 * Its only job is translation: gateway JSON in, `CanonicalPayment` out. No
 * decision about access, orders or refunds is taken here — those live in
 * `reconcile.service.ts`, which is shared with the mock so both run the same
 * verification.
 */

/** Path the gateway returns the browser to after 3-D Secure. */
export const MOYASAR_CALLBACK_PATH = '/api/payments/moyasar/callback';

/**
 * Reduce provider metadata to string values.
 *
 * Metadata comes back as whatever was sent. Everything downstream treats it as
 * a lookup of opaque identifiers, so anything non-string is dropped rather than
 * coerced — a coerced `[object Object]` would be a key that silently matches
 * nothing.
 */
function toStringMetadata(metadata: MoyasarPayment['metadata']): Record<string, string> {
  const output: Record<string, string> = {};
  if (!metadata) return output;
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') output[key] = value;
  }
  return output;
}

function toCanonical(payment: MoyasarPayment): CanonicalPayment {
  const rawStatus = payment.status.trim().toLowerCase();
  const status = normalizePaymentStatus(rawStatus);
  const failed = status === 'FAILED';

  return {
    provider: 'MOYASAR',
    providerPaymentId: payment.id,
    status,
    rawStatus,
    amountHalalas: payment.amount,
    currency: payment.currency.toUpperCase(),
    refundedHalalas: payment.refunded ?? 0,
    metadata: toStringMetadata(payment.metadata),
    // The gateway has no separate failure code; the normalised status is the
    // most specific machine-readable value there is.
    failureCode: failed ? rawStatus : null,
    // Truncated: this is diagnostic text for an administrator, never customer
    // copy, and an unbounded provider string does not belong in a column.
    failureMessage: failed ? (payment.source?.message?.slice(0, 300) ?? null) : null,
  };
}

export const moyasarPaymentProvider: PaymentProviderAdapter = {
  name: 'MOYASAR',

  getCheckoutConfig(order: CheckoutOrderView): CheckoutConfig {
    const config = env();
    const publishableKey = config.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error('NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY is not configured.');
    }

    return {
      kind: 'moyasar',
      publishableKey,
      amountHalalas: order.amountHalalas,
      currency: order.currency,
      description: order.description,
      callbackUrl: new URL(MOYASAR_CALLBACK_PATH, config.NEXT_PUBLIC_APP_URL).toString(),
      // Exactly the two identifiers reconciliation needs to find its way back to
      // an order. No customer data is sent to the gateway as metadata.
      metadata: { order_id: order.orderId, payment_attempt_id: order.paymentAttemptId },
    };
  },

  async reconcile({ paymentId }): Promise<CanonicalPayment | null> {
    const payment = await fetchMoyasarPayment(paymentId);
    return payment ? toCanonical(payment) : null;
  },

  async refund({ paymentId, amountHalalas }): Promise<CanonicalPayment> {
    return toCanonical(await refundMoyasarPayment(paymentId, amountHalalas));
  },
};
