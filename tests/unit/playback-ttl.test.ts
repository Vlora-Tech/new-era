import { describe, expect, it, beforeEach } from 'vitest';

import { BUNNY_GUID_PATTERN, playbackTtlSeconds } from '@/services/video/video-provider';
import { resetEnvCacheForTests } from '@/lib/env';

describe('playbackTtlSeconds', () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.PLAYBACK_TOKEN_TTL_SECONDS = '2700';
  });

  it('falls back to the configured baseline when the duration is unknown', () => {
    expect(playbackTtlSeconds(null)).toBe(2_700);
    expect(playbackTtlSeconds(0)).toBe(2_700);
  });

  it('keeps the baseline for a short video', () => {
    // A 10-minute lesson needs no more than the baseline.
    expect(playbackTtlSeconds(600)).toBe(2_700);
  });

  it('covers a video longer than the baseline, with headroom', () => {
    // This is the defect being designed out: a 50-minute lesson must not be
    // handed a 45-minute token that expires part-way through.
    const fiftyMinutes = 50 * 60;
    const ttl = playbackTtlSeconds(fiftyMinutes);
    expect(ttl).toBeGreaterThan(fiftyMinutes);
    expect(ttl).toBe(fiftyMinutes + 15 * 60);
  });

  it('caps very long videos so a token is never open-ended', () => {
    expect(playbackTtlSeconds(10 * 60 * 60)).toBe(4 * 60 * 60);
  });
});

describe('BUNNY_GUID_PATTERN', () => {
  it('accepts a real identifier shape', () => {
    expect(BUNNY_GUID_PATTERN.test('8f7c3d2e-1a4b-4c5d-9e6f-0a1b2c3d4e5f')).toBe(true);
    expect(BUNNY_GUID_PATTERN.test('8F7C3D2E-1A4B-4C5D-9E6F-0A1B2C3D4E5F')).toBe(true);
  });

  it('rejects the values that would otherwise produce an unplayable lesson', () => {
    expect(BUNNY_GUID_PATTERN.test('')).toBe(false);
    expect(BUNNY_GUID_PATTERN.test('placeholder-bunny-guid')).toBe(false);
    expect(BUNNY_GUID_PATTERN.test('  ')).toBe(false);
    expect(BUNNY_GUID_PATTERN.test('https://iframe.mediadelivery.net/embed/1/abc')).toBe(false);
    expect(BUNNY_GUID_PATTERN.test('8f7c3d2e1a4b4c5d9e6f0a1b2c3d4e5f')).toBe(false);
  });
});
