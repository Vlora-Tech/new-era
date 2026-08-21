import { apiSuccess, routeHandler } from '@/lib/api';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { createContactMessage } from '@/services/contact-message.service';
import { contactMessageSchema } from '@/validators/contact';

export const runtime = 'nodejs';

export const POST = routeHandler('POST /api/contact', async (request) => {
  assertSameOrigin(request);
  await enforceRateLimit('contactMessage', clientIdentifier(request));

  const input = contactMessageSchema.parse(await request.json());

  // A filled honeypot is answered as success so a bot learns nothing about the
  // filter, but no message is stored.
  if (input.website) return apiSuccess({ received: true });

  await createContactMessage(input);
  return apiSuccess({ received: true }, { status: 201 });
});
