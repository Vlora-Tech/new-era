import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listAuditLog } from '@/services/audit/audit-query.service';
import { auditLogQuerySchema } from '@/validators/admin-audit';

export const runtime = 'nodejs';

/**
 * The audit trail.
 *
 * ⚠️ **`GET` is the only verb this resource has, permanently.** `AuditLog` is
 * append-only: rows are written by `writeAuditLog` inside the transaction of the
 * change they describe, and nothing may edit or remove one afterwards — not a
 * `PATCH` to correct a typo in a metadata blob, not a `DELETE` for a row
 * somebody finds embarrassing, and not a "clear before launch" endpoint. A trail
 * an administrator can edit records whatever the last person with access wanted
 * it to record, which is worth less than no trail at all, because it looks like
 * evidence.
 *
 * There is no read-side reason for another verb either: the screen filters, and
 * a filter is a query string.
 */

/**
 * List the trail, filtered and paged on the server.
 *
 * `requireAdmin()` runs before the query string is even parsed. The trail names
 * every administrator by address and every record they touched by id, so it is
 * one of the more sensitive reads in the platform — the guard is not a formality
 * borrowed from the neighbouring routes.
 *
 * The query schema `.catch()`es every field, so `?page=abc&targetType=nonsense`
 * shows page one unfiltered rather than answering a browsing request with a
 * validation error.
 */
export const GET = routeHandler('GET /api/admin/audit-log', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = auditLogQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listAuditLog(query));
});
