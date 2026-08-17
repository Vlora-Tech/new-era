/**
 * Seeded pseudo-random source for attempt generation.
 *
 * Every random decision an attempt makes — which questions are drawn, the order
 * they appear in, the order of each question's options — is derived from one
 * integer stored on the attempt row. That is what makes a delivered attempt
 * reproducible: given the seed and the question bank as it stood, the same
 * selection can be regenerated for an investigation or a support request,
 * without storing a second copy of the decisions themselves.
 *
 * `Math.random` is deliberately not used here. It cannot be seeded, so a
 * selection made with it would be unreproducible the moment the request ended.
 * mulberry32 is a small, well-understood 32-bit generator; it is not
 * cryptographic, and nothing here depends on it being unpredictable — the
 * secrecy of an attempt comes from never serialising the answer key, not from
 * the shuffle being hard to guess.
 */

/** 2^32, the divisor that maps a uint32 onto [0, 1). */
const UINT32_RANGE = 4_294_967_296;

/**
 * Upper bound for a stored seed.
 *
 * `ExamAttempt.seed` is a PostgreSQL `integer`, so a seed must fit in a signed
 * 32-bit range. Staying non-negative keeps the value readable in the admin
 * tooling and avoids any sign-extension surprise when it is re-derived.
 */
const MAX_SEED = 2_147_483_647;

/** Create a deterministic generator producing values in [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** A fresh seed for a new attempt, inside the range the column can store. */
export function newAttemptSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

/**
 * Derive an independent stream from the attempt seed.
 *
 * Section shuffles, question shuffles and option shuffles each take their own
 * derived seed rather than sharing one generator. Sharing would make the
 * outcome depend on the order the callers happened to run in, which is exactly
 * the kind of coupling that turns a refactor into a silently different exam.
 */
export function deriveSeed(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return mixed % (MAX_SEED + 1);
}

/**
 * Draw `count` distinct items, preserving no bias toward the pool's order.
 *
 * A partial Fisher–Yates shuffle: only the prefix that is actually returned is
 * shuffled, so drawing 24 items from a bank of thousands stays proportional to
 * the draw rather than to the bank.
 *
 * Throws when the pool is too small. Callers must treat that as a hard failure:
 * quietly returning fewer items is how a student ends up with a short section.
 */
export function sampleWithoutReplacement<T>(
  pool: readonly T[],
  count: number,
  random: () => number,
): T[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('sample count must be a non-negative integer');
  }
  if (count > pool.length) {
    throw new RangeError(`cannot sample ${count} items from a pool of ${pool.length}`);
  }

  const working = [...pool];
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(random() * (working.length - i));
    const swap = working[i]!;
    working[i] = working[j]!;
    working[j] = swap;
  }
  return working.slice(0, count);
}

/** Full Fisher–Yates shuffle, returning a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const working = [...items];
  for (let i = working.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = working[i]!;
    working[i] = working[j]!;
    working[j] = swap;
  }
  return working;
}
