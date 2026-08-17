import { describe, expect, it } from 'vitest';

import {
  createRandom,
  deriveSeed,
  newAttemptSeed,
  sampleWithoutReplacement,
  shuffle,
} from '@/lib/exam/rng';

/**
 * The generator underpins reproducibility: an attempt stores one integer, and
 * that integer has to be enough to regenerate the same paper. These assert the
 * two properties that claim depends on — same seed, same output; different
 * seed, different output — plus the sampler's refusal to under-deliver.
 */
describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createRandom(12_345);
    const second = createRandom(12_345);
    const a = Array.from({ length: 20 }, () => first());
    const b = Array.from({ length: 20 }, () => second());
    expect(a).toEqual(b);
  });

  it('produces a different sequence for a different seed', () => {
    const a = Array.from({ length: 20 }, createRandom(1));
    const b = Array.from({ length: 20 }, createRandom(2));
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const random = createRandom(99);
    for (let i = 0; i < 1_000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('newAttemptSeed', () => {
  it('stays inside the range a PostgreSQL integer column can store', () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = newAttemptSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(2_147_483_647);
    }
  });
});

describe('deriveSeed', () => {
  it('is deterministic and separates salts', () => {
    expect(deriveSeed(42, 1)).toBe(deriveSeed(42, 1));
    expect(deriveSeed(42, 1)).not.toBe(deriveSeed(42, 2));
  });
});

describe('sampleWithoutReplacement', () => {
  const pool = Array.from({ length: 50 }, (_, index) => index);

  it('draws distinct items from the pool', () => {
    const drawn = sampleWithoutReplacement(pool, 12, createRandom(7));
    expect(drawn).toHaveLength(12);
    expect(new Set(drawn).size).toBe(12);
    for (const item of drawn) expect(pool).toContain(item);
  });

  it('is reproducible for a given seed', () => {
    expect(sampleWithoutReplacement(pool, 10, createRandom(3))).toEqual(
      sampleWithoutReplacement(pool, 10, createRandom(3)),
    );
  });

  it('refuses to draw more than the pool holds', () => {
    // Returning a short list here is what would silently deliver a short section.
    expect(() => sampleWithoutReplacement(pool, 51, createRandom(1))).toThrow(RangeError);
  });

  it('leaves the source array untouched', () => {
    const source = [...pool];
    sampleWithoutReplacement(source, 20, createRandom(5));
    expect(source).toEqual(pool);
  });
});

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    const shuffled = shuffle(items, createRandom(11));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('is reproducible for a given seed', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    expect(shuffle(items, createRandom(4))).toEqual(shuffle(items, createRandom(4)));
  });
});
