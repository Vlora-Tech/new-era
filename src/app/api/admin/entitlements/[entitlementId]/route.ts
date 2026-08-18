import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import {
  getEntitlementForAdmin,
  parseEntitlementId,
} from '@/services/access/entitlement-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ entitlementId: string }> };

/**
 * One entitlement and its complete, chronological history.
 *
 * `GET` only. There is no `PATCH` because `grantedAt`, `revokedAt` and `status`
 * are records of things that happened rather than fields — a hand-edited grant
 * date is a fabricated fact in the evidence trail for "why does this student
 * have access". There is no `DELETE` because the history is append-only: a
 * mistake is corrected by a further transition, which is itself recorded, not by
 * removing the row that shows the mistake.
 *
 * The change of state lives on `/status`, which is where both directions and
 * their mandatory reason are handled.
 */
export const GET = routeHandler(
  'GET /api/admin/entitlements/[entitlementId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { entitlementId } = await context.params;
    const entitlement = await getEntitlementForAdmin(parseEntitlementId(entitlementId));
    if (!entitlement) {
      throw new HttpError(404, COPY.adminEntitlements.errors.notFound, 'entitlement_not_found');
    }

    return apiSuccess(entitlement);
  },
);
