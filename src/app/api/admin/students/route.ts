import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listStudents } from '@/services/students/student-admin.service';
import { studentListQuerySchema } from '@/validators/admin-student';

export const runtime = 'nodejs';

/**
 * The accounts collection. Read-only: there is no POST here.
 *
 * Accounts are created by the people they belong to, through registration. An
 * administrative "add student" would need a password, which would mean this
 * screen inventing one and transmitting it — the exact capability the whole
 * students area is built to not have.
 *
 * `requireAdmin()` runs before the query string is even read. The rows carry
 * names, addresses and phone numbers of people who are in many cases minors, so
 * the guard is not a formality about which screen renders: it is the only thing
 * standing between that data and anyone who can guess a URL.
 */
export const GET = routeHandler('GET /api/admin/students', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = studentListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listStudents(query));
});
