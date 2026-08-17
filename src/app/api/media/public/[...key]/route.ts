import { NextResponse } from 'next/server';

import { apiFailure, routeHandler } from '@/lib/api';
import { COPY } from '@/lib/copy';
import { openPublicMediaObject } from '@/services/media/media.service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ key: string[] }> };

/**
 * Serve catalogue artwork.
 *
 * Public in the commercial sense — a cover is marketing — so it is cached hard
 * and asks nothing of the reader. Three things still hold:
 *
 *  - **The key shape is validated before anything is opened.** A catch-all
 *    segment arrives as an array of path pieces, so `/api/media/public/../../.env`
 *    reaches this handler as data. It is rejoined and matched against the one
 *    legal key shape — a UUID and an accepted extension, no separators — rather
 *    than being handed to the filesystem to normalise.
 *  - **The row decides.** The service refuses a key whose asset is deleted or
 *    whose recorded visibility is not `PUBLIC`, so this route cannot become a
 *    second, unauthenticated way to read a protected stimulus.
 *  - **`immutable` is honest.** Keys are generated UUIDs and are never reused,
 *    so the bytes behind one can never change. A year-long cache is safe
 *    precisely because a "new" image is a new key.
 */
export const GET = routeHandler(
  'GET /api/media/public/[...key]',
  async (_request, context: Context) => {
    const { key } = await context.params;
    const object = await openPublicMediaObject(key.join('/'));

    if (!object) {
      return apiFailure(404, 'media_not_found', COPY.adminMedia.errors.notFound);
    }

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        // Recorded at upload, never sniffed from the stored bytes at request time.
        'Content-Type': object.mimeType,
        'Content-Length': String(object.sizeBytes),
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=31536000, immutable',
        // The allowlist already excludes every format a browser might execute,
        // but a route whose whole job is returning files states it anyway rather
        // than depending on the proxy's matcher continuing to cover this path.
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
