import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createPlaybackSession } from '@/services/video/playback-session.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ lessonId: string }> };

/**
 * Issue a playback grant for one lesson.
 *
 * POST rather than GET: it creates a session row, and the response is a
 * short-lived credential that must never be cached by a browser or a proxy.
 */
export const POST = routeHandler('POST /api/lessons/[lessonId]/playback', async (request, context: Context) => {
  assertSameOrigin(request);

  const user = await requireAuth();
  const { lessonId } = await context.params;

  await enforceRateLimit('playbackSession', user.id);

  const grant = await createPlaybackSession({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    lessonId,
  });

  const response = apiSuccess(grant);
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
