import 'server-only';

import type { PrismaTransaction } from '@/lib/db';

/**
 * The administrative audit trail.
 *
 * Every administrative mutation writes one row here describing who did what to
 * which record. Three properties make the trail worth having, and all three are
 * enforced by this module rather than by convention at the call sites:
 *
 *  1. **Atomicity.** The write takes a transaction client, so the audit row
 *     commits with the change it describes. A trail that can record a
 *     publication that rolled back is worse than no trail: it is evidence of
 *     something that never happened.
 *  2. **A closed vocabulary.** `action` is a union, not a string. Free strings
 *     drift — `product.publish`, `product.published`, `publish_product` — and a
 *     column nobody can group by is a log, not an audit trail.
 *  3. **Safe metadata only.** `AuditLog.metadata` is `Json`, which will accept
 *     anything handed to it, including a password hash reached by spreading a
 *     user row. Every value is filtered through `sanitiseAuditMetadata` before
 *     it reaches Prisma.
 */

/**
 * The complete set of recordable actions.
 *
 * The `payment.*` members mirror the strings `reconcile.service.ts` already
 * writes by hand, so the table has one spelling per event even though that file
 * predates this module and passes its own literals.
 */
export const AUDIT_ACTIONS = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_PUBLISHED: 'product.published',
  PRODUCT_UNPUBLISHED: 'product.unpublished',
  PRODUCT_ARCHIVED: 'product.archived',
  PRODUCT_DELETED: 'product.deleted',

  QUESTION_CREATED: 'question.created',
  QUESTION_UPDATED: 'question.updated',
  QUESTION_WORKFLOW_CHANGED: 'question.workflow_changed',
  QUESTION_PUBLISHED: 'question.published',
  QUESTION_RETIRED: 'question.retired',
  QUESTION_DELETED: 'question.deleted',

  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_REPLACED: 'media.replaced',
  MEDIA_DELETED: 'media.deleted',

  PAYMENT_RECONCILE_FULFILLED: 'payment.reconcile.fulfilled',
  PAYMENT_RECONCILE_REVOKED: 'payment.reconcile.revoked',
  PAYMENT_RECONCILE_MISMATCH: 'payment.reconcile.mismatch',
  PAYMENT_RECONCILE_NEEDS_REVIEW: 'payment.reconcile.needs_review',
  PAYMENT_RECONCILE_TRANSITION_REFUSED: 'payment.reconcile.transition_refused',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * The model an action was performed on, spelled as the Prisma model name so a
 * row can be joined back to its subject without a lookup table.
 */
export type AuditTargetType =
  | 'Product'
  | 'Question'
  | 'QuestionStimulus'
  | 'MediaAsset'
  | 'Order'
  | 'User'
  | 'Entitlement'
  | 'ExamVersion'
  | 'SiteSetting';

/**
 * Who acted.
 *
 * The address is snapshotted into `actorEmail` rather than read through the
 * relation, because `actorId` is `SetNull` on user deletion — without the
 * snapshot, removing an account would quietly anonymise everything that account
 * ever did.
 */
export type AuditActor = { id: string | null; email: string | null };

export type AuditMetadata = Record<string, unknown>;

/** What survives sanitising: the JSON subset Prisma's `Json` column accepts. */
export type AuditJsonValue =
  string | number | boolean | null | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export const AUDIT_REDACTED = '[redacted]';

/**
 * Keys whose values never enter the trail, matched case-insensitively as
 * substrings of the key name.
 *
 * A denylist is the wrong shape for a security control in general, and it is the
 * right shape here specifically because it is the *second* line: the first is
 * `auditChanges` below, which takes an explicit allowlist of fields. This exists
 * to catch the case where somebody hands a whole object to `metadata` — which is
 * exactly how a `passwordHash` ends up in a log that is then exported.
 */
const REDACTED_KEY_PATTERN =
  /(password|passwd|secret|token|credential|authorization|cookie|apikey|api_key|privatekey|private_key|signature|hash|cvc|cvv|cardnumber|card_number|pan\b|iban)/i;

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 4;

function sanitiseValue(value: unknown, depth: number): AuditJsonValue | undefined {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    // Truncated rather than dropped: a long value is usually a pasted document,
    // and the first few hundred characters still identify what changed.
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  // A non-finite number is not valid JSON and would fail at the driver.
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();

  // Beyond the depth limit, structure is recorded as a marker rather than
  // walked: an unbounded object graph in an audit row is a way to fill a table.
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    const items: AuditJsonValue[] = [];
    for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
      const sanitised = sanitiseValue(item, depth + 1);
      if (sanitised !== undefined) items.push(sanitised);
    }
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS}]`);
    return items;
  }

  if (typeof value === 'object') {
    const result: Record<string, AuditJsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEY_PATTERN.test(key)) {
        // The key is kept and the value replaced, so the trail still records
        // that a secret-bearing field was part of the change.
        result[key] = AUDIT_REDACTED;
        continue;
      }
      const sanitised = sanitiseValue(entry, depth + 1);
      if (sanitised !== undefined) result[key] = sanitised;
    }
    return result;
  }

  // Functions, symbols and anything else with no JSON representation.
  return undefined;
}

/** Reduce arbitrary metadata to safe, bounded, JSON-serialisable values. */
export function sanitiseAuditMetadata(metadata: AuditMetadata): Record<string, AuditJsonValue> {
  const sanitised = sanitiseValue(metadata, 0);
  return sanitised && typeof sanitised === 'object' && !Array.isArray(sanitised)
    ? (sanitised as Record<string, AuditJsonValue>)
    : {};
}

/**
 * Before/after metadata for the fields that actually changed.
 *
 * `fields` is an explicit allowlist and that is the point. Diffing whole rows
 * would work today and would silently start copying in whatever column is added
 * to the model next — which is how a token, a hash or a personal detail ends up
 * in an audit table that is read far more widely than the row it describes.
 *
 * Unchanged fields are omitted, so a row records the edit rather than the
 * record. `before` is `null` on a create, in which case every listed field is
 * reported as an addition.
 */
export function auditChanges<T extends Record<string, unknown>>(
  before: T | null,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): { before: Record<string, AuditJsonValue>; after: Record<string, AuditJsonValue> } {
  const beforeOut: Record<string, AuditJsonValue> = {};
  const afterOut: Record<string, AuditJsonValue> = {};

  for (const field of fields) {
    if (!(field in after)) continue;

    const nextValue = sanitiseValue(after[field], 1) ?? null;
    if (before === null) {
      afterOut[field] = nextValue;
      continue;
    }

    const previousValue = sanitiseValue(before[field], 1) ?? null;
    // Structural comparison, so an array of tags reordered counts as a change
    // and an identically-shaped object does not.
    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) continue;

    beforeOut[field] = previousValue;
    afterOut[field] = nextValue;
  }

  return { before: beforeOut, after: afterOut };
}

export type AuditEntry = {
  actor: AuditActor;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  /** Safe before/after facts only. Sanitised before it is written. */
  metadata?: AuditMetadata;
  /** Correlates the row with the request's log lines. */
  requestId?: string | null;
};

/**
 * Write one audit row.
 *
 * `tx` is the transaction client the mutation itself is running in, and passing
 * it is not optional in spirit even though `PrismaClient` structurally satisfies
 * the type: called with the root client, the audit row commits independently of
 * the change, and a rolled-back publication leaves a record saying it happened.
 * Every caller should be inside `prisma.$transaction`.
 *
 * The write is awaited rather than fired and forgotten. An audit row that fails
 * should take its transaction down with it — a mutation nobody can attribute is
 * not a successful mutation.
 */
export async function writeAuditLog(tx: PrismaTransaction, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata
        ? (sanitiseAuditMetadata(entry.metadata) as never)
        : // `undefined` leaves the column NULL; `{}` would claim an empty diff.
          undefined,
      requestId: entry.requestId ?? null,
    },
  });
}
