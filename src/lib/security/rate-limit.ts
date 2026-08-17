import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';

/**
 * Fixed-window rate limiting.
 *
 * Two stores, chosen by what the limit protects:
 *
 *  - `durable` keeps counters in PostgreSQL. Budgets survive a restart and are
 *    shared across instances, which is what makes a login limit meaningful.
 *  - `memory` keeps counters in the process. Used for high-frequency, low-value
 *    endpoints such as playback heartbeats, where a database write per request
 *    would cost more than the abuse it prevents.
 *
 * Windows are fixed rather than sliding: a burst can straddle a boundary, which
 * is an accepted trade for a single atomic statement per check.
 */
export type RateLimitRule = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Where counters live. */
  store?: 'durable' | 'memory';
};

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 900, store: 'durable' },
  loginPerEmail: { limit: 5, windowSeconds: 900, store: 'durable' },
  register: { limit: 5, windowSeconds: 3_600, store: 'durable' },
  createOrder: { limit: 10, windowSeconds: 3_600, store: 'durable' },
  reconcilePayment: { limit: 6, windowSeconds: 600, store: 'durable' },
  playbackSession: { limit: 30, windowSeconds: 600, store: 'durable' },
  adminUpload: { limit: 30, windowSeconds: 3_600, store: 'durable' },
  paymentCallback: { limit: 30, windowSeconds: 600, store: 'memory' },
  webhook: { limit: 120, windowSeconds: 60, store: 'memory' },
  progressHeartbeat: { limit: 12, windowSeconds: 60, store: 'memory' },
  answerAutosave: { limit: 40, windowSeconds: 10, store: 'memory' },
  // Generating an attempt writes a hundred-odd snapshot rows, so it is budgeted
  // durably: a retry storm here is expensive in a way an autosave is not.
  examAttemptCreate: { limit: 12, windowSeconds: 3_600, store: 'durable' },
  // Start, advance and submit. Frequent enough during a real attempt that a
  // durable counter would cost more than the abuse it prevents.
  examAttemptAction: { limit: 60, windowSeconds: 600, store: 'memory' },
  examAttemptRead: { limit: 240, windowSeconds: 60, store: 'memory' },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

// ── In-memory store ──────────────────────────────────────────────────────

type MemoryEntry = { windowStart: number; count: number };
const memoryBuckets = new Map<string, MemoryEntry>();
const MEMORY_MAX_KEYS = 10_000;

function checkMemory(key: string, rule: RateLimitRule, now: number): RateLimitResult {
  const windowMs = rule.windowSeconds * 1_000;
  const windowStart = Math.floor(now / windowMs) * windowMs;

  // Bound memory growth. Entries are cheap to lose: the worst case is that a
  // client gets a fresh budget slightly early.
  if (memoryBuckets.size > MEMORY_MAX_KEYS) {
    for (const [existingKey, entry] of memoryBuckets) {
      if (entry.windowStart < windowStart) memoryBuckets.delete(existingKey);
    }
    if (memoryBuckets.size > MEMORY_MAX_KEYS) memoryBuckets.clear();
  }

  const existing = memoryBuckets.get(key);
  const entry =
    existing && existing.windowStart === windowStart ? existing : { windowStart, count: 0 };
  entry.count += 1;
  memoryBuckets.set(key, entry);

  return {
    allowed: entry.count <= rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    resetAt: new Date(windowStart + windowMs),
  };
}

// ── Durable store ────────────────────────────────────────────────────────

async function checkDurable(
  key: string,
  rule: RateLimitRule,
  now: number,
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  // One atomic statement: insert the bucket, or increment it when the stored
  // window is still current, or reset it when the window has rolled over.
  // Doing this as read-then-write would let concurrent requests both observe
  // the old count and each believe they were under the limit.
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStartsAt", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."windowStartsAt" < ${windowStart} THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "windowStartsAt" = GREATEST("rate_limit_buckets"."windowStartsAt", ${windowStart})
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 1;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt: new Date(windowStart.getTime() + windowMs),
  };
}

// ── Public API ───────────────────────────────────────────────────────────

/** Consume one unit of budget and report whether the caller may proceed. */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name] as RateLimitRule;
  const key = `${name}:${identifier}`;
  const now = Date.now();

  if (rule.store === 'memory') return checkMemory(key, rule, now);
  return checkDurable(key, rule, now);
}

/** Consume budget and throw a 429 when it is exhausted. */
export async function enforceRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const result = await checkRateLimit(name, identifier);
  if (!result.allowed) {
    throw new HttpError(429, COPY.errors.rateLimited, 'rate_limited');
  }
}

/**
 * Best-effort client address for rate limiting.
 *
 * Proxy headers are forgeable, so this is a throttling key, never an identity.
 * Anything genuinely security-critical is keyed by authenticated user id.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Test-only: clear in-memory counters between cases. */
export function resetMemoryBucketsForTests(): void {
  memoryBuckets.clear();
}
