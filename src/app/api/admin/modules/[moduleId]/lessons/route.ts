import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  createLesson,
  parseModuleId,
  reorderLessons,
} from '@/services/courses/course-admin.service';
import { createLessonSchema, reorderSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ moduleId: string }> };

/**
 * Add a lesson at the end of a module, as a draft.
 *
 * The module comes from the path, never from the body: a create that could name
 * its own parent is a create that can file a lesson under another course's
 * module, and the entitlement that grants access to one course says nothing
 * about the other.
 */
export const POST = routeHandler(
  'POST /api/admin/modules/[moduleId]/lessons',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { moduleId } = await context.params;
    const input = createLessonSchema.parse(await request.json());

    const lesson = await createLesson(parseModuleId(moduleId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(lesson, { status: 201 });
  },
);

/**
 * Reorder a module's lessons in one request, for the same reason the module
 * reorder takes a whole list: `Lesson.position` is not unique, so the ordering
 * is only ever consistent as a set, and a partial application is worse than a
 * refusal.
 *
 * A lesson id belonging to a different module is refused by name rather than as
 * a stale list — the two mistakes need different sentences, because only one of
 * them is fixed by reloading the page.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/modules/[moduleId]/lessons',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { moduleId } = await context.params;
    const { ids } = reorderSchema.parse(await request.json());

    await reorderLessons(parseModuleId(moduleId), ids, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ reordered: true });
  },
);
