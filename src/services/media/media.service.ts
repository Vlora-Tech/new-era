import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError, type CurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { isUploadEnabled } from '@/lib/env';
import { logger } from '@/lib/logger';
import { AUDIT_ACTIONS, writeAuditLog } from '@/services/audit/audit.service';
import { getStorageProvider, isValidObjectKey } from '@/services/storage';
import { MEDIA_PURPOSE_RULES, type MediaPurpose } from '@/validators/admin-media';

import {
  ImageValidationError,
  tooLargeError,
  validateAndNormaliseImage,
  type ImageValidationCode,
} from './image-validation';

/**
 * Media assets: uploading them, listing them, deleting them, and deciding who is
 * allowed to read one.
 *
 * The service owns three rules the routes above it cannot express:
 *
 *  1. **The purpose decides everything else.** A request says `PRODUCT_COVER` or
 *     `QUESTION_STIMULUS`; visibility, the byte cap and the accepted types are
 *     read from `MEDIA_PURPOSE_RULES` here. A client can therefore never ask for
 *     a paid question image to be stored as a public object — the single mistake
 *     in this area that would put the question bank on the open web regardless of
 *     what the application checks afterwards.
 *  2. **A protected asset is authorised against its actual use**, not against a
 *     role. A student may read a stimulus because a question carrying it was
 *     served to one of their own attempts, or because it sits in a quiz inside a
 *     course they hold — and in both cases only while the entitlement is still
 *     active, so a refund closes the images along with everything else.
 *  3. **Deletion refuses while anything points at the asset.** The count below
 *     exists to produce a sentence an administrator can act on; the guarantee is
 *     the `Restrict` foreign keys, which is why the row is really deleted rather
 *     than flagged.
 */

export type MediaAssetView = {
  id: string;
  visibility: $Enums.AssetVisibility;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /**
   * Where a browser fetches this image. For protected content it is the
   * authorising route, which is a URL that stops working the moment the reader
   * stops being entitled — not a permanent address.
   */
  url: string;
  /** ISO-8601; this shape crosses the wire, so it carries no `Date`. */
  createdAt: string;
};

/** An open object plus the type recorded at upload. */
export type ServableMedia = {
  body: ReadableStream<Uint8Array>;
  mimeType: string;
  sizeBytes: number;
};

const ASSET_SELECT = {
  id: true,
  objectKey: true,
  visibility: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  createdAt: true,
} as const;

type AssetRow = {
  id: string;
  objectKey: string;
  visibility: $Enums.AssetVisibility;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
};

/**
 * The address a browser should use for an asset.
 *
 * Asking the adapter for the public case is what keeps the seam real: an S3
 * adapter would answer with a CDN URL and nothing above this line would change.
 * Protected content is never routed through the adapter, because by definition
 * it has no address that works without a check.
 */
export function mediaAssetUrl(asset: {
  id: string;
  objectKey: string;
  visibility: $Enums.AssetVisibility;
}): string {
  if (asset.visibility === 'PROTECTED') return `/api/media/protected/${asset.id}`;

  // A malformed key has no address at all. Pointing it at the public route makes
  // it resolve to an honest 404, which is far easier to diagnose than an empty
  // `src` that renders as a gap with nothing in the network tab.
  return (
    getStorageProvider().publicUrl({ objectKey: asset.objectKey, visibility: 'PUBLIC' }) ??
    `/api/media/public/${encodeURIComponent(asset.objectKey)}`
  );
}

function toView(row: AssetRow): MediaAssetView {
  return {
    id: row.id,
    visibility: row.visibility,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    url: mediaAssetUrl(row),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Which status each refusal deserves.
 *
 * Separated from the messages on purpose: `image-validation.ts` has no opinion
 * about HTTP, and the mapping belongs at the layer that is about to answer a
 * request. 415 for the two type refusals, because the entity is a media type the
 * server will not accept; 422 for a file that is an image but not a usable one.
 */
const VALIDATION_STATUS: Record<ImageValidationCode, number> = {
  too_large: 413,
  wrong_type: 415,
  magic_mismatch: 415,
  dimensions_too_large: 422,
  decode_failed: 422,
};

function toHttpError(error: ImageValidationError): HttpError {
  return new HttpError(VALIDATION_STATUS[error.code], error.message, error.code);
}

// ───────────────────────────────── Upload ─────────────────────────────────

/** The most generous file cap any purpose allows. */
const LARGEST_PURPOSE_CAP = Math.max(
  ...Object.values(MEDIA_PURPOSE_RULES).map((rule) => rule.maxBytes),
);

/**
 * The largest request body the upload endpoint will buffer.
 *
 * The per-purpose caps govern the *file*; this governs the whole multipart
 * envelope, so a body far beyond any legal upload can be refused from its
 * declared length before it is read. The margin covers the boundaries, the part
 * headers and the `purpose` field.
 */
export const MEDIA_MAX_UPLOAD_BODY_BYTES = LARGEST_PURPOSE_CAP + 64 * 1_024;

/**
 * The refusal for a body over that limit.
 *
 * It reuses the file-size sentence and quotes the largest cap rather than the
 * envelope limit: at this point the purpose has not been parsed, so the most
 * specific true statement available is the most generous file size the endpoint
 * accepts — and that is the number the uploader can act on.
 */
export function oversizedRequestBodyError(): HttpError {
  return new HttpError(413, tooLargeError(LARGEST_PURPOSE_CAP).message, 'payload_too_large');
}

export async function uploadMediaAsset(input: {
  purpose: MediaPurpose;
  /** The uploaded part. A `Blob`, so nothing named a file reaches this layer. */
  file: Blob;
  actor: { id: string; email: string };
}): Promise<MediaAssetView> {
  // Checked before anything is read or written. Without a configured provider an
  // upload would appear to succeed and then disappear, which is worse for the
  // administrator than being told plainly that the feature is off.
  if (!isUploadEnabled()) {
    throw new HttpError(503, COPY.adminMedia.errors.storageUnavailable, 'storage_unavailable');
  }

  const rules = MEDIA_PURPOSE_RULES[input.purpose];

  // The first of two size checks. This one reads a length rather than the file,
  // so an oversized upload is refused without ever being held in memory.
  if (input.file.size > rules.maxBytes) throw toHttpError(tooLargeError(rules.maxBytes));

  const bytes = new Uint8Array(await input.file.arrayBuffer());

  let validated;
  try {
    validated = await validateAndNormaliseImage({
      bytes,
      declaredMimeType: input.file.type,
      maxBytes: rules.maxBytes,
    });
  } catch (error) {
    if (error instanceof ImageValidationError) throw toHttpError(error);
    throw error;
  }

  const provider = getStorageProvider();
  const stored = await provider.put({
    body: validated.bytes,
    // What the sniffer found, never what the uploader declared.
    mimeType: validated.mimeType,
    // Derived from the purpose. There is no request field that could set it.
    visibility: rules.visibility,
    extension: validated.extension,
    width: validated.width,
    height: validated.height,
  });

  try {
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          provider: provider.kind,
          objectKey: stored.objectKey,
          visibility: stored.visibility,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          checksumSha256: stored.checksumSha256,
          createdById: input.actor.id,
        },
        select: ASSET_SELECT,
      });

      await writeAuditLog(tx, {
        actor: input.actor,
        action: AUDIT_ACTIONS.MEDIA_UPLOADED,
        targetType: 'MediaAsset',
        targetId: created.id,
        metadata: {
          purpose: input.purpose,
          visibility: created.visibility,
          // Both types are recorded. A disagreement between them is the shape of
          // an attempted upload of something that was not what it claimed, and
          // the trail should be able to show that it was caught.
          declaredMimeType: input.file.type,
          storedMimeType: created.mimeType,
          declaredSizeBytes: input.file.size,
          storedSizeBytes: created.sizeBytes,
          width: created.width,
          height: created.height,
          checksumSha256: stored.checksumSha256,
        },
      });

      return created;
    });

    logger.info('media asset uploaded', {
      assetId: asset.id,
      purpose: input.purpose,
      visibility: asset.visibility,
      sizeBytes: asset.sizeBytes,
    });

    return toView(asset);
  } catch (error) {
    // The bytes are on disk but no row points at them. An object nobody can
    // reach is not neutral — it is content the platform is holding with no
    // record of why — so it is removed. The original failure is what the caller
    // hears about; a cleanup that also fails only leaves a log line.
    try {
      await provider.delete(stored);
    } catch (cleanupError) {
      logger.error('media: orphaned object could not be removed', {
        objectKey: stored.objectKey,
        error: cleanupError,
      });
    }
    throw error;
  }
}

// ────────────────────────────────── List ──────────────────────────────────

export async function listMediaAssets(input: {
  visibility?: $Enums.AssetVisibility;
  page: number;
  perPage: number;
}): Promise<{ assets: MediaAssetView[]; total: number; page: number; perPage: number }> {
  const where: Prisma.MediaAssetWhereInput = {
    deletedAt: null,
    ...(input.visibility ? { visibility: input.visibility } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      select: ASSET_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.perPage,
      take: input.perPage,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return {
    assets: rows.map(toView),
    total,
    page: input.page,
    perPage: input.perPage,
  };
}

// ───────────────────────────────── Delete ─────────────────────────────────

/**
 * How many pieces of content still point at this asset.
 *
 * Read before the delete purely so the refusal can be a sentence rather than a
 * constraint violation. It is explicitly *not* the guarantee: between this count
 * and the delete, an administrator in another tab can attach the same asset as a
 * product cover, and only the database can settle that race. See below.
 */
async function countReferences(assetId: string): Promise<number> {
  const [covers, stimuli] = await prisma.$transaction([
    prisma.product.count({ where: { coverAssetId: assetId } }),
    prisma.questionStimulus.count({ where: { mediaAssetId: assetId } }),
  ]);
  return covers + stimuli;
}

export async function deleteMediaAsset(input: {
  assetId: string;
  actor: { id: string; email: string };
}): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: input.assetId },
    select: { id: true, objectKey: true, visibility: true, mimeType: true, sizeBytes: true },
  });
  if (!asset) throw new HttpError(404, COPY.adminMedia.errors.notFound, 'media_not_found');

  if ((await countReferences(asset.id)) > 0) {
    throw new HttpError(409, COPY.adminMedia.errors.deleteBlockedInUse, 'media_in_use');
  }

  try {
    await prisma.$transaction(async (tx) => {
      /*
       * A real delete, not a flag. `Product.coverAssetId` and
       * `QuestionStimulus.mediaAssetId` are both `onDelete: Restrict`, so this
       * statement is refused by PostgreSQL if anything references the row —
       * including a reference created a millisecond ago by another
       * administrator. Marking `deletedAt` instead would satisfy those foreign
       * keys while the bytes disappeared underneath them, which is exactly the
       * "content pointing at nothing" the delete is supposed to prevent.
       *
       * The `deletedAt` column is not dead as a result: both serving paths
       * refuse an asset that carries it, so withdrawing an image from view
       * without destroying it stays available to whatever needs it — a takedown
       * request, a retention rule — as a distinct operation from this one.
       */
      await tx.mediaAsset.delete({ where: { id: asset.id } });

      await writeAuditLog(tx, {
        actor: input.actor,
        action: AUDIT_ACTIONS.MEDIA_DELETED,
        targetType: 'MediaAsset',
        targetId: asset.id,
        metadata: {
          visibility: asset.visibility,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          // Kept so an operator can find the file if the removal below fails.
          objectKey: asset.objectKey,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // The race the count above cannot close: something adopted the asset
      // between the check and the delete, and the foreign key caught it.
      if (error.code === 'P2003') {
        throw new HttpError(409, COPY.adminMedia.errors.deleteBlockedInUse, 'media_in_use');
      }
      if (error.code === 'P2025') {
        throw new HttpError(404, COPY.adminMedia.errors.notFound, 'media_not_found');
      }
    }
    throw error;
  }

  // Only after the row is gone. The other order would leave a live row pointing
  // at a file that no longer exists if the transaction rolled back — a broken
  // image rather than a recoverable orphan.
  try {
    await getStorageProvider().delete({
      objectKey: asset.objectKey,
      visibility: asset.visibility,
    });
  } catch (error) {
    logger.error('media: object left behind after its row was deleted', {
      objectKey: asset.objectKey,
      error,
    });
  }

  logger.info('media asset deleted', { assetId: asset.id, actorId: input.actor.id });
}

// ───────────────────────────────── Serving ────────────────────────────────

/**
 * Open a public object by key, or `null` for anything that should 404.
 *
 * The row is consulted even though the local adapter's directory layout already
 * separates the two trees. It is what carries `deletedAt`, and it is the
 * authority on visibility — a key that resolves under the public tree while its
 * row says `PROTECTED` is a contradiction, and a contradiction about paid
 * content is resolved by refusing.
 */
export async function openPublicMediaObject(objectKey: string): Promise<ServableMedia | null> {
  // Shape first, so a request for `../../.env` costs one regular expression
  // rather than a filesystem call whose safety depends on path normalisation.
  if (!isValidObjectKey(objectKey)) return null;

  const asset = await prisma.mediaAsset.findUnique({
    where: { objectKey },
    select: { objectKey: true, visibility: true, mimeType: true, deletedAt: true },
  });
  if (!asset || asset.deletedAt || asset.visibility !== 'PUBLIC') return null;

  const object = await getStorageProvider().getStream({
    objectKey: asset.objectKey,
    visibility: 'PUBLIC',
  });
  if (!object) return null;

  return {
    body: object.body,
    // The type recorded at upload, never one re-derived from the stored bytes.
    mimeType: asset.mimeType,
    // The store's own measurement, so `Content-Length` describes what is
    // actually being sent rather than what the row remembers.
    sizeBytes: object.sizeBytes,
  };
}

/**
 * Whether this reader may see this protected asset.
 *
 * "Actual use" is meant literally. Holding an entitlement is not enough on its
 * own and neither is the image existing: the asset has to appear in content the
 * reader's own entitlement covers.
 *
 * Preview lessons are deliberately not a bypass. A free preview is a marketing
 * decision about a lesson, and extending it to the question bank's images would
 * make the size of the leak depend on which lessons someone happened to flag as
 * previews.
 */
async function mayReadProtectedAsset(assetId: string, user: CurrentUser): Promise<boolean> {
  // An administrator is editing the question this image belongs to. There is no
  // entitlement to check, and no attempt that would produce one.
  if (user.role === 'ADMIN') return true;

  const usedByOwnAttempt = await prisma.attemptQuestion.findFirst({
    where: {
      question: { stimulus: { mediaAssetId: assetId } },
      attemptSection: {
        attempt: {
          userId: user.id,
          // Re-checked rather than inferred from the attempt existing: a refund
          // revokes the entitlement, and the images must close with it.
          simulator: { product: { entitlements: { some: { userId: user.id, status: 'ACTIVE' } } } },
        },
      },
    },
    select: { id: true },
  });
  if (usedByOwnAttempt) return true;

  const usedByOwnedCourse = await prisma.lessonQuizQuestion.findFirst({
    where: {
      question: { stimulus: { mediaAssetId: assetId } },
      quiz: {
        lesson: {
          module: {
            course: { product: { entitlements: { some: { userId: user.id, status: 'ACTIVE' } } } },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(usedByOwnedCourse);
}

export async function openProtectedMediaObject(input: {
  assetId: string;
  user: CurrentUser;
}): Promise<ServableMedia> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: input.assetId },
    select: { id: true, objectKey: true, visibility: true, mimeType: true, deletedAt: true },
  });
  // A public asset is not served from here. It has its own cacheable route, and
  // answering for it would create a second, uncached address for the same bytes.
  if (!asset || asset.deletedAt || asset.visibility !== 'PROTECTED') {
    throw new HttpError(404, COPY.adminMedia.errors.notFound, 'media_not_found');
  }

  if (!(await mayReadProtectedAsset(asset.id, input.user))) {
    // Logged, because a run of these is what an attempt to walk the question
    // bank looks like from the server's side.
    logger.warn('media: protected asset refused', { assetId: asset.id, userId: input.user.id });
    throw new HttpError(403, COPY.errors.forbidden, 'forbidden');
  }

  const object = await getStorageProvider().getStream({
    objectKey: asset.objectKey,
    visibility: 'PROTECTED',
  });
  if (!object) {
    // The row outlived its file. A 404 is the right answer to the request, and
    // the log line is the one that says something needs repairing.
    logger.error('media: protected row has no stored object', { assetId: asset.id });
    throw new HttpError(404, COPY.adminMedia.errors.notFound, 'media_not_found');
  }

  return { body: object.body, mimeType: asset.mimeType, sizeBytes: object.sizeBytes };
}
