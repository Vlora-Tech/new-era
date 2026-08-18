import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  createModule,
  parseCourseId,
  reorderModules,
} from '@/services/courses/course-admin.service';
import { createModuleSchema, reorderSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ courseId: string }> };

/**
 * Add a module at the end of the course, as a draft.
 *
 * The body carries a title and nothing else. `position` is computed by the
 * service and `status` is fixed at `DRAFT`, so a module cannot be created
 * already published — which is what keeps the publication precondition ("at
 * least one published lesson") from being optional.
 */
export const POST = routeHandler(
  'POST /api/admin/courses/[courseId]/modules',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { courseId } = await context.params;
    const input = createModuleSchema.parse(await request.json());

    const created = await createModule(parseCourseId(courseId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(created, { status: 201 });
  },
);

/**
 * Reorder the whole module list in one request.
 *
 * Deliberately not a stream of "move this one up" calls. `CourseModule.position`
 * is not unique — the schema says a unique index would deadlock against the swap
 * — so an ordering is only ever consistent as a whole, and only a request that
 * carries the whole list lets the server notice that the list no longer
 * describes the rows that exist. N separate requests would also leave the list
 * in a half-applied state whenever the third one failed.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/courses/[courseId]/modules',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { courseId } = await context.params;
    const { ids } = reorderSchema.parse(await request.json());

    await reorderModules(parseCourseId(courseId), ids, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ reordered: true });
  },
);
