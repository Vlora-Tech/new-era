import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteExamVersion,
  getExamVersionForAdmin,
  parseExamVersionId,
  updateExamVersion,
} from '@/services/exams/exam-version-admin.service';
import { updateExamVersionSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ versionId: string }> };

/**
 * A version is addressed by its own id rather than under its simulator.
 *
 * `ExamVersion.id` is globally unique and the version screen already knows it,
 * so nesting the route would add a path segment the server would then have to
 * verify agrees with the version's own `simulatorId` — a second source of truth
 * for a fact the row already carries. The reverse case, creating a version, *is*
 * nested, because there the simulator is the thing being added to.
 */

/** One version, with its sections, their rules and their fixed question lists. */
export const GET = routeHandler(
  'GET /api/admin/exam-versions/[versionId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { versionId } = await context.params;
    const version = await getExamVersionForAdmin(parseExamVersionId(versionId));
    if (!version) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.versionNotFound,
        'exam_version_not_found',
      );
    }

    return apiSuccess(version);
  },
);

/**
 * Save the version's own fields.
 *
 * Refused on anything but a draft. A published version is what live attempts are
 * generated from, and the refusal names the clone that is editable instead —
 * "تعذّر الحفظ" would leave an administrator pressing the same button.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/exam-versions/[versionId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { versionId } = await context.params;
    const input = updateExamVersionSchema.parse(await request.json());

    const version = await updateExamVersion(parseExamVersionId(versionId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version);
  },
);

/**
 * Delete a draft version.
 *
 * Published, retired, attempted and active versions are each refused by name.
 * A version that has been sat is the definition those results were computed
 * against; retiring it withdraws it from service while keeping the record
 * readable, which is what the refusal points at.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/exam-versions/[versionId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { versionId } = await context.params;
    await deleteExamVersion(parseExamVersionId(versionId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ deleted: true });
  },
);
