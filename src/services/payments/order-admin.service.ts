import 'server-only';

import type { $Enums, Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { AUDIT_ACTIONS, writeAuditLog, type AuditActor } from '@/services/audit/audit.service';
import { latestProviderPaymentId } from '@/services/payments/order.service';
import { reconcilePayment, type ReconcileOutcome } from '@/services/payments/reconcile.service';
import type { OrderListQuery } from '@/validators/admin-order';

/**
 * Order administration: the read side of `Order`, plus exactly one action.
 *
 * Four properties are why this is a service rather than queries scattered
 * through route handlers, and three of them are properties of what it *cannot*
 * do:
 *
 *  1. **Nothing here writes to an order's money columns.** `amountHalalas`,
 *     `currency`, `productTitle` and `productType` are snapshots taken by
 *     `order.service.ts` at checkout. No statement in this file names them in a
 *     `data:` clause, and none ever should — a receipt that changes after the
 *     fact is not a receipt, and the change would be silent because nothing
 *     would fail.
 *  2. **The provider is the authority on payment state.** There is no
 *     `markOrderPaid`, no `markOrderRefunded` and no status transition an
 *     administrator can drive by hand. The one action is
 *     `requestOrderReconcile`, which asks the gateway and lets
 *     `reconcile.service.ts` record the answer. The platform never asserts a
 *     payment outcome on its own say-so.
 *  3. **No refund is issued from here.** `refundPayment` exists one module over
 *     and is deliberately not called: money moves at the provider, and this
 *     screen's job is to make the provider's record legible and to re-read it.
 *     A refund button in an admin panel is a second, weaker path to the same
 *     money with none of the provider's own controls around it.
 *  4. **The trail records the request, not an outcome the platform invented.**
 *     `order.reconcile_requested` is written for the administrator's decision;
 *     whatever the gateway then says is written by the reconcile service under
 *     `payment.reconcile.*`. Two rows, two facts, in that order.
 */

export type AdminOrderContext = {
  actor: AuditActor;
  requestId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): never {
  throw new HttpError(404, COPY.adminOrders.errors.notFound, 'order_not_found');
}

/**
 * Accept a path segment as an order id, or refuse it as "no such order".
 *
 * `id` is `uuid` in PostgreSQL, so handing Prisma `/api/admin/orders/hello`
 * raises a driver-level cast error the envelope can only report as a 500. A
 * malformed id names an order that does not exist, and that is what the caller
 * is told.
 */
export function parseOrderId(value: string): string {
  if (!UUID_PATTERN.test(value)) notFound();
  return value;
}

// ── Row shapes ───────────────────────────────────────────────────────────

/** The columns the list table draws. Deliberately narrow. */
const ORDER_ROW_SELECT = {
  id: true,
  productId: true,
  productTitle: true,
  productType: true,
  amountHalalas: true,
  currency: true,
  status: true,
  provider: true,
  createdAt: true,
  paidAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const ORDER_ROW_WITH_RELATIONS = {
  ...ORDER_ROW_SELECT,
  user: { select: { id: true, name: true, email: true } },
  /**
   * The most recent attempt only. It is what the list column means — "where did
   * this order's payment get to" — and loading every attempt for every row to
   * render one cell is how a list query starts scaling with retries.
   */
  paymentAttempts: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { status: true, configuredMode: true },
  },
} satisfies Prisma.OrderSelect;

type OrderRowPayload = Prisma.OrderGetPayload<{ select: typeof ORDER_ROW_WITH_RELATIONS }>;

export type AdminOrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_ROW_SELECT }> & {
  student: { id: string; name: string; email: string };
  /** From the latest attempt. Null when checkout never reached the provider. */
  paymentStatus: $Enums.PaymentStatus | null;
  paymentMode: $Enums.PaymentMode | null;
  /**
   * True when *any* attempt on the order is flagged. This is the whole reason an
   * administrator opens this screen, so it is a column rather than something
   * discovered by opening each order in turn.
   */
  needsReview: boolean;
};

export type AdminOrderPage = {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export type AdminPaymentRow = {
  id: string;
  provider: $Enums.PaymentProvider;
  providerPaymentId: string | null;
  status: $Enums.PaymentStatus;
  configuredMode: $Enums.PaymentMode;
  amountHalalas: number;
  currency: string;
  refundedHalalas: number;
  refundedAt: Date | null;
  needsReview: boolean;
  failureCode: string | null;
  reconcileCount: number;
  lastReconciledAt: Date | null;
  createdAt: Date;
  /**
   * The *names* of the local references attached to the payment, never their
   * values and never the provider's payload.
   *
   * `safeMetadata` holds `order_id` and `payment_attempt_id` — ids this server
   * put there and already displays elsewhere on the page from its own tables.
   * Rendering the stored copy would add nothing and would create the one habit
   * this screen must not have: treating a column fed by a third party as
   * something to print. Listing the keys answers the only question the column is
   * for — "is this payment carrying the references we expect" — without it.
   */
  safeMetadataKeys: string[];
};

export type AdminWebhookRow = {
  id: string;
  eventType: string;
  status: $Enums.WebhookStatus;
  attemptCount: number;
  liveMode: boolean | null;
  receivedAt: Date;
  processedAt: Date | null;
  /**
   * Whether a diagnostic message was stored, never the message itself.
   *
   * `WebhookEvent.lastError` is a raw `Error.message` captured from *any* throw
   * during processing, not only a domain refusal — a `PrismaClientInitializationError`
   * puts "Can't reach database server at `localhost:5544`" or the database
   * username into that column. This service already omits
   * `PaymentAttempt.failureMessage` so a column that is never read cannot be
   * rendered by accident; `lastError` is strictly less controlled than the one
   * that was excluded, so it gets the same treatment. The `status` column
   * already tells the screen the delivery failed, which is the part an
   * administrator can act on; the text stays in the logs for whoever is
   * diagnosing it.
   */
  hasError: boolean;
};

export type AdminEntitlementEventRow = {
  id: string;
  type: $Enums.EntitlementEventType;
  reason: string | null;
  createdAt: Date;
};

export type AdminOrderActivityRow = {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: Date;
};

export type AdminOrderDetail = {
  id: string;
  productId: string;
  productTitle: string;
  productType: $Enums.ProductType;
  amountHalalas: number;
  currency: string;
  status: $Enums.OrderStatus;
  provider: $Enums.PaymentProvider;
  checkoutRequestKey: string;
  createdAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  updatedAt: Date;
  student: { id: string; name: string; email: string };
  /** The catalogue row as it is *today*, beside the snapshot as it was then. */
  product: { id: string; slug: string; title: string; status: $Enums.ProductStatus };
  payments: AdminPaymentRow[];
  webhooks: AdminWebhookRow[];
  entitlement: {
    id: string;
    status: $Enums.EntitlementStatus;
    grantedAt: Date | null;
    revokedAt: Date | null;
    fromThisOrder: boolean;
  } | null;
  /** Access events this order caused, in the order they happened. */
  entitlementEvents: AdminEntitlementEventRow[];
  activity: AdminOrderActivityRow[];
  needsReview: boolean;
  refundedHalalas: number;
  latestProviderPaymentId: string | null;
};

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * Turn one page of query parameters into a `where` clause.
 *
 * Every attempt-shaped filter becomes its own `some` clause inside `AND` rather
 * than being merged into one. Merged, `mode=LIVE&paymentStatus=FAILED` would
 * mean "one attempt that is both", which silently excludes the ordinary case of
 * a failed test attempt followed by a live one — the exact order somebody is
 * looking for when they set those two filters.
 */
function buildOrderWhere(query: OrderListQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];

  if (query.status) and.push({ status: query.status });
  if (query.provider) and.push({ provider: query.provider });
  if (query.mode) and.push({ paymentAttempts: { some: { configuredMode: query.mode } } });
  if (query.paymentStatus) {
    and.push({ paymentAttempts: { some: { status: query.paymentStatus } } });
  }
  if (query.needsReview) and.push({ paymentAttempts: { some: { needsReview: true } } });

  if (query.from || query.to) {
    and.push({
      createdAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    });
  }

  if (query.q) {
    const term = query.q.normalize('NFKC');
    const or: Prisma.OrderWhereInput[] = [
      // The snapshot, not the live product title: an administrator searching for
      // what the student was charged for should find the order even after the
      // catalogue entry was renamed.
      { productTitle: { contains: term, mode: 'insensitive' } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
      { user: { name: { contains: term, mode: 'insensitive' } } },
    ];
    // A full order id, pasted from a support conversation. Matched exactly and
    // only when it is actually a uuid — `id` is a `uuid` column, and handing
    // PostgreSQL a partial one is a cast error rather than a narrower search.
    if (UUID_PATTERN.test(term.trim())) or.push({ id: term.trim() });
    and.push({ OR: or });
  }

  return and.length > 0 ? { AND: and } : {};
}

function toRow(row: OrderRowPayload, flagged: ReadonlySet<string>): AdminOrderRow {
  const { user, paymentAttempts, ...order } = row;
  const latest = paymentAttempts[0] ?? null;

  return {
    ...order,
    student: user,
    paymentStatus: latest?.status ?? null,
    paymentMode: latest?.configuredMode ?? null,
    needsReview: flagged.has(order.id),
  };
}

/**
 * One page of orders, filtered on the server.
 *
 * The count and the page are read in one transaction so the pagination summary
 * describes the same moment as the rows beneath it. `id` breaks the sort tie:
 * two orders created in the same millisecond otherwise have no defined order,
 * and an undefined order across pages is how a row appears twice while another
 * is never shown at all — which on this table means an order nobody ever looks
 * at.
 */
export async function listOrders(query: OrderListQuery): Promise<AdminOrderPage> {
  const where = buildOrderWhere(query);

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: ORDER_ROW_WITH_RELATIONS,
    }),
  ]);

  // One extra query for the whole page rather than every attempt joined onto
  // every row: the flag is "does any attempt need review", and `distinct` makes
  // that a set membership test instead of an aggregate per order.
  const flaggedRows =
    rows.length === 0
      ? []
      : await prisma.paymentAttempt.findMany({
          where: { orderId: { in: rows.map((row) => row.id) }, needsReview: true },
          distinct: ['orderId'],
          select: { orderId: true },
        });
  const flagged = new Set(flaggedRows.map((row) => row.orderId));

  return {
    rows: rows.map((row) => toRow(row, flagged)),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** Metadata keys, sorted, with no value ever read. See `safeMetadataKeys`. */
function metadataKeys(value: Prisma.JsonValue | null): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return Object.keys(value).sort();
}

/**
 * Every webhook the platform can honestly attribute to this order.
 *
 * `WebhookEvent` has no foreign key — it is a durable inbox written before
 * anything is known about what the event refers to — so the association is made
 * from the two references the minimised payload actually carries: the order id
 * this server put in the checkout metadata, and the gateway payment id bound to
 * one of the order's attempts. Both are matched, because a delivery can carry
 * one without the other.
 */
async function loadWebhooks(
  orderId: string,
  providerPaymentIds: readonly string[],
): Promise<AdminWebhookRow[]> {
  const or: Prisma.WebhookEventWhereInput[] = [
    { payload: { path: ['data', 'metadata', 'order_id'], equals: orderId } },
    ...providerPaymentIds.map((paymentId) => ({
      payload: { path: ['data', 'id'], equals: paymentId },
    })),
  ];

  const rows = await prisma.webhookEvent.findMany({
    where: { OR: or },
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: {
      id: true,
      eventType: true,
      status: true,
      attemptCount: true,
      liveMode: true,
      receivedAt: true,
      processedAt: true,
      // Read only to answer "is there one", and reduced to a boolean on the next
      // line so the text cannot reach a page payload. See `AdminWebhookRow`.
      lastError: true,
    },
  });

  return rows.map(({ lastError, ...row }) => ({ ...row, hasError: lastError !== null }));
}

/**
 * One order, with the whole payment story around it.
 *
 * Read as a batch rather than one nested query: the webhook lookup depends on
 * the payment ids, so it cannot be a nested select, and the entitlement is keyed
 * by `(userId, productId)` rather than by the order — an order is one reason
 * access exists, not the only possible one.
 */
export async function getOrderForAdmin(orderId: string): Promise<AdminOrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      productId: true,
      productTitle: true,
      productType: true,
      amountHalalas: true,
      currency: true,
      status: true,
      provider: true,
      checkoutRequestKey: true,
      createdAt: true,
      paidAt: true,
      failedAt: true,
      cancelledAt: true,
      refundedAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, slug: true, title: true, status: true } },
      paymentAttempts: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          provider: true,
          providerPaymentId: true,
          status: true,
          configuredMode: true,
          amountHalalas: true,
          currency: true,
          refundedHalalas: true,
          refundedAt: true,
          needsReview: true,
          failureCode: true,
          reconcileCount: true,
          lastReconciledAt: true,
          createdAt: true,
          safeMetadata: true,
          // `failureMessage` is deliberately absent from this select. It is the
          // provider's own English diagnostic, kept server-side for support; the
          // screen reports a payment outcome in Arabic instead, and a column
          // that is never read cannot be rendered by accident.
        },
      },
    },
  });

  if (!order) return null;

  const providerPaymentIds = order.paymentAttempts
    .map((attempt) => attempt.providerPaymentId)
    .filter((value): value is string => value !== null);

  const [webhooks, entitlement, entitlementEvents, activity] = await Promise.all([
    loadWebhooks(order.id, providerPaymentIds),
    prisma.entitlement.findUnique({
      where: { userId_productId: { userId: order.user.id, productId: order.productId } },
      select: {
        id: true,
        status: true,
        grantedAt: true,
        revokedAt: true,
        sourceOrderId: true,
      },
    }),
    prisma.entitlementEvent.findMany({
      where: { orderId: order.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, reason: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { targetType: 'Order', targetId: order.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, action: true, actorEmail: true, createdAt: true },
    }),
  ]);

  const payments: AdminPaymentRow[] = order.paymentAttempts.map((attempt) => {
    const { safeMetadata, ...rest } = attempt;
    return { ...rest, safeMetadataKeys: metadataKeys(safeMetadata) };
  });

  return {
    id: order.id,
    productId: order.productId,
    productTitle: order.productTitle,
    productType: order.productType,
    amountHalalas: order.amountHalalas,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    checkoutRequestKey: order.checkoutRequestKey,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    failedAt: order.failedAt,
    cancelledAt: order.cancelledAt,
    refundedAt: order.refundedAt,
    updatedAt: order.updatedAt,
    student: order.user,
    product: order.product,
    payments,
    webhooks,
    entitlement: entitlement
      ? {
          id: entitlement.id,
          status: entitlement.status,
          grantedAt: entitlement.grantedAt,
          revokedAt: entitlement.revokedAt,
          // Access can exist for a reason other than this order — an
          // administrative grant, or an earlier purchase. Saying which is what
          // stops the screen claiming credit for access it did not open.
          fromThisOrder: entitlement.sourceOrderId === order.id,
        }
      : null,
    entitlementEvents,
    activity,
    needsReview: payments.some((payment) => payment.needsReview),
    // Summed across attempts, in integer halalas. Never a float, and never
    // derived by dividing anything by a hundred.
    refundedHalalas: payments.reduce((total, payment) => total + payment.refundedHalalas, 0),
    latestProviderPaymentId: providerPaymentIds[0] ?? null,
  };
}

// ── The one action ───────────────────────────────────────────────────────

export type AdminReconcileResult = {
  outcome: ReconcileOutcome;
  orderStatus: $Enums.OrderStatus;
  /** True when the check actually moved access. */
  changed: boolean;
};

/**
 * Ask the provider what really happened to this order's payment.
 *
 * The endpoint reads no request body and this function takes no payment id: the
 * gateway payment is derived from the order's own attempts by
 * `latestProviderPaymentId`. So the most an administrator can do here is cause
 * an order to be re-checked — never point a check at a payment of their
 * choosing, which is what would let a payment for one order fulfil another.
 *
 * The audit row is written first, in its own transaction, and that ordering is
 * deliberate. It records the administrator's *decision*, which happened whether
 * or not the gateway answers; the gateway's answer is a separate fact recorded
 * separately by `reconcile.service.ts` under `payment.reconcile.*`. Folding the
 * two into one row would mean either losing the request when the provider times
 * out, or claiming an outcome the provider never gave.
 *
 * Repeating it is safe by construction: reconciliation locks the order row and
 * returns `ALREADY_FULFILLED` for an order that is already paid, so a second
 * press grants nothing twice and moves no money at all.
 */
export async function requestOrderReconcile(
  orderId: string,
  context: AdminOrderContext,
): Promise<AdminReconcileResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, provider: true },
  });
  if (!order) notFound();

  const paymentId = await latestProviderPaymentId(order.id);
  if (!paymentId) {
    throw new HttpError(409, COPY.adminOrders.errors.noPaymentAttempt, 'order_no_payment_attempt');
  }

  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.ORDER_RECONCILE_REQUESTED,
      targetType: 'Order',
      targetId: order.id,
      metadata: {
        provider: order.provider,
        providerPaymentId: paymentId,
        statusBefore: order.status,
      },
      requestId: context.requestId,
    });
  });

  let result;
  try {
    result = await reconcilePayment({
      paymentId,
      source: 'admin',
      actorUserId: context.actor.id ?? undefined,
      requestId: context.requestId,
    });
  } catch (error) {
    // The gateway's own error text never reaches a browser. What the
    // administrator is told is that nothing changed, which is the fact that
    // matters: reconciliation is a single transaction, so a throw leaves the
    // order exactly as it was.
    logger.error('admin reconcile failed at the provider', {
      orderId: order.id,
      actorId: context.actor.id,
      requestId: context.requestId,
      error,
    });

    // An unrecognised status is not an outage, and saying "we could not reach
    // the provider" about one would send somebody to check a gateway that is
    // answering perfectly well.
    const unrecognised = error instanceof Error && error.name === 'UnknownPaymentStatusError';
    throw new HttpError(
      502,
      unrecognised
        ? COPY.adminOrders.errors.providerUnknownStatus
        : COPY.adminOrders.errors.providerUnavailable,
      unrecognised ? 'provider_unknown_status' : 'provider_unavailable',
    );
  }

  logger.info('admin reconcile completed', {
    orderId: order.id,
    outcome: result.outcome,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return {
    outcome: result.outcome,
    orderStatus: result.orderStatus ?? order.status,
    changed: result.outcome === 'FULFILLED' || result.outcome === 'REVOKED',
  };
}
