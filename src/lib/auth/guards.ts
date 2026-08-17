import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { COPY } from '@/lib/copy';
import { readSessionCookie, verifySession } from '@/lib/auth/session';
import { safeInternalPath } from '@/lib/safe-redirect';

/**
 * Data access layer for authentication.
 *
 * `proxy.ts` performs an optimistic cookie check to keep obviously signed-out
 * traffic away from protected routes, but it cannot see whether an account was
 * blocked a minute ago. Authorization therefore happens here, against the
 * database, on every protected request.
 *
 * `getCurrentUser` is wrapped in React's `cache`, so a page that checks the
 * session in a layout, a page and a component performs one query per render
 * rather than three.
 */
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADMIN';
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionCookie();
  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      sessionVersion: true,
    },
  });

  if (!user) return null;
  // A blocked account stops working on its next request, not when its token expires.
  if (user.isBlocked) return null;
  // A retired session version means the account was blocked, signed out
  // everywhere, or had its password changed after this token was issued.
  if (session.sv !== user.sessionVersion) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/** Error carrying the HTTP status a route handler should respond with. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

// ── Route handler guards: throw, and the handler maps the status ──

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, COPY.errors.unauthorized, 'unauthorized');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') throw new HttpError(403, COPY.errors.forbidden, 'forbidden');
  return user;
}

export async function requireStudent(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== 'STUDENT') throw new HttpError(403, COPY.errors.forbidden, 'forbidden');
  return user;
}

// ── Page and layout guards: redirect, because a page cannot show a status ──

export async function requireUserPage(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = safeInternalPath(nextPath);
    redirect(target ? `/login?next=${encodeURIComponent(target)}` : '/login');
  }
  return user;
}

export async function requireAdminPage(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = safeInternalPath(nextPath);
    redirect(target ? `/login?next=${encodeURIComponent(target)}` : '/login');
  }
  // A signed-in student who reaches an admin URL is redirected rather than shown
  // a 403 page, since the destination exists but is not theirs.
  if (user.role !== 'ADMIN') redirect('/dashboard');
  return user;
}
