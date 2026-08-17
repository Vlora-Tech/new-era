import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { advanceSection } from '@/services/exams/attempt-lifecycle.service';

export const runtime = 'nodejs';

/**
 * Close the current section and open the next one. Irreversible.
 *
 * There is no endpoint that reopens a section, and this is where that is
 * enforced. The confirmation dialog in the browser is a courtesy; the server
 * treats the transition as final regardless of how the request arrived.
 *
 * Advancing out of the final section finalises the attempt, so the client is
 * told which of the two happened rather than having to infer it.
 */
export const POST = routeHandler(
  'POST /api/exam-attempts/[attemptId]/sections/[attemptSectionId]/advance',
  async (
    request,
    context: { params: Promise<{ attemptId: string; attemptSectionId: string }> },
  ) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('examAttemptAction', user.id);

    const { attemptId, attemptSectionId } = await context.params;

    const result = await advanceSection({ attemptId, attemptSectionId, userId: user.id });

    if (result.outcome === 'submitted') {
      return apiSuccess({ outcome: 'submitted' as const, attemptId });
    }

    return apiSuccess({
      outcome: 'advanced' as const,
      attemptId,
      nextSectionId: result.nextSectionId,
      nextPosition: result.nextPosition,
      serverTime: new Date().toISOString(),
    });
  },
);
