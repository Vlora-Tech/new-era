import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { getAttemptForAdmin, parseAttemptId } from '@/services/exams/attempt-admin.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ attemptId: string }> };

/**
 * One attempt: what was generated, what the student did with it, how it ended.
 *
 * The response carries the correct answer for every delivered question, which is
 * exactly why this path exists separately from anything a student can reach.
 * `requireAdmin()` is the first statement in the handler, before the id is even
 * validated — a student route that leaked this would hand out the answer key for
 * a paper still in circulation.
 *
 * No `PATCH`, no `DELETE`, and no sibling route that extends a clock or re-marks
 * an answer. `COPY.adminAttempts.errors.editUnavailable`,
 * `deleteUnavailable` and `extendTimeUnavailable` state those refusals in the
 * interface rather than leaving somebody hunting for a control that was never
 * built. A stuck attempt is a bug in the engine and a fresh attempt for the
 * student; it is not a row to hand-edit.
 */
export const GET = routeHandler(
  'GET /api/admin/attempts/[attemptId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { attemptId } = await context.params;
    const attempt = await getAttemptForAdmin(parseAttemptId(attemptId));
    if (!attempt) {
      throw new HttpError(404, COPY.adminAttempts.errors.notFound, 'attempt_not_found');
    }

    return apiSuccess(attempt);
  },
);
