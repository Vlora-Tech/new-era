import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { spendDummyComparison, verifyPassword } from '@/lib/auth/password';
import { clearSessionCookie, setSessionCookie, signSession } from '@/lib/auth/session';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { LoginInput } from '@/validators/auth';

export type LoginResult = { userId: string; role: 'STUDENT' | 'ADMIN' };

/**
 * Verify credentials and establish a session.
 *
 * Signing in deliberately does not change `sessionVersion`. Bumping it here
 * would sign the account out of every other device on each login, which is
 * single-session enforcement — a behaviour the product has not asked for.
 * The column exists to revoke sessions on demand, not as a side effect.
 */
export async function loginUser(
  input: LoginInput,
  context: { requestId?: string } = {},
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      isBlocked: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    // Spend comparable time so that an unknown address does not answer
    // measurably faster than a wrong password.
    await spendDummyComparison(input.password);
    throw new HttpError(401, COPY.auth.invalidCredentials, 'invalid_credentials');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, COPY.auth.invalidCredentials, 'invalid_credentials');
  }

  // Checked after the password so a blocked account is not disclosed to someone
  // who does not already know the credentials.
  if (user.isBlocked) {
    logger.warn('blocked account attempted sign-in', {
      userId: user.id,
      requestId: context.requestId,
    });
    throw new HttpError(403, COPY.auth.accountBlocked, 'account_blocked');
  }

  const token = await signSession({
    sub: user.id,
    role: user.role,
    sv: user.sessionVersion,
  });
  await setSessionCookie(token);

  logger.info('user signed in', { userId: user.id, requestId: context.requestId });
  return { userId: user.id, role: user.role };
}

export async function logoutUser(): Promise<void> {
  await clearSessionCookie();
}
