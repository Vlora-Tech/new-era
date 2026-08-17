import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  formatByteSize,
  ImageValidationError,
  sniffImageMimeType,
  validateAndNormaliseImage,
} from '@/services/media/image-validation';
import { MEDIA_MAX_DIMENSION, MEDIA_PURPOSE_RULES } from '@/validators/admin-media';

/**
 * The upload pipeline.
 *
 * The cases below are the ones that decide whether the question bank stays
 * private and whether an image can carry a payload: an oversized file, an SVG,
 * bytes that disagree with the type declared for them, and a photograph whose
 * metadata must not survive being stored.
 *
 * Every fixture is a real encoded image produced by sharp rather than a fake
 * buffer, because the interesting failures are all about what a decoder does
 * with bytes that *nearly* pass.
 */

const COVER_CAP = MEDIA_PURPOSE_RULES.PRODUCT_COVER.maxBytes;

function solid(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 90, b: 150 } },
  });
}

/**
 * Pixels from a deterministic pseudo-random sequence, so the encoders cannot
 * compress the fixture down to nothing — a repeating pattern would produce a
 * few kilobytes of PNG no matter how large the image was.
 */
function noisy(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);
  // xorshift32: every step stays inside 32-bit integer arithmetic, so the
  // sequence does not degenerate the way a multiplicative generator does once
  // its intermediate product passes `Number.MAX_SAFE_INTEGER`.
  let state = 0x2f6e2b1;
  for (let index = 0; index < pixels.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    pixels[index] = state & 0xff;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } });
}

const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
    '<script>fetch("/api/admin/media")</script><rect width="16" height="16"/></svg>',
);

describe('sniffImageMimeType', () => {
  it('recognises each accepted format from its magic bytes', async () => {
    expect(sniffImageMimeType(await solid(8, 8).png().toBuffer())).toBe('image/png');
    expect(sniffImageMimeType(await solid(8, 8).jpeg().toBuffer())).toBe('image/jpeg');
    expect(sniffImageMimeType(await solid(8, 8).webp().toBuffer())).toBe('image/webp');
  });

  it('does not recognise an SVG, which has no magic bytes to recognise', () => {
    expect(sniffImageMimeType(SVG_BYTES)).toBeNull();
  });

  it('returns null for an empty file and for bytes that are not an image', () => {
    expect(sniffImageMimeType(new Uint8Array(0))).toBeNull();
    expect(sniffImageMimeType(Buffer.from('%PDF-1.7'))).toBeNull();
  });

  it('does not mistake any RIFF container for a WebP', () => {
    // "RIFF" followed by "WAVE" rather than "WEBP" — the same container, a
    // different form type. Checking only the first four bytes would accept it.
    const wave = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x20, 0x00, 0x00, 0x00]),
      Buffer.from('WAVEfmt '),
    ]);
    expect(sniffImageMimeType(wave)).toBeNull();
  });
});

describe('size cap', () => {
  it('refuses a file larger than the cap it was given', async () => {
    const bytes = await noisy(400, 400).png().toBuffer();
    expect(bytes.byteLength).toBeGreaterThan(64 * 1_024);

    const error = await validateAndNormaliseImage({
      bytes,
      declaredMimeType: 'image/png',
      maxBytes: 64 * 1_024,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ImageValidationError);
    expect((error as ImageValidationError).code).toBe('too_large');
    // The refusal quotes the limit, so it tells the administrator how much to
    // shrink by rather than only that they failed.
    expect((error as ImageValidationError).message).toContain(formatByteSize(64 * 1_024));
  });

  it('checks the size before the type, so a huge unsupported file is not decoded', async () => {
    const oversizedSvg = Buffer.concat([SVG_BYTES, Buffer.alloc(4_096, 0x20)]);

    const error = await validateAndNormaliseImage({
      bytes: oversizedSvg,
      declaredMimeType: 'image/svg+xml',
      maxBytes: 512,
    }).catch((thrown: unknown) => thrown);

    expect((error as ImageValidationError).code).toBe('too_large');
  });
});

describe('SVG', () => {
  it('refuses an SVG declared honestly', async () => {
    const error = await validateAndNormaliseImage({
      bytes: SVG_BYTES,
      declaredMimeType: 'image/svg+xml',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ImageValidationError);
    expect((error as ImageValidationError).code).toBe('wrong_type');
  });

  it('refuses an SVG disguised as a PNG, before any decoder sees it', async () => {
    // This is the case the allowlist alone would miss and the decoder would
    // wave through: sharp rasterises SVG happily, so "it decoded" is not a test.
    expect((await sharp(SVG_BYTES).metadata()).format).toBe('svg');

    const error = await validateAndNormaliseImage({
      bytes: SVG_BYTES,
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect((error as ImageValidationError).code).toBe('magic_mismatch');
  });
});

describe('declared type versus magic bytes', () => {
  it('refuses a real PNG declared as a JPEG', async () => {
    const error = await validateAndNormaliseImage({
      bytes: await solid(20, 20).png().toBuffer(),
      declaredMimeType: 'image/jpeg',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ImageValidationError);
    expect((error as ImageValidationError).code).toBe('magic_mismatch');
  });

  it('refuses an archive renamed to an accepted type', async () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0x41)]);

    const error = await validateAndNormaliseImage({
      bytes: zip,
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect((error as ImageValidationError).code).toBe('magic_mismatch');
  });

  it('accepts a declared type carrying a charset parameter', async () => {
    const result = await validateAndNormaliseImage({
      bytes: await solid(20, 12).png().toBuffer(),
      declaredMimeType: 'IMAGE/PNG; charset=binary',
      maxBytes: COVER_CAP,
    });
    expect(result.mimeType).toBe('image/png');
  });
});

describe('re-encoding', () => {
  it('strips EXIF metadata from an accepted image', async () => {
    const original = await solid(48, 32)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Someone else', Software: 'a camera', Artist: 'a name' } })
      .toBuffer();

    // The fixture really does carry metadata; otherwise the assertion below
    // would pass for a file that never had any.
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const result = await validateAndNormaliseImage({
      bytes: original,
      declaredMimeType: 'image/jpeg',
      maxBytes: COVER_CAP,
    });

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
    expect(result.width).toBe(48);
    expect(result.height).toBe(32);
    expect(result.sizeBytes).toBe(result.bytes.byteLength);

    const stored = await sharp(result.bytes).metadata();
    expect(stored.exif).toBeUndefined();
    expect(stored.format).toBe('jpeg');
  });

  it('discards anything appended after the image data', async () => {
    const payload = Buffer.from('<script>alert(1)</script>');
    const smuggled = Buffer.concat([await solid(24, 24).png().toBuffer(), payload]);

    // The appended bytes survive a naive copy: a decoder ignores them, so
    // storing the input verbatim would store the payload with it.
    expect(smuggled.includes(payload)).toBe(true);

    const result = await validateAndNormaliseImage({
      bytes: smuggled,
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    });

    expect(Buffer.from(result.bytes).includes(payload)).toBe(false);
  });

  it('keeps the format it was given rather than converting', async () => {
    const result = await validateAndNormaliseImage({
      bytes: await solid(16, 16).webp().toBuffer(),
      declaredMimeType: 'image/webp',
      maxBytes: COVER_CAP,
    });

    expect(result.mimeType).toBe('image/webp');
    expect(result.extension).toBe('webp');
    expect((await sharp(result.bytes).metadata()).format).toBe('webp');
  });
});

describe('dimensions and decoding', () => {
  it('refuses an image longer than the maximum edge', async () => {
    const wide = await solid(MEDIA_MAX_DIMENSION + 1, 8)
      .png()
      .toBuffer();

    const error = await validateAndNormaliseImage({
      bytes: wide,
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ImageValidationError);
    expect((error as ImageValidationError).code).toBe('dimensions_too_large');
  });

  it('accepts an image exactly at the maximum edge', async () => {
    const result = await validateAndNormaliseImage({
      bytes: await solid(MEDIA_MAX_DIMENSION, 4).png().toBuffer(),
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    });
    expect(result.width).toBe(MEDIA_MAX_DIMENSION);
  });

  it('refuses a truncated file whose signature still looks right', async () => {
    const png = await noisy(64, 64).png().toBuffer();
    const truncated = png.subarray(0, 40);

    const error = await validateAndNormaliseImage({
      bytes: truncated,
      declaredMimeType: 'image/png',
      maxBytes: COVER_CAP,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ImageValidationError);
    expect((error as ImageValidationError).code).toBe('decode_failed');
  });
});

describe('formatByteSize', () => {
  it('describes the caps the copy quotes, in Arabic', () => {
    expect(formatByteSize(3 * 1_024 * 1_024)).toBe(
      new Intl.NumberFormat('ar-SA', {
        style: 'unit',
        unit: 'megabyte',
        unitDisplay: 'long',
      }).format(3),
    );
  });

  it('drops to kilobytes below a megabyte, so a small cap is not "٠ ميغابايت"', () => {
    expect(formatByteSize(512 * 1_024)).toContain(new Intl.NumberFormat('ar-SA').format(512));
  });
});
