import { z } from 'zod';

/**
 * Exam request schemas.
 *
 * Nothing here accepts a score, a correctness flag, a completion claim or a
 * timestamp from the client. Those are all server-derived: an endpoint that
 * took them as input would be the shortest path to a fabricated result. The
 * only client-supplied timing value is `timeSpentSeconds`, which is indicative
 * telemetry, is clamped by the service, and is never used to score anything.
 */

export const attemptModeSchema = z.enum(['FULL_SIMULATION', 'TRAINING']);

export const createAttemptSchema = z.object({
  mode: attemptModeSchema.default('FULL_SIMULATION'),
  /** Administrator rehearsal. Ignored for anyone who is not an administrator. */
  dryRun: z.boolean().default(false),
});

export const saveAnswerSchema = z.object({
  /**
   * The option the student chose, or null to clear it. Validated against the
   * attempt's own snapshot, so a key from another question is refused.
   */
  selectedOptionKey: z.string().trim().min(1).max(64).nullable().default(null),
  flagged: z.boolean().default(false),
  /**
   * The version the client believes it is updating; 0 means "no answer saved
   * yet". A mismatch is a conflict, not a merge.
   */
  saveVersion: z.number().int().min(0).max(1_000_000),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
});

export type CreateAttemptBody = z.infer<typeof createAttemptSchema>;
export type SaveAnswerBody = z.infer<typeof saveAnswerSchema>;
