import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { AUTH, PROTECTED_PREFIXES } from '@/lib/constants';
import { buildContentSecurityPolicy, staticSecurityHeaders } from '@/lib/security/csp';

/**
 * Request preamble: security headers for everything, and an optimistic session
 * check for the protected areas.
 *
 * In Next.js 16 this file replaces the deprecated `middleware` convention.
 *
 * The session check here verifies a signature and nothing more. It never touches
 * the database: it runs on every matched request including prefetches, and it
 * cannot see whether an account was blocked a minute ago, because that lives in
 * the database.
 *
 * Real authorization happens in `src/lib/auth/guards.ts`, which every protected
 * layout, route handler and server action calls. This file only saves a
 * signed-out visitor from loading a page that would immediately redirect them.
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

function applySecurityHeaders(response: NextResponse, csp: string, isSecureOrigin: boolean): void {
  response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of staticSecurityHeaders(isSecureOrigin)) {
    response.headers.set(name, value);
  }
}

export async function proxy(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  /*
   * Whether the site is genuinely served over TLS — the scheme of the origin
   * the browser actually uses, which is not the same question as NODE_ENV.
   *
   * A staging deployment runs with NODE_ENV=production (it must, or the payment
   * and storage gates would not apply) while being served over plain HTTP,
   * because no public certificate exists for a bare IP address. Sending
   * `upgrade-insecure-requests` there rewrites every subresource to https://,
   * where nothing is listening, and the page renders as unstyled HTML.
   *
   * Read straight from the environment, like the session secret above: this
   * file deliberately avoids importing shared application modules.
   */
  const isSecureOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');

  // A fresh nonce per request; a reused one would defeat the point of having it.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildContentSecurityPolicy({ nonce, isDevelopment, isSecureOrigin });

  const { pathname } = request.nextUrl;

  if (isProtected(pathname)) {
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
      const redirect = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirect, csp, isSecureOrigin);
      return redirect;
    }

    if (role !== 'ADMIN' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
      const redirect = NextResponse.redirect(new URL('/dashboard', request.url));
      applySecurityHeaders(redirect, csp, isSecureOrigin);
      return redirect;
    }
  }

  // The nonce travels to the render on a request header so components can mark
  // their own inline scripts as trusted.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response, csp, isSecureOrigin);
  return response;
}

export const config = {
  /*
   * Everything except static assets, so security headers reach real documents.
   * Files under `_next/static`, the image optimiser and `public/brand` are
   * served straight from disk or cache; they gain nothing from a policy and
   * would pay for a nonce on every request.
   *
   * Prefetches are deliberately *not* excluded. Skipping them would mean a
   * protected route behaved differently depending on how it was reached, and
   * uniform behaviour is worth more here than the cost of a nonce.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
