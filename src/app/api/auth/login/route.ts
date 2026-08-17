import { apiSuccess, routeHandler } from '@/lib/api';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { safeRedirectOrDefault } from '@/lib/safe-redirect';
import { loginUser } from '@/services/auth/login';
import { loginSchema } from '@/validators/auth';

export const runtime = 'nodejs';

export const POST = routeHandler('POST /api/auth/login', async (request) => {
  assertSameOrigin(request);

  const body = await request.json();
  const input = loginSchema.parse(body);

  // Two budgets: one stops a single address being sprayed with guesses, the
  // other stops one source spreading guesses across many addresses.
  await enforceRateLimit('login', clientIdentifier(request));
  await enforceRateLimit('loginPerEmail', input.email);

  const { role } = await loginUser(input);

  const fallback = role === 'ADMIN' ? '/admin' : '/dashboard';
  return apiSuccess({ redirectTo: safeRedirectOrDefault(input.next, fallback) });
});
