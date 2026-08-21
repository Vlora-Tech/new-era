import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { env } from '@/lib/env';

import { localStorageProvider } from './local-provider';
import { s3StorageProvider } from './s3-provider';
import type { StorageProvider } from './storage-provider';

/**
 * Resolve the storage adapter for the current configuration.
 *
 * Two adapters now exist: local disk for development, and S3 for production.
 * `env()` will not parse an `s3` selection without a bucket and a region, so by
 * the time this returns the S3 adapter its configuration is already known good.
 *
 * The production gate below is the second, independent refusal of local disk in
 * production — `env()` will not even parse that combination. It reads
 * `process.env.NODE_ENV` directly rather than the validated value, so it is not
 * the same check twice through the same code path. Local disk on typical hosting
 * is ephemeral: uploads would appear to work and then vanish on the next deploy,
 * which is worse than refusing them.
 *
 * The refusal is kept rather than deleted along with the old `s3` stub: it is
 * what turns "somebody shipped with the development default" into one honest
 * Arabic sentence instead of uploads that silently evaporate.
 */
export function getStorageProvider(): StorageProvider {
  if (env().STORAGE_PROVIDER === 's3') {
    return s3StorageProvider;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(503, COPY.adminMedia.errors.storageUnavailable, 'storage_unavailable');
  }

  return localStorageProvider;
}

export { isValidObjectKey } from './local-provider';
export type {
  AssetVisibility,
  PutObjectInput,
  StorageObjectStream,
  StorageProvider,
  StorageProviderKind,
  StoredObject,
  StoredObjectRef,
} from './storage-provider';
