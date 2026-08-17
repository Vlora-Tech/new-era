import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * Both sides are hashed first so the comparison always runs over 32 bytes.
 * `timingSafeEqual` throws when lengths differ, and comparing raw secrets of
 * unequal length would itself reveal the expected length.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

/** Stable hex digest, used for deduplicating provider events. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
