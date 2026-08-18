import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { parseStudentId, revokeStudentSessions } from '@/services/students/student-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ studentId: string }> };

/**
 * End every session this account has open.
 *
 * `DELETE` on the account's sessions collection, because that is literally what
 * happens: the sessions stop existing. It takes no body — there is nothing to
 * configure about "all of them", and a body would invite a future "except this
 * device" parameter that the `sessionVersion` mechanism cannot express.
 *
 * Distinct from blocking on purpose. This leaves the account able to sign back
 * in; it is the lever for a shared password or a lost phone, where the account
 * is fine and its open sessions are not. The service refuses it against the
 * caller's own account: signing yourself out is what the sign-out button does.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/students/[studentId]/sessions',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { studentId } = await context.params;
    const student = await revokeStudentSessions(parseStudentId(studentId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(student);
  },
);
