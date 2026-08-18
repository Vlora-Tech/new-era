import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { createExamVersion } from '@/services/exams/exam-version-admin.service';
import { parseSimulatorId } from '@/services/exams/simulator-admin.service';
import { createExamVersionSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ simulatorId: string }> };

/**
 * Add a version to a simulator, blank or as a clone.
 *
 * The clone is the whole answer to "I need to change a published exam": the
 * structure is copied into a fresh draft and the published original is left
 * exactly as the attempts that reference it expect to find it. Both modes reach
 * the same service so `versionNumber` is derived in one place —
 * `@@unique([simulatorId, versionNumber])` means a client-chosen number is a
 * collision waiting to happen.
 *
 * The body cannot carry `status`, `publishedAt` or `versionNumber`: the schema
 * does not declare them, so Zod strips them before the service is reached. A
 * version therefore cannot be created already published, which is what keeps the
 * publication preconditions from being optional.
 */
export const POST = routeHandler(
  'POST /api/admin/simulators/[simulatorId]/versions',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { simulatorId } = await context.params;
    const input = createExamVersionSchema.parse(await request.json());

    const version = await createExamVersion(parseSimulatorId(simulatorId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version, { status: 201 });
  },
);
