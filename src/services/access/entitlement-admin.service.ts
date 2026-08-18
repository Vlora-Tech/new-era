import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { endOfRiyadhDay, startOfRiyadhDay } from '@/lib/riyadh-day';
import { grantEntitlement, revokeEntitlement } from '@/services/access/entitlement';
import { AUDIT_ACTIONS, writeAuditLog } from '@/services/audit/audit.service';
import type {
  EntitlementListQuery,
  EntitlementSource,
  GrantEntitlementInput,
} from '@/validators/admin-entitlement';

/**
 * Entitlement administration: the screen behind "why does this student have
 * access", and the three transitions that change the answer.
 *
 * This module is deliberately thin on top of `entitlement.ts`. That file already
 * owns the invariants — one effective row per `(userId, productId)`, an event
 * for every transition, idempotency against a duplicate webhook — and
 * reimplementing any of them here would create a second write path with its own
 * subtly different rules, which is precisely how a refund comes to revoke access
 * on one path and not the other. What this file adds is the part that is
 * genuinely administrative:
 *
 *  1. **A mandatory reason.** `EntitlementEvent.reason` is nullable in the
 *     schema because a purchase does not need one; a manual action does, and the
 *     schema's own comment says the service layer is where that is enforced.
 *  2. **The audit row**, written in the same transaction as the event, so the
 *     administrative record and the access history commit together or not at
 *     all.
 *  3. **Refusals stated as sentences**, rather than a unique-constraint
 *     violation escaping as a 500 when somebody grants access that already
 *     exists.
 *
 * Nothing here creates an order or moves money, in either direction. Access and
 * payment are separate ledgers on purpose: a manual grant is a decision to open
 * something, and a refund is a decision about money that happens to withdraw
 * access as a consequence. Collapsing them would make every goodwill grant look
 * like an unpaid invoice.
 */

/**
 * `actor.id` is required rather than nullable here, unlike `AuditActor`.
 *
 * An entitlement event records *who* decided, and `EntitlementEvent.actorUserId`
 * is what distinguishes a manual grant from an automatic one in every later
 * reading of the history. A null actor on this path would silently file an
 * administrator's decision under "the platform did it".
 */
export type AdminEntitlementContext = {
  actor: { id: string; email: string | null };
  requestId?: string;
};

const ENTITLEMENT_ROW_SELECT = {
  id: true,
  status: true,
  grantedAt: true,
  revokedAt: true,
  sourceOrderId: true,
  user: { select: { id: true, name: true, email: true } },
  product: { select: { id: true, title: true, type: true } },
  // The latest transition, for the list's "last change" column. `take: 1` on an
  // ordered relation is a lateral join; loading the whole history for every row
  // of a list would read an unbounded number of events to render one date.
  events: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { type: true, createdAt: true, actorUserId: true, orderId: true },
  },
} satisfies Prisma.EntitlementSelect;

type EntitlementRowPayload = Prisma.EntitlementGetPayload<{
  select: typeof ENTITLEMENT_ROW_SELECT;
}>;

export type AdminEntitlementRow = {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  productId: string;
  productTitle: string;
  productType: $Enums.ProductType;
  status: $Enums.EntitlementStatus;
  grantedAt: Date;
  revokedAt: Date | null;
  sourceOrderId: string | null;
  lastEventType: $Enums.EntitlementEventType | null;
  lastEventAt: Date | null;
  /** Derived, not stored — see `sourceOf`. */
  source: EntitlementSource;
};

export type AdminEntitlementPage = {
  rows: AdminEntitlementRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export type AdminEntitlementEvent = {
  id: string;
  type: $Enums.EntitlementEventType;
  reason: string | null;
  orderId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  createdAt: Date;
  source: EntitlementSource;
};

export type AdminEntitlementDetail = AdminEntitlementRow & {
  /** The whole history, oldest first. Append-only; nothing here is editable. */
  events: AdminEntitlementEvent[];
};

/** A product the grant form may offer, with enough context to choose between two. */
export type GrantableProduct = {
  id: string;
  title: string;
  type: $Enums.ProductType;
  status: $Enums.ProductStatus;
};

function notFound(): never {
  throw new HttpError(404, COPY.adminEntitlements.errors.notFound, 'entitlement_not_found');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept a path segment as an entitlement id, or refuse it as "no such row".
 * A malformed id would otherwise reach the driver as an invalid `uuid` cast and
 * surface as an unexpected 500 rather than as the 404 it actually is.
 */
export function parseEntitlementId(value: string): string {
  if (!UUID_PATTERN.test(value)) notFound();
  return value;
}

/**
 * Where a transition came from, read off the row rather than stored on it.
 *
 * An order id means a purchase produced it — that is the only thing that sets
 * `sourceOrderId`, and `order.service.ts` is the only writer. Otherwise an
 * administrator is named, or nobody is, and the second case is the platform
 * acting on its own: reconciliation withdrawing access after a confirmed refund.
 *
 * Kept as one function used by the row, the event and the list filter, so the
 * three cannot disagree about what "منح إداري" means.
 */
function sourceOf(input: {
  orderId: string | null;
  actorUserId: string | null;
}): EntitlementSource {
  if (input.orderId) return 'order';
  return input.actorUserId ? 'admin' : 'system';
}

function toRow(row: EntitlementRowPayload): AdminEntitlementRow {
  const lastEvent = row.events[0] ?? null;

  return {
    id: row.id,
    userId: row.user.id,
    studentName: row.user.name,
    studentEmail: row.user.email,
    productId: row.product.id,
    productTitle: row.product.title,
    productType: row.product.type,
    status: row.status,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    sourceOrderId: row.sourceOrderId,
    lastEventType: lastEvent?.type ?? null,
    lastEventAt: lastEvent?.createdAt ?? null,
    // The current access, not the latest event: `sourceOrderId` is the column
    // that says which order is presently responsible, and an administrative
    // reactivation clears it precisely because the order no longer is.
    source: sourceOf({
      orderId: row.sourceOrderId,
      actorUserId: lastEvent?.actorUserId ?? null,
    }),
  };
}

/**
 * Translate the list's `source` filter into SQL.
 *
 * `admin` and `system` both have no source order, and are told apart by whether
 * any event in the row's history names an administrator. That is expressible as
 * a relation filter; "the *latest* event names an administrator" is not, and
 * approximating it with a subquery here would put a second definition of
 * "administrative" in the codebase. The filter is honest about being a property
 * of the history rather than of the last row of it.
 */
function sourceCondition(source: EntitlementSource): Prisma.EntitlementWhereInput {
  if (source === 'order') return { sourceOrderId: { not: null } };
  if (source === 'admin') {
    return { sourceOrderId: null, events: { some: { actorUserId: { not: null } } } };
  }
  return { sourceOrderId: null, events: { none: { actorUserId: { not: null } } } };
}

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * One page of entitlements, filtered on the server.
 *
 * `q` matches the student's address or name, or the product's title — the three
 * ways somebody arrives at this screen. Filtering in SQL rather than in the
 * browser is not a performance preference here: the rows carry students'
 * addresses, and there is no version of "ship them all and hide most" that is
 * acceptable for that.
 */
export async function listEntitlements(query: EntitlementListQuery): Promise<AdminEntitlementPage> {
  const conditions: Prisma.EntitlementWhereInput[] = [];

  if (query.status) conditions.push({ status: query.status });
  if (query.productId) conditions.push({ productId: query.productId });
  if (query.productType) conditions.push({ product: { type: query.productType } });
  if (query.source) conditions.push(sourceCondition(query.source));

  if (query.from || query.to) {
    conditions.push({
      grantedAt: {
        ...(query.from ? { gte: startOfRiyadhDay(query.from) } : {}),
        ...(query.to ? { lte: endOfRiyadhDay(query.to) } : {}),
      },
    });
  }

  if (query.q) {
    const term = query.q.normalize('NFKC');
    conditions.push({
      OR: [
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { product: { title: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }

  const where: Prisma.EntitlementWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [total, rows] = await prisma.$transaction([
    prisma.entitlement.count({ where }),
    prisma.entitlement.findMany({
      where,
      // `id` breaks ties, so a row cannot appear on two pages while another
      // appears on none.
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: ENTITLEMENT_ROW_SELECT,
    }),
  ]);

  return {
    rows: rows.map(toRow),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/**
 * One entitlement and its complete history, oldest first.
 *
 * Chronological rather than newest-first, unlike every list on these screens.
 * This is a narrative — granted, revoked, reactivated — and it is read to answer
 * "how did we get here", which is a question that only makes sense forwards. The
 * history is not truncated either: a trail with a "…and 40 more" in the middle
 * is not evidence of anything.
 */
export async function getEntitlementForAdmin(
  entitlementId: string,
): Promise<AdminEntitlementDetail | null> {
  const row = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
    select: {
      ...ENTITLEMENT_ROW_SELECT,
      events: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          type: true,
          reason: true,
          orderId: true,
          createdAt: true,
          actorUserId: true,
          // Snapshotting is not available here — `EntitlementEvent` has no
          // `actorEmail` column and the relation is `SetNull` — so an actor
          // whose account was removed reads as the platform. The screen's copy
          // names that case rather than pretending the row is anonymous.
          actor: { select: { id: true, email: true } },
        },
      },
    },
  });

  if (!row) return null;

  const events = row.events;
  // `toRow` wants the newest event; this query ordered them oldest-first for the
  // narrative, so the last element is that one.
  const latest = events.length > 0 ? events[events.length - 1] : null;
  const summary = toRow({
    ...row,
    events: latest
      ? [
          {
            type: latest.type,
            createdAt: latest.createdAt,
            actorUserId: latest.actorUserId,
            orderId: latest.orderId,
          },
        ]
      : [],
  });

  return {
    ...summary,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      reason: event.reason,
      orderId: event.orderId,
      actorId: event.actor?.id ?? null,
      actorEmail: event.actor?.email ?? null,
      createdAt: event.createdAt,
      source: sourceOf({ orderId: event.orderId, actorUserId: event.actorUserId }),
    })),
  };
}

/** The products the grant form may offer, including drafts — see the form's hint. */
export async function listGrantableProducts(): Promise<GrantableProduct[]> {
  return prisma.product.findMany({
    orderBy: [{ title: 'asc' }],
    select: { id: true, title: true, type: true, status: true },
  });
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * Load the entitlement a transition is about, inside the caller's transaction.
 * Returns the pair the shared helpers key on, since they work in
 * `(userId, productId)` terms rather than by row id.
 */
async function loadForTransition(tx: PrismaTransaction, entitlementId: string) {
  const row = await tx.entitlement.findUnique({
    where: { id: entitlementId },
    select: { id: true, userId: true, productId: true, status: true },
  });
  if (!row) notFound();
  return row;
}

/**
 * Grant access by hand.
 *
 * Built on `grantEntitlement`, which already decides between creating a row and
 * reviving a revoked one, already writes the matching event, and already treats
 * a concurrent duplicate as a no-op rather than a `P2002`. Three things are
 * added on top:
 *
 *  - the address is resolved to an account, and an unknown address is a refusal
 *    rather than an invitation to create one;
 *  - administrators are refused as recipients. An administrator reaches every
 *    product through their role, so an entitlement on that account buys nothing
 *    and quietly puts a staff member into the paying-customer numbers;
 *  - the audit row names which of the two things happened. A previously revoked
 *    row produces a `REACTIVATED` event, so the trail says `reactivated` too —
 *    recording it as a fresh grant would erase the fact that access had been
 *    withdrawn once already, which is the single most interesting thing about
 *    that row.
 *
 * `changed: false` comes back when the student already had active access. That
 * is reported honestly rather than as an error or as a second grant: the screen
 * has its own "nothing changed" sentence, and writing another event would put a
 * duplicate in an append-only history that nothing can tidy up afterwards.
 */
export async function grantEntitlementForAdmin(
  input: GrantEntitlementInput,
  context: AdminEntitlementContext,
): Promise<{ entitlement: AdminEntitlementDetail; changed: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new HttpError(404, COPY.adminEntitlements.errors.userNotFound, 'student_not_found');
    }
    if (user.role === 'ADMIN') {
      throw new HttpError(
        409,
        COPY.adminEntitlements.errors.cannotGrantToAdmin,
        'entitlement_admin_recipient',
      );
    }

    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true },
    });
    if (!product) {
      throw new HttpError(404, COPY.adminEntitlements.errors.productNotFound, 'product_not_found');
    }

    // Read before the grant, because the grant is what changes it. `REVOKED`
    // here is what makes the difference between the two audit actions below.
    const existing = await tx.entitlement.findUnique({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      select: { status: true },
    });

    const { changed } = await grantEntitlement(tx, {
      userId: user.id,
      productId: product.id,
      source: { kind: 'admin', actorUserId: context.actor.id, reason: input.reason },
    });

    const row = await tx.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      select: { id: true },
    });

    if (changed) {
      await writeAuditLog(tx, {
        actor: context.actor,
        action:
          existing?.status === 'REVOKED'
            ? AUDIT_ACTIONS.ENTITLEMENT_REACTIVATED
            : AUDIT_ACTIONS.ENTITLEMENT_GRANTED,
        targetType: 'Entitlement',
        targetId: row.id,
        metadata: {
          userId: user.id,
          productId: product.id,
          reason: input.reason,
          previousStatus: existing?.status ?? null,
        },
        requestId: context.requestId,
      });
    }

    return { entitlementId: row.id, changed };
  });

  if (result.changed) {
    logger.info('entitlement granted by administrator', {
      entitlementId: result.entitlementId,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  const entitlement = await getEntitlementForAdmin(result.entitlementId);
  if (!entitlement) notFound();
  return { entitlement, changed: result.changed };
}

/**
 * Withdraw access.
 *
 * `revokeEntitlement` flips the projection and appends the `REVOKED` event; the
 * audit row here records who decided it. Nothing is deleted: the student's
 * lesson progress, their attempts and their results all survive, which is what
 * makes a mistaken revocation recoverable by reactivating rather than by
 * restoring a backup.
 *
 * Money is untouched. A revocation is not a refund and does not cancel an order,
 * and the confirmation text says so before the button is pressed — the
 * assumption that they are the same action is the one an administrator most
 * plausibly arrives with.
 */
export async function revokeEntitlementForAdmin(
  entitlementId: string,
  reason: string,
  context: AdminEntitlementContext,
): Promise<{ entitlement: AdminEntitlementDetail; changed: boolean }> {
  const changed = await prisma.$transaction(async (tx) => {
    const row = await loadForTransition(tx, entitlementId);

    const result = await revokeEntitlement(tx, {
      userId: row.userId,
      productId: row.productId,
      reason,
      actorUserId: context.actor.id,
    });

    if (result.changed) {
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.ENTITLEMENT_REVOKED,
        targetType: 'Entitlement',
        targetId: row.id,
        metadata: { userId: row.userId, productId: row.productId, reason },
        requestId: context.requestId,
      });
    }

    return result.changed;
  });

  if (changed) {
    logger.info('entitlement revoked by administrator', {
      entitlementId,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  const entitlement = await getEntitlementForAdmin(entitlementId);
  if (!entitlement) notFound();
  return { entitlement, changed };
}

/**
 * Put back access that was withdrawn.
 *
 * The same helper as a grant, because that is what it is: `grantEntitlement`
 * sees a revoked row and appends `REACTIVATED` rather than `GRANTED`, leaving
 * the withdrawal exactly where it was in the history. Nothing rewrites, nothing
 * collapses — a student who was granted, revoked and reactivated has three rows,
 * which is the only shape in which the sequence is still readable.
 *
 * Reactivating clears `sourceOrderId`, because the helper writes the source it
 * was given and an administrator is not an order. That is the truthful outcome:
 * the access now standing is the one an administrator decided on, and the
 * original purchase is still visible in the event history and in the order list.
 */
export async function reactivateEntitlementForAdmin(
  entitlementId: string,
  reason: string,
  context: AdminEntitlementContext,
): Promise<{ entitlement: AdminEntitlementDetail; changed: boolean }> {
  const changed = await prisma.$transaction(async (tx) => {
    const row = await loadForTransition(tx, entitlementId);

    const result = await grantEntitlement(tx, {
      userId: row.userId,
      productId: row.productId,
      source: { kind: 'admin', actorUserId: context.actor.id, reason },
    });

    if (result.changed) {
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.ENTITLEMENT_REACTIVATED,
        targetType: 'Entitlement',
        targetId: row.id,
        metadata: { userId: row.userId, productId: row.productId, reason },
        requestId: context.requestId,
      });
    }

    return result.changed;
  });

  if (changed) {
    logger.info('entitlement reactivated by administrator', {
      entitlementId,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  const entitlement = await getEntitlementForAdmin(entitlementId);
  if (!entitlement) notFound();
  return { entitlement, changed };
}
