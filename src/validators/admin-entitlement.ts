import { z } from 'zod';

import { emailSchema } from '@/validators/auth';
import { calendarDaySchema } from '@/validators/admin-student';

/**
 * Entitlement administration schemas.
 *
 * Access is the one thing on this platform that a student can be given without
 * paying for it, so the schemas are shaped around two refusals:
 *
 *  - **A reason is not optional.** `EntitlementEvent.reason` is documented in the
 *    schema as "required by the service layer for manual administrator actions",
 *    and this is the layer that makes that true. The history is the evidence
 *    trail for "why does this student have access"; an event with no reason is a
 *    row that answers the question with a shrug.
 *  - **Dates are not fields.** `grantedAt`, `revokedAt`, `status` and the whole
 *    event log are absent from every schema here, so no request body can
 *    back-date a grant or rewrite a withdrawal. They are consequences of the
 *    transitions below, recorded by the service.
 *
 * Messages are Arabic because the same schemas resolve the browser form.
 */

export const entitlementStatusValueSchema = z.enum(['ACTIVE', 'REVOKED'], {
  message: 'حالة الوصول غير صحيحة',
});

export const productTypeValueSchema = z.enum(['COURSE', 'EXAM_SIMULATOR'], {
  message: 'نوع المنتج غير صحيح',
});

/**
 * Where the current access came from, as the list filter offers it.
 *
 * Derived rather than stored: `order` is an entitlement whose `sourceOrderId` is
 * set, `admin` is one with no order but an administrator named on one of its
 * events, and `system` is neither. The service documents how each becomes a
 * `where` clause.
 */
export const entitlementSourceSchema = z.enum(['order', 'admin', 'system'], {
  message: 'مصدر الوصول غير صحيح',
});

/**
 * The mandatory reason, shared by all three administrative transitions.
 *
 * The lower bound is three characters rather than one: a single letter satisfies
 * "not empty" while telling a reader nothing, and this string is read months
 * later by somebody establishing whether access was legitimate.
 */
export const entitlementReasonSchema = z
  .string()
  .trim()
  .min(3, 'السبب مطلوب، واكتبه بما يكفي لفهمه لاحقًا')
  .max(500, 'السبب طويل جدًا');

/**
 * A manual grant.
 *
 * The student is named by address rather than by id. An id is not something an
 * administrator has to hand — the address is what a support conversation
 * contains — and `emailSchema` normalises it to the trimmed lowercase form the
 * unique index stores, so a pasted "  Sara@Example.com " finds the same row the
 * student signs in with. The service answers an address with no account as
 * `userNotFound` rather than creating one: this endpoint grants access, it does
 * not register people.
 */
export const grantEntitlementSchema = z.object({
  email: emailSchema,
  productId: z.uuid('معرّف المنتج غير صحيح'),
  reason: entitlementReasonSchema,
});

/**
 * Revoking, and putting back what was revoked.
 *
 * One endpoint carrying the target state, in the same shape as the product
 * publication transition: the two directions share every precondition except
 * which one they refuse as a no-op, and separate endpoints would mean two places
 * to remember the audit row and the event.
 */
export const entitlementStatusTransitionSchema = z.object({
  status: entitlementStatusValueSchema,
  reason: entitlementReasonSchema,
});

/**
 * List filters, read from the query string. `.catch()` throughout, for the same
 * reason as every other administration list: a browsing surface degrades to the
 * unfiltered first page rather than refusing to draw.
 */
export const entitlementListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  status: entitlementStatusValueSchema.optional().catch(undefined),
  productId: z.uuid().optional().catch(undefined),
  productType: productTypeValueSchema.optional().catch(undefined),
  source: entitlementSourceSchema.optional().catch(undefined),
  from: calendarDaySchema.optional().catch(undefined),
  to: calendarDaySchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/** Output types, after coercion, trimming and defaults. */
export type EntitlementListQuery = z.infer<typeof entitlementListQuerySchema>;
export type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>;
export type EntitlementStatusTransitionInput = z.infer<typeof entitlementStatusTransitionSchema>;
export type EntitlementSource = z.infer<typeof entitlementSourceSchema>;

/** Input types, for the form values before they are transformed. */
export type GrantEntitlementFormValues = z.input<typeof grantEntitlementSchema>;
