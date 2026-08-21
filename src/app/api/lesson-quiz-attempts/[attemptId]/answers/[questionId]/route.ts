import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { saveLessonQuizAnswer } from '@/services/courses/lesson-quiz.service';
import { saveLessonQuizAnswerSchema } from '@/validators/lesson-quiz';

export const runtime = 'nodejs';

type Context = { params: Promise<{ attemptId: string; questionId: string }> };

/**
 * Record one answer.
 *
 * There is no `saveVersion` here, and the omission is deliberate rather than an
 * economy. The exam's optimistic-concurrency dance exists because a timed
 * attempt open in two tabs can silently lose a real answer; a lesson quiz has no
 * clock and can be sat again, so last-write-wins costs a student nothing they
 * cannot immediately redo. The one place where order genuinely matters —
 * immediate feedback, where the first answer settles the question — is
 * serialised in the database by a conditional update, not by a version the
 * client sends.
 *
 * In immediate mode the response carries the verdict and the explanation for
 * this question and nothing else. That is the only path by which a key reaches
 * a student before submission, and it opens exactly one question at a time.
 */
export const PUT = routeHandler(
  'PUT /api/lesson-quiz-attempts/[attemptId]/answers/[questionId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('lessonQuizAnswer', user.id);

    const { attemptId, questionId } = await context.params;
    const body = saveLessonQuizAnswerSchema.parse(await request.json());

    const result = await saveLessonQuizAnswer({
      attemptId,
      questionId,
      userId: user.id,
      selectedOptionKey: body.selectedOptionKey,
    });

    const response = apiSuccess(result);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
);
