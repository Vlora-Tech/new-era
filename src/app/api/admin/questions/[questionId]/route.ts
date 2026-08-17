import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteQuestion,
  getQuestionDetail,
  updateQuestion,
} from '@/services/questions/question-admin.service';
import { updateQuestionSchema } from '@/validators/admin-question';

export const runtime = 'nodejs';

type Context = { params: Promise<{ questionId: string }> };

/** One question, as the editor sees it — answer key included, admins only. */
export const GET = routeHandler(
  'GET /api/admin/questions/[questionId]',
  async (_request, context: Context) => {
    await requireAdmin();
    const { questionId } = await context.params;

    return apiSuccess(await getQuestionDetail(questionId));
  },
);

/**
 * Replace the draft.
 *
 * `PATCH` by verb and a whole replacement by body: `updateQuestionSchema` carries
 * every authored field, because the options are an ordered set and a partial
 * update of an ordered set has no meaning. What it cannot carry is `workflow`,
 * `currentVersion`, `publishedAt` or a reviewer — those move only through the
 * workflow endpoint, so no edit form can publish something that was never
 * reviewed.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/questions/[questionId]',
  async (request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { questionId } = await context.params;

    const input = updateQuestionSchema.parse(await request.json());
    await updateQuestion(questionId, input, { actor: { id: admin.id, email: admin.email } });

    return apiSuccess({ id: questionId });
  },
);

/**
 * Remove a draft nothing points at.
 *
 * The service refuses anything else and says so in Arabic. Retirement, not
 * deletion, is how a question that has ever been served leaves the pool — a past
 * attempt's score has to stay explainable.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/questions/[questionId]',
  async (request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { questionId } = await context.params;

    await deleteQuestion(questionId, { actor: { id: admin.id, email: admin.email } });

    return apiSuccess({ id: questionId });
  },
);
