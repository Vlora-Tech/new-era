import type { PrismaClient } from '@prisma/client';

/**
 * Development commerce fixtures.
 *
 * Gives the local dashboard something truthful to render: one paid order that
 * really did grant an entitlement, one still awaiting payment, and one that
 * failed. Every row goes through the same shape the real flow produces —
 * including the append-only entitlement event — so the screens are exercised
 * against realistic data rather than against a special case.
 *
 * Development only. The seed refuses to run when NODE_ENV is production.
 */
export async function seedCommerceFixtures(
  prisma: PrismaClient,
  options: { studentId: string | null },
): Promise<void> {
  if (!options.studentId) {
    console.log('  orders: skipped (no development student)');
    return;
  }

  const studentId = options.studentId;

  // Targeted by slug rather than by "whichever published product sorts first".
  // A database that also holds rows from an integration run would otherwise hand
  // the development student an entitlement on a stray test product.
  const PAID_SLUG = 'qudurat-simulator-scientific';
  const PENDING_SLUG = 'qudurat-verbal-foundations';

  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', slug: { in: [PAID_SLUG, PENDING_SLUG] } },
    select: { id: true, slug: true, title: true, type: true, priceHalalas: true },
  });

  const paidProduct = products.find((product) => product.slug === PAID_SLUG);
  const pendingProduct = products.find((product) => product.slug === PENDING_SLUG) ?? paidProduct;

  if (!paidProduct || !pendingProduct) {
    console.log('  orders: skipped (the seeded products are not published)');
    return;
  }

  // Deterministic keys so re-running converges instead of adding another order.
  const fixtures = [
    { key: '00000000-0000-4000-8000-000000000001', product: paidProduct, status: 'PAID' as const },
    {
      key: '00000000-0000-4000-8000-000000000002',
      product: pendingProduct,
      status: 'PENDING_PAYMENT' as const,
    },
    {
      key: '00000000-0000-4000-8000-000000000003',
      product: paidProduct,
      status: 'FAILED' as const,
    },
  ];

  for (const fixture of fixtures) {
    const existing = await prisma.order.findUnique({
      where: { userId_checkoutRequestKey: { userId: studentId, checkoutRequestKey: fixture.key } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.order.create({
      data: {
        id: undefined,
        userId: studentId,
        productId: fixture.product.id,
        productType: fixture.product.type,
        productTitle: fixture.product.title,
        // Price is snapshotted from the product, exactly as the real flow does.
        amountHalalas: fixture.product.priceHalalas,
        currency: 'SAR',
        status: fixture.status,
        provider: 'MOCK',
        checkoutRequestKey: fixture.key,
        paidAt: fixture.status === 'PAID' ? new Date() : null,
        failedAt: fixture.status === 'FAILED' ? new Date() : null,
        paymentAttempts: {
          create: {
            provider: 'MOCK',
            configuredMode: 'TEST',
            status:
              fixture.status === 'PAID'
                ? 'PAID'
                : fixture.status === 'FAILED'
                  ? 'FAILED'
                  : 'INITIATED',
            amountHalalas: fixture.product.priceHalalas,
            currency: 'SAR',
            failureMessage: fixture.status === 'FAILED' ? 'رُفضت العملية من البنك.' : null,
          },
        },
      },
    });
  }

  // The paid order is what grants access, and the grant is recorded as an event
  // rather than only as a status, matching the real fulfilment path.
  const paidOrder = await prisma.order.findUnique({
    where: {
      userId_checkoutRequestKey: { userId: studentId, checkoutRequestKey: fixtures[0]!.key },
    },
    select: { id: true },
  });

  const existingEntitlement = await prisma.entitlement.findUnique({
    where: { userId_productId: { userId: studentId, productId: paidProduct.id } },
    select: { id: true },
  });

  if (!existingEntitlement) {
    const entitlement = await prisma.entitlement.create({
      data: {
        userId: studentId,
        productId: paidProduct.id,
        status: 'ACTIVE',
        grantedAt: new Date(),
        sourceOrderId: paidOrder?.id ?? null,
      },
      select: { id: true },
    });

    await prisma.entitlementEvent.create({
      data: { entitlementId: entitlement.id, type: 'GRANTED', orderId: paidOrder?.id ?? null },
    });
  }

  console.log(`  orders: 3 development orders, 1 entitlement on "${paidProduct.title}"`);
}
