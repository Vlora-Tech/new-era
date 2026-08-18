import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { AUDIT_ACTION_GROUP_PREFIXES, type AuditLogQuery } from '@/validators/admin-audit';

/**
 * The read side of the audit trail.
 *
 * ⚠️ **This module is read-only, and that is a property to preserve rather than
 * a stage it is at.** `AuditLog` is append-only: rows are written exclusively by
 * `writeAuditLog` in `audit.service.ts`, inside the transaction of the change
 * they describe, and nothing anywhere updates or deletes one. There is
 * deliberately no `updateAuditEntry`, no `deleteAuditEntry` and no
 * `clearAuditLog` here, and no route that could reach one. A trail an
 * administrator can correct is not evidence of anything — it is a document
 * whose contents are whatever the last person with access wanted them to be.
 *
 * If a future task asks for "remove a noisy row" or "clear the log before the
 * migration", the answer is a narrower filter on this screen, not a delete.
 */

/**
 * The columns the screen draws.
 *
 * `actorEmail` is selected alongside `actorId` rather than joined through the
 * relation, and the pair is what makes the trail survive its own subjects.
 * `AuditLog.actorId` is `SetNull` on user deletion, so the join alone would
 * quietly anonymise everything a removed account ever did; the snapshotted
 * address stays. The two columns therefore encode three states:
 *
 *  - `actorId` present  → a live account, linkable to its record screen;
 *  - `actorId` null, `actorEmail` present → the account was deleted after the
 *    fact, and the trail still names who acted;
 *  - both null → nobody acted. The platform did, processing a provider's
 *    webhook or a scheduled reconciliation.
 */
const AUDIT_ROW_SELECT = {
  id: true,
  createdAt: true,
  actorId: true,
  actorEmail: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  requestId: true,
} satisfies Prisma.AuditLogSelect;

export type AdminAuditRow = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_ROW_SELECT }>;

export type AdminAuditLogPage = {
  rows: AdminAuditRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

/**
 * One page of the trail, filtered in SQL.
 *
 * Which filters are cheap is decided by the table's three indexes, and the
 * screen's filter bar is shaped around them:
 *
 *  - `@@index([createdAt])` carries both the date window and the sort, so the
 *    common case — "what happened today" — is an index range scan;
 *  - `@@index([targetType, targetId])` carries "everything that happened to this
 *    product", which is why `targetId` is matched exactly rather than by prefix;
 *  - `@@index([actorId])` carries "everything this administrator did".
 *
 * `action` and `actionGroup` have no index and are filters over an already
 * narrowed set; `actorEmail` is matched with `contains`, which cannot use an
 * index either. Both are acceptable here and would not be on a hot path: this
 * table is read by a handful of people, and only ever behind a date window.
 */
export async function listAuditLog(query: AuditLogQuery): Promise<AdminAuditLogPage> {
  const conditions: Prisma.AuditLogWhereInput[] = [];

  if (query.action) conditions.push({ action: query.action });

  if (query.actionGroup) {
    // A group is a set of `action` prefixes rather than a column, so it becomes
    // an OR of prefix matches. `startsWith` on a literal prefix is safe by
    // construction: the values come from a frozen map in the validator, never
    // from the request.
    conditions.push({
      OR: AUDIT_ACTION_GROUP_PREFIXES[query.actionGroup].map((prefix) => ({
        action: { startsWith: prefix },
      })),
    });
  }

  if (query.targetType) conditions.push({ targetType: query.targetType });

  if (query.q) {
    // Two different questions in one box, matching what the field's note
    // promises: part of an actor's address, or a target id in full. The id is
    // compared exactly — a `contains` on it would turn a uuid paste into a scan
    // that also matched unrelated rows sharing a hex run.
    conditions.push({
      OR: [{ actorEmail: { contains: query.q, mode: 'insensitive' } }, { targetId: query.q }],
    });
  }

  if (query.from || query.to) {
    conditions.push({
      createdAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    });
  }

  const where: Prisma.AuditLogWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      // `id` breaks ties, and here it breaks them meaningfully rather than
      // arbitrarily: ids are `uuid(7)`, which is time-ordered, so two rows
      // written in the same millisecond still come back in the order they were
      // written. Without a tiebreak the order between them is undefined, and an
      // undefined order across two pages is how a row appears twice while
      // another is never shown at all — on the one screen where a missing row
      // is the whole problem.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: AUDIT_ROW_SELECT,
    }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}
