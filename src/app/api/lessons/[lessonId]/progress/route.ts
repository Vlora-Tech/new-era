import { z } from 'zod';

import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { recordProgress } from '@/services/video/progress.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

const bodySchema = z.object({
  sessionId: z.uuid(),
  positionSec: z.number().nonnegative().max(86_400),
  /** Playback seconds observed since the last heartbeat; clamped server-side. */
  deltaSec: z.number().nonnegative().max(86_400),
});

export const PUT = routeHandler('PUT /api/lessons/[lessonId]/progress', async (request, context: Context) => {
  assertSameOrigin(request);

  const user = await requireAuth();
  const { lessonId } = await context.params;

  const body = bodySchema.parse(await request.json());

  // Keyed by session rather than by user: the budget should bound one player,
  // not punish a student who legitimately has two lessons open.
  await enforceRateLimit('progressHeartbeat', body.sessionId);

  const progress = await recordProgress({
    sessionId: body.sessionId,
    userId: user.id,
    lessonId,
    positionSec: body.positionSec,
    deltaSec: body.deltaSec,
  });

  const response = apiSuccess(progress);
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
