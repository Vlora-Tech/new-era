import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listSimulators } from '@/services/exams/simulator-admin.service';
import { simulatorListQuerySchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

/**
 * The simulators collection — read only, and deliberately so.
 *
 * There is no POST here. An `ExamSimulator` exists one-to-one with a `Product`
 * of type `EXAM_SIMULATOR` and is created with it, so a "create simulator"
 * endpoint could only produce a row with no price, no catalogue page and no way
 * to be bought. The empty state on the screen says the same thing and points at
 * the products screen.
 *
 * `requireAdmin()` runs before the query string is even read. The administration
 * shell hides the link for a student, but hiding a link is decoration: this URL
 * is guessable and the guard is the only thing that actually decides.
 */
export const GET = routeHandler('GET /api/admin/simulators', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = simulatorListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listSimulators(query));
});
