import 'server-only';

import { createHash } from 'node:crypto';

import { env, isVideoEnabled } from '@/lib/env';
import { HttpError } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';

/**
 * Video provider boundary.
 *
 * Only Bunny Stream is implemented. The interface exists so playback signing and
 * lookup can be swapped without touching the lesson or entitlement code.
 *
 * Three separate Bunny credentials exist and are not interchangeable:
 *   - the token-security key signs embed URLs (used here),
 *   - the management API key reads and uploads videos (optional lookup),
 *   - the read-only API key verifies webhook signatures (phase two).
 * None is ever sent to a browser, and a permanent playback URL is never stored.
 */
export type SignedPlayback = {
  embedUrl: string;
  expiresAt: Date;
};

export type VideoLookup = {
  title: string;
  durationSec: number;
  ready: boolean;
};

export interface VideoProviderAdapter {
  readonly name: 'BUNNY';
  signPlayback(input: { videoGuid: string; ttlSeconds: number }): SignedPlayback;
  /** Available only when a management key is configured. */
  lookupVideo(videoGuid: string): Promise<VideoLookup | null>;
}

/** Bunny video identifiers are UUIDs; anything else is a typo, not a video. */
export const BUNNY_GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIN_TTL_SECONDS = 300;
const MAX_TTL_SECONDS = 4 * 60 * 60;

/**
 * Size a playback token to the video it plays.
 *
 * A fixed short token is the defect this replaces: it expires part-way through a
 * longer lesson and the player simply stops. The token covers the whole video
 * plus headroom, and the client still refreshes before expiry.
 */
export function playbackTtlSeconds(durationSec: number | null): number {
  const base = env().PLAYBACK_TOKEN_TTL_SECONDS;
  if (durationSec === null || durationSec <= 0) return base;

  const sized = durationSec + 15 * 60;
  return Math.min(Math.max(sized, base, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}

const bunnyProvider: VideoProviderAdapter = {
  name: 'BUNNY',

  signPlayback({ videoGuid, ttlSeconds }) {
    const config = env();
    const libraryId = config.BUNNY_STREAM_LIBRARY_ID;
    const securityKey = config.BUNNY_STREAM_TOKEN_SECURITY_KEY;

    if (!libraryId || !securityKey) {
      // Surfaced to the caller as an Arabic availability message; the variable
      // names stay in the server log.
      logger.error('bunny playback requested without configuration');
      throw new HttpError(503, 'خدمة الفيديو غير متاحة حاليًا.', 'video_unavailable');
    }

    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = createHash('sha256').update(`${securityKey}${videoGuid}${expires}`).digest('hex');

    const embedUrl =
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}` +
      `?token=${token}&expires=${expires}&autoplay=false&preload=true`;

    return { embedUrl, expiresAt: new Date(expires * 1000) };
  },

  async lookupVideo(videoGuid) {
    const config = env();
    const libraryId = config.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = config.BUNNY_STREAM_API_KEY;

    // The management key is optional: without it a pasted identifier is accepted
    // on format alone, and the administrator is told it was not confirmed.
    if (!libraryId || !apiKey) return null;

    try {
      const response = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`,
        {
          headers: { AccessKey: apiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        title?: string;
        length?: number;
        status?: number;
      };

      return {
        title: payload.title ?? '',
        durationSec: Math.max(0, Math.trunc(payload.length ?? 0)),
        // Bunny reports status 4 once processing has finished.
        ready: payload.status === 4,
      };
    } catch (error) {
      logger.warn('bunny video lookup failed', { videoGuid, error });
      return null;
    }
  },
};

export function getVideoProvider(): VideoProviderAdapter {
  if (!isVideoEnabled()) {
    throw new HttpError(503, 'خدمة الفيديو غير مهيأة.', 'video_not_configured');
  }
  return bunnyProvider;
}
