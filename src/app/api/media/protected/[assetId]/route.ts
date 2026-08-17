import { NextResponse } from 'next/server';

import { routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { openProtectedMediaObject } from '@/services/media/media.service';
import { mediaAssetIdSchema } from '@/validators/admin-media';

export const runtime = 'nodejs';

type Context = { params: Promise<{ assetId: string }> };

/**
 * Serve a question stimulus.
 *
 * This is paid bank content, so the route is the opposite of its public sibling
 * in every respect that matters:
 *
 *  - It **authenticates**, then authorises against the asset's actual use — the
 *    reader must hold an active entitlement to a product whose content actually
 *    carries this image. A role is not enough and an entitlement alone is not
 *    enough.
 *  - It is addressed by asset id rather than by object key, so the stored key
 *    never appears in a URL a browser could keep after access ends.
 *  - It sets `private, no-store`. A shared cache holding one of these would keep
 *    serving it to a reader whose entitlement was revoked an hour ago, which is
 *    the whole failure this route exists to prevent. The authorised route *is*
 *    the short-lived access in development; an S3 adapter would swap in
 *    pre-signed GETs behind the same service call.
 */
export const GET = routeHandler(
  'GET /api/media/protected/[assetId]',
  async (_request, context: Context) => {
    const user = await requireAuth();

    const { assetId } = await context.params;
    const id = mediaAssetIdSchema.parse(assetId);

    const object = await openProtectedMediaObject({ assetId: id, user });

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        // The type recorded at upload. Nothing here re-derives it from the bytes.
        'Content-Type': object.mimeType,
        'Content-Length': String(object.sizeBytes),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
