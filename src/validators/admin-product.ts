import { z } from 'zod';

/**
 * Product administration schemas.
 *
 * As in `commerce.ts`, these are a security boundary before they are a
 * convenience. Zod strips every key it does not declare, so the following never
 * survive a request body no matter what a client sends:
 *
 *  - `status` and `publishedAt` — publication is a separate, audited transition
 *    with its own preconditions. Folding it into the ordinary save would let a
 *    product go live through an edit form that never checked whether it had a
 *    price.
 *  - `currency` — `SAR` by CHECK constraint. Accepting it would create a code
 *    path that appears to support another currency while every amount stays a
 *    count of halalas.
 *  - `id`, `createdAt`, `updatedAt` — server-owned.
 *
 * Messages are Arabic because the same schema resolves the browser form, so a
 * field message is displayed exactly as written here.
 */

/**
 * URL slug: lowercase ASCII letters, digits and single interior hyphens.
 *
 * Restricted to ASCII on purpose. The cluster runs an ICU `ar-SA` collation, and
 * uniqueness-critical columns are normalised in the application layer precisely
 * so that uniqueness never depends on collation — an ICU version difference
 * between the Alpine image and a managed host cannot then corrupt a unique
 * index. A slug containing Arabic would put that guarantee back at risk, and it
 * would also percent-encode into an unreadable URL.
 */
export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'المعرّف قصير جدًا')
  .max(80, 'المعرّف طويل جدًا')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'المعرّف يجب أن يتكون من أحرف لاتينية صغيرة وأرقام وشرطات مفردة فقط',
  );

/**
 * Price as an integer count of halalas.
 *
 * `z.number().int()` rather than a coercion: a form that sends `"19900"` is a
 * form that has not converted its riyals yet, and silently coercing it would
 * hide that. The ceiling is a sanity bound — a hundred million halalas is a
 * million riyals — so a stray extra digit is caught at the edge rather than
 * charged to a card.
 */
export const priceHalalasSchema = z
  .number('السعر مطلوب')
  .int('السعر يجب أن يكون عددًا صحيحًا من الهللات')
  .min(0, 'السعر لا يمكن أن يكون سالبًا')
  .max(100_000_000, 'السعر أكبر من الحد المسموح');

export const productTypeSchema = z.enum(['COURSE', 'EXAM_SIMULATOR'], {
  message: 'نوع المنتج غير صحيح',
});

export const productStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'], {
  message: 'حالة النشر غير صحيحة',
});

/**
 * An optional free-text column that is `NULL` in the database when blank.
 * The empty string and `undefined` both become `null`, so an emptied textarea
 * clears the column instead of storing `""` — two values that render the same
 * and compare differently.
 */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

export const createProductSchema = z.object({
  type: productTypeSchema,
  slug: productSlugSchema,
  title: z.string().trim().min(2, 'اسم المنتج قصير جدًا').max(160, 'اسم المنتج طويل جدًا'),
  shortDescription: z
    .string()
    .trim()
    .min(10, 'الوصف المختصر قصير جدًا')
    .max(300, 'الوصف المختصر طويل جدًا'),
  longDescription: optionalText(8_000, 'الوصف التفصيلي طويل جدًا'),
  /** An existing `MediaAsset` id. The server checks it exists and is PUBLIC. */
  coverAssetId: z.uuid('معرّف صورة الغلاف غير صحيح').nullish().default(null),
  priceHalalas: priceHalalasSchema,
  featured: z.boolean().default(false),
});

/**
 * Editing a product.
 *
 * `type` is absent rather than optional: it decides whether the product owns a
 * `Course` row or an `ExamSimulator` row, and flipping it on an existing product
 * would orphan a whole content tree. The refusal is expressed by the schema not
 * having the field at all, so no handler can forget to check for it.
 */
export const updateProductSchema = createProductSchema.omit({ type: true });

/** The audited publication transition, carrying a target state and nothing else. */
export const productStatusTransitionSchema = z.object({
  status: productStatusSchema,
});

/**
 * List filters, read from the query string.
 *
 * `.catch()` throughout: a malformed `?page=abc` should show page one, not a
 * validation error page. A list view has a sensible answer for bad input; a
 * mutation does not, which is why nothing above uses `.catch()`.
 */
export const productListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  type: productTypeSchema.optional().catch(undefined),
  status: productStatusSchema.optional().catch(undefined),
  featured: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/**
 * Riyals typed by a human ⇄ halalas stored by the server.
 *
 * Money never becomes a float here. `"199.5"` is split on its separator and the
 * two halves are combined with integer arithmetic, so no amount passes through
 * binary floating point — `parseFloat('19.99') * 100` is `1998.9999…`, which
 * truncates to a riyal short of the price that was typed.
 *
 * These are pure and dependency-free so a client form can import them; the wire
 * format stays `priceHalalas`, an integer, in both directions.
 */
export function riyalsToHalalas(input: string): number | null {
  const normalised = input.trim().replace(/[٫,]/g, '.');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalised);
  if (!match) return null;

  const riyals = Number(match[1]);
  // A single decimal digit means tenths: "199.5" is 199.50, not 199.05.
  const halalas = Number((match[2] ?? '').padEnd(2, '0') || '0');
  return riyals * 100 + halalas;
}

/** Halalas as a plain editable string, e.g. `19950` → `"199.50"`. */
export function halalasToRiyals(halalas: number): string {
  const safe = Math.max(0, Math.trunc(halalas));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, '0')}`;
}

/** Output types, after coercion, trimming and defaults. */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductStatusTransitionInput = z.infer<typeof productStatusTransitionSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Input types, for the form values before they are transformed. */
export type CreateProductFormValues = z.input<typeof createProductSchema>;
export type UpdateProductFormValues = z.input<typeof updateProductSchema>;
