import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import { loadStudentAttemptState } from '@/services/exams/attempt-snapshot.service';

export const runtime = 'nodejs';

/**
 * The running attempt, as the student may see it.
 *
 * Three properties matter here:
 *
 *   - The clock is resolved before anything is read, so a section whose
 *     deadline passed while the tab was closed is already locked and the
 *     response describes the section the student is genuinely in.
 *   - Only the current section's questions are returned, through
 *     `toStudentQuestionView`. No correct answer and no explanation exists
 *     anywhere in this payload.
 *   - `serverTime` accompanies `deadlineAt` so the client can compute a
 *     countdown from two server timestamps and its own drift, instead of
 *     trusting its own clock or decrementing a local counter.
 */
export const GET = routeHandler(
  'GET /api/exam-attempts/[attemptId]',
  async (_request, context: { params: Promise<{ attemptId: string }> }) => {
    const user = await requireAuth();
    await enforceRateLimit('examAttemptRead', user.id);

    const { attemptId } = await context.params;
    const now = new Date();

    await resolveAttemptClock(attemptId, now);

    const state = await loadStudentAttemptState(prisma, { attemptId, userId: user.id, serverTime: now });
    if (!state) {
      return apiFailure(404, 'attempt_not_found', COPY.exam.errors.attemptNotFound);
    }

    return apiSuccess(state);
  },
);
