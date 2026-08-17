import '@testing-library/jest-dom/vitest';

import { config } from 'dotenv';

/**
 * Test environment bootstrap.
 *
 * Integration tests talk to the `new_era_test` database, never to the
 * development one, so a suite that truncates tables cannot destroy local work.
 */
config({ path: '.env', quiet: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// `NODE_ENV` is typed as read-only, but the suite genuinely needs to set it
// before any module reads the validated environment.
const mutableEnv = process.env as Record<string, string | undefined>;

mutableEnv.NODE_ENV ??= 'test';
mutableEnv.SESSION_SECRET ??= 'test-session-secret-that-is-long-enough-x';

/*
 * Pinned with `=`, not `??=`, and that distinction is the whole point.
 *
 * `assertSameOrigin` compares a request's `Origin` against this value, and the
 * integration suites declare a fixed `ORIGIN` constant to send. With `??=` the
 * developer's own `.env` won — so moving the dev server to another port silently
 * turned every cookie-authenticated mutation in the suite into a 403
 * `cross_origin`, in tests that have nothing to do with which port anyone runs
 * locally. The suite has to be hermetic about its own origin.
 */
mutableEnv.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
