import { z } from 'zod';

import { productStatusSchema } from '@/validators/admin-product';

/**
 * Course-content administration schemas.
 *
 * As in `admin-product.ts`, these are a security boundary before they are a
 * convenience: Zod strips every key it does not declare, so the following never
 * survive a request body no matter what a client sends.
 *
 *  - `position` — an ordering is a property of the *container*, established by
 *    the explicit reorder endpoint that receives the whole ordered list. A body
 *    that could carry a position would let two concurrent edits each claim slot
 *    three and leave the list with two of them.
 *  - `courseId` on a module, `id`, `createdAt`, `updatedAt` — server-owned. A
 *    module cannot be re-parented onto another course by editing it, because a
 *    course is a product's content tree and moving a module across products
 *    would move paid material between two things people bought separately.
 *  - `status` on the ordinary edit — publication is an audited transition with
 *    preconditions, and that is why the mutation schemas below are discriminated
 *    unions rather than one wide optional object. `intent: 'update'` has no
 *    `status` key at all, so no handler can forget to check for one.
 *
 * A lesson *may* be moved between modules of the same course, and `moduleId` is
 * therefore present on the lesson update variant. The service checks the target
 * module belongs to the same course; the schema cannot know that.
 *
 * Messages are Arabic because the same schemas resolve the browser forms, so a
 * field message is displayed exactly as written here.
 */

/** `ContentStatus`. The three states a module or a lesson can be in. */
export const contentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'], {
  message: 'حالة النشر غير صحيحة',
});

/** `FeedbackMode` on a lesson quiz. */
export const feedbackModeSchema = z.enum(['IMMEDIATE', 'AFTER_SUBMISSION'], {
  message: 'وقت إظهار النتيجة غير صحيح',
});

/**
 * An optional free-text column that is `NULL` in the database when blank.
 * The empty string and `undefined` both become `null`, so an emptied box clears
 * the column instead of storing `""` — two values that render the same and
 * compare differently.
 */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

/**
 * A completion threshold, as a whole percentage.
 *
 * Zero is excluded rather than treated as "no requirement": a lesson completed
 * by opening it is a different product decision, and it would be indistinguishable
 * from a column nobody filled in. The lesson-level field is nullable instead,
 * and null means "take the course default" — one absence with one meaning.
 */
export const completionThresholdSchema = z
  .number('نسبة المشاهدة مطلوبة')
  .int('نسبة المشاهدة يجب أن تكون عددًا صحيحًا')
  .min(1, 'نسبة المشاهدة يجب أن تكون بين ١ و١٠٠')
  .max(100, 'نسبة المشاهدة يجب أن تكون بين ١ و١٠٠');

// ── The course row itself ────────────────────────────────────────────────

/**
 * Course settings.
 *
 * Three fields, none of them content and none of them a product field. Title,
 * price and publication belong to `Product` and are edited on the catalogue
 * screen; repeating them here would create two places that both appear to own
 * the same value.
 */
export const updateCourseSettingsSchema = z.object({
  category: optionalText(80, 'التصنيف طويل جدًا'),
  level: optionalText(80, 'المستوى طويل جدًا'),
  completionThresholdPercent: completionThresholdSchema,
});

// ── Modules ──────────────────────────────────────────────────────────────

export const moduleTitleSchema = z
  .string()
  .trim()
  .min(2, 'اسم الوحدة قصير جدًا')
  .max(160, 'اسم الوحدة طويل جدًا');

export const createModuleSchema = z.object({ title: moduleTitleSchema });

/**
 * Editing a module, or moving it between states.
 *
 * A discriminated union rather than one object with optional fields, because the
 * two carry different authority. Saving a title checks nothing; publishing
 * checks that the module has something a student could open. Folding them
 * together would mean every save either re-ran the publication preconditions or
 * quietly skipped them, and the second is what actually happens.
 */
export const moduleMutationSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('update'), title: moduleTitleSchema }),
  z.object({ intent: z.literal('transition'), status: contentStatusSchema }),
]);

// ── Lessons ──────────────────────────────────────────────────────────────

export const lessonTitleSchema = z
  .string()
  .trim()
  .min(2, 'اسم الدرس قصير جدًا')
  .max(160, 'اسم الدرس طويل جدًا');

/**
 * The editable body of a lesson.
 *
 * `durationSec` is accepted from the form because there is no video provider
 * configured to read it from; when there is one it becomes a value the server
 * derives, and the field can then be dropped from here without any other file
 * changing. The ceiling is a day, which is a sanity bound rather than a policy.
 */
const lessonBodySchema = z.object({
  title: lessonTitleSchema,
  content: optionalText(20_000, 'النص المرافق طويل جدًا'),
  /** An existing `VideoAsset` id. The server checks it exists, is ready and is free. */
  videoAssetId: z
    .uuid('معرّف المقطع غير صحيح')
    .nullish()
    .transform((value) => value ?? null),
  durationSec: z
    .number('مدة الدرس يجب أن تكون عددًا من الثواني')
    .int('مدة الدرس يجب أن تكون عددًا صحيحًا من الثواني')
    .min(1, 'مدة الدرس يجب أن تكون أكبر من صفر')
    .max(86_400, 'مدة الدرس أكبر من الحد المسموح')
    .nullish()
    .transform((value) => value ?? null),
  isPreview: z.boolean().default(false),
  /** Null means "use the course default"; a number overrides it for this lesson. */
  completionThresholdPercent: completionThresholdSchema
    .nullish()
    .transform((value) => value ?? null),
});

/** Creating a lesson: the module comes from the path, never from the body. */
export const createLessonSchema = lessonBodySchema;

/**
 * Editing a lesson, or moving it between states.
 *
 * `moduleId` is on the update variant deliberately: a lesson filed under the
 * wrong module is an ordinary authoring mistake, and the fix should not be
 * "delete it and retype it". The service refuses a target module belonging to
 * another course.
 */
export const lessonMutationSchema = z.discriminatedUnion('intent', [
  lessonBodySchema.extend({
    intent: z.literal('update'),
    moduleId: z.uuid('معرّف الوحدة غير صحيح'),
  }),
  z.object({ intent: z.literal('transition'), status: contentStatusSchema }),
]);

// ── Ordering ─────────────────────────────────────────────────────────────

/**
 * A reorder: the complete ordered list of ids, in one request.
 *
 * Not a stream of "move this one up" calls. `position` is deliberately not
 * unique on `CourseModule` and `Lesson` — the schema comment says a unique
 * constraint would deadlock against the swap — so the ordering is only ever
 * consistent as a whole. Sending the whole list lets the server apply it in one
 * transaction and, just as importantly, lets it detect that the list it was
 * given no longer describes the rows that exist.
 *
 * Duplicates are rejected here rather than in the service: a list naming the
 * same id twice has no coherent reading at all.
 */
export const reorderSchema = z.object({
  ids: z
    .array(z.uuid('معرّف غير صحيح'))
    .min(1, 'قائمة الترتيب فارغة')
    .max(500, 'قائمة الترتيب أطول من الحد المسموح')
    .refine((ids) => new Set(ids).size === ids.length, 'قائمة الترتيب تحتوي على معرّف مكرر'),
});

// ── Lesson quiz ──────────────────────────────────────────────────────────

export const quizQuestionSchema = z.object({
  questionId: z.uuid('معرّف السؤال غير صحيح'),
  points: z
    .number('درجة السؤال مطلوبة')
    .int('درجة السؤال يجب أن تكون عددًا صحيحًا')
    .min(1, 'درجة السؤال يجب أن تكون واحدًا فأكثر')
    .max(100, 'درجة السؤال أكبر من الحد المسموح')
    .default(1),
});

/**
 * The whole quiz, saved as one desired state.
 *
 * The questions arrive as an ordered array rather than as add/remove calls, for
 * the same reason the reorder endpoint takes a whole list: position is an
 * attribute of the collection. It also means the `@@unique([quizId, questionId])`
 * constraint is checked against the submitted list before anything is written,
 * so a duplicate is an Arabic sentence rather than a unique-violation 500 with
 * the administrator's selection lost.
 *
 * `maxAttempts` null means unlimited. The schema will not accept zero, which
 * would be a quiz nobody can take — expressed by removing the quiz, not by a
 * number.
 */
export const saveLessonQuizSchema = z.object({
  feedbackMode: feedbackModeSchema.default('AFTER_SUBMISSION'),
  maxAttempts: z
    .number('الحد الأقصى للمحاولات يجب أن يكون عددًا')
    .int('الحد الأقصى للمحاولات يجب أن يكون عددًا صحيحًا')
    .min(1, 'الحد الأقصى للمحاولات يجب أن يكون واحدًا فأكثر')
    .max(100, 'الحد الأقصى للمحاولات أكبر من الحد المسموح')
    .nullish()
    .transform((value) => value ?? null),
  questions: z
    .array(quizQuestionSchema)
    .min(1, 'الاختبار القصير يحتاج إلى سؤال واحد على الأقل')
    .max(50, 'عدد أسئلة الاختبار القصير أكبر من الحد المسموح')
    .refine(
      (questions) => new Set(questions.map((item) => item.questionId)).size === questions.length,
      'هذا السؤال مضاف بالفعل إلى هذا الاختبار القصير',
    ),
});

// ── List filters ─────────────────────────────────────────────────────────

/**
 * Read from the query string.
 *
 * `.catch()` throughout: a malformed `?page=abc` should show page one, not a
 * validation error page. A list view has a sensible answer for bad input; a
 * mutation does not, which is why nothing above uses `.catch()`.
 *
 * `productStatus` is imported from the catalogue's schema rather than restated.
 * It is the same enum with the same meaning, and this list filters on the
 * product's column directly.
 */
export const courseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  productStatus: productStatusSchema.optional().catch(undefined),
  category: z.string().trim().max(80).optional().catch(undefined),
  hasLessons: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/** Output types, after coercion, trimming and defaults. */
export type UpdateCourseSettingsInput = z.infer<typeof updateCourseSettingsSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type ModuleMutationInput = z.infer<typeof moduleMutationSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type LessonMutationInput = z.infer<typeof lessonMutationSchema>;
export type LessonUpdateInput = Extract<LessonMutationInput, { intent: 'update' }>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type SaveLessonQuizInput = z.infer<typeof saveLessonQuizSchema>;
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

/** Input types, for the form values before they are transformed. */
export type CourseSettingsFormValues = z.input<typeof updateCourseSettingsSchema>;
export type LessonFormValues = z.input<typeof createLessonSchema>;
