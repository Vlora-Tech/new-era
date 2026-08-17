import 'server-only';

import type { $Enums } from '@prisma/client';

/**
 * The storage boundary. **Interface only — no adapter lives in this file.**
 *
 * The production adapter is deliberately unchosen: the brief requires the owner
 * to approve a provider and a region first, because a bucket implies both a cost
 * and a data-residency decision that the privacy review has not settled. The
 * local development adapter and any future S3 adapter both implement this shape,
 * so a caller never learns which one it is talking to.
 *
 * Two things this interface is careful not to expose:
 *
 *  - **Filenames.** `put` takes bytes and an extension; the adapter generates the
 *    key. A user-supplied filename never reaches the object store, which removes
 *    path traversal as a category rather than filtering for it.
 *  - **A URL for protected content.** `publicUrl` returns `null` for a protected
 *    object, because there is no permanent public URL for one by design. Every
 *    read of paid bank content goes through a route that authorises first.
 *
 * See `docs/media-storage.md` for the validation pipeline that runs before
 * anything reaches `put`, and for why local disk fails startup in production.
 */

/** `PUBLIC` — catalogue artwork. `PROTECTED` — paid question stimuli. */
export type AssetVisibility = $Enums.AssetVisibility;

/** Which adapter produced an object, recorded on the `MediaAsset` row. */
export type StorageProviderKind = $Enums.StorageProviderKind;

/**
 * Everything needed to locate a stored object.
 *
 * Visibility travels with the key rather than being looked up, because the local
 * adapter's directory layout *is* its enforcement: public and protected objects
 * live in different trees, and only one of them may ever be served without a
 * check.
 */
export type StoredObjectRef = {
  objectKey: string;
  visibility: AssetVisibility;
};

/**
 * What the store recorded about an object it wrote.
 *
 * The checksum is computed by the adapter over the bytes it actually persisted,
 * not passed in by the caller: a checksum supplied alongside the data attests to
 * nothing, whereas one taken at the point of writing detects a truncated or
 * corrupted store.
 */
export type StoredObject = StoredObjectRef & {
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  /** Present for raster images; `null` when the adapter was not told. */
  width: number | null;
  height: number | null;
};

/**
 * A validated, re-encoded image ready to be written.
 *
 * By the time this is constructed the upload service has already checked the
 * size, matched the magic bytes against the declared type, decoded and
 * re-encoded (which strips metadata and anything hidden past the image data),
 * and enforced the dimension cap. The adapter's job is storage, not validation.
 */
export type PutObjectInput = {
  body: Uint8Array;
  /** The type determined by sniffing, never the one the uploader declared. */
  mimeType: string;
  visibility: AssetVisibility;
  /** Extension for the generated key, e.g. `webp`. No dot, no filename. */
  extension: string;
  width?: number | null;
  height?: number | null;
};

/**
 * A readable object.
 *
 * A web `ReadableStream` rather than a Node stream, because the value is handed
 * straight to a `Response` body in a route handler. `sizeBytes` is returned for
 * `Content-Length`; the **content type is not**, and deliberately so — the type
 * served comes from the `MediaAsset` row recorded at upload, never from
 * something re-derived from the stored bytes at request time.
 */
export type StorageObjectStream = {
  body: ReadableStream<Uint8Array>;
  sizeBytes: number;
};

export interface StorageProvider {
  /** Which implementation this is; recorded on the `MediaAsset` row. */
  readonly kind: StorageProviderKind;

  /** Write bytes under a newly generated key and report what was stored. */
  put(input: PutObjectInput): Promise<StoredObject>;

  /**
   * Open an object for reading, or `null` when it does not exist.
   *
   * Absence is a return value rather than an exception: a missing object is an
   * ordinary outcome — a row surviving a deleted file, a key from a previous
   * environment — and it should produce a 404, not an unhandled error path
   * indistinguishable from the store being unreachable.
   */
  getStream(ref: StoredObjectRef): Promise<StorageObjectStream | null>;

  /**
   * Remove an object. Idempotent: deleting something already gone succeeds.
   *
   * This is the low-level removal. Refusing to delete an asset that a product or
   * a question still references is a service-level rule, checked before this is
   * called, so the store never has to know what its objects are used for.
   */
  delete(ref: StoredObjectRef): Promise<void>;

  /**
   * A directly fetchable URL, or `null` when the object has none.
   *
   * Always `null` for `PROTECTED`. Returning a value rather than throwing makes
   * "can this be served directly?" a question a caller can ask in an `if`,
   * instead of a control-flow decision hidden in a `try`/`catch`.
   */
  publicUrl(ref: StoredObjectRef): string | null;
}
