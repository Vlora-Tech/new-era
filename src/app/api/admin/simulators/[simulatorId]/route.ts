import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  getSimulatorForAdmin,
  parseSimulatorId,
  updateSimulatorSettings,
} from '@/services/exams/simulator-admin.service';
import { updateSimulatorSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ simulatorId: string }> };

/** One simulator, its settings and every version it owns. */
export const GET = routeHandler(
  'GET /api/admin/simulators/[simulatorId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { simulatorId } = await context.params;
    const simulator = await getSimulatorForAdmin(parseSimulatorId(simulatorId));
    if (!simulator) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.simulatorNotFound,
        'simulator_not_found',
      );
    }

    return apiSuccess(simulator);
  },
);

/**
 * Save the simulator's settings.
 *
 * The body may carry `activeExamVersionId` because the settings form shows the
 * active version — but a change to it is not part of the settings diff. The
 * service treats it as an activation with its own preconditions (the version
 * must belong to this simulator and must be published) and its own audit row,
 * and reports back whether it moved so the browser can say which of the two
 * things happened.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/simulators/[simulatorId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { simulatorId } = await context.params;
    const input = updateSimulatorSchema.parse(await request.json());

    const result = await updateSimulatorSettings(parseSimulatorId(simulatorId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(result);
  },
);
