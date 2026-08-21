import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { startLessonQuizAttempt } from '@/services/courses/lesson-quiz.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

/**
 * Open an attempt at this lesson's quiz.
 *
 * Idempotent: a second press, or a second tab, gets the attempt that is already
 * open rather than a new one. The service decides that from the database, so the
 * guarantee does not depend on this handler being called once.
 *
 * The whole view comes back, not just an id. The client has to re-render the
 * questions anyway, and returning the same shape the page was server-rendered
 * with means there is one parser for both.
 */
export const POST = routeHandler(
  'POST /api/lessons/[lessonId]/quiz/attempts',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('lessonQuizAttemptCreate', user.id);

    const { lessonId } = await context.params;

    const response = apiSuccess(await startLessonQuizAttempt(lessonId, user.id), { status: 201 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
);
