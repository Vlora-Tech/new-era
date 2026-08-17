import { z } from 'zod';

import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  listMediaAssets,
  MEDIA_MAX_UPLOAD_BODY_BYTES,
  oversizedRequestBodyError,
  uploadMediaAsset,
} from '@/services/media/media.service';
import { mediaUploadSchema } from '@/validators/admin-media';

export const runtime = 'nodejs';

/**
 * Upload an image, and list what has been uploaded.
 *
 * The multipart body carries exactly two parts: `purpose` and `file`. There is
 * no visibility field, no MIME field and no filename field, and adding one would
 * be a mistake in each case — visibility follows from the purpose, the type is
 * sniffed from the bytes, and the object key is generated so that a name from a
 * browser never reaches the object store.
 */

/**
 * List filters. Deliberately local to this file rather than in `src/validators`:
 * there is no client form to share it with, and the shared directory is for
 * schemas that resolve a browser form *and* a handler. As with the product list,
 * every field is `.catch()`ed — a malformed `?page=abc` should show page one
 * rather than a validation error.
 */
const mediaListQuerySchema = z.object({
  visibility: z.enum(['PUBLIC', 'PROTECTED']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

export const POST = routeHandler('POST /api/admin/media', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  // Keyed by administrator. The budget exists to bound how much a single
  // account can push onto the disk, and an address is not an account.
  await enforceRateLimit('adminUpload', admin.id);

  /*
   * Refused from the declared length, before `formData()` buffers anything.
   * This is an early exit rather than the enforcement: a chunked request
   * declares no length, and the header is a claim in any case. The real check is
   * the service's comparison against the purpose's own cap.
   */
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MEDIA_MAX_UPLOAD_BODY_BYTES) {
    throw oversizedRequestBodyError();
  }

  const form = await request.formData();
  const { purpose } = mediaUploadSchema.parse({ purpose: form.get('purpose') });

  // `Blob` rather than `File`: nothing below this line has any use for a name,
  // and typing it as a `Blob` is what makes that structural instead of a rule.
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    throw new HttpError(400, COPY.adminMedia.noFileSelected, 'file_missing');
  }

  const asset = await uploadMediaAsset({
    purpose,
    file,
    actor: { id: admin.id, email: admin.email },
  });

  const response = apiSuccess(asset, { status: 201 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});

export const GET = routeHandler('GET /api/admin/media', async (request) => {
  // Hiding the navigation link is not authorization; this is.
  await requireAdmin();

  const query = mediaListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const page = await listMediaAssets(query);

  const response = apiSuccess(page);
  // An administrative listing must not be held by any cache: it changes with
  // every upload, and it is scoped to a reader who had to be an administrator.
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
