import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  getCoverageReport,
  parseExamVersionId,
  transitionExamVersion,
} from '@/services/exams/exam-version-admin.service';
import { examVersionStatusActionSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ versionId: string }> };

/**
 * The audited moves a version can make: publish, retire, activate, deactivate.
 *
 * Four actions on one endpoint rather than a `status` field on the edit route,
 * for the same reason products publish through their own handler: each has
 * preconditions the ordinary save does not check, and folding them into a PATCH
 * would mean every save either re-ran them or quietly skipped them.
 *
 * Publication and activation stay apart. Publishing freezes a structure;
 * activating decides which frozen structure students receive. A version can be
 * published on Sunday, read end to end on Monday and activated on Tuesday, and
 * the trail shows three separate decisions because that is what happened.
 */
export const POST = routeHandler(
  'POST /api/admin/exam-versions/[versionId]/status',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { versionId } = await context.params;
    const { action } = examVersionStatusActionSchema.parse(await request.json());

    const result = await transitionExamVersion(parseExamVersionId(versionId), action, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(result);
  },
);

/**
 * Run the coverage check without changing anything.
 *
 * A GET because it is a question, not an act: it compares what the blueprint
 * asks for against what the bank holds right now and answers. Nothing is written
 * and nothing is audited, so there is no origin check to make — and putting it
 * beside the publish endpoint is deliberate, because it is the same computation
 * publication refuses on, run early enough to be useful.
 */
export const GET = routeHandler(
  'GET /api/admin/exam-versions/[versionId]/status',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { versionId } = await context.params;
    const report = await getCoverageReport(parseExamVersionId(versionId));
    if (!report) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.versionNotFound,
        'exam_version_not_found',
      );
    }

    return apiSuccess(report);
  },
);
