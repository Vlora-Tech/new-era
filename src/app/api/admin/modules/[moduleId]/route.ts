import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteModule,
  parseModuleId,
  transitionModuleStatus,
  updateModule,
} from '@/services/courses/course-admin.service';
import { moduleMutationSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ moduleId: string }> };

/**
 * Edit a module, or move it between DRAFT, PUBLISHED and ARCHIVED.
 *
 * One verb, two intents, discriminated in the body. They are separate because
 * they carry different authority: saving a title checks nothing, while
 * publishing checks that the module has a published lesson under it. The
 * `update` variant of the schema has no `status` key at all, so an edit form
 * physically cannot publish — the same rule the catalogue enforces by keeping
 * publication on its own endpoint.
 *
 * A no-op transition answers `changed: false` rather than re-stamping the row,
 * so the interface can say "لا توجد تعديلات لحفظها" instead of claiming a second
 * publication that never happened.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/modules/[moduleId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { moduleId } = await context.params;
    const id = parseModuleId(moduleId);
    const input = moduleMutationSchema.parse(await request.json());
    const actor = { actor: { id: admin.id, email: admin.email } };

    if (input.intent === 'transition') {
      const result = await transitionModuleStatus(id, input.status, actor);
      return apiSuccess({ id, ...result });
    }

    const updated = await updateModule(id, { title: input.title }, actor);
    return apiSuccess({ ...updated, changed: true });
  },
);

/**
 * Delete a module and everything under it.
 *
 * `CourseModule.lessons` cascades, so this removes every lesson in the module.
 * The service refuses whenever any descendant lesson has watch progress or its
 * quiz has attempts, and names which of the two it found — deleting either would
 * erase a student's record of work they actually did.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/modules/[moduleId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { moduleId } = await context.params;
    const result = await deleteModule(parseModuleId(moduleId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ deleted: true, ...result });
  },
);
