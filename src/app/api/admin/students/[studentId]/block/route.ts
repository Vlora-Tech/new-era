import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { parseStudentId, setStudentBlocked } from '@/services/students/student-admin.service';
import { studentBlockSchema } from '@/validators/admin-student';

export const runtime = 'nodejs';

type Context = { params: Promise<{ studentId: string }> };

/**
 * Block an account, or lift a block.
 *
 * One endpoint carrying the direction rather than two, because it is one
 * decision — may this person sign in — and both directions share the same
 * subject, the same audit shape and the same refusals. Two endpoints would be
 * two places to remember that blocking must also retire the account's sessions.
 *
 * `assertSameOrigin` before anything else, then `requireAdmin`. The order
 * matters for what an attacker learns: a cross-site form post is refused without
 * the handler ever revealing whether the session behind it was an administrator's.
 *
 * The service does the rest, including refusing to block the caller or another
 * administrator, and including the `sessionVersion` bump that makes a block take
 * effect on the blocked student's next request rather than when their cookie
 * happens to expire.
 */
export const POST = routeHandler(
  'POST /api/admin/students/[studentId]/block',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { studentId } = await context.params;
    const input = studentBlockSchema.parse(await request.json());

    const student = await setStudentBlocked(parseStudentId(studentId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(student);
  },
);
