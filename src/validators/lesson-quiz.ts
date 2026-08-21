import { z } from 'zod';

/**
 * The student's lesson-quiz requests.
 *
 * One field, and it is the only thing a client is allowed to say. Correctness,
 * the score, the attempt number and every timestamp are server-derived: an
 * endpoint that accepted any of them would be the shortest path to a fabricated
 * result, and the same rule already governs `validators/exam.ts`.
 *
 * The key is bounded but not typed as a uuid. Option keys are the option rows'
 * ids *as they were at publication*, and a snapshot cut before the schema
 * settled on uuids must still be answerable; the service checks the key against
 * the attempt's own pinned version anyway, which is the check that matters.
 */
export const saveLessonQuizAnswerSchema = z.object({
  /** The option the student chose, or null to clear it before submitting. */
  selectedOptionKey: z.string().trim().min(1).max(64).nullable().default(null),
});

export type SaveLessonQuizAnswerBody = z.infer<typeof saveLessonQuizAnswerSchema>;
