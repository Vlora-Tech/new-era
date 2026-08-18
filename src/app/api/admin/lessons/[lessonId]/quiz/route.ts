import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteLessonQuiz,
  getLessonQuiz,
  parseLessonId,
  saveLessonQuiz,
} from '@/services/courses/course-admin.service';
import { saveLessonQuizSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

/**
 * The short quiz attached to a lesson.
 *
 * `null` rather than a 404 when there is none: a lesson without a quiz is the
 * ordinary case, not a bad address, and answering 404 would make the editor
 * treat "this lesson has no quiz yet" as an error to report.
 */
export const GET = routeHandler(
  'GET /api/admin/lessons/[lessonId]/quiz',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { lessonId } = await context.params;
    return apiSuccess(await getLessonQuiz(parseLessonId(lessonId)));
  },
);

/**
 * Create or replace the whole quiz.
 *
 * `PUT` rather than a POST plus a set of add/remove/reorder calls, because the
 * body is the complete desired state: the settings, the questions, their order
 * and their points. That is the only formulation where the
 * `@@unique([quizId, questionId])` constraint can be checked against what was
 * submitted before anything is written, and where a failure leaves the quiz
 * exactly as it was rather than half-edited.
 *
 * The questions are references into the bank, never authored here. The service
 * refuses any that is not `PUBLISHED` — the bank's review workflow exists so
 * that unreviewed material cannot reach a student, and a second door into the
 * same content would make that guarantee decorative.
 */
export const PUT = routeHandler(
  'PUT /api/admin/lessons/[lessonId]/quiz',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { lessonId } = await context.params;
    const input = saveLessonQuizSchema.parse(await request.json());

    const result = await saveLessonQuiz(parseLessonId(lessonId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(result, { status: result.created ? 201 : 200 });
  },
);

/**
 * Detach the quiz from its lesson.
 *
 * Refused once anybody has sat it: `LessonQuizAttempt.quizId` is `Restrict`, and
 * those rows are a student's record of what they answered.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/lessons/[lessonId]/quiz',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { lessonId } = await context.params;
    await deleteLessonQuiz(parseLessonId(lessonId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ deleted: true });
  },
);
