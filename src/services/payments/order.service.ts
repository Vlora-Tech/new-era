import 'server-only';

import { Prisma, type OrderStatus, type PaymentProvider, type ProductType } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { hasActiveEntitlement } from '@/services/access/entitlement';

import { configuredPaymentMode, configuredProviderName } from './payment-provider';

/**
 * Orders.
 *
 * An order is the platform's own record of an intended purchase. Two properties
 * matter more than anything else here:
 *
 *  1. Price, currency, title and type are copied from the product row by the
 *     server. No field of an order is ever read from a request body. A client
 *     that posts `priceHalalas` is not rejected — it is simply not listened to,
 *     because the schema does not have that key.
 *  2. Creation is idempotent per `(userId, checkoutRequestKey)`. A student who
 *     double-taps "buy", or whose connection drops mid-request and retries, gets
 *     the same order back rather than a second one to pay for.
 */

// ── Order state machine ──────────────────────────────────────────────────

/**
 * Permitted order transitions, written out rather than implied by `if`s.
 *
 * `FAILED → PAID` is deliberate and is the reason this table exists at all: a
 * gateway webhook can arrive after a browser callback already recorded a
 * failure, and the gateway's record is the one that decides. Every other
 * backwards move is refused — in particular `PAID → FAILED`, because a late
 * failure notice for a superseded attempt must never close an order that money
 * has already settled against.
 */
export const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'FAILED', 'CANCELLED'],
  FAILED: ['PAID'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
  CANCELLED: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

/**
 * Whether an order may move between two states.
 * A transition to the state it is already in is not a transition, and returns
 * false: callers that need idempotency must say so explicitly.
 */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}

/** Conflict that carries a pointer the client can act on. */
export class OrderConflictError extends HttpError {
  readonly details: { reason: string; orderId?: string };

  constructor(message: string, code: string, details: { reason: string; orderId?: string }) {
    super(409, message, code);
    this.name = 'OrderConflictError';
    this.details = details;
  }
}

// ── Creation ─────────────────────────────────────────────────────────────

export type OrderView = {
  id: string;
  userId: string;
  productId: string;
  productType: ProductType;
  productTitle: string;
  amountHalalas: number;
  currency: string;
  status: OrderStatus;
  provider: PaymentProvider;
  createdAt: Date;
};

const ORDER_VIEW_SELECT = {
  id: true,
  userId: true,
  productId: true,
  productType: true,
  productTitle: true,
  amountHalalas: true,
  currency: true,
  status: true,
  provider: true,
  createdAt: true,
} as const;

export type CreateOrderResult = {
  order: OrderView;
  paymentAttemptId: string;
  /** True when an existing order was returned instead of a new one. */
  reused: boolean;
};

async function findOrderByKey(
  client: PrismaTransaction,
  userId: string,
  checkoutRequestKey: string,
): Promise<OrderView | null> {
  return client.order.findUnique({
    where: { userId_checkoutRequestKey: { userId, checkoutRequestKey } },
    select: ORDER_VIEW_SELECT,
  });
}

/**
 * An attempt the student can still pay against.
 *
 * A fresh row is created rather than reused once one has been handed to the
 * gateway: the unique `(provider, providerPaymentId)` constraint means an
 * attempt is the record of one gateway payment, and a retry is a new payment.
 */
async function ensureOpenAttempt(client: PrismaTransaction, order: OrderView): Promise<string> {
  const open = await client.paymentAttempt.findFirst({
    where: { orderId: order.id, providerPaymentId: null, status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (open) return open.id;

  const created = await client.paymentAttempt.create({
    data: {
      orderId: order.id,
      provider: order.provider,
      configuredMode: configuredPaymentMode(),
      status: 'CREATED',
      amountHalalas: order.amountHalalas,
      currency: order.currency,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Decide what an already-existing order under this idempotency key means.
 *
 * The key identifies one checkout intent. Presenting it again for a different
 * product is not a retry, it is a collision, and answering it with the first
 * order would let a request for one product return a different one.
 */
async function resolveExistingOrder(
  existing: OrderView,
  requestedProductId: string,
): Promise<CreateOrderResult> {
  if (existing.productId !== requestedProductId) {
    throw new OrderConflictError(COPY.commerce.checkoutKeyReused, 'checkout_key_reused', {
      reason: 'different_product',
    });
  }

  if (existing.status === 'PAID') {
    throw new OrderConflictError(COPY.commerce.orderAlreadyPaid, 'order_already_paid', {
      reason: 'already_paid',
      orderId: existing.id,
    });
  }

  if (existing.status === 'REFUNDED' || existing.status === 'CANCELLED') {
    throw new OrderConflictError(COPY.commerce.orderNotPayable, 'order_not_payable', {
      reason: existing.status.toLowerCase(),
      orderId: existing.id,
    });
  }

  // PENDING_PAYMENT or FAILED: both are still payable, and `FAILED → PAID` is a
  // permitted transition, so a retry continues on the same order.
  const paymentAttemptId = await ensureOpenAttempt(prisma, existing);
  return { order: existing, paymentAttemptId, reused: true };
}

/**
 * Create — or re-return — the order for one checkout intent.
 *
 * The order row and its first payment attempt are written in one transaction:
 * an order with no attempt would be a purchase the checkout page cannot render,
 * and an attempt with no order would be a payment with nothing to fulfil.
 */
export async function createOrder(input: {
  userId: string;
  productId: string;
  checkoutRequestKey: string;
}): Promise<CreateOrderResult> {
  const existing = await findOrderByKey(prisma, input.userId, input.checkoutRequestKey);
  if (existing) return resolveExistingOrder(existing, input.productId);

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, type: true, title: true, status: true, priceHalalas: true, currency: true },
  });

  if (!product) {
    throw new HttpError(404, COPY.commerce.productNotFound, 'product_not_found');
  }
  // A draft or archived product has no price the platform is willing to stand
  // behind, so it cannot be bought even by someone holding a direct link.
  if (product.status !== 'PUBLISHED') {
    throw new HttpError(409, COPY.commerce.productNotPurchasable, 'product_not_purchasable');
  }

  if (await hasActiveEntitlement(input.userId, product.id)) {
    throw new OrderConflictError(COPY.commerce.alreadyOwned, 'already_owned', {
      reason: 'already_entitled',
    });
  }

  const provider = configuredProviderName();
  const configuredMode = configuredPaymentMode();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: input.userId,
          productId: product.id,
          // Snapshots. A later price edit moves the catalogue, never this order.
          productType: product.type,
          productTitle: product.title,
          amountHalalas: product.priceHalalas,
          currency: product.currency,
          status: 'PENDING_PAYMENT',
          provider,
          checkoutRequestKey: input.checkoutRequestKey,
        },
        select: ORDER_VIEW_SELECT,
      });

      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider,
          configuredMode,
          status: 'CREATED',
          amountHalalas: order.amountHalalas,
          currency: order.currency,
          // Opaque local references only. Never a provider payload.
          safeMetadata: { checkoutRequestKey: input.checkoutRequestKey },
        },
        select: { id: true },
      });

      return { order, attemptId: attempt.id };
    });

    logger.info('order created', {
      orderId: created.order.id,
      userId: input.userId,
      productId: product.id,
      provider,
    });

    return { order: created.order, paymentAttemptId: created.attemptId, reused: false };
  } catch (error) {
    // Two requests carrying the same key raced past the lookup above. The unique
    // constraint decided which one wins; the loser reads the winner's order and
    // answers with it, which is exactly what the key promised.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await findOrderByKey(prisma, input.userId, input.checkoutRequestKey);
      if (raced) return resolveExistingOrder(raced, input.productId);
    }
    throw error;
  }
}

// ── Lookups used by the checkout pages and the payment routes ────────────

export type OrderWithAttempt = OrderView & {
  latestProviderPaymentId: string | null;
};

/** Load an order, refusing to confirm it exists to anyone who does not own it. */
export async function getOwnedOrder(
  orderId: string,
  userId: string,
): Promise<OrderWithAttempt | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: ORDER_VIEW_SELECT,
  });
  if (!order) return null;

  const attempt = await prisma.paymentAttempt.findFirst({
    where: { orderId: order.id, providerPaymentId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { providerPaymentId: true },
  });

  return { ...order, latestProviderPaymentId: attempt?.providerPaymentId ?? null };
}

/**
 * The gateway payment id most recently bound to an order.
 *
 * Reconciliation is always driven from this, never from a request body: the
 * caller says which order to check, and the server decides which payment that
 * means.
 */
export async function latestProviderPaymentId(orderId: string): Promise<string | null> {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { orderId, providerPaymentId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { providerPaymentId: true },
  });
  return attempt?.providerPaymentId ?? null;
}

/**
 * Bind a gateway payment id to an order, before the browser leaves for 3-D
 * Secure.
 *
 * This is the one thing the browser is allowed to tell the server about a
 * payment, and it is deliberately the least it could say: an identifier, which
 * the server then uses to ask the gateway what actually happened. Nothing about
 * amount, status or card ever crosses this boundary.
 *
 * The binding is not authorisation. Attaching an id grants nothing on its own —
 * reconciliation still verifies that the gateway's copy of the payment carries
 * this order's id, amount and currency before any access is opened.
 */
export async function attachProviderPayment(input: {
  orderId: string;
  paymentId: string;
}): Promise<{ paymentAttemptId: string; alreadyAttached: boolean }> {
  const provider = configuredProviderName();

  const existing = await prisma.paymentAttempt.findUnique({
    where: { provider_providerPaymentId: { provider, providerPaymentId: input.paymentId } },
    select: { id: true, orderId: true },
  });

  if (existing) {
    // The same id may not be re-pointed at a second order: that is how one paid
    // payment would be made to fulfil two of them.
    if (existing.orderId !== input.orderId) {
      throw new OrderConflictError(
        COPY.commerce.paymentAlreadyAttached,
        'payment_already_attached',
        { reason: 'bound_to_other_order' },
      );
    }
    return { paymentAttemptId: existing.id, alreadyAttached: true };
  }

  const open = await prisma.paymentAttempt.findFirst({
    where: { orderId: input.orderId, providerPaymentId: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  try {
    if (open) {
      const updated = await prisma.paymentAttempt.update({
        where: { id: open.id },
        data: { providerPaymentId: input.paymentId, status: 'INITIATED' },
        select: { id: true },
      });
      return { paymentAttemptId: updated.id, alreadyAttached: false };
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: input.orderId },
      select: { amountHalalas: true, currency: true },
    });

    const created = await prisma.paymentAttempt.create({
      data: {
        orderId: input.orderId,
        provider,
        configuredMode: configuredPaymentMode(),
        providerPaymentId: input.paymentId,
        status: 'INITIATED',
        amountHalalas: order.amountHalalas,
        currency: order.currency,
      },
      select: { id: true },
    });
    return { paymentAttemptId: created.id, alreadyAttached: false };
  } catch (error) {
    // A concurrent attach won the race; re-read and treat it as already bound.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.paymentAttempt.findUnique({
        where: { provider_providerPaymentId: { provider, providerPaymentId: input.paymentId } },
        select: { id: true, orderId: true },
      });
      if (raced && raced.orderId === input.orderId) {
        return { paymentAttemptId: raced.id, alreadyAttached: true };
      }
      throw new OrderConflictError(
        COPY.commerce.paymentAlreadyAttached,
        'payment_already_attached',
        { reason: 'bound_to_other_order' },
      );
    }
    throw error;
  }
}
