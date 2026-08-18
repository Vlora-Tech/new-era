import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { listVideoAssets, registerVideoAsset } from '@/services/video/video-admin.service';
import { registerVideoSchema, videoListQuerySchema } from '@/validators/admin-video';

export const runtime = 'nodejs';

/**
 * The video library collection.
 *
 * Both verbs guard with `requireAdmin()`: these URLs are guessable and the
 * administration shell hiding a link decides nothing.
 */

/**
 * List registered videos, filtered and paged on the server.
 *
 * Every query field `.catch()`es, so a hand-edited query string degrades to the
 * default view rather than answering a browsing request with a 400.
 */
export const GET = routeHandler('GET /api/admin/videos', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = videoListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listVideoAssets(query));
});

/**
 * Register a Bunny video against the platform.
 *
 * The body carries a `videoGuid` and nothing else that matters: `libraryId` is
 * not declared by the schema, so Zod strips it and the service reads the
 * configured library instead. That is what stops a request registering an
 * identifier pointing into a library this platform does not own.
 *
 * 201 rather than 200 — a row was created — and the response reports whether
 * Bunny actually confirmed the identifier, so the screen can distinguish a
 * verified video from one accepted on format alone.
 */
export const POST = routeHandler('POST /api/admin/videos', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  const input = registerVideoSchema.parse(await request.json());
  const result = await registerVideoAsset(input, {
    actor: { id: admin.id, email: admin.email },
  });

  return apiSuccess(result, { status: 201 });
});
