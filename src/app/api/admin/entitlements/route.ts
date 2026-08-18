import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  grantEntitlementForAdmin,
  listEntitlements,
} from '@/services/access/entitlement-admin.service';
import { entitlementListQuerySchema, grantEntitlementSchema } from '@/validators/admin-entitlement';

export const runtime = 'nodejs';

/**
 * The access collection.
 *
 * `requireAdmin()` is on both verbs. Granting access is the one action on this
 * platform that hands out paid material without a payment, so the guard here is
 * not about which screen renders — it is the whole control.
 */

/**
 * List entitlements, filtered and paged on the server.
 *
 * The query schema `.catch()`es every field, so `?page=abc&status=nonsense`
 * degrades to the unfiltered first page instead of answering a browsing request
 * with a validation error. The mutation below deliberately does not.
 */
export const GET = routeHandler('GET /api/admin/entitlements', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = entitlementListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listEntitlements(query));
});

/**
 * Grant access by hand.
 *
 * The body carries an address, a product and a reason, and nothing else. There
 * is no `grantedAt`, no `status` and no `sourceOrderId` in the schema, so a
 * request cannot back-date a grant, cannot create one that is already revoked,
 * and cannot attribute goodwill access to an order somebody never placed.
 *
 * `changed` is returned alongside the row rather than folded into the status
 * code. A grant for a student who already has active access is not an error and
 * not a second grant: it is a request that found the world already in the state
 * it asked for, and the screen has a sentence for exactly that.
 */
export const POST = routeHandler('POST /api/admin/entitlements', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  const input = grantEntitlementSchema.parse(await request.json());
  const result = await grantEntitlementForAdmin(input, {
    actor: { id: admin.id, email: admin.email },
  });

  return apiSuccess(result, { status: result.changed ? 201 : 200 });
});
