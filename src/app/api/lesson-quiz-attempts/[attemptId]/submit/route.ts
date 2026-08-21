import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { submitLessonQuizAttempt } from '@/services/courses/lesson-quiz.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ attemptId: string }> };

/**
 * Grade the attempt and close it.
 *
 * Submitting is the moment the answer key becomes disclosable, so it is a POST
 * against the attempt rather than a flag on the last answer: the transition has
 * to be one server-side act that either happens or does not. A second call
 * finds the attempt already submitted and is refused, which is why the client
 * can retry a request whose response it never saw.
 *
 * The refreshed view comes back with every question's verdict and explanation.
 */
export const POST = routeHandler(
  'POST /api/lesson-quiz-attempts/[attemptId]/submit',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('lessonQuizAnswer', user.id);

    const { attemptId } = await context.params;

    const response = apiSuccess(await submitLessonQuizAttempt(attemptId, user.id));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
);
