import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The orders administration routes, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. The origin check, the Zod schemas, the
 * service, the reconciliation path, the audit writes and the database are all
 * real, because every property worth asserting here is a property of the whole
 * request pipeline:
 *
 *   - a student is refused;
 *   - re-checking an order never edits the amount that was agreed;
 *   - the platform records the administrator's *request* and lets the provider's
 *     answer be recorded separately;
 *   - a partial refund does not silently withdraw access — it raises a flag and
 *     stops.
 *
 * Asserting any of those one layer below the route would prove nothing about the
 * route.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: '',
    name: 'مسؤول',
    role: 'ADMIN' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      return session.user;
    },
    // Deliberately the real rule rather than a pass-through: "a student is
    // refused" is one of the things this file exists to prove.
    requireAdmin: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      if (session.user.role !== 'ADMIN') {
        throw new actual.HttpError(403, 'forbidden', 'forbidden');
      }
      return session.user;
    },
  };
});

import { prisma } from '@/lib/db';
import { attachProviderPayment, createOrder } from '@/services/payments/order.service';
import {
  createMockPayment,
  mockPaymentProvider,
  resetMockPaymentsForTests,
} from '@/services/payments/providers/mock.provider';

const ORIGIN = 'http://localhost:3000';

/** Scopes every row this file creates, so parallel workers never collide. */
const RUN = randomUUID().slice(0, 8);

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdWebhookIds: string[] = [];

type Envelope<T = Record<string, unknown>> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string> };
};

function mutation(path: string, origin = ORIGIN) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
  });
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email: `admin-orders-${randomUUID()}@example.test`,
      name: 'حساب اختبار',
      passwordHash: 'not-a-real-hash',
      role,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

async function createStudent() {
  const user = await prisma.user.create({
    data: {
      email: `order-student-${randomUUID()}@example.test`,
      name: `طالب ${RUN}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function createProduct(priceHalalas = 49_900) {
  const slug = `admin-orders-${randomUUID()}`;
  const product = await prisma.product.create({
    data: {
      type: 'COURSE',
      slug,
      title: `منتج طلبات ${RUN}`,
      shortDescription: 'وصف مختصر لمنتج اختباري.',
      status: 'PUBLISHED',
      priceHalalas,
      currency: 'SAR',
      publishedAt: new Date(),
      course: { create: {} },
    },
    select: { id: true, priceHalalas: true },
  });
  createdProductIds.push(product.id);
  return product;
}

/** An order with a mock gateway payment already bound to it. */
async function seedPaidCheckout(
  options: { priceHalalas?: number; rawStatus?: 'paid' | 'failed'; amountHalalas?: number } = {},
) {
  const student = await createStudent();
  const product = await createProduct(options.priceHalalas ?? 49_900);

  const { order, paymentAttemptId } = await createOrder({
    userId: student.id,
    productId: product.id,
    checkoutRequestKey: randomUUID(),
  });

  const payment = createMockPayment({
    rawStatus: options.rawStatus ?? 'paid',
    amountHalalas: options.amountHalalas ?? order.amountHalalas,
    currency: 'SAR',
    metadata: { order_id: order.id, payment_attempt_id: paymentAttemptId },
  });
  await attachProviderPayment({ orderId: order.id, paymentId: payment.id });

  return { student, product, order, payment };
}

/** An order that never reached the gateway. */
async function seedUnpaidCheckout() {
  const student = await createStudent();
  const product = await createProduct();
  const { order } = await createOrder({
    userId: student.id,
    productId: product.id,
    checkoutRequestKey: randomUUID(),
  });
  return { student, product, order };
}

async function getOrders(query = '') {
  const { GET } = await import('@/app/api/admin/orders/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/orders${query}`));
  return {
    response,
    payload: (await response.json()) as Envelope<{
      rows: Array<{ id: string; needsReview: boolean; paymentStatus: string | null }>;
      total: number;
      page: number;
      perPage: number;
    }>,
  };
}

async function getOrder(orderId: string) {
  const { GET } = await import('@/app/api/admin/orders/[orderId]/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/orders/${orderId}`), {
    params: Promise.resolve({ orderId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function reconcile(orderId: string, origin = ORIGIN) {
  const { POST } = await import('@/app/api/admin/orders/[orderId]/reconcile/route');
  const response = await POST(mutation(`/api/admin/orders/${orderId}/reconcile`, origin), {
    params: Promise.resolve({ orderId }),
  });
  return {
    response,
    payload: (await response.json()) as Envelope<{
      outcome: string;
      orderStatus: string;
      changed: boolean;
    }>,
  };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE orders` here would
 * delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  resetMockPaymentsForTests();

  const orders = await prisma.order.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: { in: orderIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { userId: { in: createdUserIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.webhookEvent.deleteMany({ where: { id: { in: createdWebhookIds } } });
  await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.course.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('GET /api/admin/orders', () => {
  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await getOrders();
    expect(response.status).toBe(403);
  });

  it('finds an order by the student address and by its full id', async () => {
    await signInAs('ADMIN');
    const { student, order } = await seedPaidCheckout();

    const byEmail = await getOrders(`?q=${encodeURIComponent(student.email)}`);
    expect(byEmail.payload.data?.total).toBe(1);
    expect(byEmail.payload.data?.rows[0]?.id).toBe(order.id);

    // The id pasted out of a support conversation finds its own row.
    const byId = await getOrders(`?q=${order.id}`);
    expect(byId.payload.data?.total).toBe(1);
    expect(byId.payload.data?.rows[0]?.id).toBe(order.id);
  });

  it('filters by order status on the server', async () => {
    await signInAs('ADMIN');
    const { student, order } = await seedPaidCheckout();

    const pending = await getOrders(
      `?q=${encodeURIComponent(student.email)}&status=PENDING_PAYMENT`,
    );
    expect(pending.payload.data?.total).toBe(1);

    await reconcile(order.id);

    const paid = await getOrders(`?q=${encodeURIComponent(student.email)}&status=PAID`);
    expect(paid.payload.data?.total).toBe(1);
    expect(paid.payload.data?.rows[0]?.paymentStatus).toBe('PAID');

    const stillPending = await getOrders(
      `?q=${encodeURIComponent(student.email)}&status=PENDING_PAYMENT`,
    );
    expect(stillPending.payload.data?.total).toBe(0);
  });

  it('narrows to the payments a human still has to decide about', async () => {
    await signInAs('ADMIN');
    const { student, order, payment } = await seedPaidCheckout({ priceHalalas: 40_000 });

    await reconcile(order.id);

    // Half the money back at the provider. Access is deliberately *not*
    // withdrawn by a partial refund — that is a commercial judgement — so the
    // attempt is flagged and the flag is what the filter exists to surface.
    await mockPaymentProvider.refund({ paymentId: payment.id, amountHalalas: 20_000 });
    const second = await reconcile(order.id);
    expect(second.payload.data?.outcome).toBe('NEEDS_REVIEW');

    const flagged = await getOrders(`?q=${encodeURIComponent(student.email)}&needsReview=true`);
    expect(flagged.payload.data?.total).toBe(1);
    expect(flagged.payload.data?.rows[0]?.needsReview).toBe(true);

    // Nothing was withdrawn behind the administrator's back.
    const entitlement = await prisma.entitlement.findFirstOrThrow({
      where: { userId: student.id },
      select: { status: true },
    });
    expect(entitlement.status).toBe('ACTIVE');
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getOrders(
      '?page=abc&status=nonsense&perPage=99999&from=not-a-date',
    );

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });
});

describe('GET /api/admin/orders/[orderId]', () => {
  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const { order } = await seedUnpaidCheckout();

    await signInAs('STUDENT');
    const { response } = await getOrder(order.id);
    expect(response.status).toBe(403);
  });

  it('answers a malformed id with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getOrder('not-a-uuid');
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('order_not_found');
  });

  it('answers an unknown order with 404', async () => {
    await signInAs('ADMIN');
    const { response } = await getOrder(randomUUID());
    expect(response.status).toBe(404);
  });

  it('reports the payment story and never the provider metadata values', async () => {
    await signInAs('ADMIN');
    const { order } = await seedPaidCheckout();
    await reconcile(order.id);

    const { response, payload } = await getOrder(order.id);
    expect(response.status).toBe(200);

    const detail = payload.data as {
      amountHalalas: number;
      payments: Array<{ status: string; safeMetadataKeys: string[] }>;
      entitlement: { status: string; fromThisOrder: boolean } | null;
      entitlementEvents: Array<{ type: string }>;
    };

    expect(detail.payments.some((payment) => payment.status === 'PAID')).toBe(true);
    // Only the reference *names* are carried, never a stored provider value.
    expect(Array.isArray(detail.payments[0]?.safeMetadataKeys)).toBe(true);
    // The provider's own diagnostic text is kept server-side. The whole payload
    // is searched rather than one field, because the way it would leak is a
    // column riding along in a spread rather than a deliberate addition.
    expect(JSON.stringify(payload)).not.toContain('failureMessage');
    expect(detail.entitlement?.status).toBe('ACTIVE');
    expect(detail.entitlement?.fromThisOrder).toBe(true);
    expect(detail.entitlementEvents.map((event) => event.type)).toContain('GRANTED');
  });

  /**
   * `WebhookEvent.lastError` is a raw `Error.message` captured from *any* throw
   * during processing, not only a domain refusal — a driver failure puts the
   * database host, port and account name into that column. It used to be
   * selected into `AdminWebhookRow` and printed verbatim in the webhooks table.
   * The service now reduces it to a boolean, for the same reason it omits
   * `PaymentAttempt.failureMessage` entirely.
   */
  it('reports that a webhook failed without publishing the stored message', async () => {
    await signInAs('ADMIN');
    const { order } = await seedPaidCheckout();

    const secret =
      "Can't reach database server at `db-host.internal:5544`, credentials for `postgres`";
    const webhook = await prisma.webhookEvent.create({
      data: {
        provider: 'MOCK',
        providerEventId: `admin-orders-${randomUUID()}`,
        eventType: 'payment_paid',
        liveMode: false,
        payload: { data: { metadata: { order_id: order.id } } },
        status: 'FAILED',
        attemptCount: 3,
        lastError: secret,
      },
      select: { id: true },
    });
    createdWebhookIds.push(webhook.id);

    const { response, payload } = await getOrder(order.id);
    expect(response.status).toBe(200);

    const detail = payload.data as {
      webhooks: Array<{ status: string; hasError: boolean }>;
    };
    const row = detail.webhooks.find((entry) => entry.status === 'FAILED');
    // The screen still says a delivery failed — that is the actionable part.
    expect(row?.hasError).toBe(true);

    // The whole payload is searched rather than one field, because the way it
    // would leak is a column riding along in a spread rather than a deliberate
    // addition.
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain('db-host.internal');
    expect(serialised).not.toContain('lastError');
  });
});

describe('POST /api/admin/orders/[orderId]/reconcile', () => {
  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const { order } = await seedPaidCheckout();

    const { response } = await reconcile(order.id, 'https://attacker.example');

    expect(response.status).toBe(403);
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    expect(stored.status).toBe('PENDING_PAYMENT');
  });

  it('answers a signed-in student with 403 and changes nothing', async () => {
    await signInAs('ADMIN');
    const { order } = await seedPaidCheckout();

    await signInAs('STUDENT');
    const { response } = await reconcile(order.id);

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { status: true },
        })
      ).status,
    ).toBe('PENDING_PAYMENT');
  });

  it('refuses an order that never reached the gateway, and says why', async () => {
    await signInAs('ADMIN');
    const { order } = await seedUnpaidCheckout();

    const { response, payload } = await reconcile(order.id);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('order_no_payment_attempt');
    // Nothing was requested, so nothing was recorded.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Order', targetId: order.id, action: 'order.reconcile_requested' },
      }),
    ).toBe(0);
  });

  it('opens access, and leaves two audit rows: the request and the answer', async () => {
    const admin = await signInAs('ADMIN');
    const { student, product, order } = await seedPaidCheckout();

    const { response, payload } = await reconcile(order.id);

    expect(response.status).toBe(200);
    expect(payload.data?.outcome).toBe('FULFILLED');
    expect(payload.data?.orderStatus).toBe('PAID');
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, paidAt: true, amountHalalas: true },
    });
    expect(stored.status).toBe('PAID');
    expect(stored.paidAt).not.toBeNull();
    // The point of the whole file: re-checking a payment never edits the amount
    // that was agreed at checkout.
    expect(stored.amountHalalas).toBe(product.priceHalalas);

    expect(
      (
        await prisma.entitlement.findUniqueOrThrow({
          where: { userId_productId: { userId: student.id, productId: product.id } },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');

    // The administrator's decision, attributed to them…
    const request = await prisma.auditLog.findFirst({
      where: { targetType: 'Order', targetId: order.id, action: 'order.reconcile_requested' },
      select: { actorId: true, actorEmail: true },
    });
    expect(request?.actorId).toBe(admin.id);
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(request?.actorEmail).toBe(admin.email);

    // …and the provider's answer, recorded separately by the reconcile service.
    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'Order',
          targetId: order.id,
          action: 'payment.reconcile.fulfilled',
        },
      }),
    ).toBe(1);
  });

  it('reports a repeated check as no change instead of granting twice', async () => {
    await signInAs('ADMIN');
    const { student, product, order } = await seedPaidCheckout();

    await reconcile(order.id);
    const second = await reconcile(order.id);

    expect(second.payload.data?.outcome).toBe('ALREADY_FULFILLED');
    expect(second.payload.data?.changed).toBe(false);

    const entitlement = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true },
    });
    expect(
      await prisma.entitlementEvent.count({
        where: { entitlementId: entitlement.id, type: 'GRANTED' },
      }),
    ).toBe(1);

    // Two requests were made, so two requests are recorded — but only one
    // fulfilment, because only one happened.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Order', targetId: order.id, action: 'order.reconcile_requested' },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Order', targetId: order.id, action: 'payment.reconcile.fulfilled' },
      }),
    ).toBe(1);
  });

  it('does not open access when the gateway reports a failure', async () => {
    await signInAs('ADMIN');
    const { student, product, order } = await seedPaidCheckout({ rawStatus: 'failed' });

    const { payload } = await reconcile(order.id);

    expect(payload.data?.outcome).toBe('FAILED');
    expect(payload.data?.changed).toBe(false);
    expect(
      await prisma.entitlement.count({ where: { userId: student.id, productId: product.id } }),
    ).toBe(0);
  });

  it('does not open access when the paid amount disagrees with the order', async () => {
    await signInAs('ADMIN');
    const { student, product, order } = await seedPaidCheckout({
      priceHalalas: 49_900,
      amountHalalas: 100,
    });

    const { payload } = await reconcile(order.id);

    expect(payload.data?.outcome).toBe('MISMATCH');
    expect(
      await prisma.entitlement.count({ where: { userId: student.id, productId: product.id } }),
    ).toBe(0);
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { status: true },
        })
      ).status,
    ).toBe('PENDING_PAYMENT');
  });

  it('exposes no verb that could edit or delete an order', async () => {
    // A structural assertion rather than a behavioural one: the refusal to let
    // an administrator rewrite a receipt is expressed by the handler not
    // existing, and a test for it has to check exactly that.
    const record = await import('@/app/api/admin/orders/[orderId]/route');
    expect(Object.keys(record).sort()).toEqual(['GET', 'runtime']);

    const collection = await import('@/app/api/admin/orders/route');
    expect(Object.keys(collection).sort()).toEqual(['GET', 'runtime']);
  });
});
