import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The order routes, exercised through the handlers themselves.
 *
 * Only the session guards are stubbed — everything else is real, including the
 * Zod schemas, the origin check, the rate limiter and the database. That is the
 * point: "the server ignores a price sent by the client" is a property of the
 * request pipeline, and asserting it one layer below the route would prove
 * nothing about the route.
 */
const session = vi.hoisted(() => ({
  user: { id: '', email: '', name: 'طالب', role: 'STUDENT' as 'STUDENT' | 'ADMIN' },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => session.user,
    requireStudent: async () => session.user,
  };
});

import { prisma } from '@/lib/db';
import { resetMemoryBucketsForTests } from '@/lib/security/rate-limit';
import {
  createMockPayment,
  resetMockPaymentsForTests,
} from '@/services/payments/providers/mock.provider';

import { cleanupUsers, createTestProduct, createTestUser, entitlementFacts } from './helpers';

const ORIGIN = 'http://localhost:3000';
const createdUserIds: string[] = [];

beforeEach(() => {
  resetMemoryBucketsForTests();
  resetMockPaymentsForTests();
});

afterAll(async () => {
  await cleanupUsers(createdUserIds);
});

async function signIn() {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'طالب', role: 'STUDENT' };
  return user;
}

function jsonRequest(path: string, body: unknown, origin: string = ORIGIN) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

type Envelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

async function postOrder(body: unknown) {
  const { POST } = await import('@/app/api/orders/route');
  const response = await POST(jsonRequest('/api/orders', body));
  return { response, payload: (await response.json()) as Envelope };
}

describe('POST /api/orders', () => {
  it('ignores a price the client tried to set', async () => {
    await signIn();
    const product = await createTestProduct({ priceHalalas: 49_900 });

    const { response, payload } = await postOrder({
      productId: product.id,
      checkoutRequestKey: randomUUID(),
      // None of these exist in the schema, and none of them may reach the order.
      priceHalalas: 1,
      amountHalalas: 1,
      currency: 'USD',
      status: 'PAID',
    });

    expect(response.status).toBe(200);
    expect(payload.data?.amountHalalas).toBe(49_900);
    expect(payload.data?.currency).toBe('SAR');
    expect(payload.data?.status).toBe('PENDING_PAYMENT');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: payload.data?.orderId as string },
      select: { amountHalalas: true, currency: true, status: true },
    });
    expect(stored).toEqual({ amountHalalas: 49_900, currency: 'SAR', status: 'PENDING_PAYMENT' });
  });

  it('returns the same order for a repeated idempotency key', async () => {
    await signIn();
    const product = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    const first = await postOrder({ productId: product.id, checkoutRequestKey });
    const second = await postOrder({ productId: product.id, checkoutRequestKey });

    expect(second.payload.data?.orderId).toBe(first.payload.data?.orderId);
    expect(second.payload.data?.reused).toBe(true);
  });

  it('rejects the key being reused for a different product', async () => {
    await signIn();
    const productA = await createTestProduct();
    const productB = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    await postOrder({ productId: productA.id, checkoutRequestKey });
    const { response, payload } = await postOrder({
      productId: productB.id,
      checkoutRequestKey,
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('checkout_key_reused');
  });

  it('rejects a cross-site request before anything is written', async () => {
    const user = await signIn();
    const product = await createTestProduct();

    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      jsonRequest(
        '/api/orders',
        { productId: product.id, checkoutRequestKey: randomUUID() },
        'https://attacker.example',
      ),
    );

    expect(response.status).toBe(403);
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects a malformed body with a validation error', async () => {
    await signIn();
    const { response, payload } = await postOrder({ productId: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('validation_error');
  });
});

describe('payment attach and reconcile routes', () => {
  it('binds a payment id and then fulfils from the gateway record', async () => {
    const user = await signIn();
    const product = await createTestProduct({ priceHalalas: 30_000 });

    const created = await postOrder({ productId: product.id, checkoutRequestKey: randomUUID() });
    const orderId = created.payload.data?.orderId as string;
    const paymentAttemptId = created.payload.data?.paymentAttemptId as string;

    const payment = createMockPayment({
      rawStatus: 'paid',
      amountHalalas: 30_000,
      currency: 'SAR',
      metadata: { order_id: orderId, payment_attempt_id: paymentAttemptId },
    });

    const attach = await import('@/app/api/orders/[orderId]/payments/attach/route');
    const attachResponse = await attach.POST(
      jsonRequest(`/api/orders/${orderId}/payments/attach`, { paymentId: payment.id }),
      { params: Promise.resolve({ orderId }) },
    );
    expect(attachResponse.status).toBe(200);

    const reconcile = await import('@/app/api/orders/[orderId]/payments/reconcile/route');
    const reconcileResponse = await reconcile.POST(
      jsonRequest(`/api/orders/${orderId}/payments/reconcile`, {}),
      { params: Promise.resolve({ orderId }) },
    );
    const reconcilePayload = (await reconcileResponse.json()) as Envelope;

    expect(reconcilePayload.data?.status).toBe('PAID');
    expect((await entitlementFacts(user.id, product.id)).entitlement?.status).toBe('ACTIVE');
  });

  it('will not let a payment id be re-pointed at a second order', async () => {
    await signIn();
    const product = await createTestProduct();

    const first = await postOrder({ productId: product.id, checkoutRequestKey: randomUUID() });
    const second = await postOrder({ productId: product.id, checkoutRequestKey: randomUUID() });
    const firstId = first.payload.data?.orderId as string;
    const secondId = second.payload.data?.orderId as string;

    const payment = createMockPayment({
      rawStatus: 'paid',
      amountHalalas: product.priceHalalas,
      currency: 'SAR',
      metadata: { order_id: firstId },
    });

    const attach = await import('@/app/api/orders/[orderId]/payments/attach/route');
    await attach.POST(
      jsonRequest(`/api/orders/${firstId}/payments/attach`, { paymentId: payment.id }),
      { params: Promise.resolve({ orderId: firstId }) },
    );
    const clash = await attach.POST(
      jsonRequest(`/api/orders/${secondId}/payments/attach`, { paymentId: payment.id }),
      { params: Promise.resolve({ orderId: secondId }) },
    );

    expect(clash.status).toBe(409);
    expect(((await clash.json()) as Envelope).error?.code).toBe('payment_already_attached');
  });

  it('answers a non-owner with 404 rather than confirming the order exists', async () => {
    await signIn();
    const product = await createTestProduct();
    const created = await postOrder({ productId: product.id, checkoutRequestKey: randomUUID() });
    const orderId = created.payload.data?.orderId as string;

    // A different signed-in student asks about it.
    await signIn();

    const attach = await import('@/app/api/orders/[orderId]/payments/attach/route');
    const response = await attach.POST(
      jsonRequest(`/api/orders/${orderId}/payments/attach`, { paymentId: 'mock_pay_whatever' }),
      { params: Promise.resolve({ orderId }) },
    );

    expect(response.status).toBe(404);
  });

  it('refuses to reconcile an order with no payment attached', async () => {
    await signIn();
    const product = await createTestProduct();
    const created = await postOrder({ productId: product.id, checkoutRequestKey: randomUUID() });
    const orderId = created.payload.data?.orderId as string;

    const reconcile = await import('@/app/api/orders/[orderId]/payments/reconcile/route');
    const response = await reconcile.POST(
      jsonRequest(`/api/orders/${orderId}/payments/reconcile`, {}),
      { params: Promise.resolve({ orderId }) },
    );

    expect(response.status).toBe(409);
    expect(((await response.json()) as Envelope).error?.code).toBe('payment_not_attached');
  });
});
