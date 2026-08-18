import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { listCourses } from '@/services/courses/course-admin.service';
import { courseListQuerySchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

/**
 * The course collection.
 *
 * Read-only, and that is a design decision rather than an omission. A `Course`
 * row exists one-to-one with a `Product` of type `COURSE` and is written by
 * `createProduct`; a POST here would be a second way to create half of a
 * product, and the half it created would be the half no catalogue page can
 * render. The screen says so and links to the catalogue instead.
 *
 * `requireAdmin()` runs before the query string is even read. The administration
 * shell hides this route from a student, and hiding a link is decoration: the
 * URL is guessable, and this call is the only thing that actually decides.
 */
export const GET = routeHandler('GET /api/admin/courses', async (request) => {
  await requireAdmin();

  // Every field in the schema `.catch()`es, so `?page=abc&productStatus=nonsense`
  // degrades to page one unfiltered instead of answering a browsing request with
  // a validation error.
  const url = new URL(request.url);
  const query = courseListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listCourses(query));
});
