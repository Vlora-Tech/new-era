import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { transitionQuestion } from '@/services/questions/question-publish.service';
import { questionTransitionSchema } from '@/validators/admin-question';

export const runtime = 'nodejs';

/**
 * Move a question through the review workflow.
 *
 * A separate endpoint from the edit form on purpose. Publication freezes an
 * immutable version that live attempts then serve, and retirement removes an item
 * from the eligible pool; neither belongs to "save my changes". Keeping them
 * apart is what makes it impossible for an edit to publish a question that was
 * never reviewed, and it gives each act its own audit row.
 *
 * The body names only a target state. Whether the move is legal from where the
 * row currently stands is decided by the service, which is the only layer that
 * can read the current state.
 */
export const POST = routeHandler(
  'POST /api/admin/questions/[questionId]/workflow',
  async (request, context: { params: Promise<{ questionId: string }> }) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { questionId } = await context.params;

    const input = questionTransitionSchema.parse(await request.json());
    const result = await transitionQuestion(questionId, input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(result);
  },
);
