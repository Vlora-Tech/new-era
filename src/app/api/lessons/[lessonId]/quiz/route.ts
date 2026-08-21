import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { getLessonQuizView } from '@/services/courses/lesson-quiz.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

/**
 * The student's view of this lesson's short quiz.
 *
 * `null` rather than a 404 when there is nothing to show, for the same reason
 * the administration route answers `null`: a lesson without a quiz is the
 * ordinary case, not a bad address. The service collapses "no quiz", "no such
 * lesson", "not yours" and "every question has been retired" into that one
 * answer on purpose — each of them means the page renders no quiz section, and
 * distinguishing them in the response would tell a visitor which lessons exist.
 *
 * The page server-renders this same view, so this route serves the refresh after
 * an answer or a submission rather than the first paint.
 */
export const GET = routeHandler(
  'GET /api/lessons/[lessonId]/quiz',
  async (_request: Request, context: Context) => {
    const user = await requireAuth();
    const { lessonId } = await context.params;

    const response = apiSuccess(await getLessonQuizView(lessonId, user.id));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
);
