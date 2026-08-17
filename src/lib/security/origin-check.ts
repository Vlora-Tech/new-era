import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { env } from '@/lib/env';

/**
 * Same-origin enforcement for cookie-authenticated mutations.
 *
 * The session cookie is `SameSite=Lax`, which already blocks most cross-site
 * requests. It is not sufficient on its own: `multipart/form-data` and
 * `application/x-www-form-urlencoded` POSTs are not preflighted, so a form on
 * another site can still reach a handler. Checking `Origin` closes that gap.
 *
 * Endpoints that authenticate by shared secret rather than by cookie — the
 * payment webhook and the internal job triggers — are exempt by design: they are
 * called by machines that send no Origin, and a stolen cookie buys nothing there.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const expected = new URL(env().NEXT_PUBLIC_APP_URL).origin;
  const origin = request.headers.get('origin');

  if (origin) {
    if (origin !== expected) {
      throw new HttpError(403, COPY.errors.forbidden, 'cross_origin');
    }
    return;
  }

  // No Origin header: accept only when the browser states the request is
  // same-origin. Anything else is refused rather than assumed safe.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin' || fetchSite === 'none') return;

  throw new HttpError(403, COPY.errors.forbidden, 'missing_origin');
}
