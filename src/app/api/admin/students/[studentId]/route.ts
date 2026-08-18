import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { getStudentForAdmin, parseStudentId } from '@/services/students/student-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ studentId: string }> };

/**
 * One account and the records that explain it.
 *
 * `GET` is the only verb on this path, and the omissions are the design. There
 * is no `PATCH`: a student's name, address and phone number are theirs, and the
 * address is the sign-in identifier, so an administrator editing it is an
 * account takeover with extra steps. There is no `DELETE`: `orders`,
 * `consent_records`, `entitlements` and `exam_attempts` all hold `Restrict`
 * edges, and retention is still an open legal question in
 * `docs/client-inputs-required.md` — the interface says both rather than
 * offering a button that always fails.
 *
 * The two things an administrator may actually do live on their own paths,
 * `/block` and `/sessions`, because each is an audited transition rather than a
 * field on a form.
 */
export const GET = routeHandler(
  'GET /api/admin/students/[studentId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { studentId } = await context.params;
    const student = await getStudentForAdmin(parseStudentId(studentId));
    if (!student) {
      throw new HttpError(404, COPY.adminStudents.errors.notFound, 'student_not_found');
    }

    return apiSuccess(student);
  },
);
