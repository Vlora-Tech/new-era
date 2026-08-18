import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  createBlueprintRule,
  deleteBlueprintRule,
  parseExamSectionId,
  reorderBlueprintRules,
  updateBlueprintRule,
} from '@/services/exams/exam-version-admin.service';
import { parseUuidOr404 } from '@/services/exams/simulator-admin.service';
import { createBlueprintRuleSchema, updateBlueprintRuleSchema } from '@/validators/admin-simulator';

export const runtime = 'nodejs';

type Context = { params: Promise<{ sectionId: string }> };

/**
 * The blueprint rules of one section.
 *
 * Nested under the section because a rule has no meaning apart from it: its
 * share is a share *of that section's* question count, and its position orders
 * it against that section's other rules. The service therefore checks on every
 * verb that the rule named actually belongs to the section in the path — a rule
 * id from another section is answered as "no such rule", not silently applied.
 *
 * Every verb answers with the whole version. Changing one rule's percentage
 * changes what every other rule in the section is allocated, so a response
 * carrying only the edited row would leave the screen showing stale numbers
 * beside a fresh one.
 */

/** Add a rule. Its position is `MAX + 1` within the section. */
export const POST = routeHandler(
  'POST /api/admin/exam-sections/[sectionId]/rules',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { sectionId } = await context.params;
    const input = createBlueprintRuleSchema.parse(await request.json());

    const version = await createBlueprintRule(parseExamSectionId(sectionId), input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(version, { status: 201 });
  },
);

/** Edit one rule, or set the order of all of them. */
export const PATCH = routeHandler(
  'PATCH /api/admin/exam-sections/[sectionId]/rules',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { sectionId } = await context.params;
    const id = parseExamSectionId(sectionId);
    const input = updateBlueprintRuleSchema.parse(await request.json());
    const actor = { actor: { id: admin.id, email: admin.email } };

    if (input.op === 'reorder') {
      return apiSuccess(await reorderBlueprintRules(id, input.ids, actor));
    }

    // `op` and `ruleId` address the row; the rest of the body is the rule
    // itself, in exactly the shape a create takes. It is passed whole rather
    // than re-spread: the service reads the fields it declares and nothing else,
    // so a field added to the schema later cannot be dropped here by omission.
    return apiSuccess(await updateBlueprintRule(id, input.ruleId, input, actor));
  },
);

/**
 * Remove one rule, named in the query string.
 *
 * A DELETE with a body is legal and widely ignored — fetch will send one, some
 * proxies drop it, and a rule silently not deleted is worse than a 404. The id
 * goes in the URL where every layer agrees it belongs.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/exam-sections/[sectionId]/rules',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { sectionId } = await context.params;
    const ruleId = new URL(request.url).searchParams.get('ruleId');
    if (!ruleId) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.ruleNotFound,
        'blueprint_rule_not_found',
      );
    }

    const version = await deleteBlueprintRule(
      parseExamSectionId(sectionId),
      parseUuidOr404(ruleId, COPY.adminSimulators.errors.ruleNotFound, 'blueprint_rule_not_found'),
      { actor: { id: admin.id, email: admin.email } },
    );

    return apiSuccess(version);
  },
);
