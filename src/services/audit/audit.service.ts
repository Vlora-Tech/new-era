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
 *
 * The naming rule is `domain.verb`, dot-separated, with the verb in the past
 * tense — the row records something that happened, not something requested. A
 * verb of several words joins with an underscore (`workflow_changed`), and a
 * domain of several words does the same (`lesson_quiz`, `exam_version`), so the
 * dot never means anything but "domain, then verb". `payment.reconcile.*` is the
 * one three-segment family and it predates the rule.
 *
 * A reorder is recorded once per operation on the *parent* — `module.reordered`
 * against the course — rather than once per row that moved. Ten rows shifting by
 * one position is one administrative decision, and ten rows of trail for it is
 * how the table stops being readable.
 *
 * Every value here needs an Arabic label in `COPY.adminAudit.actionLabels`,
 * which is keyed by these exact strings. An action added without one renders
 * through `unknownAction` — correct, but useless to the person reading the log.
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

  // ── Course content ──────────────────────────────────────────────────────
  // A `Course` row is never created or deleted from the administration area:
  // it exists one-to-one with its `Product`, so the catalogue's own
  // `product.created` and `product.deleted` already record those two events.
  // Only the course's settings are separately editable, hence a single verb.
  COURSE_UPDATED: 'course.updated',

  MODULE_CREATED: 'module.created',
  MODULE_UPDATED: 'module.updated',
  MODULE_DELETED: 'module.deleted',
  MODULE_REORDERED: 'module.reordered',
  MODULE_PUBLISHED: 'module.published',
  MODULE_UNPUBLISHED: 'module.unpublished',
  MODULE_ARCHIVED: 'module.archived',

  LESSON_CREATED: 'lesson.created',
  LESSON_UPDATED: 'lesson.updated',
  LESSON_DELETED: 'lesson.deleted',
  LESSON_REORDERED: 'lesson.reordered',
  LESSON_PUBLISHED: 'lesson.published',
  LESSON_UNPUBLISHED: 'lesson.unpublished',
  LESSON_ARCHIVED: 'lesson.archived',

  LESSON_QUIZ_CREATED: 'lesson_quiz.created',
  LESSON_QUIZ_UPDATED: 'lesson_quiz.updated',
  LESSON_QUIZ_DELETED: 'lesson_quiz.deleted',
  // Adding or removing a bank question from a quiz. One action for both, with
  // the direction in the metadata: they are the same decision seen twice, and
  // splitting them buys a filter nobody wants at the cost of two spellings.
  LESSON_QUIZ_QUESTIONS_CHANGED: 'lesson_quiz.questions_changed',
  LESSON_QUIZ_REORDERED: 'lesson_quiz.reordered',

  // Registering a Bunny video against the platform is not an upload: the bytes
  // are uploaded in Bunny's dashboard and this records the identifier pointing
  // at them. `registered` rather than `created` says so — the video existed
  // before this row did, and deleting the row does not delete the video.
  VIDEO_REGISTERED: 'video.registered',
  VIDEO_UPDATED: 'video.updated',
  VIDEO_DELETED: 'video.deleted',

  // ── Exam simulators ─────────────────────────────────────────────────────
  SIMULATOR_UPDATED: 'simulator.updated',

  EXAM_VERSION_CREATED: 'exam_version.created',
  EXAM_VERSION_UPDATED: 'exam_version.updated',
  EXAM_VERSION_DUPLICATED: 'exam_version.duplicated',
  EXAM_VERSION_DELETED: 'exam_version.deleted',
  EXAM_VERSION_PUBLISHED: 'exam_version.published',
  EXAM_VERSION_RETIRED: 'exam_version.retired',
  // Publication and activation are two decisions and therefore two actions.
  // Publishing freezes a version's structure; activating points the simulator
  // at it, which is what actually changes what a student receives.
  EXAM_VERSION_ACTIVATED: 'exam_version.activated',
  EXAM_VERSION_DEACTIVATED: 'exam_version.deactivated',

  EXAM_SECTION_CREATED: 'exam_section.created',
  EXAM_SECTION_UPDATED: 'exam_section.updated',
  EXAM_SECTION_DELETED: 'exam_section.deleted',
  EXAM_SECTION_REORDERED: 'exam_section.reordered',
  EXAM_SECTION_QUESTIONS_CHANGED: 'exam_section.questions_changed',

  BLUEPRINT_RULE_CREATED: 'blueprint_rule.created',
  BLUEPRINT_RULE_UPDATED: 'blueprint_rule.updated',
  BLUEPRINT_RULE_DELETED: 'blueprint_rule.deleted',
  BLUEPRINT_RULE_REORDERED: 'blueprint_rule.reordered',

  // ── Student accounts ────────────────────────────────────────────────────
  STUDENT_BLOCKED: 'student.blocked',
  STUDENT_UNBLOCKED: 'student.unblocked',
  // Bumping `sessionVersion` on its own, without blocking. Blocking bumps it
  // too, and is recorded as `student.blocked` alone: two rows for one button
  // would suggest two decisions were taken.
  STUDENT_SESSIONS_REVOKED: 'student.sessions_revoked',
  STUDENT_UPDATED: 'student.updated',
  STUDENT_ROLE_CHANGED: 'student.role_changed',

  // ── Orders and payments ─────────────────────────────────────────────────
  // Administrator-initiated actions only. What the gateway then decides is
  // recorded by `reconcile.service.ts` under `payment.reconcile.*`, so a refund
  // leaves two rows: the request, and the outcome the provider returned.
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_RECONCILE_REQUESTED: 'order.reconcile_requested',
  PAYMENT_REFUND_REQUESTED: 'payment.refund_requested',
  PAYMENT_REFUND_FAILED: 'payment.refund_failed',
  PAYMENT_REVIEW_FLAGGED: 'payment.review_flagged',
  PAYMENT_REVIEW_CLEARED: 'payment.review_cleared',

  // ── Access ──────────────────────────────────────────────────────────────
  // These mirror the three `EntitlementEventType` members. The event row is the
  // authoritative access history; the audit row is the administrative record of
  // who decided it, and both are written in the same transaction.
  ENTITLEMENT_GRANTED: 'entitlement.granted',
  ENTITLEMENT_REVOKED: 'entitlement.revoked',
  ENTITLEMENT_REACTIVATED: 'entitlement.reactivated',

  // ── Platform settings ───────────────────────────────────────────────────
  // One action for the whole key/value store, with the key in `targetId`.
  SETTING_UPDATED: 'setting.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * The model an action was performed on, spelled as the Prisma model name so a
 * row can be joined back to its subject without a lookup table.
 *
 * The target is the record that changed, which is not always the record the
 * screen was showing. Reordering lessons targets the `CourseModule` they belong
 * to, because the ordering is a property of the container; editing one of them
 * targets the `Lesson`. `SiteSetting` is the one model keyed by a string rather
 * than a uuid, so its `targetId` carries the setting key.
 *
 * Every member needs an Arabic name in `COPY.adminAudit.targetTypeLabels`.
 */
export type AuditTargetType =
  | 'Product'
  | 'Question'
  | 'QuestionStimulus'
  | 'MediaAsset'
  | 'Course'
  | 'CourseModule'
  | 'Lesson'
  | 'LessonQuiz'
  | 'VideoAsset'
  | 'ExamSimulator'
  | 'ExamVersion'
  | 'ExamSection'
  | 'ExamBlueprintRule'
  | 'ExamAttempt'
  | 'Order'
  | 'PaymentAttempt'
  | 'User'
  | 'Entitlement'
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
