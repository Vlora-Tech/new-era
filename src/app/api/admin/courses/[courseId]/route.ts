import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  getCourseBuilder,
  parseCourseId,
  updateCourseSettings,
} from '@/services/courses/course-admin.service';
import { updateCourseSettingsSchema } from '@/validators/admin-course';

export const runtime = 'nodejs';

type Context = { params: Promise<{ courseId: string }> };

/** One course with its whole module and lesson tree. */
export const GET = routeHandler(
  'GET /api/admin/courses/[courseId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { courseId } = await context.params;
    const course = await getCourseBuilder(parseCourseId(courseId));
    if (!course) {
      throw new HttpError(404, COPY.adminCourses.errors.courseNotFound, 'course_not_found');
    }

    return apiSuccess(course);
  },
);

/**
 * Save the three course-level settings.
 *
 * The schema declares `category`, `level` and `completionThresholdPercent` and
 * nothing else, so a body carrying a title or a price is stripped before the
 * service sees it. Those belong to `Product` and are edited on the catalogue
 * screen; accepting them here would create a second writer for one value, and
 * the two would disagree the first time somebody used the other screen.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/courses/[courseId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { courseId } = await context.params;
    const input = updateCourseSettingsSchema.parse(await request.json());

    const course = await updateCourseSettings(parseCourseId(courseId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(course);
  },
);
