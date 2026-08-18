import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteLesson,
  getLessonForAdmin,
  parseLessonId,
  transitionLessonStatus,
  updateLesson,
} from '@/services/courses/course-admin.service';
import { lessonMutationSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

/**
 * One lesson, with its body.
 *
 * The builder screen deliberately does not carry lesson bodies — a course with
 * fifty lessons would ship every word of every one of them to draw a list — so
 * the editor fetches the one it is about to change, and nothing else does.
 */
export const GET = routeHandler(
  'GET /api/admin/lessons/[lessonId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { lessonId } = await context.params;
    const lesson = await getLessonForAdmin(parseLessonId(lessonId));
    if (!lesson) {
      throw new HttpError(404, COPY.adminCourses.errors.lessonNotFound, 'lesson_not_found');
    }

    return apiSuccess(lesson);
  },
);

/**
 * Save an edit, or move the lesson between DRAFT, PUBLISHED and ARCHIVED.
 *
 * Two intents in one verb, discriminated in the body, exactly as the module
 * route does. The `update` variant has no `status` key, so the editor cannot
 * publish a lesson by saving it — publication checks that the lesson has a video
 * or some text, and a save that could skip that check is a save that publishes
 * empty pages.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/lessons/[lessonId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { lessonId } = await context.params;
    const id = parseLessonId(lessonId);
    const input = lessonMutationSchema.parse(await request.json());
    const actor = { actor: { id: admin.id, email: admin.email } };

    if (input.intent === 'transition') {
      const result = await transitionLessonStatus(id, input.status, actor);
      return apiSuccess({ id, ...result });
    }

    const lesson = await updateLesson(id, input, actor);
    return apiSuccess({ ...lesson, changed: true });
  },
);

/**
 * Delete a lesson.
 *
 * Refused whenever a student has watch progress against it or has sat its quiz.
 * `LessonProgress.lessonId` is `Restrict` in the schema, so the database would
 * decline anyway; the service checks first so the answer names the obstacle and
 * points at archiving, which is the action that was actually wanted.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/lessons/[lessonId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { lessonId } = await context.params;
    const result = await deleteLesson(parseLessonId(lessonId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ deleted: true, ...result });
  },
);
