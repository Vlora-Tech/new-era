import 'server-only';

import { normalizePaymentStatus, type RawPaymentStatus } from '../moyasar-status';
import type {
  CanonicalPayment,
  CheckoutConfig,
  CheckoutOrderView,
  PaymentProviderAdapter,
} from '../payment-provider';

/**
 * Development payment mock.
 *
 * The point of this adapter is that it is *not* a shortcut. It keeps a canonical
 * payment record of its own — amount, currency, metadata, refunded total — and
 * `reconcile()` reads that record back exactly as the Moyasar adapter reads the
 * gateway. Fulfilment therefore runs the identical verification: the amount is
 * compared, the currency is compared, the order is located through metadata, and
 * the browser's claim about what happened is ignored. A mock that granted access
 * directly would leave the entire verification path untested until production.
 *
 * Three independent gates keep this out of production: `env()` refuses to parse
 * such a configuration, `getPaymentProvider()` refuses to return this adapter,
 * and the completion route refuses to exist.
 */
export type MockPaymentRecord = {
  id: string;
  rawStatus: RawPaymentStatus;
  amountHalalas: number;
  currency: string;
  refundedHalalas: number;
  metadata: Record<string, string>;
  failureMessage: string | null;
};

/**
 * Cached on `globalThis` for the same reason the Prisma client is: the module
 * is re-evaluated on every edit in development, and a payment created before an
 * edit must still be reconcilable after it.
 */
const globalForMock = globalThis as unknown as {
  __neMockPayments?: Map<string, MockPaymentRecord>;
};

const mockPayments: Map<string, MockPaymentRecord> = (globalForMock.__neMockPayments ??= new Map());

/** Create a canonical mock payment. Called only by the development route. */
export function createMockPayment(input: {
  rawStatus: RawPaymentStatus;
  amountHalalas: number;
  currency: string;
  metadata: Record<string, string>;
  failureMessage?: string | null;
}): MockPaymentRecord {
  const record: MockPaymentRecord = {
    id: `mock_pay_${crypto.randomUUID().replace(/-/g, '')}`,
    rawStatus: input.rawStatus,
    amountHalalas: input.amountHalalas,
    currency: input.currency,
    refundedHalalas: 0,
    metadata: input.metadata,
    failureMessage: input.failureMessage ?? null,
  };
  mockPayments.set(record.id, record);
  return record;
}

export function getMockPayment(paymentId: string): MockPaymentRecord | null {
  return mockPayments.get(paymentId) ?? null;
}

/** Test-only: drop every stored mock payment between cases. */
export function resetMockPaymentsForTests(): void {
  mockPayments.clear();
}

function toCanonical(record: MockPaymentRecord): CanonicalPayment {
  const status = normalizePaymentStatus(record.rawStatus);
  return {
    provider: 'MOCK',
    providerPaymentId: record.id,
    status,
    rawStatus: record.rawStatus,
    amountHalalas: record.amountHalalas,
    currency: record.currency.toUpperCase(),
    refundedHalalas: record.refundedHalalas,
    metadata: { ...record.metadata },
    failureCode: status === 'FAILED' ? 'mock_declined' : null,
    failureMessage: status === 'FAILED' ? record.failureMessage : null,
  };
}

export const mockPaymentProvider: PaymentProviderAdapter = {
  name: 'MOCK',

  getCheckoutConfig(order: CheckoutOrderView): CheckoutConfig {
    return {
      kind: 'mock',
      orderId: order.orderId,
      paymentAttemptId: order.paymentAttemptId,
      amountHalalas: order.amountHalalas,
      currency: order.currency,
      description: order.description,
    };
  },

  async reconcile({ paymentId }): Promise<CanonicalPayment | null> {
    const record = getMockPayment(paymentId);
    return record ? toCanonical(record) : null;
  },

  async refund({ paymentId, amountHalalas }): Promise<CanonicalPayment> {
    const record = getMockPayment(paymentId);
    if (!record) throw new Error(`Unknown mock payment: ${paymentId}`);

    const requested = amountHalalas ?? record.amountHalalas - record.refundedHalalas;
    record.refundedHalalas = Math.min(record.amountHalalas, record.refundedHalalas + requested);
    // A partially refunded payment keeps reading as paid, which is what makes
    // the partial-refund branch of reconciliation reachable in development.
    if (record.refundedHalalas >= record.amountHalalas) record.rawStatus = 'refunded';

    return toCanonical(record);
  },
};
