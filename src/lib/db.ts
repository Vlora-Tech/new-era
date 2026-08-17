import 'server-only';

import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * Next.js reloads modules on every edit in development, which would otherwise
 * open a new connection pool per reload until PostgreSQL refuses connections.
 * Caching on `globalThis` survives module reloading; production creates exactly
 * one instance per process and skips the global entirely.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Transaction client type, for services that accept either `prisma` or a tx. */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
