import 'server-only';

import { Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie, signSession } from '@/lib/auth/session';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentLegalVersions } from '@/repositories/site-setting-repository';
import type { RegisterInput } from '@/validators/auth';

export type RegisterResult = { userId: string };

/**
 * Create an active student account and sign them in.
 *
 * The product has no verification step: the account works immediately. What
 * cannot be skipped is the record of consent, so the user row and its
 * `ConsentRecord` are written in one transaction. A half-finished registration
 * that produced an account with no record of what was agreed to would be
 * exactly the gap a privacy review later cannot close.
 */
export async function registerStudent(
  input: RegisterInput,
  context: { requestId?: string } = {},
): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const legal = await getCurrentLegalVersions(tx);

      const created = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          passwordHash,
          role: 'STUDENT',
          sessionVersion: 1,
        },
        select: { id: true, role: true, sessionVersion: true },
      });

      await tx.consentRecord.create({
        data: {
          userId: created.id,
          termsVersion: legal.termsVersion,
          privacyVersion: legal.privacyVersion,
          acceptedAt: new Date(),
        },
      });

      return created;
    });

    const token = await signSession({
      sub: user.id,
      role: user.role,
      sv: user.sessionVersion,
    });
    await setSessionCookie(token);

    logger.info('student registered', { userId: user.id, requestId: context.requestId });
    return { userId: user.id };
  } catch (error) {
    // A duplicate address must not reveal that the address is already in use:
    // that would let anyone test which addresses have accounts here.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('registration rejected: duplicate email', { requestId: context.requestId });
      throw new HttpError(409, COPY.auth.registerFailed, 'registration_failed');
    }
    throw error;
  }
}
