import 'server-only';

import type { PaymentProvider as PaymentProviderName, PaymentStatus } from '@prisma/client';

import { env } from '@/lib/env';

import { mockPaymentProvider } from './providers/mock.provider';
import { moyasarPaymentProvider } from './providers/moyasar.provider';

/**
 * The payment provider seam.
 *
 * Everything above this interface — order creation, reconciliation, fulfilment,
 * refunds — is written against `PaymentProviderAdapter` and never against
 * Moyasar. The development mock therefore exercises the same verification and
 * fulfilment code that a real card payment does, rather than a shortcut that
 * grants access directly. A mock that skips the verification path is a mock that
 * proves nothing.
 *
 * `CanonicalPayment` is the only shape the rest of the system sees. It is
 * assembled by the adapter from the provider's own response and carries no
 * cardholder data, no raw payload and no provider-specific fields.
 */
export type CanonicalPayment = {
  provider: PaymentProviderName;
  providerPaymentId: string;
  /** Normalised status. Assembling this is where an unknown status throws. */
  status: PaymentStatus;
  /** The provider's own lowercase string, kept for the audit trail. */
  rawStatus: string;
  amountHalalas: number;
  currency: string;
  refundedHalalas: number;
  /**
   * Provider metadata reduced to string values. This is where `order_id` and
   * `payment_attempt_id` travel — set by this server when checkout was
   * configured, read back from the provider, never taken from a caller.
   */
  metadata: Record<string, string>;
  failureCode: string | null;
  failureMessage: string | null;
};

/** What the checkout page needs to know about the order it is paying for. */
export type CheckoutOrderView = {
  orderId: string;
  paymentAttemptId: string;
  amountHalalas: number;
  currency: string;
  description: string;
};

export type CheckoutConfig =
  | {
      kind: 'mock';
      orderId: string;
      paymentAttemptId: string;
      amountHalalas: number;
      currency: string;
      description: string;
    }
  | {
      kind: 'moyasar';
      publishableKey: string;
      amountHalalas: number;
      currency: string;
      description: string;
      callbackUrl: string;
      /** Exactly two keys. Nothing else is sent to the provider. */
      metadata: { order_id: string; payment_attempt_id: string };
    };

/** Who asked for the reconcile. Recorded, and used only for logging. */
export type ReconcileSource = 'callback' | 'webhook' | 'scheduler' | 'manual' | 'admin';

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;

  /** Build the client-side checkout configuration for one order. */
  getCheckoutConfig(order: CheckoutOrderView): CheckoutConfig;

  /**
   * Fetch the provider's canonical record of a payment, using the server
   * secret. Returns null when the provider has no such payment.
   */
  reconcile(input: {
    paymentId: string;
    source: ReconcileSource;
  }): Promise<CanonicalPayment | null>;

  /** Refund a payment, in full when no amount is given. */
  refund(input: { paymentId: string; amountHalalas?: number }): Promise<CanonicalPayment>;
}

/** The provider name implied by the current configuration. */
export function configuredProviderName(): PaymentProviderName {
  return env().PAYMENT_PROVIDER === 'moyasar' ? 'MOYASAR' : 'MOCK';
}

/** The payment mode this deployment is configured for. */
export function configuredPaymentMode(): 'TEST' | 'LIVE' {
  return env().MOYASAR_MODE === 'live' ? 'LIVE' : 'TEST';
}

/**
 * Resolve the adapter for the current configuration.
 *
 * The mock check here is the second of three independent gates. `env()` already
 * refuses to parse a production configuration that selects the mock, and the
 * development completion route refuses to exist in production. This gate reads
 * `process.env.NODE_ENV` directly rather than the parsed value, so it is not
 * checking the same thing twice through the same code path.
 */
export function getPaymentProvider(): PaymentProviderAdapter {
  const name = configuredProviderName();

  if (name === 'MOCK' && process.env.NODE_ENV === 'production') {
    throw new Error('The mock payment provider is not available in production.');
  }

  return name === 'MOYASAR' ? moyasarPaymentProvider : mockPaymentProvider;
}
