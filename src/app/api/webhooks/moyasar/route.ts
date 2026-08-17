import { Prisma, type WebhookStatus } from '@prisma/client';
import { z } from 'zod';

import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { constantTimeEquals, sha256Hex } from '@/lib/security/constant-time';
import { clientIdentifier, enforceRateLimit } from '@/lib/security/rate-limit';
import { reconcilePayment } from '@/services/payments/reconcile.service';

export const runtime = 'nodejs';

/**
 * Moyasar webhook inbox.
 *
 * This endpoint is deliberately **exempt from `assertSameOrigin`**. The caller is
 * a machine that sends no `Origin` header, and the request is authenticated by a
 * shared secret in the envelope rather than by a session cookie — so there is no
 * ambient authority for a cross-site request to borrow, and nothing for an
 * origin check to protect.
 *
 * The event is written to the database *before* anything is done with it. Only
 * after that row is committed does processing start, and processing happens
 * inside this request rather than after the response. A failure therefore leaves
 * a `PENDING` row that the sweep or a gateway retry can pick up: the event is
 * never both acknowledged and lost.
 *
 * As everywhere else, the payload's own `status` field decides nothing. The
 * handler takes `data.id` and asks the gateway what that payment really is.
 */
const PROVIDER = 'MOYASAR' as const;
const RETRY_DELAY_MS = 60_000;

/**
 * Event types this platform acts on.
 *
 * `payment_faild` is not a typo here — it is the spelling Moyasar has sent for
 * failed payments, and both forms are accepted so a failure notice cannot be
 * silently dropped by a rename at either end.
 */
const ACTIONABLE_EVENT_TYPES = new Set([
  'payment_paid',
  'payment_failed',
  'payment_faild',
  'payment_refunded',
  'payment_captured',
  'payment_authorized',
  'payment_voided',
  'payment_verified',
  'payment_abandoned',
]);

/**
 * The envelope, parsed loosely on purpose: a gateway may add fields, and a
 * webhook that 400s because of an unknown key is a webhook that loses events.
 */
const envelopeSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(200),
  created_at: z.string().max(100).optional(),
  secret_token: z.string().optional(),
  live: z.boolean().optional(),
  data: z
    .object({
      id: z.string().min(1).max(200).optional(),
      status: z.string().max(100).optional(),
      amount: z.number().int().optional(),
      currency: z.string().max(10).optional(),
      refunded: z.number().int().optional(),
      metadata: z.record(z.string(), z.unknown()).nullish(),
    })
    .loose(),
});

type Envelope = z.infer<typeof envelopeSchema>;

/**
 * Reduce the envelope to what may be stored.
 *
 * The shared secret is removed, and so is everything the platform does not act
 * on — `source` above all, which carries the cardholder's name and a masked
 * card. Keeping "just in case" fields is how card-adjacent data ends up in a
 * database that was never scoped to hold it.
 */
function minimisePayload(envelope: Envelope): Record<string, unknown> {
  return {
    type: envelope.type,
    live: envelope.live ?? null,
    createdAt: envelope.created_at ?? null,
    data: {
      id: envelope.data.id ?? null,
      status: envelope.data.status ?? null,
      amount: envelope.data.amount ?? null,
      currency: envelope.data.currency ?? null,
      refunded: envelope.data.refunded ?? null,
      metadata: envelope.data.metadata ?? null,
    },
  };
}

/**
 * A stable event identity.
 *
 * Moyasar supplies an event id; the digest is the fallback for a delivery that
 * does not, so deduplication does not quietly stop working if one ever arrives
 * without one. The digest covers the payment, its reported state and the event
 * time, which is what distinguishes two genuine events from one retry.
 */
function eventIdentity(envelope: Envelope, payload: Record<string, unknown>): string {
  if (envelope.id) return envelope.id;
  return `digest_${sha256Hex(JSON.stringify(payload))}`;
}

/** Verify the shared secret without leaking its length or content through timing. */
function assertWebhookSecret(candidate: string | undefined): void {
  const expected = env().MOYASAR_WEBHOOK_SECRET_TOKEN;
  if (!expected) {
    logger.error('webhook rejected: MOYASAR_WEBHOOK_SECRET_TOKEN is not configured');
    throw new HttpError(401, COPY.errors.unauthorized, 'unauthorized');
  }
  if (!candidate || !constantTimeEquals(candidate, expected)) {
    logger.warn('webhook rejected: secret token mismatch');
    throw new HttpError(401, COPY.errors.unauthorized, 'unauthorized');
  }
}

export const POST = routeHandler('POST /api/webhooks/moyasar', async (request) => {
  await enforceRateLimit('webhook', clientIdentifier(request));

  let envelope: Envelope;
  try {
    envelope = envelopeSchema.parse(JSON.parse(await request.text()));
  } catch {
    // The body is never logged, only the fact that it did not parse.
    logger.warn('webhook rejected: body was not a recognisable event');
    throw new HttpError(400, COPY.errors.validation, 'invalid_payload');
  }

  assertWebhookSecret(envelope.secret_token);

  const payload = minimisePayload(envelope);
  const providerEventId = eventIdentity(envelope, payload);
  const liveMode = envelope.live ?? null;

  // A live event reaching a test deployment (or the reverse) is recorded and
  // ignored. Acting on it would fulfil an order against the wrong ledger.
  const modeMatches = liveMode === null || liveMode === (env().MOYASAR_MODE === 'live');
  const actionable = ACTIONABLE_EVENT_TYPES.has(envelope.type) && Boolean(envelope.data.id);
  const initialStatus: WebhookStatus = modeMatches && actionable ? 'PENDING' : 'IGNORED';

  let eventId: string;
  let status: WebhookStatus;

  try {
    const created = await prisma.webhookEvent.create({
      data: {
        provider: PROVIDER,
        providerEventId,
        eventType: envelope.type,
        liveMode,
        payload: payload as Prisma.InputJsonValue,
        status: initialStatus,
        ...(initialStatus === 'IGNORED' ? { processedAt: new Date() } : {}),
      },
      select: { id: true, status: true },
    });
    eventId = created.id;
    status = created.status;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
      throw error;

    // Already received. The row is not rewritten — but if the earlier delivery
    // never finished processing, this retry is allowed to finish it.
    const existing = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: PROVIDER, providerEventId } },
      select: { id: true, status: true },
    });
    if (existing.status !== 'PENDING' && existing.status !== 'FAILED') {
      logger.info('webhook duplicate ignored', { providerEventId, status: existing.status });
      return apiSuccess({ status: 'DUPLICATE' });
    }
    eventId = existing.id;
    status = existing.status;
  }

  if (status === 'IGNORED') {
    logger.info('webhook stored without action', {
      providerEventId,
      eventType: envelope.type,
      reason: modeMatches ? 'unhandled_type' : 'mode_mismatch',
    });
    return apiSuccess({ status: 'IGNORED' });
  }

  // Claim the row so two concurrent deliveries of the same event cannot both
  // reconcile it. Losing the claim is not an error: the winner is doing the work.
  const claimed = await prisma.webhookEvent.updateMany({
    where: { id: eventId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'PROCESSING', claimedAt: new Date(), attemptCount: { increment: 1 } },
  });
  if (claimed.count === 0) return apiSuccess({ status: 'DUPLICATE' });

  try {
    const outcome = await reconcilePayment({
      // The gateway's id, re-verified against the gateway. The payload's own
      // status never reaches this call.
      paymentId: envelope.data.id as string,
      source: 'webhook',
    });

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
    });

    logger.info('webhook processed', {
      providerEventId,
      eventType: envelope.type,
      outcome: outcome.outcome,
      orderId: outcome.orderId,
    });

    return apiSuccess({ status: 'PROCESSED', outcome: outcome.outcome });
  } catch (error) {
    // Returned to PENDING rather than FAILED: the event is still owed
    // processing, and a retry — from the gateway or from the sweep — must find
    // it waiting. The stored error is a short message, never a payload.
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'PENDING',
        claimedAt: null,
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        lastError: (error instanceof Error ? error.message : 'unknown error').slice(0, 500),
      },
    });

    logger.error('webhook processing failed; event left pending for retry', {
      providerEventId,
      eventType: envelope.type,
      error,
    });

    // A 5xx tells the gateway to deliver it again.
    return apiFailure(500, 'webhook_processing_failed', COPY.common.unexpectedError);
  }
});
