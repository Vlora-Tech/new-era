import 'server-only';

import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { MEDIA_EXTENSIONS } from '@/validators/admin-media';

import type {
  AssetVisibility,
  PutObjectInput,
  StorageObjectStream,
  StorageProvider,
  StoredObject,
  StoredObjectRef,
} from './storage-provider';

/**
 * The development storage adapter: files on local disk.
 *
 * Two properties matter more than anything else about this file, and both are
 * structural rather than checks that could be forgotten:
 *
 *  - **The tree lives outside `public/`.** Anything under `public/` is served by
 *    Next straight from disk, which would put every protected question stimulus
 *    on a permanent unauthenticated URL and quietly bypass every check the
 *    application performs. `STORAGE_LOCAL_ROOT` defaults to `.storage/`, a
 *    sibling of `public/` and not a child of it.
 *  - **Keys are generated, never supplied.** `put` takes an extension and mints
 *    a UUID. A filename from a browser never reaches this module, so path
 *    traversal is not a thing to be filtered — there is no input to traverse
 *    with. The key shape is then re-validated on the way back out, because a key
 *    read from a database row is still a string that arrived from somewhere.
 *
 * `env()` refuses to parse a production configuration that selects this adapter,
 * because local disk on the hosting this product targets is ephemeral: uploads
 * would appear to work and then vanish on the next deploy.
 */

/**
 * The one legal shape of a key this adapter produces: a UUID and one of the
 * accepted extensions, with no separator of any kind. The extension list is read
 * from the validator rather than repeated, so widening the accepted types cannot
 * leave the key check behind.
 */
const OBJECT_KEY_PATTERN = new RegExp(
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:${Object.values(
    MEDIA_EXTENSIONS,
  ).join('|')})$`,
);

/**
 * Whether a string can be an object key at all.
 *
 * Exported because the public serving route checks the shape *before* touching
 * the database or the disk: a request for `../../.env` should cost one regular
 * expression, not a filesystem call whose safety depends on how `path.join`
 * happens to normalise the result.
 */
export function isValidObjectKey(key: string): boolean {
  return OBJECT_KEY_PATTERN.test(key);
}

function storageRoot(): string {
  return path.resolve(process.cwd(), env().STORAGE_LOCAL_ROOT);
}

/**
 * Public and protected objects live in separate trees.
 *
 * This is the enforcement, not a convention: the public serving route only ever
 * asks for `PUBLIC`, so it can only ever open a file from the public tree, and a
 * guessed protected key resolves to a path that does not exist there.
 */
function directoryFor(visibility: AssetVisibility): string {
  return path.join(storageRoot(), visibility === 'PUBLIC' ? 'public' : 'protected');
}

function resolveObjectPath(ref: StoredObjectRef): string | null {
  if (!isValidObjectKey(ref.objectKey)) return null;
  return path.join(directoryFor(ref.visibility), ref.objectKey);
}

export const localStorageProvider: StorageProvider = {
  kind: 'LOCAL',

  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `${randomUUID()}.${input.extension}`;
    const directory = directoryFor(input.visibility);
    await mkdir(directory, { recursive: true });

    // Computed over the bytes handed to `writeFile`, so it attests to what was
    // persisted rather than to what a caller claimed about it.
    const checksumSha256 = createHash('sha256').update(input.body).digest('hex');

    // `wx` fails rather than overwriting. A UUID collision is vanishingly
    // unlikely and silently replacing somebody else's image would be
    // unrecoverable, so the improbable case is made loud instead of invisible.
    await writeFile(path.join(directory, objectKey), input.body, { flag: 'wx' });

    return {
      objectKey,
      visibility: input.visibility,
      mimeType: input.mimeType,
      sizeBytes: input.body.byteLength,
      checksumSha256,
      width: input.width ?? null,
      height: input.height ?? null,
    };
  },

  async getStream(ref: StoredObjectRef): Promise<StorageObjectStream | null> {
    const objectPath = resolveObjectPath(ref);
    if (!objectPath) return null;

    let info;
    try {
      info = await stat(objectPath);
    } catch {
      // Absence is an ordinary outcome — a row that outlived its file, a key
      // copied from another environment — and it must produce a 404 rather than
      // an error path indistinguishable from the disk being unreadable.
      return null;
    }
    if (!info.isFile()) return null;

    // A Node stream converted to a web stream, because the value is handed
    // straight to a `Response` body. The cast is the one place the two
    // `ReadableStream` declarations — DOM and `node:stream/web` — have to be
    // reconciled; they are the same class at runtime.
    const body = Readable.toWeb(
      createReadStream(objectPath),
    ) as unknown as ReadableStream<Uint8Array>;

    return { body, sizeBytes: info.size };
  },

  async delete(ref: StoredObjectRef): Promise<void> {
    const objectPath = resolveObjectPath(ref);
    if (!objectPath) return;
    // `force` makes a missing file a success. Deletion is called after the row
    // is already gone, so a second attempt — a retry, a cleanup sweep — must not
    // fail on work that is already done.
    await rm(objectPath, { force: true });
  },

  publicUrl(ref: StoredObjectRef): string | null {
    // Never a URL for protected content. There is no permanent public address
    // for a paid question image by design; every read goes through the route
    // that authorises first.
    if (ref.visibility !== 'PUBLIC') return null;
    if (!isValidObjectKey(ref.objectKey)) {
      logger.warn('media: refusing to build a URL for a malformed object key');
      return null;
    }
    return `/api/media/public/${ref.objectKey}`;
  },
};
