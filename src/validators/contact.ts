import { z } from 'zod';

import { COPY } from '@/lib/copy';

const FIELDS = COPY.contact.form;

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, FIELDS.name.required).max(100, FIELDS.name.tooLong),
  email: z.string().trim().toLowerCase().email(FIELDS.email.invalid).max(254, FIELDS.email.invalid),
  subject: z
    .string()
    .trim()
    .max(160, FIELDS.subject.tooLong)
    .transform((value) => value || undefined),
  message: z.string().trim().min(10, FIELDS.message.tooShort).max(5_000, FIELDS.message.tooLong),
  /** Invisible honeypot. Real users never interact with it. */
  website: z.string().max(200).optional().default(''),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
export type ContactMessageFormValues = z.input<typeof contactMessageSchema>;

export const contactMessageListQuerySchema = z.object({
  q: z.string().trim().max(160).catch('').default(''),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(20).default(20),
});

export type ContactMessageListQuery = z.infer<typeof contactMessageListQuerySchema>;

export const contactMessageIdSchema = z.string().uuid();
