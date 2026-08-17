import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Entitlements: who may open what.
 *
 * `Entitlement` is the current-state projection and `EntitlementEvent` is the
 * append-only history. Every transition writes an event, and no transition ever
 * rewrites an earlier one — a refund followed by a repurchase must leave both
 * facts visible, not a single row that has been edited twice.
 *
 * Access is always decided from these rows on the server. Nothing in the
 * browser — not a cookie, not a purchase-success page, not a callback query
 * parameter — is permitted to stand in for them.
 */
export type GrantSource =
  { kind: 'order'; orderId: string } | { kind: 'admin'; actorUserId: string; reason: string };

/** True when the user currently holds active access to the product. */
export async function hasActiveEntitlement(
  userId: string,
  productId: string,
  client: PrismaTransaction = prisma,
): Promise<boolean> {
  const entitlement = await client.entitlement.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { status: true },
  });
  return entitlement?.status === 'ACTIVE';
}

/** Products the user currently holds, for dashboards and catalogue badges. */
export async function listActiveEntitlementProductIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { productId: true },
  });
  return new Set(rows.map((row) => row.productId));
}

/**
 * Grant access, exactly once.
 *
 * Safe to call repeatedly for the same order: a payment callback, a webhook and
 * the reconciliation sweep can all reach this for one payment, and only the
 * first should produce a GRANTED event. Idempotency comes from the unique
 * `(userId, productId)` constraint plus the status check, not from the caller
 * remembering whether it already ran.
 */
export async function grantEntitlement(
  tx: PrismaTransaction,
  input: { userId: string; productId: string; source: GrantSource },
): Promise<{ changed: boolean }> {
  const { userId, productId, source } = input;
  const orderId = source.kind === 'order' ? source.orderId : undefined;
  const actorUserId = source.kind === 'admin' ? source.actorUserId : undefined;
  const reason = source.kind === 'admin' ? source.reason : undefined;

  const existing = await tx.entitlement.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, status: true },
  });

  if (existing?.status === 'ACTIVE') {
    // Already granted. Writing another event here is what would turn a
    // duplicate webhook into duplicate history.
    return { changed: false };
  }

  if (existing) {
    await tx.entitlement.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', revokedAt: null, sourceOrderId: orderId ?? null },
    });
    await tx.entitlementEvent.create({
      data: { entitlementId: existing.id, type: 'REACTIVATED', orderId, actorUserId, reason },
    });
    logger.info('entitlement reactivated', { userId, productId, orderId });
    return { changed: true };
  }

  try {
    const created = await tx.entitlement.create({
      data: {
        userId,
        productId,
        status: 'ACTIVE',
        grantedAt: new Date(),
        sourceOrderId: orderId ?? null,
      },
      select: { id: true },
    });
    await tx.entitlementEvent.create({
      data: { entitlementId: created.id, type: 'GRANTED', orderId, actorUserId, reason },
    });
    logger.info('entitlement granted', { userId, productId, orderId });
    return { changed: true };
  } catch (error) {
    // Two concurrent grants raced past the read above; the constraint caught the
    // loser. The winner already produced the event, so this call is a no-op.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { changed: false };
    }
    throw error;
  }
}

/** Withdraw access, recording why. */
export async function revokeEntitlement(
  tx: PrismaTransaction,
  input: {
    userId: string;
    productId: string;
    reason: string;
    orderId?: string;
    actorUserId?: string;
  },
): Promise<{ changed: boolean }> {
  const existing = await tx.entitlement.findUnique({
    where: { userId_productId: { userId: input.userId, productId: input.productId } },
    select: { id: true, status: true },
  });

  if (!existing || existing.status === 'REVOKED') return { changed: false };

  await tx.entitlement.update({
    where: { id: existing.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await tx.entitlementEvent.create({
    data: {
      entitlementId: existing.id,
      type: 'REVOKED',
      reason: input.reason,
      orderId: input.orderId,
      actorUserId: input.actorUserId,
    },
  });

  logger.info('entitlement revoked', {
    userId: input.userId,
    productId: input.productId,
    orderId: input.orderId,
  });
  return { changed: true };
}
