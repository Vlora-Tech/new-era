import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { endOfRiyadhDay, startOfRiyadhDay } from '@/lib/riyadh-day';
import { AUDIT_ACTIONS, writeAuditLog, type AuditActor } from '@/services/audit/audit.service';
import type { StudentBlockInput, StudentListQuery } from '@/validators/admin-student';

/**
 * Student accounts: the read side of `User`, and the three levers an
 * administrator is allowed to pull on a live account.
 *
 * Four properties are why this is a service rather than a few Prisma calls in a
 * route handler:
 *
 *  1. **Blocking is a session operation, not a flag.** Setting `isBlocked` alone
 *     leaves every issued token working until it expires — for a fortnight, on
 *     this platform's session length. `sessionVersion` is the column that exists
 *     to prevent exactly that, and `getCurrentUser` compares it on every
 *     protected request. Both writes happen in one statement here so no caller
 *     can perform half of a block.
 *  2. **Some accounts must not be blockable.** An administrator who could block
 *     themselves, or another administrator, could lock the platform out of its
 *     own control panel with no way back in through the interface. Both are
 *     refused by name rather than silently ignored.
 *  3. **Nothing here selects `passwordHash`.** Not into a row type, not into an
 *     audit metadata object, not into a log line. The column is absent from
 *     every `select` in this file, which is a property of what this code does
 *     *not* do and therefore the kind of thing a later "just spread the user"
 *     edit would break without failing anything.
 *  4. **Every mutation is audited inside its own transaction**, so the trail can
 *     never record a block that rolled back.
 *
 * There is no create, no edit and no delete. Registration belongs to the student
 * themselves; a student's own details are theirs; and deletion is refused by the
 * schema — `orders`, `consent_records`, `entitlements` and `exam_attempts` all
 * hold `Restrict` edges — as well as being an open legal question in
 * `docs/client-inputs-required.md`. The interface says so instead of offering a
 * button that always fails.
 */

export type AdminStudentContext = {
  actor: AuditActor;
  requestId?: string;
};

/**
 * The columns the list table draws.
 *
 * Deliberately narrow, and deliberately without `passwordHash`, `blockedReason`
 * or the consent rows: a list of thirty accounts on one screen is thirty times
 * whatever it shows, and the reason an account was blocked is not something to
 * put in front of somebody who was only looking for an address.
 */
const STUDENT_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isBlocked: true,
  blockedAt: true,
  createdAt: true,
  _count: {
    select: {
      // Filtered so the column means "products this account can open now",
      // which is the question an administrator is actually asking. An unfiltered
      // count would include withdrawn access and read as a larger library.
      entitlements: { where: { status: 'ACTIVE' } },
      orders: true,
      examAttempts: true,
    },
  },
  // One row each, purely to derive "last activity" without a second round trip
  // per account. Ordering plus `take: 1` becomes a lateral join, not a fetch of
  // every order this student ever placed.
  orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
  examAttempts: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserSelect;

type StudentRowPayload = Prisma.UserGetPayload<{ select: typeof STUDENT_ROW_SELECT }>;

export type AdminStudentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: $Enums.UserRole;
  isBlocked: boolean;
  blockedAt: Date | null;
  createdAt: Date;
  activeEntitlementCount: number;
  orderCount: number;
  attemptCount: number;
  /**
   * The most recent order or attempt, whichever is later, and `null` for an
   * account that has done neither. Not "last sign-in": no column records that,
   * and inventing one from `updatedAt` would report a block as activity by the
   * student.
   */
  lastActivityAt: Date | null;
};

export type AdminStudentPage = {
  rows: AdminStudentRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

// ── Related records shown on one account's record ─────────────────────────

export type AdminStudentEntitlement = {
  id: string;
  productId: string;
  productTitle: string;
  productType: $Enums.ProductType;
  status: $Enums.EntitlementStatus;
  grantedAt: Date;
  revokedAt: Date | null;
  sourceOrderId: string | null;
};

export type AdminStudentOrder = {
  id: string;
  productTitle: string;
  amountHalalas: number;
  currency: string;
  status: $Enums.OrderStatus;
  createdAt: Date;
};

export type AdminStudentAttempt = {
  id: string;
  simulatorTitle: string;
  mode: $Enums.AttemptMode;
  status: $Enums.AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  correctCount: number | null;
  totalQuestions: number;
};

export type AdminStudentConsent = {
  id: string;
  acceptedAt: Date;
  termsVersion: string;
  privacyVersion: string;
};

export type AdminStudentActivity = {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: Date;
};

export type AdminStudentDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: $Enums.UserRole;
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: Date | null;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
  entitlements: AdminStudentEntitlement[];
  orders: AdminStudentOrder[];
  attempts: AdminStudentAttempt[];
  consents: AdminStudentConsent[];
  activity: AdminStudentActivity[];
  orderCount: number;
  attemptCount: number;
};

/** How many related rows the record view shows before it defers to the full list. */
const RELATED_LIMIT = 10;

/**
 * The fields an audit row is allowed to carry for an account.
 *
 * An explicit list rather than a spread of the row, and short on purpose: an
 * account row holds a password hash, an address and a phone number, and the
 * audit table is read far more widely than the row it describes. What changed
 * here is a state and a reason, so that is all the trail records.
 */
type BlockAuditMetadata = {
  role: $Enums.UserRole;
  reason: string | null;
  sessionVersionBefore: number;
  sessionVersionAfter: number;
};

function notFound(): never {
  throw new HttpError(404, COPY.adminStudents.errors.notFound, 'student_not_found');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept a path segment as an account id, or refuse it as "no such account".
 *
 * `id` is `uuid` in PostgreSQL, so handing Prisma `/api/admin/students/hello`
 * raises a driver-level cast error that the envelope can only report as an
 * unexpected 500. A malformed id is not a server fault — it names an account
 * that does not exist, and that is what the caller is told.
 */
export function parseStudentId(value: string): string {
  if (!UUID_PATTERN.test(value)) notFound();
  return value;
}

function toRow(row: StudentRowPayload): AdminStudentRow {
  const lastOrder = row.orders[0]?.createdAt ?? null;
  const lastAttempt = row.examAttempts[0]?.createdAt ?? null;
  let lastActivityAt: Date | null = lastOrder;
  if (lastAttempt && (!lastActivityAt || lastAttempt > lastActivityAt))
    lastActivityAt = lastAttempt;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isBlocked: row.isBlocked,
    blockedAt: row.blockedAt,
    createdAt: row.createdAt,
    activeEntitlementCount: row._count.entitlements,
    orderCount: row._count.orders,
    attemptCount: row._count.examAttempts,
    lastActivityAt,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * One page of accounts, filtered on the server.
 *
 * Every narrowing happens in SQL. The alternative — dumping the table and
 * filtering in the browser — would ship every student's address and phone number
 * to every administrator's laptop in order to show them twenty-five of them,
 * which is the opposite of what a screen holding minors' personal data should
 * do, quite apart from what it does to the page weight at ten thousand accounts.
 *
 * `q` matches the name, the address or the phone number: the three things a
 * support conversation actually contains. The count and the page are read in one
 * transaction so the pagination summary describes the same moment as the rows
 * beneath it.
 */
export async function listStudents(query: StudentListQuery): Promise<AdminStudentPage> {
  const where: Prisma.UserWhereInput = {};

  if (query.role) where.role = query.role;
  if (query.state) where.isBlocked = query.state === 'blocked';
  if (query.hasEntitlements !== undefined) {
    where.entitlements = query.hasEntitlements
      ? { some: { status: 'ACTIVE' } }
      : { none: { status: 'ACTIVE' } };
  }

  if (query.registeredFrom || query.registeredTo) {
    where.createdAt = {
      ...(query.registeredFrom ? { gte: startOfRiyadhDay(query.registeredFrom) } : {}),
      ...(query.registeredTo ? { lte: endOfRiyadhDay(query.registeredTo) } : {}),
    };
  }

  if (query.q) {
    const term = query.q.normalize('NFKC');
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      // `id` breaks ties. Two accounts created in the same millisecond otherwise
      // have no defined order, and an undefined order across two pages is how a
      // row appears twice while another is never shown at all.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: STUDENT_ROW_SELECT,
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
 * One account and the records that explain it.
 *
 * The related lists are capped at ten rows each and the full counts are returned
 * alongside, so the screen can say "here are the last ten of forty" rather than
 * implying forty is ten. What is shown is what an administrator answering a
 * support message genuinely needs: what they bought, what they can open, what
 * they have attempted, and which document versions they accepted.
 *
 * `passwordHash` is absent from every `select` below. So is anything session
 * -shaped beyond the integer `sessionVersion`, which is a counter rather than a
 * token and is shown because the block controls talk about it.
 */
export async function getStudentForAdmin(studentId: string): Promise<AdminStudentDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isBlocked: true,
      blockedReason: true,
      blockedAt: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { orders: true, examAttempts: true } },
      entitlements: {
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          productId: true,
          status: true,
          grantedAt: true,
          revokedAt: true,
          sourceOrderId: true,
          product: { select: { title: true, type: true } },
        },
      },
      orders: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RELATED_LIMIT,
        select: {
          id: true,
          // The snapshot the order carries, not the product's current title: a
          // receipt names what was bought at the time it was bought.
          productTitle: true,
          amountHalalas: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      },
      examAttempts: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RELATED_LIMIT,
        select: {
          id: true,
          mode: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          correctCount: true,
          totalQuestions: true,
          simulator: { select: { product: { select: { title: true } } } },
        },
      },
      consents: {
        orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, acceptedAt: true, termsVersion: true, privacyVersion: true },
      },
    },
  });

  if (!user) return null;

  /*
   * The administrative actions taken *on* this account, which is a different
   * question from the actions this account took. `targetId` is the subject;
   * `actorId` would be the doer, and for a student that is always empty.
   */
  const activity = await prisma.auditLog.findMany({
    where: { targetType: 'User', targetId: studentId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: RELATED_LIMIT,
    select: { id: true, action: true, actorEmail: true, createdAt: true },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason,
    blockedAt: user.blockedAt,
    sessionVersion: user.sessionVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    orderCount: user._count.orders,
    attemptCount: user._count.examAttempts,
    entitlements: user.entitlements.map((row) => ({
      id: row.id,
      productId: row.productId,
      productTitle: row.product.title,
      productType: row.product.type,
      status: row.status,
      grantedAt: row.grantedAt,
      revokedAt: row.revokedAt,
      sourceOrderId: row.sourceOrderId,
    })),
    orders: user.orders,
    attempts: user.examAttempts.map((row) => ({
      id: row.id,
      simulatorTitle: row.simulator.product.title,
      mode: row.mode,
      status: row.status,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      correctCount: row.correctCount,
      totalQuestions: row.totalQuestions,
    })),
    consents: user.consents,
    activity,
  };
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * Block an account, or lift a block.
 *
 * The block half writes three things in one statement, and all three matter:
 *
 *  - `isBlocked`, which `getCurrentUser` checks on every protected request;
 *  - `blockedReason` and `blockedAt`, so the administrative record says who was
 *    stopped and why without anyone having to reconstruct it from the trail;
 *  - **`sessionVersion`, incremented**, which is the whole point. The comment on
 *    that column in `schema.prisma` calls it an invalidation lever, and
 *    `getCurrentUser` compares the token's `sv` against it. Without the bump a
 *    blocked student stays signed in on every device they already have open
 *    until the cookie expires — the exact failure the column was added to
 *    prevent, and one that looks like success from the administrator's side.
 *
 * Lifting a block does *not* decrement or otherwise touch `sessionVersion`. The
 * counter is monotonic and the tokens it retired stay retired: the student signs
 * in again, which is what the confirmation text promises. Reversing it would
 * resurrect whatever sessions were open at the moment of the block, including
 * the one on the device that caused the block.
 *
 * Nothing here touches orders, entitlements or attempts. A blocked account keeps
 * everything it bought; blocking is not refunding and not deleting, and the copy
 * says so at the moment of the click.
 */
export async function setStudentBlocked(
  studentId: string,
  input: StudentBlockInput,
  context: AdminStudentContext,
): Promise<AdminStudentDetail> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, isBlocked: true, sessionVersion: true },
    });
    if (!before) notFound();

    if (input.blocked) {
      /*
       * The two refusals that keep the platform reachable. An administrator who
       * blocked themselves would be signed out on their next request with no
       * control panel left to undo it from, and blocking the last other
       * administrator has the same end state one step later. Both are stated by
       * name rather than silently ignored, because a button that appears to work
       * and does nothing is worse than one that explains itself.
       */
      if (before.id === context.actor.id) {
        throw new HttpError(409, COPY.adminStudents.errors.cannotBlockSelf, 'student_block_self');
      }
      if (before.role === 'ADMIN') {
        throw new HttpError(409, COPY.adminStudents.errors.cannotBlockAdmin, 'student_block_admin');
      }
      if (before.isBlocked) {
        throw new HttpError(
          409,
          COPY.adminStudents.errors.alreadyBlocked,
          'student_already_blocked',
        );
      }
    } else if (!before.isBlocked) {
      throw new HttpError(409, COPY.adminStudents.errors.notBlocked, 'student_not_blocked');
    }

    const updated = await tx.user.update({
      where: { id: studentId },
      data: input.blocked
        ? {
            isBlocked: true,
            blockedReason: input.reason,
            blockedAt: new Date(),
            // Retires every outstanding token for this account, on every device,
            // at the same instant the flag is set.
            sessionVersion: { increment: 1 },
          }
        : {
            isBlocked: false,
            // Cleared together: a lifted block that kept its reason and date
            // reads as a block that is still in force.
            blockedReason: null,
            blockedAt: null,
          },
      select: { sessionVersion: true },
    });

    const metadata: BlockAuditMetadata = {
      role: before.role,
      reason: input.reason,
      sessionVersionBefore: before.sessionVersion,
      sessionVersionAfter: updated.sessionVersion,
    };

    /*
     * One row, not two. Blocking bumps `sessionVersion` as a consequence of one
     * decision, and also writing `student.sessions_revoked` would put two
     * entries in the trail for one button — which reads as two decisions when
     * somebody audits it later. That action exists for the standalone control.
     */
    await writeAuditLog(tx, {
      actor: context.actor,
      action: input.blocked ? AUDIT_ACTIONS.STUDENT_BLOCKED : AUDIT_ACTIONS.STUDENT_UNBLOCKED,
      targetType: 'User',
      targetId: studentId,
      metadata,
      requestId: context.requestId,
    });
  });

  logger.info(input.blocked ? 'student blocked' : 'student unblocked', {
    studentId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  // Re-read outside the transaction: the record view needs the related lists,
  // and holding a transaction open across five more queries to save one round
  // trip is a poor trade on a screen a person is waiting for.
  const detail = await getStudentForAdmin(studentId);
  if (!detail) notFound();
  return detail;
}

/**
 * End every session this account has open, without blocking it.
 *
 * The same lever as blocking, minus the flag: `sessionVersion` moves, so every
 * token issued before this instant fails its comparison in `getCurrentUser` and
 * the student signs in again. Used when an account looks shared or a device
 * looks lost — cases where the account is fine and the sessions are not.
 *
 * Refused against the caller's own account. Signing yourself out is what the
 * sign-out button does, and routing it through an administrative endpoint would
 * put a `student.sessions_revoked` row in the trail against an administrator who
 * merely left for lunch.
 */
export async function revokeStudentSessions(
  studentId: string,
  context: AdminStudentContext,
): Promise<AdminStudentDetail> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (!before) notFound();

    if (before.id === context.actor.id) {
      throw new HttpError(
        409,
        COPY.adminStudents.errors.cannotSignOutSelf,
        'student_sign_out_self',
      );
    }

    const updated = await tx.user.update({
      where: { id: studentId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.STUDENT_SESSIONS_REVOKED,
      targetType: 'User',
      targetId: studentId,
      metadata: {
        role: before.role,
        sessionVersionBefore: before.sessionVersion,
        sessionVersionAfter: updated.sessionVersion,
      },
      requestId: context.requestId,
    });
  });

  logger.info('student sessions revoked', {
    studentId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  const detail = await getStudentForAdmin(studentId);
  if (!detail) notFound();
  return detail;
}
