import { apiSuccess, routeHandler } from '@/lib/api';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { logoutUser } from '@/services/auth/login';

export const runtime = 'nodejs';

export const POST = routeHandler('POST /api/auth/logout', async (request) => {
  assertSameOrigin(request);
  await logoutUser();
  return apiSuccess({ redirectTo: '/' });
});
