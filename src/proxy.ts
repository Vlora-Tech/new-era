import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { AUTH, PROTECTED_PREFIXES } from '@/lib/constants';

/**
 * Optimistic routing guard.
 *
 * In Next.js 16 this file replaces the deprecated `middleware` convention.
 *
 * It performs a signature check only, and deliberately never touches the
 * database: this runs on every matched request, including prefetches, so a
 * query here would multiply load for no security benefit. It cannot tell
 * whether an account was blocked, because that lives in the database.
 *
 * Real authorization therefore happens in `src/lib/auth/guards.ts`, which every
 * protected layout, route handler and server action calls. This file only saves
 * a signed-out visitor from loading a page that would immediately redirect them.
 * Treat it as a routing optimisation, never as the access control itself.
 */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Read the signing secret directly: the proxy avoids shared app modules. */
function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < AUTH.MIN_SECRET_LENGTH) return null;
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH.COOKIE_NAME)?.value;
  const key = secretKey();

  let role: string | null = null;
  if (token && key) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      role = typeof payload.role === 'string' ? payload.role : null;
    } catch {
      role = null;
    }
  }

  if (!role) {
    const loginUrl = new URL('/login', request.url);
    // `pathname` comes from the router, not from user input, so it is a safe
    // internal target by construction. The login page validates it again.
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (role !== 'ADMIN' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/learn/:path*', '/exam/:path*'],
};
