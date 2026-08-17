import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { startAttempt } from '@/services/exams/attempt-lifecycle.service';

export const runtime = 'nodejs';

/**
 * Put the attempt on the clock.
 *
 * Idempotent: replaying this against an already-running attempt reports the
 * existing timestamps rather than restarting it. A retried request after a lost
 * response must not hand the student a fresh 25 minutes.
 */
export const POST = routeHandler(
  'POST /api/exam-attempts/[attemptId]/start',
  async (request, context: { params: Promise<{ attemptId: string }> }) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('examAttemptAction', user.id);

    const { attemptId } = await context.params;
    const result = await startAttempt(attemptId, user.id);

    return apiSuccess({
      attemptId: result.attemptId,
      status: result.status,
      startedAt: result.startedAt?.toISOString() ?? null,
      maxEndAt: result.maxEndAt?.toISOString() ?? null,
      started: result.started,
      serverTime: new Date().toISOString(),
    });
  },
);
