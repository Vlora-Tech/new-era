import { z } from 'zod';

/**
 * Commerce request schemas.
 *
 * These schemas are as much a security boundary as a validation step. Zod strips
 * keys it does not declare, so a request body carrying `priceHalalas`,
 * `amountHalalas`, `status` or `currency` loses them here before any service
 * sees it — the server reads every one of those from the product row instead.
 * Nothing about money is declared in this file for exactly that reason.
 */

/**
 * A client-generated idempotency key. A UUID rather than a free string so the
 * key space cannot be crowded, and so a retry is recognisably a retry.
 */
const checkoutRequestKeySchema = z.uuid('مفتاح الطلب غير صحيح');

export const createOrderSchema = z.object({
  productId: z.uuid('معرّف المنتج غير صحيح'),
  checkoutRequestKey: checkoutRequestKeySchema,
});

/**
 * The gateway payment identifier, and nothing else.
 *
 * The browser is never asked for an amount, a status or a card, so the schema
 * cannot accept one. The character class is restrictive because this value is
 * interpolated into a provider URL path.
 */
export const attachPaymentSchema = z.object({
  paymentId: z
    .string()
    .trim()
    .min(6, 'معرّف عملية الدفع غير صحيح')
    .max(120, 'معرّف عملية الدفع غير صحيح')
    .regex(/^[A-Za-z0-9_-]+$/, 'معرّف عملية الدفع غير صحيح'),
});

/** Development-only mock completion. Chooses an outcome, never an amount. */
export const mockPaymentCompletionSchema = z.object({
  orderId: z.uuid('معرّف الطلب غير صحيح'),
  outcome: z.enum(['paid', 'failed']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AttachPaymentInput = z.infer<typeof attachPaymentSchema>;
export type MockPaymentCompletionInput = z.infer<typeof mockPaymentCompletionSchema>;
