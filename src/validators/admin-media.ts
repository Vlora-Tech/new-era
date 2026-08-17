import { z } from 'zod';

/**
 * Media upload schemas and the limits the upload service enforces.
 *
 * The critical property here is what the schema *cannot* accept. An upload
 * declares its **purpose** and nothing else: visibility, the size cap and the
 * accepted types are all derived from that purpose on the server. A request
 * therefore cannot ask for a paid question image to be stored as a public
 * object, which is the one mistake in this area that would put the product's
 * stock-in-trade on the open web regardless of what the application checks
 * afterwards.
 *
 * Nor is a declared MIME type accepted. A declared type is a claim by the
 * uploader; the server sniffs the magic bytes, decodes, and records the type it
 * actually found. Nothing a client says about a file's contents is stored.
 *
 * The Arabic sentences describing these limits live in
 * `src/lib/copy/admin-media.ts`; the numbers below and the words there must move
 * together.
 */

/**
 * Accepted image types.
 *
 * SVG is absent and must stay absent: it is a document format that can execute
 * script, so accepting it would be accepting stored XSS with an image
 * extension. This is a category exclusion, not a filter to be relaxed.
 */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];

/**
 * Extension per stored type.
 *
 * The stored key is a generated UUID plus one of these — never a user-supplied
 * filename, which removes path traversal as a category rather than filtering
 * for it.
 */
export const MEDIA_EXTENSIONS: Record<MediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Longest accepted edge, applied during the decode-and-re-encode step. */
export const MEDIA_MAX_DIMENSION = 4_000;

export const mediaPurposeSchema = z.enum(['PRODUCT_COVER', 'QUESTION_STIMULUS'], {
  message: 'الغرض من الرفع غير صحيح',
});
export type MediaPurpose = z.infer<typeof mediaPurposeSchema>;

/**
 * What each purpose implies. The server reads this; the client never sends it.
 *
 * The caps differ because the two kinds of file differ commercially: a cover is
 * marketing that should cache aggressively, a stimulus is paid bank content that
 * is authorised on every request.
 */
export const MEDIA_PURPOSE_RULES: Record<
  MediaPurpose,
  { visibility: 'PUBLIC' | 'PROTECTED'; maxBytes: number }
> = {
  PRODUCT_COVER: { visibility: 'PUBLIC', maxBytes: 3 * 1024 * 1024 },
  QUESTION_STIMULUS: { visibility: 'PROTECTED', maxBytes: 2 * 1024 * 1024 },
};

/**
 * The metadata half of a multipart upload.
 *
 * The bytes are validated by the upload service — size, magic bytes, decode,
 * dimensions, checksum — because none of that can be expressed as a shape.
 */
export const mediaUploadSchema = z.object({
  purpose: mediaPurposeSchema,
});

export const mediaAssetIdSchema = z.uuid('معرّف الصورة غير صحيح');

/** Attaching or clearing a cover. `null` detaches without deleting the asset. */
export const attachCoverSchema = z.object({
  assetId: mediaAssetIdSchema.nullable(),
});

export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type AttachCoverInput = z.infer<typeof attachCoverSchema>;
