import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { resetEnvCacheForTests } from '@/lib/env';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
import {
  createMockPayment,
  resetMockPaymentsForTests,
} from '@/services/payments/providers/mock.provider';

import { cleanupUsers, createTestProduct, createTestUser, entitlementFacts } from './helpers';

/**
 * The webhook is the only commerce endpoint that authenticates by shared secret
 * rather than by session, so it is tested through the route itself: the secret
 * comparison, the mode check, deduplication and payload minimisation are all
 * properties of the handler, not of a service beneath it.
 */
const SECRET = 'webhook-secret-for-tests-0123456789';

const mutableEnv = process.env as Record<string, string | undefined>;
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

beforeAll(() => {
  mutableEnv.MOYASAR_WEBHOOK_SECRET_TOKEN = SECRET;
  mutableEnv.MOYASAR_MODE = 'test';
  resetEnvCacheForTests();
});

afterEach(() => {
  resetMockPaymentsForTests();
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { providerEventId: { in: createdEventIds } } });
  await cleanupUsers(createdUserIds);
  delete mutableEnv.MOYASAR_WEBHOOK_SECRET_TOKEN;
  resetEnvCacheForTests();
});

type EnvelopeOverrides = {
  id?: string;
  type?: string;
  live?: boolean;
  secret_token?: string | null;
  data?: Record<string, unknown>;
};

function envelope(overrides: EnvelopeOverrides = {}) {
  const eventId = overrides.id ?? `evt_${randomUUID()}`;
  createdEventIds.push(eventId);

  const body: Record<string, unknown> = {
    id: eventId,
    type: overrides.type ?? 'payment_paid',
    created_at: '2026-08-17T09:00:00Z',
    account_name: 'New Era',
    live: overrides.live ?? false,
    data: {
      id: `mock_pay_${randomUUID().replace(/-/g, '')}`,
      status: 'paid',
      amount: 49_900,
      currency: 'SAR',
      // Present in real deliveries and deliberately not stored.
      source: { type: 'creditcard', company: 'visa', name: 'TEST CARDHOLDER', number: '4111' },
      ...overrides.data,
    },
  };

  if (overrides.secret_token !== null) body.secret_token = overrides.secret_token ?? SECRET;
  return { eventId, body };
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/webhooks/moyasar/route');
  return POST(
    new Request('http://localhost:3000/api/webhooks/moyasar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function storedEvent(providerEventId: string) {
  return prisma.webhookEvent.findUnique({
    where: { provider_providerEventId: { provider: 'MOYASAR', providerEventId } },
  });
}

describe('webhook authentication', () => {
  it('rejects a wrong secret with 401 and stores nothing', async () => {
    const { eventId, body } = envelope({ secret_token: 'not-the-secret' });

    const response = await post(body);

    expect(response.status).toBe(401);
    expect(await storedEvent(eventId)).toBeNull();
  });

  it('rejects a missing secret', async () => {
    const { eventId, body } = envelope({ secret_token: null });

    const response = await post(body);

    expect(response.status).toBe(401);
    expect(await storedEvent(eventId)).toBeNull();
  });
});

describe('webhook envelope handling', () => {
  it('ignores an event whose live flag does not match the configured mode', async () => {
    const { eventId, body } = envelope({ live: true });

    const response = await post(body);
    const payload = (await response.json()) as { ok: boolean; data: { status: string } };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('IGNORED');

    const stored = await storedEvent(eventId);
    expect(stored?.status).toBe('IGNORED');
    expect(stored?.liveMode).toBe(true);
  });

  it('acknowledges an unknown event type without acting on it', async () => {
    const { eventId, body } = envelope({ type: 'invoice_something_new' });

    const response = await post(body);
    const payload = (await response.json()) as { ok: boolean; data: { status: string } };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('IGNORED');
    expect((await storedEvent(eventId))?.status).toBe('IGNORED');
  });

  it('strips the shared secret and the card source before storing the payload', async () => {
    const { eventId, body } = envelope({ type: 'invoice_unknown_type' });

    await post(body);
    const stored = await storedEvent(eventId);
    const serialised = JSON.stringify(stored?.payload);

    expect(serialised).not.toContain(SECRET);
    expect(serialised).not.toContain('secret_token');
    expect(serialised).not.toContain('TEST CARDHOLDER');
    expect(serialised).not.toContain('source');
  });

  it('records a duplicate event id exactly once', async () => {
    const { eventId, body } = envelope({ type: 'invoice_unknown_type' });

    const first = await post(body);
    const second = await post(body);
    const secondPayload = (await second.json()) as { data: { status: string } };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondPayload.data.status).toBe('DUPLICATE');

    const rows = await prisma.webhookEvent.count({
      where: { provider: 'MOYASAR', providerEventId: eventId },
    });
    expect(rows).toBe(1);
  });

  it('falls back to a digest when the envelope carries no event id', async () => {
    const { body } = envelope({ type: 'invoice_unknown_type' });
    delete (body as Record<string, unknown>).id;

    await post(body);
    await post(body);

    const rows = await prisma.webhookEvent.findMany({
      where: { providerEventId: { startsWith: 'digest_' }, eventType: 'invoice_unknown_type' },
      select: { id: true, providerEventId: true },
    });
    createdEventIds.push(...rows.map((row) => row.providerEventId));

    expect(rows).toHaveLength(1);
  });

  it('rejects a body that is not a recognisable event', async () => {
    const response = await post({ nothing: 'useful' });
    expect(response.status).toBe(400);
  });
});

describe('webhook fulfilment', () => {
  it('fulfils from the gateway record, not from the payload it was sent', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const product = await createTestProduct({ priceHalalas: 49_900 });

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

    const { eventId, body } = envelope({
      type: 'payment_paid',
      data: { id: payment.id, amount: order.amountHalalas },
    });

    const response = await post(body);
    const payload = (await response.json()) as { data: { status: string; outcome: string } };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('PROCESSED');
    expect(payload.data.outcome).toBe('FULFILLED');
    expect((await storedEvent(eventId))?.status).toBe('PROCESSED');

    const facts = await entitlementFacts(user.id, product.id);
    expect(facts.entitlement?.status).toBe('ACTIVE');
    expect(facts.grantedEvents).toBe(1);
  });

  it('grants nothing when the payload claims a payment the gateway does not have', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const product = await createTestProduct();

    const { order } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    const { body } = envelope({
      type: 'payment_paid',
      data: { id: 'mock_pay_never_created', metadata: { order_id: order.id } },
    });

    const response = await post(body);
    const payload = (await response.json()) as { data: { outcome: string } };

    expect(payload.data.outcome).toBe('UNKNOWN_PAYMENT');
    expect((await entitlementFacts(user.id, product.id)).entitlement).toBeNull();
  });

  it('accepts the gateway spelling "payment_faild" as an actionable failure', async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const product = await createTestProduct();

    const { order, paymentAttemptId } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    const payment = createMockPayment({
      rawStatus: 'failed',
      amountHalalas: order.amountHalalas,
      currency: 'SAR',
      metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
    });

    const { eventId, body } = envelope({
      type: 'payment_faild',
      data: { id: payment.id, status: 'failed' },
    });

    const response = await post(body);
    const payload = (await response.json()) as { data: { status: string; outcome: string } };

    expect(payload.data.status).toBe('PROCESSED');
    expect(payload.data.outcome).toBe('FAILED');
    expect((await storedEvent(eventId))?.status).toBe('PROCESSED');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('FAILED');
  });
});
