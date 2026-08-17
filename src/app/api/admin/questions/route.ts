import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { createQuestion, listQuestions } from '@/services/questions/question-admin.service';
import { createQuestionSchema, questionListQuerySchema } from '@/validators/admin-question';

export const runtime = 'nodejs';

/**
 * The question bank collection.
 *
 * Both verbs call `requireAdmin()` themselves. The administration navigation
 * hides these routes from a student, and that is chrome: the only thing standing
 * between a signed-in student and the answer key is this call.
 *
 * The list legitimately carries `isCorrect` and the explanation, because an
 * editor cannot review a question without them. That is safe here and nowhere
 * else — the delivery path has its own select in `attempt-snapshot.service.ts`
 * which never asks PostgreSQL for the answer at all.
 */
export const GET = routeHandler('GET /api/admin/questions', async (request) => {
  await requireAdmin();

  // Every field in this schema is `.catch()`ed, so a hand-edited query string
  // degrades to the default view instead of answering a 400 to what is, from the
  // reader's point of view, a page they simply navigated to.
  const url = new URL(request.url);
  const query = questionListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listQuestions(query));
});

export const POST = routeHandler('POST /api/admin/questions', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  const input = createQuestionSchema.parse(await request.json());
  const { id } = await createQuestion(input, {
    actor: { id: admin.id, email: admin.email },
  });

  return apiSuccess({ id }, { status: 201 });
});
