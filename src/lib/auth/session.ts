import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { AUTH } from '@/lib/constants';
import { env, isSecureOrigin } from '@/lib/env';

/**
 * Signed session token.
 *
 * The payload carries only what an authorization decision needs: subject, role
 * and session version. Name and email are deliberately absent — every protected
 * request loads the user row anyway, so putting profile data in the cookie would
 * only create a second, stale copy.
 *
 * `sv` is compared against the user's current `sessionVersion` on each request.
 * Blocking a user or forcing a sign-out increments that column, which retires
 * every outstanding token immediately instead of waiting for natural expiry.
 */
export type SessionPayload = {
  sub: string;
  role: 'STUDENT' | 'ADMIN';
  sv: number;
};

const ALGORITHM = 'HS256';

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const ttl = env().SESSION_TTL_SECONDS;
  return new SignJWT({ role: payload.role, sv: payload.sv })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());
}

/**
 * Verify a token and validate the shape of every claim.
 *
 * Returns null rather than throwing: a bad cookie is an ordinary condition
 * (expired, tampered, signed by a rotated secret) and callers treat all of those
 * the same way — as "not signed in".
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      // Pinning the algorithm prevents a token from selecting a weaker one.
      algorithms: [ALGORITHM],
    });

    const sub = payload.sub;
    const role = payload.role;
    const sv = payload.sv;

    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (role !== 'STUDENT' && role !== 'ADMIN') return null;
    if (typeof sv !== 'number' || !Number.isInteger(sv)) return null;

    return { sub, role, sv };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: 'lax',
    path: '/',
    maxAge: env().SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH.COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(AUTH.COOKIE_NAME)?.value;
}
