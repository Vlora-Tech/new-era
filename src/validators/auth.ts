import { z } from 'zod';

import { AUTH } from '@/lib/constants';

/**
 * Authentication schemas.
 *
 * The same schema validates the browser form and the request on the server, so
 * the two can never disagree about what is acceptable. Messages are Arabic
 * because they are shown to the person filling in the form.
 */

/**
 * Normalise an address before it is validated or stored.
 * The database additionally enforces uniqueness over `lower(email)`, so a write
 * path that somehow skipped this still cannot create a duplicate account.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'البريد الإلكتروني مطلوب')
  .max(254, 'البريد الإلكتروني طويل جدًا')
  .pipe(z.email('البريد الإلكتروني غير صحيح'));

export const passwordSchema = z
  .string()
  .min(AUTH.MIN_PASSWORD_LENGTH, `كلمة المرور يجب ألا تقل عن ${AUTH.MIN_PASSWORD_LENGTH} أحرف`)
  .max(200, 'كلمة المرور طويلة جدًا');

/** Saudi mobile numbers, accepted as 05XXXXXXXX or +9665XXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+9665|05)\d{8}$/, 'رقم الجوال غير صحيح')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'الاسم قصير جدًا').max(120, 'الاسم طويل جدًا'),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: 'يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة',
    }),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

/** Output type, after coercion and defaults. */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Input type, for the form before its values are transformed. */
export type LoginFormValues = z.input<typeof loginSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;
