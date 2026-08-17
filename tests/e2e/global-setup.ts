import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ quiet: true });

/**
 * Prepare the environment for an end-to-end run.
 *
 * The suite registers several accounts from one address, which is exactly the
 * pattern the registration limit exists to stop. Rather than loosening that
 * limit — the production budget should be tested as configured, not weakened to
 * suit a test — the counters are cleared before the run.
 *
 * Only the rate-limit table is touched. Nothing else in the database is reset,
 * so the seeded catalogue the tests read stays as it is.
 */
export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const deleted = await prisma.rateLimitBucket.deleteMany({});
    if (deleted.count > 0) {
      console.log(`[e2e] cleared ${deleted.count} rate-limit buckets`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
