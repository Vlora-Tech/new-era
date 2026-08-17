import { apiSuccess, routeHandler } from '@/lib/api';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { safeRedirectOrDefault } from '@/lib/safe-redirect';
import { registerStudent } from '@/services/auth/register';
import { registerSchema } from '@/validators/auth';

export const runtime = 'nodejs';

export const POST = routeHandler('POST /api/auth/register', async (request) => {
  assertSameOrigin(request);
  await enforceRateLimit('register', clientIdentifier(request));

  const body = await request.json();
  const input = registerSchema.parse(body);

  const { userId } = await registerStudent(input);

  return apiSuccess({
    userId,
    redirectTo: safeRedirectOrDefault(input.next, '/dashboard'),
  });
});
