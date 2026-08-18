import { z } from 'zod';

import {
  questionDifficultySchema,
  questionDomainSchema,
  questionTrackSchema,
} from '@/validators/admin-question';

/**
 * Exam simulator administration schemas.
 *
 * The classification enums are imported from `admin-question.ts` rather than
 * restated: a blueprint rule addresses the question bank, and a rule that could
 * name a domain the bank cannot store is a rule that draws nothing. One
 * definition means the two can never drift apart, and the Arabic messages stay
 * identical on both screens.
 *
 * Stripped by omission, each for a reason:
 *
 *  - `status` and `publishedAt` on a version — publication freezes a structure
 *    that live attempts are generated from, so it is an audited transition with
 *    preconditions rather than a column an edit form may set.
 *  - `versionNumber` — derived from `MAX(versionNumber) + 1` for the simulator,
 *    because `@@unique([simulatorId, versionNumber])` makes a client-chosen
 *    number a collision waiting to happen.
 *  - `position` on a section or a rule — appended on create, changed only by an
 *    explicit reorder. Accepting one would admit the duplicates that
 *    `@@unique([examVersionId, position])` then rejects as a 500.
 *  - `questionVersion` on a fixed section question — it is the bank's
 *    `currentVersion` at the moment the question was attached, read by the
 *    server. A client-supplied version could point a paper at a snapshot that
 *    was never published.
 *
 * Messages are Arabic because the same schemas resolve the browser forms.
 */

// ───────────────────────────────── Enums ────────────────────────────────────

export const examVersionStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'RETIRED'], {
  message: 'حالة الإصدار غير صحيحة',
});

export const selectionModeSchema = z.enum(['FIXED', 'BLUEPRINT'], {
  message: 'طريقة اختيار الأسئلة غير صحيحة',
});

/**
 * The four audited moves a version can make.
 *
 * Publication and activation are separate members rather than one "status"
 * field, because they answer different questions: publishing freezes a
 * structure, activating decides which frozen structure students receive.
 */
export const examVersionActionSchema = z.enum(['publish', 'retire', 'activate', 'deactivate'], {
  message: 'الإجراء غير صحيح',
});

// ─────────────────────────────── Primitives ─────────────────────────────────

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
 * A public address for the structure's source, or nothing.
 *
 * Restricted to `http`/`https`: the value is rendered as a link on an
 * administration screen, and `javascript:` in an href is a script that runs with
 * the administrator's session.
 */
const optionalUrl = z
  .string()
  .trim()
  .max(2_000, 'الرابط طويل جدًا')
  .nullish()
  .transform((value) => (value == null || value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^https?:\/\//i.test(value),
    'الرابط يجب أن يبدأ بـ http أو https',
  );

/**
 * A date typed as `YYYY-MM-DD` by a person, or nothing.
 *
 * Not `z.coerce.date()`: coercion turns `null` into the Unix epoch and an
 * unparseable string into `Invalid Date`, both of which would reach the column
 * as a date nobody chose. The empty string is the browser's "field left blank"
 * and has to mean `null`, not the first of January 1970.
 */
const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value == null) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: 'custom', message: 'التاريخ غير صحيح' });
        return z.NEVER;
      }
      return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'التاريخ غير صحيح' });
      return z.NEVER;
    }
    return parsed;
  });

/**
 * A duration in whole seconds.
 *
 * `z.number().int()` rather than a coercion, and bounded at twelve hours: the
 * section clock is server-authoritative and runs while the browser is closed, so
 * a stray digit is an attempt nobody can finish rather than a typo somebody
 * notices.
 */
const durationSecSchema = z
  .number('المدة مطلوبة')
  .int('المدة يجب أن تكون عددًا صحيحًا من الثواني')
  .min(1, 'المدة يجب أن تكون أكبر من صفر')
  .max(43_200, 'المدة أطول من الحد المسموح');

const questionCountSchema = z
  .number('عدد الأسئلة مطلوب')
  .int('عدد الأسئلة يجب أن يكون عددًا صحيحًا')
  .min(1, 'عدد الأسئلة يجب أن يكون أكبر من صفر')
  .max(500, 'عدد الأسئلة أكبر من الحد المسموح');

// ────────────────────────────── The simulator ───────────────────────────────

/**
 * The `ExamSimulator` row.
 *
 * `activeExamVersionId` is present even though activation is its own audited
 * action: the settings screen shows the active version as a field, and a form
 * that displays a value it cannot submit is a form that silently discards a
 * choice. The service treats a *change* to this field as an activation with its
 * own preconditions and its own audit row, rather than folding it into the
 * settings diff.
 *
 * **Every optional field is `.optional()` and never `.default()`, and the
 * distinction is load-bearing.** This is a `PATCH`, so an absent key means "do
 * not touch this", and a default would turn it into "set this to null". With
 * `activeExamVersionId: z.uuid().nullish().default(null)`, a body of
 * `{"track":"GENERAL"}` parsed into a *deactivation* of the live exam version, a
 * cleared intro video and training mode switched off — three pieces of live
 * state destroyed by a request that named none of them, and an
 * `exam_version.deactivated` audit row recording a decision nobody took. The
 * browser form sends all five fields, so only a script or an integration would
 * ever have hit it; that is exactly the caller least able to notice.
 *
 * `track` stays required because it is the one field the settings screen always
 * submits and the one whose change carries its own preconditions.
 */
export const updateSimulatorSchema = z.object({
  track: questionTrackSchema,
  fullSimulationEnabled: z.boolean().optional(),
  trainingModeEnabled: z.boolean().optional(),
  introVideoAssetId: z.uuid('معرّف المقطع التعريفي غير صحيح').nullable().optional(),
  activeExamVersionId: z.uuid('معرّف الإصدار غير صحيح').nullable().optional(),
});

export const simulatorListQuerySchema = z.object({
  q: z.string().trim().max(160).optional().catch(undefined),
  track: questionTrackSchema.optional().catch(undefined),
  versionStatus: examVersionStatusSchema.optional().catch(undefined),
  hasActiveVersion: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

// ──────────────────────────────── Versions ──────────────────────────────────

/**
 * The editable body of a version.
 *
 * `resultDisclaimer` is accepted empty here and refused at publication. The
 * column is non-nullable, so a draft that has not been worded yet holds `""`;
 * making the field mandatory at creation would mean an administrator cannot
 * start laying out sections before the legal wording is agreed, which is the
 * order the work actually happens in.
 */
const examVersionFields = {
  selectionMode: selectionModeSchema.default('BLUEPRINT'),
  totalQuestions: questionCountSchema,
  totalDurationSec: durationSecSchema,
  resultDisclaimer: z
    .string()
    .trim()
    .max(2_000, 'إشعار النتيجة طويل جدًا')
    .nullish()
    .transform((value) => value ?? ''),
  changeSummary: optionalText(2_000, 'ملخّص التغيير طويل جدًا'),
  sourceLabel: optionalText(200, 'اسم المصدر طويل جدًا'),
  sourceUrl: optionalUrl,
  sourceRetrievedAt: optionalDate,
  sourceNote: optionalText(2_000, 'ملاحظة المصدر طويلة جدًا'),
};

export const updateExamVersionSchema = z.object(examVersionFields);

/**
 * Creating a version, either blank or as a copy.
 *
 * A discriminated union rather than an optional `sourceVersionId`, because the
 * two carry different bodies: a clone takes its structure from the source and
 * would silently ignore any totals sent alongside it. Making the mode explicit
 * means the server never has to guess which half of the body was meant.
 */
export const createExamVersionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('blank') }).extend(examVersionFields),
  z.object({
    mode: z.literal('clone'),
    sourceVersionId: z.uuid('معرّف الإصدار المصدر غير صحيح'),
    changeSummary: optionalText(2_000, 'ملخّص التغيير طويل جدًا'),
  }),
]);

export const examVersionStatusActionSchema = z.object({ action: examVersionActionSchema });

// ──────────────────────────────── Sections ──────────────────────────────────

const examSectionFields = {
  title: z.string().trim().min(2, 'اسم القسم قصير جدًا').max(160, 'اسم القسم طويل جدًا'),
  durationSec: durationSecSchema,
  questionCount: questionCountSchema,
  calculatorEnabled: z.boolean().default(false),
  scratchpadEnabled: z.boolean().default(true),
  allowReviewWithinSection: z.boolean().default(true),
  lockOnAdvance: z.boolean().default(true),
  pauseEnabled: z.boolean().default(false),
};

export const createExamSectionSchema = z.object(examSectionFields);

/**
 * Editing a section, or changing which fixed questions it holds.
 *
 * One endpoint with an explicit operation rather than three: the fixed list is
 * part of the section rather than a resource of its own — it has no identity a
 * URL could name — and an `op` the caller has to spell out is what stops a body
 * missing half its fields from being read as "clear everything else".
 */
export const updateExamSectionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('settings') }).extend(examSectionFields),
  z.object({
    op: z.literal('questions'),
    action: z.enum(['add', 'remove'], { message: 'الإجراء غير صحيح' }),
    questionId: z.uuid('معرّف السؤال غير صحيح'),
  }),
]);

/**
 * A reorder, sent as the complete new order.
 *
 * The whole list rather than "move this one up": positions carry a unique
 * constraint per parent, so a partial instruction has to be turned into a
 * sequence of swaps somewhere, and doing that in the browser means two
 * administrators reordering at once can interleave into an order neither chose.
 * The server compares the submitted set against what it holds and refuses a
 * stale list outright.
 */
export const reorderSchema = z.object({
  ids: z
    .array(z.uuid('معرّف غير صحيح'))
    .min(1, 'لا يوجد ما يُرتَّب')
    .max(200, 'عدد العناصر أكبر من الحد المسموح'),
});

// ───────────────────────────── Blueprint rules ──────────────────────────────

/**
 * One selection rule.
 *
 * `percentage` and `questionCount` are both optional here and the service
 * refuses a rule that sets neither or both. The rule is not expressible as a
 * Zod refinement across a discriminated union without duplicating every other
 * field, and it needs the section's own question count to say anything useful —
 * "٤٠٪ ومعها ١٢ سؤالًا" is ambiguous in a way only the server can resolve.
 */
const blueprintRuleFields = {
  domain: questionDomainSchema,
  subskill: optionalText(160, 'اسم المهارة الفرعية طويل جدًا'),
  difficulty: questionDifficultySchema.nullish().transform((value) => value ?? null),
  track: questionTrackSchema.nullish().transform((value) => value ?? null),
  percentage: z
    .number('النسبة يجب أن تكون رقمًا')
    .int('النسبة يجب أن تكون عددًا صحيحًا')
    .min(1, 'النسبة يجب أن تكون أكبر من صفر')
    .max(100, 'النسبة لا يمكن أن تتجاوز ١٠٠')
    .nullish()
    .transform((value) => value ?? null),
  questionCount: z
    .number('عدد الأسئلة يجب أن يكون رقمًا')
    .int('عدد الأسئلة يجب أن يكون عددًا صحيحًا')
    .min(1, 'عدد الأسئلة يجب أن يكون أكبر من صفر')
    .max(500, 'عدد الأسئلة أكبر من الحد المسموح')
    .nullish()
    .transform((value) => value ?? null),
};

export const createBlueprintRuleSchema = z.object(blueprintRuleFields);

/**
 * Editing or reordering the rules of one section.
 *
 * The rules live under their section's URL because a rule has no meaning apart
 * from it: its share is a share *of that section*, and its position orders it
 * against that section's other rules.
 */
export const updateBlueprintRuleSchema = z.discriminatedUnion('op', [
  z
    .object({ op: z.literal('update'), ruleId: z.uuid('معرّف القاعدة غير صحيح') })
    .extend(blueprintRuleFields),
  z.object({ op: z.literal('reorder'), ids: reorderSchema.shape.ids }),
]);

// ───────────────────────────────── Types ────────────────────────────────────

/** Output types, after coercion, trimming and defaults. */
export type UpdateSimulatorInput = z.infer<typeof updateSimulatorSchema>;
export type SimulatorListQuery = z.infer<typeof simulatorListQuerySchema>;
export type CreateExamVersionInput = z.infer<typeof createExamVersionSchema>;
export type UpdateExamVersionInput = z.infer<typeof updateExamVersionSchema>;
export type ExamVersionAction = z.infer<typeof examVersionActionSchema>;
export type CreateExamSectionInput = z.infer<typeof createExamSectionSchema>;
export type UpdateExamSectionInput = z.infer<typeof updateExamSectionSchema>;
export type ExamSectionSettingsInput = Extract<UpdateExamSectionInput, { op: 'settings' }>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type CreateBlueprintRuleInput = z.infer<typeof createBlueprintRuleSchema>;
export type UpdateBlueprintRuleInput = z.infer<typeof updateBlueprintRuleSchema>;
export type BlueprintRuleSettingsInput = Extract<UpdateBlueprintRuleInput, { op: 'update' }>;

/** Input types, for the form values before they are transformed. */
export type UpdateSimulatorFormValues = z.input<typeof updateSimulatorSchema>;
export type ExamVersionFormValues = z.input<typeof updateExamVersionSchema>;
export type ExamSectionFormValues = z.input<typeof createExamSectionSchema>;
export type BlueprintRuleFormValues = z.input<typeof createBlueprintRuleSchema>;
