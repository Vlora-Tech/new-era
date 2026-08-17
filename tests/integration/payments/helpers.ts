import { randomUUID } from 'node:crypto';

import type { ProductStatus, ProductType } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Fixtures for the commerce integration suite.
 *
 * Every fixture is uniquely named and torn down by id rather than by truncating
 * shared tables. Vitest runs files in parallel workers against one test
 * database, and a `TRUNCATE users` in one file would delete another file's
 * fixtures mid-assertion.
 */
export type TestUser = { id: string; email: string };
export type TestProduct = { id: string; priceHalalas: number; title: string };

export async function createTestUser(role: 'STUDENT' | 'ADMIN' = 'STUDENT'): Promise<TestUser> {
  const email = `commerce-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'طالب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  return user;
}

export async function createTestProduct(
  overrides: {
    status?: ProductStatus;
    type?: ProductType;
    priceHalalas?: number;
  } = {},
): Promise<TestProduct> {
  const slug = `commerce-${randomUUID()}`;
  return prisma.product.create({
    data: {
      type: overrides.type ?? 'COURSE',
      slug,
      title: `منتج اختبار ${slug.slice(-8)}`,
      shortDescription: 'وصف مختصر لمنتج اختباري.',
      status: overrides.status ?? 'PUBLISHED',
      priceHalalas: overrides.priceHalalas ?? 49_900,
      currency: 'SAR',
      publishedAt: new Date(),
    },
    select: { id: true, priceHalalas: true, title: true },
  });
}

/** Remove everything a single test user produced, deepest edge first. */
export async function cleanupUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { userId: { in: userIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.consentRecord.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** Count the entitlement rows and GRANTED events a user holds for a product. */
export async function entitlementFacts(userId: string, productId: string) {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, status: true },
  });

  const grantedEvents = entitlement
    ? await prisma.entitlementEvent.count({
        where: { entitlementId: entitlement.id, type: 'GRANTED' },
      })
    : 0;

  return { entitlement, grantedEvents };
}
