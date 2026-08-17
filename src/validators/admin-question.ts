import { z } from 'zod';

/**
 * Question bank administration schemas.
 *
 * Stripped by omission, and each for a reason:
 *
 *  - `workflow`, `publishedAt`, `retiredAt`, `reviewedById`, `reviewedAt` — the
 *    review path is a set of audited transitions with preconditions. A save that
 *    could also set `workflow: 'PUBLISHED'` would be a way to publish an
 *    unreviewed question through the edit form.
 *  - `currentVersion` — incremented by the publish path when it writes an
 *    immutable `QuestionVersion`. A client-supplied version would let a caller
 *    point students at a snapshot that does not exist.
 *  - `createdById` — taken from the session, never from the body.
 *  - option `position` — the array index is the position. Accepting one would
 *    admit duplicates that the `(questionId, position)` unique constraint then
 *    rejects as a 500 rather than as a field message.
 *
 * Question text is authored as plain Arabic. The columns hold the structured
 * `RichText` documents described in `src/lib/exam/content.ts`; the question
 * service wraps each string into one on the way in. That conversion is not a
 * Zod `.transform()` on purpose: react-hook-form submits a schema's *output*, so
 * a transform here would have the browser post a document to a handler whose
 * identical schema expects a string.
 */

export const questionDomainSchema = z.enum(
  [
    'VERBAL_ANALOGY',
    'SENTENCE_COMPLETION',
    'CONTEXTUAL_ERROR',
    'READING_COMPREHENSION',
    'ARITHMETIC',
    'GEOMETRY',
    'ALGEBRA',
    'DATA_ANALYSIS',
  ],
  { message: 'المهارة غير صحيحة' },
);

export const questionDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD'], {
  message: 'مستوى الصعوبة غير صحيح',
});

export const questionTrackSchema = z.enum(['SCIENTIFIC', 'THEORETICAL', 'BOTH', 'CUSTOM'], {
  message: 'المسار غير صحيح',
});

export const questionWorkflowSchema = z.enum(
  ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED'],
  { message: 'حالة المراجعة غير صحيحة' },
);

export const rightsDeclarationSchema = z.enum(['ORIGINAL', 'LICENSED'], {
  message: 'إقرار الحقوق غير صحيح',
});

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

export const questionOptionSchema = z.object({
  content: z.string().trim().min(1, 'نص الخيار مطلوب').max(2_000, 'نص الخيار طويل جدًا'),
  isCorrect: z.boolean().default(false),
});

/**
 * The options array, carrying the two rules the database also enforces.
 *
 * The "exactly one correct" refinement mirrors a partial unique index on
 * `question_options`. Duplicating the rule here is deliberate: without it a
 * second correct answer reaches PostgreSQL, comes back as a unique-violation,
 * and surfaces to an editor as an opaque 500 with their work still unsaved.
 * With it, the same mistake is a field message on the options group. The index
 * stays the authority — it also catches a write path that skips this schema.
 */
export const questionOptionsSchema = z
  .array(questionOptionSchema)
  .min(2, 'يجب إدخال خيارين على الأقل')
  .max(8, 'عدد الخيارات أكبر من الحد المسموح')
  .refine((options) => options.filter((option) => option.isCorrect).length === 1, {
    message: 'يجب تحديد إجابة صحيحة واحدة بالضبط',
  });

const questionFields = {
  stem: z.string().trim().min(3, 'نص السؤال مطلوب').max(8_000, 'نص السؤال طويل جدًا'),
  options: questionOptionsSchema,

  domain: questionDomainSchema,
  difficulty: questionDifficultySchema,
  track: questionTrackSchema,
  subskill: optionalText(120, 'اسم المهارة الفرعية طويل جدًا'),

  explanation: optionalText(8_000, 'الشرح طويل جدًا'),
  hint: optionalText(1_000, 'التلميح طويل جدًا'),

  tags: z
    .array(z.string().trim().min(1, 'الوسم فارغ').max(40, 'الوسم طويل جدًا'))
    .max(20, 'عدد الوسوم أكبر من الحد المسموح')
    .default([]),

  /**
   * Planning guidance only. It is never used to time a student or to score an
   * answer, so the bounds are generous; they exist to catch a milliseconds value
   * pasted into a seconds field.
   */
  estimatedSeconds: z
    .number()
    .int('الزمن التقديري يجب أن يكون عددًا صحيحًا من الثواني')
    .min(5, 'الزمن التقديري قصير جدًا')
    .max(3_600, 'الزمن التقديري طويل جدًا')
    .nullish()
    .transform((value) => value ?? null),

  shuffleOptions: z.boolean().default(true),

  /** An existing `QuestionStimulus` shared by several questions, if any. */
  stimulusId: z.uuid('معرّف المادة المرافقة غير صحيح').nullish().default(null),

  /**
   * Rights and provenance.
   *
   * `rightsDeclaration` is nullable in the schema but required here. The content
   * and legal checklist makes the declaration mandatory for anything entering
   * the bank, and refusing at the edge — where the editor is still looking at
   * the form — is better than refusing at publish time, when the question has
   * already been written, reviewed and queued.
   */
  authorOrLicensor: z
    .string()
    .trim()
    .min(2, 'اسم المُعِد أو الجهة المرخِّصة مطلوب')
    .max(200, 'اسم المُعِد أو الجهة المرخِّصة طويل جدًا'),
  provenanceNote: optionalText(1_000, 'بيان المصدر طويل جدًا'),
  rightsDeclaration: rightsDeclarationSchema,
};

export const createQuestionSchema = z.object(questionFields);

/** Editing replaces the whole draft, so the shape is the same. */
export const updateQuestionSchema = z.object(questionFields);

/**
 * A workflow transition.
 *
 * The schema validates that the target is a real state; whether the move is
 * legal *from the current state* is a business rule and belongs in the question
 * service, which is the only place that can read what the current state is.
 */
export const questionTransitionSchema = z.object({
  to: questionWorkflowSchema,
  note: z.string().trim().max(500, 'الملاحظة طويلة جدًا').optional(),
});

export const questionListQuerySchema = z.object({
  q: z.string().trim().max(160).optional().catch(undefined),
  domain: questionDomainSchema.optional().catch(undefined),
  difficulty: questionDifficultySchema.optional().catch(undefined),
  track: questionTrackSchema.optional().catch(undefined),
  workflow: questionWorkflowSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/** Output types, after coercion, trimming and defaults. */
export type QuestionOptionInput = z.infer<typeof questionOptionSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type QuestionTransitionInput = z.infer<typeof questionTransitionSchema>;
export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

/** Input types, for the form values before they are transformed. */
export type CreateQuestionFormValues = z.input<typeof createQuestionSchema>;
export type UpdateQuestionFormValues = z.input<typeof updateQuestionSchema>;
