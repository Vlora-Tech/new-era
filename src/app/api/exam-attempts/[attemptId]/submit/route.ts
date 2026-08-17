import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { submitAttempt } from '@/services/exams/attempt-lifecycle.service';

export const runtime = 'nodejs';

/**
 * Submit the attempt.
 *
 * Idempotent by contract: a replay returns the result that was already stored
 * rather than scoring again. The client may therefore retry a submission whose
 * response was lost without risking a second, differently-timed result.
 *
 * The response carries no answer key. The review, with correct answers and
 * explanations, is a separate request that first re-establishes the attempt is
 * terminal.
 */
export const POST = routeHandler(
  'POST /api/exam-attempts/[attemptId]/submit',
  async (request, context: { params: Promise<{ attemptId: string }> }) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('examAttemptAction', user.id);

    const { attemptId } = await context.params;
    const result = await submitAttempt(attemptId, user.id);

    return apiSuccess({
      attemptId: result.attemptId,
      status: result.status,
      submittedAt: result.submittedAt?.toISOString() ?? null,
      finalised: result.finalised,
    });
  },
);
