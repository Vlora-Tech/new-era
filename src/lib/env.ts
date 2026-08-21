import 'server-only';

import { z } from 'zod';

/**
 * Validated server configuration.
 *
 * Parsed lazily on first access and cached. A malformed environment therefore
 * fails at the first server-side use with a precise message, rather than
 * surfacing later as a confusing runtime error.
 *
 * This module is server-only. `proxy.ts` deliberately does not import it: the
 * proxy is meant to run without depending on shared application modules, so it
 * reads the one variable it needs directly with its own guard.
 */
const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    TEST_DATABASE_URL: z.string().min(1).optional(),

    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),

    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    ADMIN_NAME: z.string().optional(),

    PAYMENT_PROVIDER: z.enum(['mock', 'moyasar']).default('mock'),
    MOYASAR_API_BASE_URL: z.url().default('https://api.moyasar.com'),
    MOYASAR_MODE: z.enum(['test', 'live']).default('test'),
    NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY: z.string().optional(),
    MOYASAR_SECRET_KEY: z.string().optional(),
    MOYASAR_WEBHOOK_SECRET_TOKEN: z.string().optional(),

    BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
    BUNNY_STREAM_TOKEN_SECURITY_KEY: z.string().optional(),
    BUNNY_STREAM_API_KEY: z.string().optional(),
    BUNNY_STREAM_READONLY_API_KEY: z.string().optional(),
    PLAYBACK_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_700),

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.storage'),

    /*
     * S3, required only when it is the selected provider.
     *
     * There is deliberately no access-key setting. The client uses the default
     * AWS provider chain, which resolves to the container's IAM role — a
     * short-lived, rotated credential. Adding a key here would invite pasting a
     * long-lived one into an environment variable, which is precisely what the
     * role exists to avoid.
     */
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).optional(),
    /* A CDN origin in front of the bucket, e.g. `https://cdn.example.com`. When
       absent, public objects stream through the application's own route instead,
       so S3 is usable before CloudFront exists. */
    S3_PUBLIC_BASE_URL: z.url().optional(),

    INTERNAL_JOBS_SECRET: z.string().min(32).optional(),
    ENABLE_EMBEDDED_SCHEDULER: booleanish.default(false),
  })
  .superRefine((env, ctx) => {
    const isProduction = env.NODE_ENV === 'production';

    // The development payment mock must be unreachable in production. This is
    // the first of three independent gates; the provider factory and the mock
    // route itself each refuse as well.
    if (isProduction && env.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'The mock payment provider cannot be used in production.',
      });
    }

    if (env.PAYMENT_PROVIDER === 'moyasar') {
      if (!env.MOYASAR_SECRET_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['MOYASAR_SECRET_KEY'],
          message: 'MOYASAR_SECRET_KEY is required when PAYMENT_PROVIDER is "moyasar".',
        });
      }
      if (!env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY'],
          message: 'A publishable key is required when PAYMENT_PROVIDER is "moyasar".',
        });
      }

      // Mixing a live key into test mode (or the reverse) would charge real
      // cards against test bookkeeping, so the pairing is checked explicitly.
      const expectedPrefix = env.MOYASAR_MODE === 'live' ? '_live_' : '_test_';
      if (env.MOYASAR_SECRET_KEY && !env.MOYASAR_SECRET_KEY.includes(expectedPrefix)) {
        ctx.addIssue({
          code: 'custom',
          path: ['MOYASAR_SECRET_KEY'],
          message: `MOYASAR_MODE is "${env.MOYASAR_MODE}" but the secret key is not a ${env.MOYASAR_MODE} key.`,
        });
      }
      if (
        env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY &&
        !env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY.includes(expectedPrefix)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY'],
          message: `MOYASAR_MODE is "${env.MOYASAR_MODE}" but the publishable key is not a ${env.MOYASAR_MODE} key.`,
        });
      }
    }

    // Local disk is not durable on the hosting this product targets. Rather than
    // silently losing uploads, production refuses to start with it configured.
    if (isProduction && env.STORAGE_PROVIDER === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_PROVIDER'],
        message: 'Local filesystem storage is not production-safe. Configure an approved provider.',
      });
    }

    /*
     * Selecting S3 without telling it where is a misconfiguration that would
     * otherwise surface as a failed upload long after deploy, so it is refused
     * at startup in every environment rather than only in production.
     */
    if (env.STORAGE_PROVIDER === 's3') {
      if (!env.S3_BUCKET) {
        ctx.addIssue({
          code: 'custom',
          path: ['S3_BUCKET'],
          message: 'S3_BUCKET is required when STORAGE_PROVIDER is "s3".',
        });
      }
      if (!env.S3_REGION) {
        ctx.addIssue({
          code: 'custom',
          path: ['S3_REGION'],
          message: 'S3_REGION is required when STORAGE_PROVIDER is "s3".',
        });
      }
    }

    if (isProduction && !env.INTERNAL_JOBS_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['INTERNAL_JOBS_SECRET'],
        message: 'INTERNAL_JOBS_SECRET is required in production to authenticate job triggers.',
      });
    }
  });

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // The message names variables, never values.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test-only escape hatch so a suite can re-parse after mutating process.env. */
export function resetEnvCacheForTests(): void {
  cached = null;
}

/** Whether purchases can actually complete with the current configuration. */
export function isCommerceEnabled(): boolean {
  const config = env();
  if (config.PAYMENT_PROVIDER === 'mock') return config.NODE_ENV !== 'production';
  return Boolean(config.MOYASAR_SECRET_KEY && config.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY);
}

/** Whether protected video playback can be signed with the current configuration. */
export function isVideoEnabled(): boolean {
  const config = env();
  return Boolean(config.BUNNY_STREAM_LIBRARY_ID && config.BUNNY_STREAM_TOKEN_SECURITY_KEY);
}

/** Whether administrators can upload media with the current configuration. */
export function isUploadEnabled(): boolean {
  const config = env();
  return config.STORAGE_PROVIDER !== 'local' || config.NODE_ENV !== 'production';
}
