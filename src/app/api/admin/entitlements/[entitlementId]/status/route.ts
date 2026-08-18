import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  parseEntitlementId,
  reactivateEntitlementForAdmin,
  revokeEntitlementForAdmin,
} from '@/services/access/entitlement-admin.service';
import { entitlementStatusTransitionSchema } from '@/validators/admin-entitlement';

export const runtime = 'nodejs';

type Context = { params: Promise<{ entitlementId: string }> };

/**
 * Withdraw access, or put it back.
 *
 * One endpoint carrying the target state, in the same shape as the product
 * publication transition. The two directions share every precondition, the same
 * mandatory reason and the same "already in that state" answer; splitting them
 * would be two places that each have to remember the event and the audit row.
 *
 * The reason is required by the schema in both directions, so a request that
 * omits it is rejected before any transaction opens. `EntitlementEvent.reason`
 * is nullable in the database because a purchase does not need one — this is the
 * layer the schema's own comment points at when it says a manual action does.
 *
 * `changed` is reported rather than assumed. Revoking an already-revoked
 * entitlement writes nothing: an append-only history that gained a duplicate row
 * cannot be tidied up afterwards, so the honest answer is that nothing happened.
 */
export const POST = routeHandler(
  'POST /api/admin/entitlements/[entitlementId]/status',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { entitlementId } = await context.params;
    const id = parseEntitlementId(entitlementId);
    const input = entitlementStatusTransitionSchema.parse(await request.json());

    const actor = { actor: { id: admin.id, email: admin.email } };
    const result =
      input.status === 'REVOKED'
        ? await revokeEntitlementForAdmin(id, input.reason, actor)
        : await reactivateEntitlementForAdmin(id, input.reason, actor);

    return apiSuccess(result);
  },
);
