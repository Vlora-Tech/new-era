import { z } from 'zod';

import {
  RIYADH_DAY_PATTERN,
  endOfRiyadhDay,
  isRiyadhDay,
  startOfRiyadhDay,
} from '@/lib/riyadh-day';

/**
 * Reading the audit trail.
 *
 * **This file has one schema and it is a query.** There is deliberately no
 * create, update or delete schema here, and adding one would not be a feature —
 * `AuditLog` is append-only, written exclusively by `writeAuditLog` inside the
 * transaction of the change it describes. A trail an administrator can edit is
 * not evidence of anything, so the absence below is the design.
 *
 * Two decisions worth stating, because both look arbitrary from the outside:
 *
 *  1. **`action` is a bounded free string, not an enum.** `AuditLog.action` is
 *     `String` in the schema, and the closed vocabulary lives in
 *     `AUDIT_ACTIONS` — a `server-only` module this file must not pull in, since
 *     the filter bar that imports these types is rendered from a page. A filter
 *     on an unknown action is harmless: it matches nothing and the screen says
 *     so. The `<select>` is populated from `COPY.adminAudit.actionLabels`, which
 *     is keyed by the same literals.
 *  2. **Dates are Riyadh days, not UTC days.** An administrator typing
 *     `2026-08-17` into "من تاريخ" means that day in Riyadh. Parsed as UTC it
 *     would silently include the last three hours of the sixteenth and drop the
 *     last three of the seventeenth — an off-by-three-hours window on a screen
 *     whose entire job is to say exactly when something happened.
 */

/**
 * Every member of `AuditTargetType`, restated as a value.
 *
 * A restatement rather than an import for the same reason as `action` above: the
 * union lives in a `server-only` module. `COPY.adminAudit.targetTypeLabels` is
 * keyed by these exact names, and a member added there without being added here
 * simply cannot be filtered on — which is visible immediately, unlike a silent
 * mismatch.
 */
export const AUDIT_TARGET_TYPES = [
  'Product',
  'Question',
  'QuestionStimulus',
  'MediaAsset',
  'Course',
  'CourseModule',
  'Lesson',
  'LessonQuiz',
  'ExamSimulator',
  'ExamVersion',
  'ExamSection',
  'ExamBlueprintRule',
  'ExamAttempt',
  'Order',
  'PaymentAttempt',
  'User',
  'Entitlement',
  'SiteSetting',
] as const;

export type AuditTargetTypeName = (typeof AUDIT_TARGET_TYPES)[number];

export const auditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES, {
  message: 'نوع العنصر غير صحيح',
});

/**
 * The coarse groups the action filter offers, and the `action` prefixes each
 * one covers.
 *
 * Seventy options in one `<select>` is a control nobody uses; the group narrows
 * it to a handful first. The grouping follows where an administrator would look
 * rather than the literal first segment — `module.*` and `lesson.*` are course
 * content, and `payment.*` belongs with the order it was taken against.
 *
 * The prefixes carry their trailing dot on purpose. Without it, `lesson.` would
 * also match `lesson_quiz.created`, and the two are separate rows on separate
 * screens.
 */
export const AUDIT_ACTION_GROUP_PREFIXES = {
  product: ['product.'],
  question: ['question.'],
  media: ['media.'],
  course: ['course.', 'module.', 'lesson.', 'lesson_quiz.', 'video.'],
  simulator: ['simulator.', 'exam_version.', 'exam_section.', 'blueprint_rule.'],
  student: ['student.'],
  order: ['order.', 'payment.'],
  entitlement: ['entitlement.'],
  setting: ['setting.'],
} as const satisfies Record<string, readonly string[]>;

export type AuditActionGroup = keyof typeof AUDIT_ACTION_GROUP_PREFIXES;

export const AUDIT_ACTION_GROUPS = Object.keys(
  AUDIT_ACTION_GROUP_PREFIXES,
) as readonly AuditActionGroup[];

export const auditActionGroupSchema = z.enum(
  Object.keys(AUDIT_ACTION_GROUP_PREFIXES) as [AuditActionGroup, ...AuditActionGroup[]],
  { message: 'مجال الإجراء غير صحيح' },
);

/**
 * Which group an action belongs to, or `null` for one no group claims.
 *
 * `null` is a real answer, not a failure: an action added to `AUDIT_ACTIONS`
 * under a new domain is still a valid row that must still be listed. The filter
 * simply cannot narrow to it until a prefix is added above.
 */
export function auditActionGroup(action: string): AuditActionGroup | null {
  for (const group of AUDIT_ACTION_GROUPS) {
    if (AUDIT_ACTION_GROUP_PREFIXES[group].some((prefix) => action.startsWith(prefix))) {
      return group;
    }
  }
  return null;
}

/**
 * `<input type="date">` submits `YYYY-MM-DD`. The window is closed at both ends
 * on the day the administrator named: `to=2026-08-17` includes everything that
 * happened on the seventeenth, because a range that excluded the day it names
 * would be read as a bug by every person who used it.
 *
 * The Riyadh arithmetic itself is `@/lib/riyadh-day`, shared with the order and
 * student filters. `refine` runs before the transform because `2026-02-31`
 * matches the pattern and names no day at all; refusing it here keeps it a
 * validation miss the `.catch()` turns into "unfiltered", instead of letting it
 * reach a constructor that would refuse it by throwing.
 */
function dayBoundarySchema(edge: 'start' | 'end') {
  return z
    .string()
    .trim()
    .regex(RIYADH_DAY_PATTERN)
    .refine(isRiyadhDay)
    .transform((value) => (edge === 'start' ? startOfRiyadhDay(value) : endOfRiyadhDay(value)))
    .optional()
    .catch(undefined);
}

/**
 * List filters, read from the query string.
 *
 * `.catch()` on every field, exactly as the products list does: a browsing
 * surface has a sensible answer for `?page=abc` and a validation error is not
 * it. Nothing in this file is a mutation, so nothing in it needs to refuse.
 *
 * `perPage` defaults higher than the catalogue's because a trail is read by
 * scanning: fifty rows is roughly what fits a scroll, and paging every
 * twenty-five turns "what happened this morning" into six navigations.
 */
export const auditLogQuerySchema = z.object({
  /** Matches the actor's address as a substring, or a target id exactly. */
  q: z.string().trim().max(200).optional().catch(undefined),
  action: z.string().trim().max(120).optional().catch(undefined),
  actionGroup: auditActionGroupSchema.optional().catch(undefined),
  targetType: auditTargetTypeSchema.optional().catch(undefined),
  from: dayBoundarySchema('start'),
  to: dayBoundarySchema('end'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(200).catch(50),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
