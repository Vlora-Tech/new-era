import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createAttempt } from '@/services/exams/attempt-lifecycle.service';
import { createAttemptSchema } from '@/validators/exam';

export const runtime = 'nodejs';

/**
 * Create an attempt. Deliberately does not start it.
 *
 * The response carries the attempt id and whether it was newly created; the
 * client navigates to the instructions screen either way. A double-click
 * therefore lands on the same attempt rather than producing two, and the
 * partial unique index behind `createAttempt` is what guarantees that even when
 * the two requests race.
 *
 * The rate limit is keyed by user id rather than by address: this endpoint is
 * authenticated, and a shared campus IP must not exhaust one budget for
 * everybody sitting an exam on it.
 */
export const POST = routeHandler(
  'POST /api/exams/[simulatorId]/attempts',
  async (request, context: { params: Promise<{ simulatorId: string }> }) => {
    assertSameOrigin(request);

    const user = await requireAuth();
    await enforceRateLimit('examAttemptCreate', user.id);

    const { simulatorId } = await context.params;
    const body = createAttemptSchema.parse(await request.json().catch(() => ({})));

    const result = await createAttempt({
      userId: user.id,
      simulatorId,
      mode: body.mode,
      isDryRun: body.dryRun,
      actorRole: user.role,
    });

    return apiSuccess(
      { attemptId: result.attemptId, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  },
);
