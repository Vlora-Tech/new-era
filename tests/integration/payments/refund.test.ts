import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
import { getPaymentProvider } from '@/services/payments/payment-provider';
import {
  createMockPayment,
  getMockPayment,
  resetMockPaymentsForTests,
} from '@/services/payments/providers/mock.provider';
import { reconcilePayment } from '@/services/payments/reconcile.service';

import { cleanupUsers, createTestProduct, createTestUser, entitlementFacts } from './helpers';

const createdUserIds: string[] = [];

afterEach(() => {
  resetMockPaymentsForTests();
});

afterAll(async () => {
  await cleanupUsers(createdUserIds);
});

async function seedPaidOrder(priceHalalas = 60_000) {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  const product = await createTestProduct({ priceHalalas });

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
  await reconcilePayment({ paymentId: payment.id, source: 'callback' });

  return { user, product, order, payment };
}

describe('refunds', () => {
  it('withdraws access when the whole amount is returned', async () => {
    const { user, product, order, payment } = await seedPaidOrder();

    await getPaymentProvider().refund({ paymentId: payment.id });
    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'admin' });

    expect(outcome.outcome).toBe('REVOKED');

    const facts = await entitlementFacts(user.id, product.id);
    expect(facts.entitlement?.status).toBe('REVOKED');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, refundedAt: true },
    });
    expect(stored.status).toBe('REFUNDED');
    expect(stored.refundedAt).not.toBeNull();

    // The grant is still in the history: a refund adds a fact, it does not erase one.
    const events = await prisma.entitlementEvent.findMany({
      where: { entitlementId: facts.entitlement!.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true },
    });
    expect(events.map((event) => event.type)).toEqual(['GRANTED', 'REVOKED']);
  });

  it('never withdraws access automatically for a partial refund', async () => {
    const { user, product, order, payment } = await seedPaidOrder(60_000);

    await getPaymentProvider().refund({ paymentId: payment.id, amountHalalas: 20_000 });
    expect(getMockPayment(payment.id)?.rawStatus).toBe('paid');

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'admin' });

    expect(outcome.outcome).toBe('NEEDS_REVIEW');
    expect((await entitlementFacts(user.id, product.id)).entitlement?.status).toBe('ACTIVE');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('PAID');

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { provider_providerPaymentId: { provider: 'MOCK', providerPaymentId: payment.id } },
      select: { needsReview: true, refundedHalalas: true },
    });
    expect(attempt.needsReview).toBe(true);
    expect(attempt.refundedHalalas).toBe(20_000);
  });

  it('keeps the review flag latched once a human is needed', async () => {
    const { payment } = await seedPaidOrder(60_000);

    await getPaymentProvider().refund({ paymentId: payment.id, amountHalalas: 20_000 });
    await reconcilePayment({ paymentId: payment.id, source: 'admin' });
    // A later ordinary reconcile must not quietly clear the flag.
    await reconcilePayment({ paymentId: payment.id, source: 'scheduler' });

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { provider_providerPaymentId: { provider: 'MOCK', providerPaymentId: payment.id } },
      select: { needsReview: true },
    });
    expect(attempt.needsReview).toBe(true);
  });

  it('cancels a pending order and grants nothing when a payment is voided', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const product = await createTestProduct();

    const { order, paymentAttemptId } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    const payment = createMockPayment({
      rawStatus: 'voided',
      amountHalalas: order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'webhook' });

    expect(outcome.outcome).toBe('REVOKED');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, cancelledAt: true },
    });
    expect(stored.status).toBe('CANCELLED');
    expect(stored.cancelledAt).not.toBeNull();
  });

  it('withdraws access when a settled payment is later voided', async () => {
    const { user, product, order, payment } = await seedPaidOrder();

    const record = getMockPayment(payment.id)!;
    record.rawStatus = 'voided';

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'webhook' });

    expect(outcome.outcome).toBe('REVOKED');
    expect((await entitlementFacts(user.id, product.id)).entitlement?.status).toBe('REVOKED');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('REFUNDED');
  });
});
