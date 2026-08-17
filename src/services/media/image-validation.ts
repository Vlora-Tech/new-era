import 'server-only';

import sharp, { type OutputInfo, type Sharp, type SharpOptions } from 'sharp';

import { COPY } from '@/lib/copy';
import { formatNumber } from '@/lib/format';
import {
  MEDIA_EXTENSIONS,
  MEDIA_MAX_DIMENSION,
  MEDIA_MIME_TYPES,
  type MediaMimeType,
} from '@/validators/admin-media';

/**
 * The upload validation pipeline, in the order `docs/media-storage.md` sets out.
 *
 * The order is not cosmetic — each step assumes the previous one passed:
 *
 *  1. **Size.** Checked before anything decodes, so a large file costs a length
 *     comparison rather than a decompression.
 *  2. **The declared type against the allowlist.** This is where SVG dies, and it
 *     has to die here rather than at the decoder: sharp will happily rasterise an
 *     SVG (verified — `sharp(svgBytes).metadata().format === 'svg'`), so "it
 *     decoded, therefore it is an image" is not a safe test. SVG is a document
 *     format that executes script; accepting it is accepting stored XSS wearing
 *     an image extension.
 *  3. **Magic bytes, which must agree with the declared type.** A declared type
 *     is a claim by the uploader — `Blob.type` comes from the browser's guess at
 *     a file extension and can be set to anything by a scripted client.
 *  4. **Decode, dimension cap, re-encode.** Re-encoding is what actually removes
 *     a payload: EXIF, colour profiles, and anything appended after the image
 *     data are all absent from the output because the output is drawn from
 *     decoded pixels rather than copied from the input.
 *  5. The caller then checksums and records the row. This module never touches
 *     the database or the object store.
 *
 * Failures are `ImageValidationError`, not `HttpError`: this module has no
 * opinion about status codes, and keeping it free of the auth layer is what lets
 * the unit suite exercise it without a database client.
 */

/** The locale used for the numbers interpolated into the refusals below. */
const LOCALE = 'ar-SA';

const BYTES_PER_KILOBYTE = 1_024;
const BYTES_PER_MEGABYTE = 1_024 * 1_024;

/**
 * A byte count in Arabic words, e.g. `٣ ميغابايت`.
 *
 * The unit noun comes from ICU rather than from a literal, so this is
 * locale-aware formatting in the sense `src/lib/format.ts` uses the word, not
 * user-facing copy authored outside `COPY`.
 */
export function formatByteSize(bytes: number): string {
  const useMegabytes = bytes >= BYTES_PER_MEGABYTE;
  return new Intl.NumberFormat(LOCALE, {
    style: 'unit',
    unit: useMegabytes ? 'megabyte' : 'kilobyte',
    unitDisplay: 'long',
    maximumFractionDigits: 1,
  }).format(bytes / (useMegabytes ? BYTES_PER_MEGABYTE : BYTES_PER_KILOBYTE));
}

/**
 * Which step refused the file.
 *
 * Five codes rather than one, because the five refusals need five different
 * actions from the administrator: shrink it, convert it, stop renaming it,
 * resize it, or pick a file that is actually an image.
 */
export type ImageValidationCode =
  'too_large' | 'wrong_type' | 'magic_mismatch' | 'dimensions_too_large' | 'decode_failed';

export class ImageValidationError extends Error {
  readonly code: ImageValidationCode;

  constructor(code: ImageValidationCode, message: string) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
  }
}

/**
 * The size refusal, exported because the caller checks the cap twice: once
 * against `Blob.size` before the bytes are read into memory, and once here.
 * Both refusals must read identically, so both come from this one place.
 */
export function tooLargeError(maxBytes: number): ImageValidationError {
  return new ImageValidationError(
    'too_large',
    COPY.adminMedia.errors.tooLarge.replace('{limit}', formatByteSize(maxBytes)),
  );
}

// ── Magic bytes ──────────────────────────────────────────────────────────

const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
/** `RIFF` at 0 and `WEBP` at 8 — a WebP is a RIFF container with that form type. */
const RIFF_TAG = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const;

function matchesAt(bytes: Uint8Array, signature: readonly number[], offset: number): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The type the bytes actually are, or `null` for anything not on the allowlist.
 *
 * `null` covers a great deal: an SVG, a PDF, a ZIP renamed to `.png`, a
 * truncated download, an empty file. All of them are the same answer — this is
 * not one of the three types this platform stores — and none of them needs to be
 * distinguished for the message the administrator sees.
 */
export function sniffImageMimeType(bytes: Uint8Array): MediaMimeType | null {
  if (matchesAt(bytes, PNG_SIGNATURE, 0)) return 'image/png';
  if (matchesAt(bytes, JPEG_SOI, 0)) return 'image/jpeg';
  if (matchesAt(bytes, RIFF_TAG, 0) && matchesAt(bytes, WEBP_TAG, 8)) return 'image/webp';
  return null;
}

function isAcceptedMimeType(value: string): value is MediaMimeType {
  return (MEDIA_MIME_TYPES as readonly string[]).includes(value);
}

// ── The pipeline ─────────────────────────────────────────────────────────

/**
 * A re-encoded image and the facts recorded about it.
 *
 * `bytes` is the **output** of the re-encode, never the input. Nothing that
 * arrived from a browser is stored.
 */
export type ValidatedImage = {
  bytes: Uint8Array;
  mimeType: MediaMimeType;
  /** For the generated object key. No dot, and never from a filename. */
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
};

/**
 * Re-encode to the type the file already was.
 *
 * Format conversion is deliberately absent. Turning every upload into WebP would
 * save bandwidth and would also silently re-encode a PNG diagram — the exact
 * kind of image a question stimulus is — as a lossy one.
 */
function encodeAs(pipeline: Sharp, mimeType: MediaMimeType): Sharp {
  switch (mimeType) {
    case 'image/jpeg':
      return pipeline.jpeg({ quality: 82 });
    case 'image/png':
      return pipeline.png({ compressionLevel: 9 });
    case 'image/webp':
      return pipeline.webp({ quality: 82 });
  }
}

export async function validateAndNormaliseImage(input: {
  bytes: Uint8Array;
  /** What the uploader said it was. Treated as a claim, never as a fact. */
  declaredMimeType: string;
  maxBytes: number;
}): Promise<ValidatedImage> {
  if (input.bytes.byteLength > input.maxBytes) throw tooLargeError(input.maxBytes);

  const declared = input.declaredMimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!isAcceptedMimeType(declared)) {
    throw new ImageValidationError('wrong_type', COPY.adminMedia.errors.wrongType);
  }

  const sniffed = sniffImageMimeType(input.bytes);
  if (sniffed === null || sniffed !== declared) {
    throw new ImageValidationError('magic_mismatch', COPY.adminMedia.errors.magicMismatch);
  }

  const source = Buffer.from(input.bytes);
  const options: SharpOptions = {
    // `error` rather than the stricter default of `warning`: real photographs
    // routinely carry benign warnings from their encoder, and refusing those
    // would teach administrators that the uploader is broken. Anything that
    // genuinely fails to decode still throws.
    failOn: 'error',
    // A decompression bomb — a few kilobytes of PNG that expands to gigabytes of
    // pixels — is refused at decode rather than after it has been allocated.
    limitInputPixels: MEDIA_MAX_DIMENSION * MEDIA_MAX_DIMENSION,
  };

  let width: number;
  let height: number;
  try {
    // `metadata()` reads the header only, so the dimension cap below is applied
    // before a single pixel is decoded.
    const metadata = await sharp(source, options).metadata();
    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError('decode_failed', COPY.adminMedia.errors.decodeFailed);
    }
    width = metadata.width;
    height = metadata.height;
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError('decode_failed', COPY.adminMedia.errors.decodeFailed);
  }

  if (width > MEDIA_MAX_DIMENSION || height > MEDIA_MAX_DIMENSION) {
    throw new ImageValidationError(
      'dimensions_too_large',
      COPY.adminMedia.errors.dimensionsTooLarge.replace('{max}', formatNumber(MEDIA_MAX_DIMENSION)),
    );
  }

  let encoded: { data: Buffer; info: OutputInfo };
  try {
    encoded = await encodeAs(
      // `rotate()` with no argument applies the EXIF orientation and then drops
      // it. Without it, stripping metadata would leave a phone photograph
      // rendering on its side, because the orientation flag was the only thing
      // that had been holding it upright.
      sharp(source, options).rotate(),
      sniffed,
    ).toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageValidationError('decode_failed', COPY.adminMedia.errors.decodeFailed);
  }

  // The cap governs what is stored, not only what was sent. Re-encoding usually
  // shrinks a file, but an 8-bit palette PNG expanded to full colour can grow
  // several times over, and the store must not be made to hold more than the
  // limit the administrator was shown.
  if (encoded.info.size > input.maxBytes) throw tooLargeError(input.maxBytes);

  return {
    bytes: encoded.data,
    mimeType: sniffed,
    extension: MEDIA_EXTENSIONS[sniffed],
    sizeBytes: encoded.info.size,
    // Taken from the output: `rotate()` swaps the two for a quarter-turn
    // orientation, and the recorded dimensions must describe the stored bytes.
    width: encoded.info.width,
    height: encoded.info.height,
  };
}
