import { z } from 'zod';

import { RIYADH_DAY_PATTERN, isRiyadhDay } from '@/lib/riyadh-day';

/**
 * Student administration schemas.
 *
 * This screen is deliberately the narrowest write surface in the administration
 * area, and the schemas are where that narrowness is enforced rather than merely
 * described. Zod strips every key it does not declare, so none of the following
 * can reach a service no matter what a client sends:
 *
 *  - `email`, `name`, `phone` — a student's own identifying details are not
 *    editable by an administrator. The address is the sign-in identifier, and
 *    changing it under somebody is an account takeover with extra steps.
 *  - `passwordHash`, and anything password-shaped — there is no reset, no
 *    reveal, no "send a new password". The column never leaves the database row.
 *  - `role` — the administrator role is granted by a server-side tool, not by a
 *    form that any signed-in administrator can reach.
 *  - `isBlocked`, `blockedAt`, `sessionVersion` — these are the *result* of the
 *    audited transition below, not fields. `sessionVersion` in particular is the
 *    lever that retires every outstanding token, and a client that could set it
 *    directly could also set it back.
 *
 * Messages are Arabic because the same schemas resolve the browser form, so a
 * field message is displayed exactly as written here.
 */

/**
 * A calendar day as the browser's `<input type="date">` emits it.
 *
 * Kept as the string rather than transformed into a `Date`, for two reasons. The
 * filter bar re-renders the value it was given, and a `Date` would have to be
 * formatted back into `YYYY-MM-DD` on every render — a round trip that is one
 * timezone mistake away from showing yesterday. And the conversion to an instant
 * belongs to the service, which knows that a day named by a Saudi administrator
 * runs from 00:00 to 24:00 in Riyadh, not in UTC.
 *
 * The `refine` rejects `2026-02-31`, which the regexp accepts and which names no
 * day at all. It is the same predicate the day constructors in
 * `@/lib/riyadh-day` assert on, so a string that passes this schema is one those
 * constructors will honour.
 */
export const calendarDaySchema = z
  .string()
  .trim()
  .regex(RIYADH_DAY_PATTERN, 'التاريخ غير صحيح')
  .refine(isRiyadhDay, 'التاريخ غير صحيح');

export const userRoleSchema = z.enum(['STUDENT', 'ADMIN'], { message: 'الدور غير صحيح' });

/**
 * Account state, which is derived from `isBlocked` rather than stored as an
 * enum. The two spellings live here so the filter bar, the query string and the
 * service cannot each invent their own.
 */
export const studentStateSchema = z.enum(['active', 'blocked'], {
  message: 'حالة الحساب غير صحيحة',
});

/**
 * List filters, read from the query string.
 *
 * `.catch()` throughout: a malformed `?page=abc` should show page one, not an
 * error page. A browsing surface has a sensible answer for bad input; the
 * mutation below deliberately does not.
 */
export const studentListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  role: userRoleSchema.optional().catch(undefined),
  state: studentStateSchema.optional().catch(undefined),
  hasEntitlements: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  registeredFrom: calendarDaySchema.optional().catch(undefined),
  registeredTo: calendarDaySchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/**
 * Blocking and unblocking, as one audited transition carrying its direction.
 *
 * A reason is mandatory when blocking and meaningless when lifting one, which is
 * why this is a `superRefine` rather than two schemas: the endpoint is one
 * decision — "may this person sign in" — and splitting it would leave two places
 * that each have to remember to bump `sessionVersion`.
 *
 * The transform normalises the "off" case to `null` so the service stores a
 * cleared column rather than an empty string, two values that render the same
 * and compare differently.
 */
export const studentBlockSchema = z
  .object({
    blocked: z.boolean('حدّد الإجراء المطلوب'),
    reason: z.string().trim().max(500, 'سبب الإيقاف طويل جدًا').optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.blocked) return;
    if (!value.reason || value.reason.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'سبب الإيقاف مطلوب، ويُحفظ في سجل النشاط.',
      });
    }
  })
  .transform((value) => ({
    blocked: value.blocked,
    // Read as a string only on the branch the refinement has already proved.
    reason: value.blocked ? (value.reason as string) : null,
  }));

/** Output types, after coercion, trimming and defaults. */
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type StudentBlockInput = z.infer<typeof studentBlockSchema>;

/** Input types, for the form values before they are transformed. */
export type StudentBlockFormValues = z.input<typeof studentBlockSchema>;
