import { spawnSync } from 'node:child_process';

import { config } from 'dotenv';

config({ quiet: true });

/**
 * Reset the test database.
 *
 * The guard below is the point of this script. `prisma migrate reset` drops
 * everything it is pointed at, and the only thing standing between "reset the
 * test database" and "delete a day of local work" is which URL happens to be in
 * `DATABASE_URL` at the time. So the target is taken from `TEST_DATABASE_URL`
 * and the script refuses to run unless that URL actually names the test
 * database.
 */
const TEST_DATABASE_NAME = 'new_era_test';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set. Refusing to reset anything.');
  process.exit(1);
}

if (!testUrl.includes(TEST_DATABASE_NAME)) {
  console.error(
    `TEST_DATABASE_URL does not name "${TEST_DATABASE_NAME}".\n` +
      'Refusing to run: this command drops every table in the database it targets.',
  );
  process.exit(1);
}

console.log(`Resetting ${TEST_DATABASE_NAME}…`);

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'reset', '--force', '--skip-seed'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  },
);

process.exit(result.status ?? 1);
