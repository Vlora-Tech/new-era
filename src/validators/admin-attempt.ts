import { z } from 'zod';

// One definition of "a Riyadh calendar day", shared with the orders screen
// rather than copied. Two admin lists filter by date, and two implementations of
// a timezone boundary is how one of them starts disagreeing with the other about
// what happened at 01:00.
import { riyadhDayFilter } from './admin-order';

/**
 * Exam attempt administration schemas.
 *
 * This file declares a list query and nothing else, on purpose. An attempt is
 * the record of what a student was shown and what they did with it; there is no
 * schema here for editing an answer, re-marking a question, extending a clock or
 * reopening a locked section, because the screen offers none of those. A schema
 * that existed "for later" is the first half of the feature, and the feature is
 * one that destroys the evidentiary value of the whole table.
 *
 * Every field `.catch()`es: a browsing surface answers bad input with page one,
 * not with a validation error.
 */

export const attemptModeSchema = z.enum(['FULL_SIMULATION', 'TRAINING'], {
  message: 'نمط المحاولة غير صحيح',
});

export const attemptStatusSchema = z.enum(
  ['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'],
  { message: 'حالة المحاولة غير صحيحة' },
);

/**
 * How administrator rehearsals are treated.
 *
 * Three values rather than a boolean because there are genuinely three
 * questions. `exclude` is the default: a dry run is a rehearsal against a
 * version, and counting it among student attempts is how a list of "what
 * students did" quietly stops being one. `only` is how somebody checks their own
 * rehearsals, and `include` is the deliberate "show me everything".
 */
export const dryRunFilterSchema = z.enum(['exclude', 'include', 'only']).catch('exclude');

export type DryRunFilter = z.infer<typeof dryRunFilterSchema>;

export const attemptListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  mode: attemptModeSchema.optional().catch(undefined),
  status: attemptStatusSchema.optional().catch(undefined),
  simulatorId: z.uuid().optional().catch(undefined),
  examVersionId: z.uuid().optional().catch(undefined),
  dryRun: dryRunFilterSchema,
  from: riyadhDayFilter('start'),
  to: riyadhDayFilter('end'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  // Attempts outgrow every other table in the system, so the ceiling matters
  // here in a way it does not on a catalogue of four products.
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

export type AttemptListQuery = z.infer<typeof attemptListQuerySchema>;
