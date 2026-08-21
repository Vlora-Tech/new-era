import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { getCourseDetail } from '@/services/catalog/product-detail';

import { cleanupLessonQuizFixtures, createLessonQuizFixture } from './helpers';

/**
 * Which side panel a product page shows.
 *
 * The decision used to be a boolean, and the page it fed kept a price and
 * «شراء لمرة واحدة» in front of somebody who had already paid. These cases pin
 * the three states apart, including the two that are easy to get wrong: a
 * refunded entitlement is buyable again, and an unpaid order takes precedence
 * over the buy panel so a second order cannot be opened beside the first.
 */

afterAll(async () => {
  await cleanupLessonQuizFixtures();
});

async function createOrder(
  userId: string,
  productId: string,
  status: 'PENDING_PAYMENT' | 'FAILED',
) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { type: true, title: true, priceHalalas: true },
  });

  return prisma.order.create({
    data: {
      userId,
      productId,
      productType: product.type,
      productTitle: product.title,
      amountHalalas: product.priceHalalas,
      status,
      provider: 'MOCK',
      checkoutRequestKey: randomUUID(),
    },
    select: { id: true },
  });
}

async function detailFor(slugSource: { productId: string }, viewerId: string | null) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: slugSource.productId },
    select: { slug: true },
  });
  return getCourseDetail(product.slug, viewerId);
}

describe('purchase state', () => {
  it('is available to a signed-out visitor', async () => {
    const fixture = await createLessonQuizFixture({ entitled: false });
    const detail = await detailFor(fixture, null);

    expect(detail?.purchase.kind).toBe('available');
    expect(detail?.hasAccess).toBe(false);
    expect(detail?.ownerProgress).toBeNull();
  });

  it('is owned once an entitlement is active, and carries the way in', async () => {
    const fixture = await createLessonQuizFixture();
    const detail = await detailFor(fixture, fixture.userId);

    expect(detail?.purchase.kind).toBe('owned');
    expect(detail?.hasAccess).toBe(true);
    expect(detail?.ownerProgress).toEqual({
      completedCount: 0,
      totalCount: 1,
      resumeLessonId: fixture.lessonId,
      hasUnfinished: true,
    });
  });

  it('reports a finished course as finished rather than as unstarted', async () => {
    const fixture = await createLessonQuizFixture();
    await prisma.lessonProgress.create({
      data: {
        userId: fixture.userId,
        lessonId: fixture.lessonId,
        completed: true,
        completedAt: new Date(),
      },
    });

    const detail = await detailFor(fixture, fixture.userId);
    expect(detail?.ownerProgress).toEqual({
      completedCount: 1,
      totalCount: 1,
      // Still openable: a finished course has to be re-readable.
      resumeLessonId: fixture.lessonId,
      hasUnfinished: false,
    });
  });

  it('hands back an unpaid order instead of offering to open a second one', async () => {
    const fixture = await createLessonQuizFixture({ entitled: false });
    const order = await createOrder(fixture.userId, fixture.productId, 'PENDING_PAYMENT');

    const detail = await detailFor(fixture, fixture.userId);
    expect(detail?.purchase).toMatchObject({ kind: 'pending-order', orderId: order.id });
  });

  it('treats a failed order as buyable again, not as mid-payment', async () => {
    const fixture = await createLessonQuizFixture({ entitled: false });
    await createOrder(fixture.userId, fixture.productId, 'FAILED');

    const detail = await detailFor(fixture, fixture.userId);
    expect(detail?.purchase.kind).toBe('available');
  });

  it('lets ownership win over an order left unpaid', async () => {
    const fixture = await createLessonQuizFixture();
    await createOrder(fixture.userId, fixture.productId, 'PENDING_PAYMENT');

    const detail = await detailFor(fixture, fixture.userId);
    expect(detail?.purchase.kind).toBe('owned');
  });

  it('returns a revoked entitlement to the buy panel', async () => {
    const fixture = await createLessonQuizFixture();
    await prisma.entitlement.update({
      where: { userId_productId: { userId: fixture.userId, productId: fixture.productId } },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    const detail = await detailFor(fixture, fixture.userId);
    expect(detail?.purchase.kind).toBe('available');
    expect(detail?.hasAccess).toBe(false);
    expect(detail?.ownerProgress).toBeNull();
  });
});
