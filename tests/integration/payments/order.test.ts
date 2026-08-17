import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { HttpError } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { grantEntitlement } from '@/services/access/entitlement';
import { createOrder, OrderConflictError } from '@/services/payments/order.service';
import { createOrderSchema } from '@/validators/commerce';

import { cleanupUsers, createTestProduct, createTestUser } from './helpers';

const createdUserIds: string[] = [];

afterAll(async () => {
  await cleanupUsers(createdUserIds);
});

async function newUser() {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  return user;
}

describe('createOrder idempotency', () => {
  it('returns the same order when the same key is presented twice', async () => {
    const user = await newUser();
    const product = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    const first = await createOrder({ userId: user.id, productId: product.id, checkoutRequestKey });
    const second = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey,
    });

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.order.id).toBe(first.order.id);

    const count = await prisma.order.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  it('rejects a key that was already used for a different product', async () => {
    const user = await newUser();
    const productA = await createTestProduct();
    const productB = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    await createOrder({ userId: user.id, productId: productA.id, checkoutRequestKey });

    await expect(
      createOrder({ userId: user.id, productId: productB.id, checkoutRequestKey }),
    ).rejects.toMatchObject({ code: 'checkout_key_reused', status: 409 });

    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);
  });

  it('answers a paid order with a conflict that points at it', async () => {
    const user = await newUser();
    const product = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    const { order } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const error = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OrderConflictError);
    expect((error as OrderConflictError).details.orderId).toBe(order.id);
  });

  it('creates independent orders for two different keys', async () => {
    const user = await newUser();
    const product = await createTestProduct();

    const first = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });
    const second = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    expect(second.order.id).not.toBe(first.order.id);
  });

  it('serialises a concurrent burst carrying one key into one order', async () => {
    const user = await newUser();
    const product = await createTestProduct();
    const checkoutRequestKey = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createOrder({ userId: user.id, productId: product.id, checkoutRequestKey }),
      ),
    );

    const ids = new Set(results.map((result) => result.order.id));
    expect(ids.size).toBe(1);
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe('createOrder pricing', () => {
  it('copies price, currency, title and type from the product row', async () => {
    const user = await newUser();
    const product = await createTestProduct({ priceHalalas: 123_45, type: 'EXAM_SIMULATOR' });

    const { order } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    expect(order.amountHalalas).toBe(product.priceHalalas);
    expect(order.currency).toBe('SAR');
    expect(order.productTitle).toBe(product.title);
    expect(order.productType).toBe('EXAM_SIMULATOR');
  });

  it('drops money fields a client tries to send', () => {
    const parsed = createOrderSchema.parse({
      productId: randomUUID(),
      checkoutRequestKey: randomUUID(),
      priceHalalas: 1,
      amountHalalas: 1,
      currency: 'USD',
      status: 'PAID',
    });

    expect(parsed).toEqual({
      productId: expect.any(String),
      checkoutRequestKey: expect.any(String),
    });
    expect(Object.keys(parsed)).toHaveLength(2);
  });

  it('records the price at the time of purchase even after the catalogue moves', async () => {
    const user = await newUser();
    const product = await createTestProduct({ priceHalalas: 50_000 });

    const { order } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });
    await prisma.product.update({ where: { id: product.id }, data: { priceHalalas: 90_000 } });

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { amountHalalas: true },
    });
    expect(stored.amountHalalas).toBe(50_000);
  });

  it('writes an initial payment attempt in the same transaction', async () => {
    const user = await newUser();
    const product = await createTestProduct();

    const { order, paymentAttemptId } = await createOrder({
      userId: user.id,
      productId: product.id,
      checkoutRequestKey: randomUUID(),
    });

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: paymentAttemptId },
      select: { orderId: true, status: true, amountHalalas: true, providerPaymentId: true },
    });
    expect(attempt).toMatchObject({
      orderId: order.id,
      status: 'CREATED',
      amountHalalas: order.amountHalalas,
      providerPaymentId: null,
    });
  });
});

describe('createOrder eligibility', () => {
  it('refuses an unpublished product', async () => {
    const user = await newUser();
    const draft = await createTestProduct({ status: 'DRAFT' });

    await expect(
      createOrder({
        userId: user.id,
        productId: draft.id,
        checkoutRequestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'product_not_purchasable', status: 409 });
  });

  it('refuses a product that does not exist', async () => {
    const user = await newUser();

    const error = await createOrder({
      userId: user.id,
      productId: randomUUID(),
      checkoutRequestKey: randomUUID(),
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
  });

  it('refuses a product the student already holds', async () => {
    const user = await newUser();
    const product = await createTestProduct();

    await prisma.$transaction((tx) =>
      grantEntitlement(tx, {
        userId: user.id,
        productId: product.id,
        source: { kind: 'admin', actorUserId: user.id, reason: 'fixture' },
      }),
    );

    await expect(
      createOrder({
        userId: user.id,
        productId: product.id,
        checkoutRequestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'already_owned', status: 409 });
  });
});
