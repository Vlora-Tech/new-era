import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { env } from '@/lib/env';

import { localStorageProvider } from './local-provider';
import type { StorageProvider } from './storage-provider';

/**
 * Resolve the storage adapter for the current configuration.
 *
 * Only the local adapter exists. `s3` parses as a valid `STORAGE_PROVIDER`
 * because the environment schema anticipates it, but there is deliberately no
 * implementation behind it: the brief requires the owner to approve a provider
 * *and a region* first, since a bucket implies both a cost and a data-residency
 * decision the privacy review has not settled. Selecting it therefore refuses
 * with the Arabic sentence that says so, rather than failing somewhere deeper
 * with a message about a missing credential.
 *
 * The production gate below is the second, independent refusal of local disk in
 * production — `env()` will not even parse that combination. It reads
 * `process.env.NODE_ENV` directly rather than the validated value, so it is not
 * the same check twice through the same code path. Local disk on typical hosting
 * is ephemeral: uploads would appear to work and then vanish on the next deploy,
 * which is worse than refusing them.
 */
export function getStorageProvider(): StorageProvider {
  if (env().STORAGE_PROVIDER === 's3') {
    throw new HttpError(503, COPY.adminMedia.errors.storageUnavailable, 'storage_unavailable');
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
