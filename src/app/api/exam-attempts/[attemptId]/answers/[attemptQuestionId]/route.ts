import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import { saveAnswer } from '@/services/exams/attempt-answer.service';
import { saveAnswerSchema } from '@/validators/exam';

export const runtime = 'nodejs';

/**
 * Autosave one answer.
 *
 * The clock runs first: a save that arrives a second after the section's
 * deadline must be refused, and it is refused because the section is already
 * `LOCKED` by the time the service checks — not because this handler compared
 * timestamps itself.
 *
 * A stale `saveVersion` produces 409 carrying the current server state in
 * `details`, which is the only way a second tab can recover without guessing.
 * It is deliberately not an error the student is shown as a failure; the client
 * rebases onto the returned state.
 */
export const PUT = routeHandler(
  'PUT /api/exam-attempts/[attemptId]/answers/[attemptQuestionId]',
  async (
    request,
    context: { params: Promise<{ attemptId: string; attemptQuestionId: string }> },
  ) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('answerAutosave', user.id);

    const { attemptId, attemptQuestionId } = await context.params;
    const body = saveAnswerSchema.parse(await request.json());

    await resolveAttemptClock(attemptId);

    const result = await saveAnswer({
      attemptId,
      attemptQuestionId,
      userId: user.id,
      selectedOptionKey: body.selectedOptionKey,
      flagged: body.flagged,
      saveVersion: body.saveVersion,
      timeSpentSeconds: body.timeSpentSeconds,
    });

    if (result.outcome === 'conflict') {
      return apiFailure(409, 'save_conflict', COPY.exam.saveConflict, result.state);
    }

    return apiSuccess(result.state);
  },
);
