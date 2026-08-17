import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { deleteMediaAsset } from '@/services/media/media.service';
import { mediaAssetIdSchema } from '@/validators/admin-media';

export const runtime = 'nodejs';

type Context = { params: Promise<{ assetId: string }> };

/**
 * Delete an image.
 *
 * The service refuses while a product cover or a question stimulus still points
 * at the asset, so the worst outcome an administrator can produce here is a
 * `409` naming the problem — never a product page and a question left referring
 * to bytes that no longer exist.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/media/[assetId]',
  async (request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { assetId } = await context.params;
    const id = mediaAssetIdSchema.parse(assetId);

    await deleteMediaAsset({ assetId: id, actor: { id: admin.id, email: admin.email } });

    return apiSuccess({ id });
  },
);
