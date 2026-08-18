import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listAttempts } from '@/services/exams/attempt-admin.service';
import { attemptListQuerySchema } from '@/validators/admin-attempt';

export const runtime = 'nodejs';

/**
 * The attempts collection.
 *
 * `GET` only, here and on the record path. An attempt is created by a student
 * starting an exam and finalised by submission or by the clock; there is no
 * administrative verb that creates, edits or removes one, because an attempt an
 * administrator can write to stops being evidence of what the student was shown.
 *
 * `requireAdmin()` runs before the query string is parsed — an attempt row
 * carries a student's name, address and answers, so this list is one of the more
 * sensitive reads in the application.
 */
export const GET = routeHandler('GET /api/admin/attempts', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = attemptListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listAttempts(query));
});
