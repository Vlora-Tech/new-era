import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Moyasar path, with the HTTP client replaced at its own seam.
 *
 * Mocking `moyasar-client` rather than `fetch` keeps the adapter, the status
 * mapping and the whole of reconciliation under test: the only thing stubbed is
 * the network. What the gateway "returns" here is the real response shape, so
 * the amount unit (integer halalas) and the lowercase status strings are
 * exercised exactly as they arrive in production.
 */
const client = vi.hoisted(() => ({
  fetchMoyasarPayment: vi.fn(),
  refundMoyasarPayment: vi.fn(),
}));

vi.mock('@/services/payments/moyasar-client', () => ({
  fetchMoyasarPayment: client.fetchMoyasarPayment,
  refundMoyasarPayment: client.refundMoyasarPayment,
  MoyasarRequestError: class MoyasarRequestError extends Error {},
}));

import { prisma } from '@/lib/db';
import { resetEnvCacheForTests } from '@/lib/env';
import { UnknownPaymentStatusError } from '@/services/payments/moyasar-status';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
import { getPaymentProvider } from '@/services/payments/payment-provider';
import { reconcilePayment } from '@/services/payments/reconcile.service';

import { cleanupUsers, createTestProduct, createTestUser, entitlementFacts } from './helpers';

const mutableEnv = process.env as Record<string, string | undefined>;
const createdUserIds: string[] = [];

beforeAll(() => {
  mutableEnv.PAYMENT_PROVIDER = 'moyasar';
  mutableEnv.MOYASAR_MODE = 'test';
  mutableEnv.MOYASAR_SECRET_KEY = 'sk_test_stub_key';
  mutableEnv.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY = 'pk_test_stub_key';
  resetEnvCacheForTests();
});

beforeEach(() => {
  client.fetchMoyasarPayment.mockReset();
  client.refundMoyasarPayment.mockReset();
});

afterAll(async () => {
  await cleanupUsers(createdUserIds);
  mutableEnv.PAYMENT_PROVIDER = 'mock';
  delete mutableEnv.MOYASAR_SECRET_KEY;
  delete mutableEnv.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
  resetEnvCacheForTests();
});

/** A payment as the gateway returns it, including fields the platform discards. */
function gatewayPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: `pay_${randomUUID()}`,
    status: 'paid',
    amount: 49_900,
    currency: 'SAR',
    refunded: 0,
    fee: 1_200,
    description: 'دورة اختبارية',
    metadata: {},
    source: {
      type: 'creditcard',
      company: 'mada',
      name: 'TEST CARDHOLDER',
      number: '4111',
      message: null,
    },
    ...overrides,
  };
}

async function seedOrder(priceHalalas = 49_900) {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  const product = await createTestProduct({ priceHalalas });

  const { order, paymentAttemptId } = await createOrder({
    userId: user.id,
    productId: product.id,
    checkoutRequestKey: randomUUID(),
  });

  return { user, product, order, paymentAttemptId };
}

describe('Moyasar checkout configuration', () => {
  it('is pinned to Arabic, cards only, and the three supported networks', () => {
    const config = getPaymentProvider().getCheckoutConfig({
      orderId: '11111111-1111-4111-8111-111111111111',
      paymentAttemptId: '22222222-2222-4222-8222-222222222222',
      amountHalalas: 49_900,
      currency: 'SAR',
      description: 'دورة',
    });

    expect(config.kind).toBe('moyasar');
    if (config.kind !== 'moyasar') throw new Error('unreachable');

    expect(config.metadata).toEqual({
      order_id: '11111111-1111-4111-8111-111111111111',
      payment_attempt_id: '22222222-2222-4222-8222-222222222222',
    });
    // Metadata carries identifiers only: no customer data leaves for the gateway.
    expect(Object.keys(config.metadata)).toHaveLength(2);
    expect(config.callbackUrl).toContain('/api/payments/moyasar/callback');
    expect(config.publishableKey).toBe('pk_test_stub_key');
  });
});

describe('Moyasar reconciliation', () => {
  it('fulfils a paid payment and stores no card data', async () => {
    const { user, product, order, paymentAttemptId } = await seedOrder();
    const payment = gatewayPayment({
      amount: order.amountHalalas,
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });
    client.fetchMoyasarPayment.mockResolvedValue(payment);
    await attachProviderPayment({ orderId: order.id, paymentId: payment.id });

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    expect(outcome.outcome).toBe('FULFILLED');
    expect(client.fetchMoyasarPayment).toHaveBeenCalledWith(payment.id);

    const facts = await entitlementFacts(user.id, product.id);
    expect(facts.entitlement?.status).toBe('ACTIVE');

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: {
        provider_providerPaymentId: { provider: 'MOYASAR', providerPaymentId: payment.id },
      },
      select: {
        status: true,
        amountHalalas: true,
        currency: true,
        safeMetadata: true,
        failureMessage: true,
        configuredMode: true,
      },
    });
    expect(attempt.status).toBe('PAID');
    expect(attempt.amountHalalas).toBe(order.amountHalalas);
    expect(attempt.configuredMode).toBe('TEST');
    expect(JSON.stringify(attempt)).not.toContain('TEST CARDHOLDER');
    expect(JSON.stringify(attempt)).not.toContain('4111');
  });

  it('refuses a payment whose amount does not match the order', async () => {
    const { user, product, order, paymentAttemptId } = await seedOrder(49_900);
    const payment = gatewayPayment({
      amount: 100,
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });
    client.fetchMoyasarPayment.mockResolvedValue(payment);

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'webhook' });

    expect(outcome.outcome).toBe('MISMATCH');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
  });

  it('records the failure reason but grants nothing', async () => {
    const { user, product, order, paymentAttemptId } = await seedOrder();
    const payment = gatewayPayment({
      status: 'failed',
      amount: order.amountHalalas,
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
      source: { type: 'creditcard', message: 'Insufficient Funds' },
    });
    client.fetchMoyasarPayment.mockResolvedValue(payment);

    const outcome = await reconcilePayment({ paymentId: payment.id, source: 'callback' });

    expect(outcome.outcome).toBe('FAILED');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: {
        provider_providerPaymentId: { provider: 'MOYASAR', providerPaymentId: payment.id },
      },
      select: { failureCode: true, failureMessage: true },
    });
    expect(attempt.failureCode).toBe('failed');
    expect(attempt.failureMessage).toBe('Insufficient Funds');
  });

  it('revokes access when the gateway reports a full refund', async () => {
    const { user, product, order, paymentAttemptId } = await seedOrder();
    const metadata = { order_id: order.id, payment_attempt_id: paymentAttemptId };
    const paid = gatewayPayment({ amount: order.amountHalalas, metadata });

    client.fetchMoyasarPayment.mockResolvedValue(paid);
    await reconcilePayment({ paymentId: paid.id, source: 'callback' });

    client.fetchMoyasarPayment.mockResolvedValue({
      ...paid,
      status: 'refunded',
      refunded: order.amountHalalas,
    });
    const outcome = await reconcilePayment({ paymentId: paid.id, source: 'webhook' });

    expect(outcome.outcome).toBe('REVOKED');
    expect((await entitlementFacts(user.id, product.id)).entitlement?.status).toBe('REVOKED');
  });

  it('refuses to guess at a status it does not model', async () => {
    const { order, paymentAttemptId } = await seedOrder();
    client.fetchMoyasarPayment.mockResolvedValue(
      gatewayPayment({
        status: 'settled',
        amount: order.amountHalalas,
        metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
      }),
    );

    await expect(
      reconcilePayment({ paymentId: 'pay_unknown_status', source: 'scheduler' }),
    ).rejects.toBeInstanceOf(UnknownPaymentStatusError);
  });

  it('reports an unknown payment when the gateway has none', async () => {
    client.fetchMoyasarPayment.mockResolvedValue(null);

    const outcome = await reconcilePayment({ paymentId: 'pay_missing', source: 'scheduler' });
    expect(outcome.outcome).toBe('UNKNOWN_PAYMENT');
  });
});
