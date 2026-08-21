import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

import { isValidObjectKey } from './local-provider';
import type {
  AssetVisibility,
  PutObjectInput,
  StorageObjectStream,
  StorageProvider,
  StoredObject,
  StoredObjectRef,
} from './storage-provider';

/**
 * The production storage adapter: objects in an S3 bucket.
 *
 * It mirrors the local adapter's two structural guarantees rather than
 * re-deciding them, because they are what make the boundary safe:
 *
 *  - **Two prefixes, not one bucket of mixed content.** `public/` and
 *    `protected/` are separate trees, exactly as on disk, so a guessed protected
 *    key cannot resolve inside the public one. The bucket itself blocks all
 *    public access; `publicUrl` answers with a CDN address, never an S3 one, so
 *    the only way bytes leave the bucket is through something that decided they
 *    should.
 *  - **Keys are generated, never supplied.** `put` mints a UUID and the caller
 *    supplies only an extension, so a browser filename never reaches the store.
 *    Keys read back out of a database row are re-validated with the same
 *    `isValidObjectKey` the local adapter uses — one definition of a legal key,
 *    shared, so widening the accepted image types cannot leave one adapter
 *    behind.
 *
 * The object key recorded on the `MediaAsset` row stays bare (`<uuid>.<ext>`),
 * identical to the local adapter's. The prefix is derived from visibility at
 * call time, the same way the local adapter derives a directory, so a row is
 * portable between the two and `isValidObjectKey` keeps working on it.
 *
 * Credentials are deliberately not configuration. The client uses the default
 * AWS provider chain, which on App Runner or ECS resolves to the task's IAM
 * role — a short-lived, rotated credential. There is no access-key setting to
 * add, because a long-lived key in an environment variable is the thing the role
 * exists to avoid.
 */

function prefixFor(visibility: AssetVisibility): string {
  return visibility === 'PUBLIC' ? 'public' : 'protected';
}

/** The bucket key for a stored object, or `null` when the key is malformed. */
function resolveBucketKey(ref: StoredObjectRef): string | null {
  if (!isValidObjectKey(ref.objectKey)) return null;
  return `${prefixFor(ref.visibility)}/${ref.objectKey}`;
}

/*
 * One client for the process.
 *
 * Built lazily rather than at module load: importing this file must not require
 * the S3 settings to be present, or a development process running the local
 * adapter would fail on configuration it never uses.
 */
let client: S3Client | null = null;

function s3(): S3Client {
  client ??= new S3Client({ region: env().S3_REGION });
  return client;
}

function bucket(): string {
  // `env()` refuses to parse an `s3` configuration without these, so by the time
  // any of this runs the values are present. The assertion documents that
  // contract rather than re-checking it on every call.
  return env().S3_BUCKET as string;
}

/**
 * Whether a thrown value is S3 saying "no such object".
 *
 * Only absence maps to `null`. An unreachable bucket, a denied request or an
 * expired credential must keep throwing: the interface promises that a missing
 * object is distinguishable from a broken store, and swallowing everything here
 * would turn an outage into a page of silent 404s.
 */
function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'NoSuchKey' || candidate.$metadata?.httpStatusCode === 404;
}

export const s3StorageProvider: StorageProvider = {
  kind: 'S3',

  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `${randomUUID()}.${input.extension}`;

    /*
     * Taken over the bytes about to be sent, then given to S3 in base64 as well
     * as recorded in hex. The hex value goes on the `MediaAsset` row, matching
     * the local adapter; the base64 copy makes S3 verify the body it received
     * and reject a truncated upload, so the checksum attests to what was
     * persisted rather than to what this process believed it sent.
     */
    const digest = createHash('sha256').update(input.body).digest();

    await s3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: `${prefixFor(input.visibility)}/${objectKey}`,
        Body: input.body,
        ContentType: input.mimeType,
        ChecksumSHA256: digest.toString('base64'),
        /*
         * The cache rule travels with the object, so a CDN in front of the
         * bucket cannot be the only thing keeping paid content out of a shared
         * cache. Public keys are UUIDs and are never reused, which is what makes
         * `immutable` honest: a changed image is a new key.
         */
        CacheControl:
          input.visibility === 'PUBLIC'
            ? 'public, max-age=31536000, immutable'
            : 'private, no-store',
        /*
         * The counterpart of the local adapter's `wx` flag: fail rather than
         * overwrite. A UUID collision is vanishingly unlikely, and silently
         * replacing somebody else's image would be unrecoverable, so the
         * improbable case is made loud instead of invisible.
         */
        IfNoneMatch: '*',
      }),
    );

    return {
      objectKey,
      visibility: input.visibility,
      mimeType: input.mimeType,
      sizeBytes: input.body.byteLength,
      checksumSha256: digest.toString('hex'),
      width: input.width ?? null,
      height: input.height ?? null,
    };
  },

  async getStream(ref: StoredObjectRef): Promise<StorageObjectStream | null> {
    const key = resolveBucketKey(ref);
    if (!key) return null;

    let response;
    try {
      response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }

    if (!response.Body) return null;

    return {
      // The SDK's stream mixin converts to a web stream, because the value is
      // handed straight to a `Response` body in a route handler.
      body: response.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      sizeBytes: response.ContentLength ?? 0,
    };
  },

  async delete(ref: StoredObjectRef): Promise<void> {
    const key = resolveBucketKey(ref);
    if (!key) return;
    // S3 treats deleting an absent key as success, which is the idempotence the
    // interface asks for: deletion runs after the row is gone, so a retry or a
    // cleanup sweep must not fail on work already done.
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },

  publicUrl(ref: StoredObjectRef): string | null {
    // Never an address for protected content. There is no permanent public URL
    // for a paid question image by design.
    if (ref.visibility !== 'PUBLIC') return null;
    if (!isValidObjectKey(ref.objectKey)) {
      logger.warn('media: refusing to build a URL for a malformed object key');
      return null;
    }

    /*
     * Without a CDN in front of the bucket there is no public address to give,
     * so this answers `null` and `mediaAssetUrl` falls back to the application's
     * own public route — which streams the object through `getStream`. That is
     * slower and costs egress through the app, but it is correct, and it means
     * S3 works on day one without CloudFront having to exist yet.
     */
    const base = env().S3_PUBLIC_BASE_URL;
    if (!base) return null;

    return `${base.replace(/\/+$/, '')}/public/${ref.objectKey}`;
  },
};
