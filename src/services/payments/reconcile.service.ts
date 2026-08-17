import 'server-only';

import type { OrderStatus, PaymentStatus } from '@prisma/client';

import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { grantEntitlement, revokeEntitlement } from '@/services/access/entitlement';

import { decideAccess } from './moyasar-status';
import { canTransitionOrder } from './order.service';
import {
  getPaymentProvider,
  type CanonicalPayment,
  type ReconcileSource,
} from './payment-provider';

/**
 * Verify a payment and fulfil it. The only path that ever opens access.
 *
 * A browser callback, a gateway webhook, the reconciliation sweep, a student
 * pressing "check again" and an administrator acting by hand all arrive here.
 * They differ only in the `source` recorded against the attempt. Nothing any of
 * them says about the payment is believed:
 *
 *  - The canonical payment is fetched from the provider with the server secret.
 *    A callback claiming `status=paid` for a payment the gateway calls `failed`
 *    changes nothing, because the query string is never read.
 *  - The order is located through the provider's own `metadata.order_id`, never
 *    through an id supplied by the caller. A caller can therefore ask for a
 *    payment to be re-checked, but cannot choose which order it fulfils.
 *  - Amount, currency and attempt ownership are compared against the order
 *    before anything is granted. A mismatch is flagged for review and stops.
 *
 * Concurrency is handled by taking a row lock on the order and re-reading its
 * status inside the same transaction. The second of two simultaneous reconciles
 * blocks on the lock, then sees `PAID` and returns `ALREADY_FULFILLED`, so the
 * grant happens exactly once. The unique constraint on `(userId, productId)` in
 * the entitlement table is the backstop if that reasoning is ever wrong.
 */
export type ReconcileOutcome =
  /** Access was opened by this call. */
  | 'FULFILLED'
  /** The order was already paid; this call changed nothing. */
  | 'ALREADY_FULFILLED'
  /** The payment exists but has not settled. No access. */
  | 'PENDING'
  /** The gateway reports the payment failed. No access. */
  | 'FAILED'
  /** Access was withdrawn. */
  | 'REVOKED'
  /** A human must decide. Nothing was granted or withdrawn. */
  | 'NEEDS_REVIEW'
  /** The payment does not match the order it points at. Nothing was granted. */
  | 'MISMATCH'
  /** The provider has no such payment. */
  | 'UNKNOWN_PAYMENT'
  /** The payment carries no usable order reference. */
  | 'UNKNOWN_ORDER';

export type ReconcileResult = {
  outcome: ReconcileOutcome;
  orderId: string | null;
  orderStatus: OrderStatus | null;
  paymentStatus: PaymentStatus | null;
};

export type ReconcileInput = {
  paymentId: string;
  source: ReconcileSource;
  /** Set when an administrator triggered this, for the audit trail. */
  actorUserId?: string;
  requestId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function result(
  outcome: ReconcileOutcome,
  parts: Partial<Omit<ReconcileResult, 'outcome'>> = {},
): ReconcileResult {
  return {
    outcome,
    orderId: parts.orderId ?? null,
    orderStatus: parts.orderStatus ?? null,
    paymentStatus: parts.paymentStatus ?? null,
  };
}

/**
 * Record a payment-side fact in the audit trail.
 *
 * Only identifiers and amounts are written. A gateway payload never reaches
 * this table, and neither does a secret, a token or anything from a card.
 */
async function auditPayment(
  tx: PrismaTransaction,
  input: {
    action: string;
    orderId: string | null;
    actorUserId?: string;
    requestId?: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorUserId ?? null,
      action: input.action,
      targetType: 'Order',
      targetId: input.orderId,
      metadata: input.metadata as never,
      requestId: input.requestId ?? null,
    },
  });
}

/**
 * Write the attempt row for this gateway payment.
 *
 * Upserted on the unique `(provider, providerPaymentId)` pair, so a webhook that
 * arrives before the browser ever attached an id still lands on one row rather
 * than creating a second history for the same payment.
 */
async function upsertAttempt(
  tx: PrismaTransaction,
  input: {
    orderId: string;
    payment: CanonicalPayment;
    configuredMode: 'TEST' | 'LIVE';
    needsReview: boolean;
  },
): Promise<string> {
  const { payment } = input;
  const now = new Date();
  const refundedAt = payment.refundedHalalas > 0 ? now : null;

  const attempt = await tx.paymentAttempt.upsert({
    where: {
      provider_providerPaymentId: {
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
      },
    },
    create: {
      orderId: input.orderId,
      provider: payment.provider,
      configuredMode: input.configuredMode,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      amountHalalas: payment.amountHalalas,
      currency: payment.currency,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      refundedHalalas: payment.refundedHalalas,
      refundedAt,
      needsReview: input.needsReview,
      reconcileCount: 1,
      lastReconciledAt: now,
    },
    update: {
      status: payment.status,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      refundedHalalas: payment.refundedHalalas,
      ...(refundedAt ? { refundedAt } : {}),
      // Review is a latch: once a human is needed, an ordinary reconcile must
      // not clear the flag behind their back.
      ...(input.needsReview ? { needsReview: true } : {}),
      reconcileCount: { increment: 1 },
      lastReconciledAt: now,
    },
    select: { id: true },
  });

  return attempt.id;
}

export async function reconcilePayment(input: ReconcileInput): Promise<ReconcileResult> {
  const provider = getPaymentProvider();

  // Fetched outside the transaction on purpose: a slow gateway must not hold a
  // row lock on the order while it thinks.
  const payment = await provider.reconcile({ paymentId: input.paymentId, source: input.source });

  if (!payment) {
    logger.warn('reconcile: provider has no such payment', {
      paymentId: input.paymentId,
      source: input.source,
      requestId: input.requestId,
    });
    return result('UNKNOWN_PAYMENT');
  }

  const orderId = payment.metadata.order_id;
  if (!orderId || !UUID_PATTERN.test(orderId)) {
    logger.error('reconcile: payment carries no usable order reference', {
      paymentId: payment.providerPaymentId,
      source: input.source,
      requestId: input.requestId,
    });
    return result('UNKNOWN_ORDER', { paymentStatus: payment.status });
  }

  return prisma.$transaction(
    async (tx) => {
    // Serialises concurrent reconciles of the same order. The second caller
    // blocks here and, once through, re-reads a status that already says PAID.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
    `;
    if (locked.length === 0) {
      logger.error('reconcile: order referenced by the payment does not exist', {
        paymentId: payment.providerPaymentId,
        orderId,
        source: input.source,
      });
      return result('UNKNOWN_ORDER', { paymentStatus: payment.status });
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        productId: true,
        amountHalalas: true,
        currency: true,
        status: true,
        provider: true,
      },
    });

    const configuredMode = (
      await tx.paymentAttempt.findFirst({
        where: { orderId: order.id },
        orderBy: { createdAt: 'asc' },
        select: { configuredMode: true },
      })
    )?.configuredMode;

    // ── Verification ────────────────────────────────────────────────────
    const mismatches: string[] = [];
    if (payment.amountHalalas !== order.amountHalalas) mismatches.push('amount');
    if (payment.currency !== 'SAR' || order.currency !== 'SAR') mismatches.push('currency');
    if (payment.provider !== order.provider) mismatches.push('provider');

    // When the payment names an attempt, that attempt must belong to this order.
    // Without this check, metadata copied from someone else's checkout would
    // still pass the amount comparison whenever two products cost the same.
    const claimedAttemptId = payment.metadata.payment_attempt_id;
    if (claimedAttemptId) {
      if (!UUID_PATTERN.test(claimedAttemptId)) {
        mismatches.push('payment_attempt');
      } else {
        const owned = await tx.paymentAttempt.findFirst({
          where: { id: claimedAttemptId, orderId: order.id },
          select: { id: true },
        });
        if (!owned) mismatches.push('payment_attempt');
      }
    }

    if (mismatches.length > 0) {
      // Flagged and recorded, never fulfilled. The attempt row is still written
      // so the evidence of what the gateway reported survives.
      await upsertAttempt(tx, {
        orderId: order.id,
        payment,
        configuredMode: configuredMode ?? 'TEST',
        needsReview: true,
      });
      await auditPayment(tx, {
        action: 'payment.reconcile.mismatch',
        orderId: order.id,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        metadata: {
          source: input.source,
          providerPaymentId: payment.providerPaymentId,
          mismatches,
          expectedAmountHalalas: order.amountHalalas,
          reportedAmountHalalas: payment.amountHalalas,
          expectedCurrency: order.currency,
          reportedCurrency: payment.currency,
          reportedStatus: payment.rawStatus,
        },
      });

      logger.error('reconcile: payment does not match its order', {
        orderId: order.id,
        paymentId: payment.providerPaymentId,
        mismatches,
        source: input.source,
        requestId: input.requestId,
      });

      return result('MISMATCH', {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: payment.status,
      });
    }

    // ── Access decision ─────────────────────────────────────────────────
    const decision = decideAccess(payment.status, payment.amountHalalas, payment.refundedHalalas);

    await upsertAttempt(tx, {
      orderId: order.id,
      payment,
      configuredMode: configuredMode ?? 'TEST',
      needsReview: decision.needsReview,
    });

    if (decision.access === 'GRANT') {
      // The guard that makes fulfilment exactly-once under concurrency.
      if (order.status === 'PAID') {
        return result('ALREADY_FULFILLED', {
          orderId: order.id,
          orderStatus: order.status,
          paymentStatus: payment.status,
        });
      }

      if (!canTransitionOrder(order.status, 'PAID')) {
        await auditPayment(tx, {
          action: 'payment.reconcile.transition_refused',
          orderId: order.id,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          metadata: {
            source: input.source,
            providerPaymentId: payment.providerPaymentId,
            from: order.status,
            to: 'PAID',
          },
        });
        return result('NEEDS_REVIEW', {
          orderId: order.id,
          orderStatus: order.status,
          paymentStatus: payment.status,
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await grantEntitlement(tx, {
        userId: order.userId,
        productId: order.productId,
        source: { kind: 'order', orderId: order.id },
      });
      await auditPayment(tx, {
        action: 'payment.reconcile.fulfilled',
        orderId: order.id,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        metadata: {
          source: input.source,
          providerPaymentId: payment.providerPaymentId,
          amountHalalas: payment.amountHalalas,
          currency: payment.currency,
        },
      });

      logger.info('order fulfilled', {
        orderId: order.id,
        userId: order.userId,
        source: input.source,
        requestId: input.requestId,
      });

      return result(decision.needsReview ? 'NEEDS_REVIEW' : 'FULFILLED', {
        orderId: order.id,
        orderStatus: 'PAID',
        paymentStatus: payment.status,
      });
    }

    if (decision.access === 'REVOKE') {
      const nextStatus: OrderStatus | null =
        order.status === 'PAID'
          ? 'REFUNDED'
          : canTransitionOrder(order.status, 'CANCELLED')
            ? 'CANCELLED'
            : null;

      if (nextStatus) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            ...(nextStatus === 'REFUNDED'
              ? { refundedAt: new Date() }
              : { cancelledAt: new Date() }),
          },
        });
      }

      await revokeEntitlement(tx, {
        userId: order.userId,
        productId: order.productId,
        orderId: order.id,
        actorUserId: input.actorUserId,
        reason: `payment ${payment.rawStatus} (${input.source})`,
      });
      await auditPayment(tx, {
        action: 'payment.reconcile.revoked',
        orderId: order.id,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        metadata: {
          source: input.source,
          providerPaymentId: payment.providerPaymentId,
          reportedStatus: payment.rawStatus,
          refundedHalalas: payment.refundedHalalas,
        },
      });

      return result('REVOKED', {
        orderId: order.id,
        orderStatus: nextStatus ?? order.status,
        paymentStatus: payment.status,
      });
    }

    // ── No access change ────────────────────────────────────────────────
    if (decision.needsReview) {
      await auditPayment(tx, {
        action: 'payment.reconcile.needs_review',
        orderId: order.id,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        metadata: {
          source: input.source,
          providerPaymentId: payment.providerPaymentId,
          reason: decision.reviewReason,
          reportedStatus: payment.rawStatus,
          amountHalalas: payment.amountHalalas,
          refundedHalalas: payment.refundedHalalas,
        },
      });
      return result('NEEDS_REVIEW', {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: payment.status,
      });
    }

    if (payment.status === 'FAILED') {
      // Only a still-open order is closed by a failure. An order that is already
      // paid keeps its status: a failed first attempt followed by a successful
      // second one is the ordinary shape of a retried checkout, and its late
      // notice must not undo the payment that worked.
      if (canTransitionOrder(order.status, 'FAILED')) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'FAILED', failedAt: new Date() },
        });
        return result('FAILED', {
          orderId: order.id,
          orderStatus: 'FAILED',
          paymentStatus: payment.status,
        });
      }
      return result('FAILED', {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: payment.status,
      });
    }

    // Initiated, authorised, verified or captured: money has not settled, so
    // nothing opens.
    return result('PENDING', {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: payment.status,
    });
  });
}

/**
 * Refund a payment and re-verify it.
 *
 * The refund call itself does not touch entitlement. It asks the provider to
 * move the money and then runs the ordinary reconcile, so withdrawal of access
 * is decided by the gateway's own record of what was returned — the same rule
 * that applies when a refund is issued from the provider's dashboard instead.
 */
export async function refundPayment(input: {
  paymentId: string;
  amountHalalas?: number;
  actorUserId: string;
  requestId?: string;
}): Promise<ReconcileResult> {
  const provider = getPaymentProvider();
  await provider.refund({ paymentId: input.paymentId, amountHalalas: input.amountHalalas });

  return reconcilePayment({
    paymentId: input.paymentId,
    source: 'admin',
    actorUserId: input.actorUserId,
    requestId: input.requestId,
  });
}
