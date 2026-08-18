import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listOrders } from '@/services/payments/order-admin.service';
import { orderListQuerySchema } from '@/validators/admin-order';

export const runtime = 'nodejs';

/**
 * The orders collection.
 *
 * Read-only, and there is no `POST` here by design: an order is created by a
 * student going through checkout, where the server copies price, title and type
 * out of the catalogue itself. An administrative "create order" endpoint would be
 * a second way to write those columns, without a payment behind it.
 *
 * `requireAdmin()` runs before the query string is even parsed. The
 * administration shell hides the link from a student, but hiding a link is
 * decoration — this URL is guessable, and the guard is what actually decides.
 *
 * The query schema `.catch()`es every field, so `?page=abc&status=nonsense`
 * degrades to page one unfiltered rather than answering a browsing request with
 * a validation error.
 */
export const GET = routeHandler('GET /api/admin/orders', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = orderListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listOrders(query));
});
