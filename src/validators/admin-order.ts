import { z } from 'zod';

import {
  RIYADH_DAY_PATTERN,
  endOfRiyadhDay,
  isRiyadhDay,
  startOfRiyadhDay,
} from '@/lib/riyadh-day';

/**
 * Order administration schemas.
 *
 * There is no create, update or delete schema in this file, and that absence is
 * the design rather than an omission:
 *
 *  - An order carries `amountHalalas`, `productTitle` and `productType` as
 *    snapshots taken at checkout. Nothing may edit them, so no schema declares
 *    them, so no handler can accidentally accept them.
 *  - Payment state is the provider's fact, not ours. The one administrative
 *    action on this screen re-asks the gateway and records its answer, and it
 *    reads **no request body at all** — the order id in the path is the whole
 *    input. A schema for it would only invite a future edit to let a caller name
 *    the payment, and choosing which payment fulfils which order is precisely
 *    what `reconcile.service.ts` refuses to let a caller do.
 *
 * What remains is the list query, which is a browsing surface: every field
 * `.catch()`es, so `?page=abc&status=nonsense` shows page one unfiltered instead
 * of answering a browsing request with a validation error.
 */

/**
 * One edge of a Riyadh calendar day, read from the query string.
 *
 * The day arithmetic itself lives in `@/lib/riyadh-day`, shared with the student
 * and audit filters so the three cannot drift apart about where a day starts.
 *
 * `refine` runs *before* the transform: `2026-13-45` matches the pattern and
 * would otherwise reach the constructor, which refuses a day that does not
 * exist. Refining first keeps a bad query string a validation miss — and the
 * `.catch()` below turns it into "unfiltered" — rather than a thrown request.
 */
export function riyadhDayFilter(edge: 'start' | 'end') {
  return z
    .string()
    .trim()
    .regex(RIYADH_DAY_PATTERN, 'التاريخ يجب أن يكون بصيغة سنة-شهر-يوم')
    .refine(isRiyadhDay, 'التاريخ غير صحيح')
    .transform((day) => (edge === 'start' ? startOfRiyadhDay(day) : endOfRiyadhDay(day)))
    .optional()
    .catch(undefined);
}

export const orderStatusSchema = z.enum(
  ['PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'],
  { message: 'حالة الطلب غير صحيحة' },
);

export const paymentProviderSchema = z.enum(['MOCK', 'MOYASAR'], {
  message: 'مزوّد الدفع غير صحيح',
});

export const paymentModeSchema = z.enum(['TEST', 'LIVE'], { message: 'وضع الدفع غير صحيح' });

export const paymentStatusSchema = z.enum(
  [
    'CREATED',
    'INITIATED',
    'PAID',
    'FAILED',
    'AUTHORIZED',
    'CAPTURED',
    'VERIFIED',
    'REFUNDED',
    'VOIDED',
  ],
  { message: 'حالة عملية الدفع غير صحيحة' },
);

/**
 * List filters, read from the query string.
 *
 * `mode`, `paymentStatus` and `needsReview` describe a `PaymentAttempt` rather
 * than the order itself. They are still order filters here — the screen lists
 * orders — and the service expresses each as its own `some` clause, so an order
 * with a failed test attempt and a successful live one matches both.
 */
export const orderListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  status: orderStatusSchema.optional().catch(undefined),
  provider: paymentProviderSchema.optional().catch(undefined),
  mode: paymentModeSchema.optional().catch(undefined),
  paymentStatus: paymentStatusSchema.optional().catch(undefined),
  /**
   * Only `true` narrows. A checkbox that is not ticked submits nothing, and
   * "show me the ones that do not need review" is not a question anyone asks of
   * this screen.
   */
  needsReview: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  from: riyadhDayFilter('start'),
  to: riyadhDayFilter('end'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
