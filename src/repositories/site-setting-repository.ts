import 'server-only';

import { LEGAL_VERSION_KEYS } from '@/lib/constants';
import { prisma, type PrismaTransaction } from '@/lib/db';

/** Defaults used when the settings table has not been seeded yet. */
const FALLBACK_LEGAL_VERSION = '0000-00-00.0';

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row ? (row.value as T) : null;
}

export async function getSettings(keys: string[]): Promise<Map<string, unknown>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

/**
 * The legal document versions currently in force.
 *
 * Recorded against every consent so that, later, it is possible to say exactly
 * which text a given person agreed to rather than only that they ticked a box.
 */
export async function getCurrentLegalVersions(
  client: PrismaTransaction = prisma,
): Promise<{ termsVersion: string; privacyVersion: string }> {
  const rows = await client.siteSetting.findMany({
    where: { key: { in: [LEGAL_VERSION_KEYS.terms, LEGAL_VERSION_KEYS.privacy] } },
  });

  const lookup = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: string): string => {
    const value = lookup.get(key);
    return typeof value === 'string' && value.length > 0 ? value : FALLBACK_LEGAL_VERSION;
  };

  return {
    termsVersion: read(LEGAL_VERSION_KEYS.terms),
    privacyVersion: read(LEGAL_VERSION_KEYS.privacy),
  };
}

export async function setSetting(key: string, value: unknown, updatedById?: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedById },
    update: { value: value as never, updatedById },
  });
}
