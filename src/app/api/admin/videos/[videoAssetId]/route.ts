import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { deleteVideoAsset } from '@/services/video/video-admin.service';
import { videoAssetIdSchema } from '@/validators/admin-video';

export const runtime = 'nodejs';

type Context = { params: Promise<{ videoAssetId: string }> };

/**
 * Un-register one video.
 *
 * The verb is DELETE because a row is destroyed, but what it destroys is this
 * platform's *reference* to a video — the video itself stays at Bunny, and the
 * confirmation copy says so. There is deliberately no provider call here: an
 * administration screen that could delete somebody's source footage as a side
 * effect of tidying a list is not a feature anyone asked for.
 *
 * The id is parsed rather than trusted: a malformed segment is a 400 naming the
 * field, not a Prisma error surfacing as a 500.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/videos/[videoAssetId]',
  async (request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { videoAssetId } = await context.params;
    const id = videoAssetIdSchema.parse(videoAssetId);

    await deleteVideoAsset(id, { actor: { id: admin.id, email: admin.email } });

    return apiSuccess({ deleted: true });
  },
);
