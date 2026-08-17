import { spawnSync } from 'node:child_process';

import { config } from 'dotenv';

config({ quiet: true });

/**
 * Reset the test database.
 *
 * The guard below is the point of this script. `prisma migrate reset` drops
 * everything it is pointed at, and the only thing between "reset the test
 * database" and "delete a day of local work" is which URL happens to be in
 * `DATABASE_URL`. So the target is read from `TEST_DATABASE_URL` and the script
 * refuses unless that URL actually names the test database.
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

const result = spawnSync('npx prisma migrate reset --force --skip-seed', {
  stdio: 'inherit',
  // Windows resolves `npx` to `npx.cmd`, which is a batch file rather than an
  // executable. Without a shell the spawn fails, and — because a failed spawn
  // reports no exit status — the failure can read as success.
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl },
});

if (result.error) {
  console.error('Failed to run Prisma:', result.error.message);
  process.exit(1);
}

// A null status means the process was terminated by a signal or never started.
// Treating that as success is exactly how a reset silently does nothing.
if (result.status === null) {
  console.error('Prisma did not run to completion; the database was not reset.');
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Prisma exited with status ${result.status}; the database was not reset.`);
  process.exit(result.status);
}

console.log(`${TEST_DATABASE_NAME} reset.`);
