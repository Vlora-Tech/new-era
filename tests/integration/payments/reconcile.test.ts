import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
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

/** An order with a mock payment already bound to it, ready to reconcile. */
async function seedCheckout(options: { priceHalalas?: number } = {}) {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  const product = await createTestProduct({ priceHalalas: options.priceHalalas ?? 49_900 });

  const { order, paymentAttemptId } = await createOrder({
    userId: user.id,
    productId: product.id,
    checkoutRequestKey: randomUUID(),
  });

  return { user, product, order, paymentAttemptId };
}

async function bindPayment(
  orderId: string,
  paymentAttemptId: string,
  payment: { amountHalalas: number; currency?: string; rawStatus?: 'paid' | 'failed' },
) {
  const record = createMockPayment({
    rawStatus: payment.rawStatus ?? 'paid',
    amountHalalas: payment.amountHalalas,
    currency: payment.currency ?? 'SAR',
    metadata: { order_id: orderId, payment_attempt_id: paymentAttemptId },
  });
  await attachProviderPayment({ orderId, paymentId: record.id });
  return record;
}

describe('reconcile fulfilment', () => {
  it('grants access exactly once for a paid payment', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
    });

    const first = await reconcilePayment({ paymentId: payment.id, source: 'callback' });
    const second = await reconcilePayment({ paymentId: payment.id, source: 'webhook' });

    expect(first.outcome).toBe('FULFILLED');
    expect(second.outcome).toBe('ALREADY_FULFILLED');

    const facts = await entitlementFacts(user.id, product.id);
    expect(facts.entitlement?.status).toBe('ACTIVE');
    expect(facts.grantedEvents).toBe(1);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, paidAt: true },
    });
    expect(stored.status).toBe('PAID');
    expect(stored.paidAt).not.toBeNull();
  });

  it('does not grant when the paid amount differs from the order', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout({ priceHalalas: 49_900 });
    const payment = await bindPayment(order.id, paymentAttemptId, { amountHalalas: 100 });

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    expect(outcome.outcome).toBe('MISMATCH');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('PENDING_PAYMENT');

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { provider_providerPaymentId: { provider: 'MOCK', providerPaymentId: payment.id } },
      select: { needsReview: true },
    });
    expect(attempt.needsReview).toBe(true);
  });

  it('does not grant when the currency is not SAR', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
      currency: 'USD',
    });

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    expect(outcome.outcome).toBe('MISMATCH');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
  });

  it('records a mismatch in the audit trail without fulfilling', async () => {
    const { order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, { amountHalalas: 1 });

    await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'Order', targetId: order.id, action: 'payment.reconcile.mismatch' },
      select: { metadata: true },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ mismatches: ['amount'] });
  });

  it('refuses a payment whose attempt belongs to another order', async () => {
    const first = await seedCheckout();
    const second = await seedCheckout();

    // Metadata naming the first order but the second order's attempt.
    const record = createMockPayment({
      rawStatus: 'paid',
      amountHalalas: first.order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: first.order.id, payment_attempt_id: second.paymentAttemptId },
    });

    const outcome = await reconcilePayment({ paymentId: record.id, source: 'webhook' });

    expect(outcome.outcome).toBe('MISMATCH');
    expect((await entitlementFacts(first.user.id, first.product.id)).entitlement).toBeNull();
  });

  it('reports an unknown payment rather than inventing one', async () => {
    const outcome = await reconcilePayment({ paymentId: 'mock_pay_missing', source: 'scheduler' });
    expect(outcome.outcome).toBe('UNKNOWN_PAYMENT');
  });

  it('reports a payment that carries no order reference', async () => {
    const record = createMockPayment({
      rawStatus: 'paid',
      amountHalalas: 1_000,
      currency: 'SAR',
      metadata: {},
    });

    const outcome = await reconcilePayment({ paymentId: record.id, source: 'webhook' });
    expect(outcome.outcome).toBe('UNKNOWN_ORDER');
  });

  it('closes a pending order when the gateway reports a failure', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
      rawStatus: 'failed',
    });

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    expect(outcome.outcome).toBe('FAILED');
    expect(outcome.orderStatus).toBe('FAILED');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
  });

  it('leaves a paid order alone when a superseded attempt reports a failure', async () => {
    const { order, paymentAttemptId } = await seedCheckout();
    const paid = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
    });
    await reconcilePayment({ paymentId: paid.id, source: 'callback' });

    const failedAttempt = createMockPayment({
      rawStatus: 'failed',
      amountHalalas: order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: order.id },
    });
    const outcome = await reconcilePayment({ paymentId: failedAttempt.id, source: 'webhook' });

    expect(outcome.outcome).toBe('FAILED');
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('PAID');
  });

  it('leaves access closed for an intermediate state', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout();
    const record = createMockPayment({
      rawStatus: 'authorized',
      amountHalalas: order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });

    const outcome = await reconcilePayment({ paymentId: record.id, source: 'scheduler' });

    expect(outcome.outcome).toBe('PENDING');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
  });

  it('keeps the mock store honest: reconcile reads the record, not the caller', async () => {
    const { order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
      rawStatus: 'failed',
    });

    expect(getMockPayment(payment.id)?.rawStatus).toBe('failed');
  });
});

describe('browser callback', () => {
  it('ignores a status query parameter that contradicts the gateway', async () => {
    const { user, product, order, paymentAttemptId } = await seedCheckout();
    const payment = await bindPayment(order.id, paymentAttemptId, {
      amountHalalas: order.amountHalalas,
      rawStatus: 'failed',
    });

    const { GET } = await import('@/app/api/payments/moyasar/callback/route');
    const response = await GET(
      new Request(
        `http://localhost:3000/api/payments/moyasar/callback?id=${payment.id}&status=paid&message=APPROVED`,
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain(`/checkout/${order.id}/result`);

    // The query string said paid. The gateway said failed. Nothing was granted.
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('FAILED');
  });

  it('sends the browser somewhere safe when the id is unusable', async () => {
    const { GET } = await import('@/app/api/payments/moyasar/callback/route');
    const response = await GET(
      new Request('http://localhost:3000/api/payments/moyasar/callback?id=../../evil'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/dashboard/orders');
  });
});
