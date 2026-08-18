import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  createExamSection,
  parseExamVersionId,
  reorderExamSections,
} from '@/services/exams/exam-version-admin.service';
import { createExamSectionSchema, reorderSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ versionId: string }> };

/**
 * The version's sections as a collection: add one, or set their order.
 *
 * Both verbs answer with the whole version rather than with the row they
 * touched. A section's position, the version's totals and the coverage of every
 * rule all move together, so returning one row would leave the screen holding a
 * consistent fragment of an inconsistent page.
 */

/** Append a section. Its position is `MAX + 1`, never taken from the request. */
export const POST = routeHandler(
  'POST /api/admin/exam-versions/[versionId]/sections',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { versionId } = await context.params;
    const input = createExamSectionSchema.parse(await request.json());

    const version = await createExamSection(parseExamVersionId(versionId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version, { status: 201 });
  },
);

/**
 * Set the complete order.
 *
 * The whole list, not "move this one up". Positions are unique per version, so a
 * partial instruction has to be turned into a sequence of swaps somewhere, and
 * doing that in the browser means two administrators reordering at once can
 * interleave into an order neither of them chose. The service refuses a list
 * that no longer names exactly the sections it holds.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/exam-versions/[versionId]/sections',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { versionId } = await context.params;
    const { ids } = reorderSchema.parse(await request.json());

    const version = await reorderExamSections(parseExamVersionId(versionId), ids, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version);
  },
);
