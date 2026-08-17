import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
import {
  createMockPayment,
  resetMockPaymentsForTests,
} from '@/services/payments/providers/mock.provider';
import { reconcilePayment } from '@/services/payments/reconcile.service';

import { cleanupUsers, createTestProduct, createTestUser, entitlementFacts } from './helpers';

/**
 * Exactly-once fulfilment under concurrency.
 *
 * This is the scenario the row lock in `reconcilePayment` exists for: a browser
 * callback, a webhook and a reconciliation sweep can all land on one paid
 * payment within the same second. Whatever the interleaving, the student must
 * end with one entitlement and one GRANTED event — the history is the record of
 * what happened, and three grants for one purchase is a false record.
 */
const PARALLEL_RECONCILES = 8;

const createdUserIds: string[] = [];

afterEach(() => {
  resetMockPaymentsForTests();
});

afterAll(async () => {
  await cleanupUsers(createdUserIds);
});

describe('concurrent reconciliation', () => {
  it('grants once for N simultaneous reconciles of one paid payment', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const product = await createTestProduct({ priceHalalas: 75_000 });

    const { order, paymentAttemptId } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    const payment = createMockPayment({
      rawStatus: 'paid',
      amountHalalas: order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });
    await attachProviderPayment({ orderId: order.id, paymentId: payment.id });

    const sources = ['callback', 'webhook', 'scheduler', 'manual'] as const;
    const outcomes = await Promise.all(
      Array.from({ length: PARALLEL_RECONCILES }, (_, index) =>
        reconcilePayment({ paymentId: payment.id, source: sources[index % sources.length] }),
      ),
    );

    const fulfilled = outcomes.filter((outcome) => outcome.outcome === 'FULFILLED');
    const alreadyFulfilled = outcomes.filter((outcome) => outcome.outcome === 'ALREADY_FULFILLED');

    expect(fulfilled).toHaveLength(1);
    expect(alreadyFulfilled).toHaveLength(PARALLEL_RECONCILES - 1);

    const facts = await entitlementFacts(user.id, product.id);
    expect(facts.entitlement?.status).toBe('ACTIVE');
    expect(facts.grantedEvents).toBe(1);

    const allEvents = await prisma.entitlementEvent.count({
      where: { entitlementId: facts.entitlement!.id },
    });
    expect(allEvents).toBe(1);

    // One attempt row for one gateway payment, however many callers saw it.
    const attempts = await prisma.paymentAttempt.count({
      where: { orderId: order.id, providerPaymentId: payment.id },
    });
    expect(attempts).toBe(1);

    const stored = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { provider_providerPaymentId: { provider: 'MOCK', providerPaymentId: payment.id } },
      select: { status: true, reconcileCount: true },
    });
    expect(stored.status).toBe('PAID');
    expect(stored.reconcileCount).toBe(PARALLEL_RECONCILES);
  });
});
