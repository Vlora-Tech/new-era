import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  addSectionQuestion,
  deleteExamSection,
  parseExamSectionId,
  removeSectionQuestion,
  updateExamSection,
} from '@/services/exams/exam-version-admin.service';
import { updateExamSectionSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ sectionId: string }> };

/**
 * One section: its settings, and the fixed question list that belongs to it.
 *
 * The fixed list is edited through this same PATCH under an explicit `op`
 * rather than through a nested route, because it is not a resource of its own:
 * a `FIXED` section's questions have no identity a URL could name beyond the
 * section and the question, and the pair is already addressable. Making the
 * operation explicit is what stops a body missing half its fields from being
 * read as "clear everything else".
 *
 * Every path refuses unless the owning version is still a draft. That check
 * lives in the service, on a loader every mutation goes through, so the next
 * operation added here cannot be the one that forgets it.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/exam-sections/[sectionId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { sectionId } = await context.params;
    const id = parseExamSectionId(sectionId);
    const input = updateExamSectionSchema.parse(await request.json());
    const actor = { actor: { id: admin.id, email: admin.email } };

    if (input.op === 'settings') {
      return apiSuccess(await updateExamSection(id, input, actor));
    }

    return apiSuccess(
      input.action === 'add'
        ? await addSectionQuestion(id, input.questionId, actor)
        : await removeSectionQuestion(id, input.questionId, actor),
    );
  },
);

/**
 * Delete a section.
 *
 * Its rules and its fixed-question rows cascade with it — they are `Cascade` in
 * the schema because a draft's content tree has no independent existence. What
 * does not cascade is an `AttemptSection`, which is `Restrict`; a published
 * version cannot reach this handler at all, so that edge is never tested here
 * and the refusal an administrator sees is the version-frozen one instead.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/exam-sections/[sectionId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { sectionId } = await context.params;
    const version = await deleteExamSection(parseExamSectionId(sectionId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version);
  },
);
