import 'server-only';

import { z } from 'zod';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Moyasar HTTP client.
 *
 * The single place this application talks to the payment gateway, and therefore
 * the single seam the test suite replaces. Three rules hold here:
 *
 *  - The secret key is used for Basic authentication and never leaves this
 *    module. It is not logged, not returned, and not placed in an error.
 *  - No provider payload is ever logged. A payment response contains a masked
 *    card, a cardholder name and a gateway reference; none of it belongs in a
 *    log line, and "masked" is not the same as "safe to store".
 *  - Every request is bounded by a timeout. A gateway that stops answering must
 *    fail a reconcile quickly, not hold a database transaction open.
 *
 * Only the fields the platform actually uses are parsed out of the response.
 * Everything else — `source`, `ip`, `invoice_id` — is discarded here, so it
 * cannot reach a database column or a log by accident further up.
 */
const REQUEST_TIMEOUT_MS = 12_000;

/** A Moyasar request that did not produce a usable answer. */
export class MoyasarRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MoyasarRequestError';
    this.status = status;
  }
}

/**
 * The subset of a Moyasar payment this platform relies on.
 *
 * `amount` and `refunded` are integer minor units — halalas for SAR — which is
 * the same unit the database stores, so no conversion happens anywhere.
 */
const moyasarPaymentSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.string().min(1),
  refunded: z.number().int().nonnegative().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  // Kept only to record why a payment failed. Never stored verbatim beyond a
  // short failure message, and never shown to a customer.
  source: z
    .object({
      type: z.string().nullish(),
      message: z.string().nullish(),
    })
    .loose()
    .nullish(),
});

export type MoyasarPayment = z.infer<typeof moyasarPaymentSchema>;

function authorizationHeader(): string {
  const secret = env().MOYASAR_SECRET_KEY;
  if (!secret) {
    // Names the variable, never a value.
    throw new MoyasarRequestError(500, 'MOYASAR_SECRET_KEY is not configured.');
  }
  // Moyasar uses HTTP Basic with the secret key as the username and no password.
  return `Basic ${Buffer.from(`${secret}:`, 'utf8').toString('base64')}`;
}

async function moyasarRequest(
  path: string,
  init: { method: 'GET' | 'POST'; body?: URLSearchParams },
): Promise<{ status: number; json: unknown }> {
  const url = new URL(path, env().MOYASAR_API_BASE_URL).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: authorizationHeader(),
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: init.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // A payment lookup is never a cacheable read.
      cache: 'no-store',
    });
  } catch (error) {
    // Network failure or timeout. The path is safe to log; nothing else is.
    logger.error('moyasar request failed', { path, error });
    throw new MoyasarRequestError(504, 'The payment gateway did not respond.');
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, json };
}

/**
 * Fetch the gateway's canonical record of a payment.
 * Returns null when the gateway does not know the id.
 */
export async function fetchMoyasarPayment(paymentId: string): Promise<MoyasarPayment | null> {
  const { status, json } = await moyasarRequest(`/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
  });

  if (status === 404) return null;
  if (status < 200 || status >= 300) {
    logger.warn('moyasar payment fetch rejected', { paymentId, status });
    throw new MoyasarRequestError(status, 'The payment gateway rejected the lookup.');
  }

  const parsed = moyasarPaymentSchema.safeParse(json);
  if (!parsed.success) {
    // The response is deliberately not logged, only the fact it did not parse.
    logger.error('moyasar payment response did not match the expected shape', { paymentId });
    throw new MoyasarRequestError(502, 'The payment gateway returned an unexpected response.');
  }

  return parsed.data;
}

/** Refund a payment, in full when `amountHalalas` is omitted. */
export async function refundMoyasarPayment(
  paymentId: string,
  amountHalalas?: number,
): Promise<MoyasarPayment> {
  const body = new URLSearchParams();
  if (typeof amountHalalas === 'number') body.set('amount', String(Math.trunc(amountHalalas)));

  const { status, json } = await moyasarRequest(
    `/v1/payments/${encodeURIComponent(paymentId)}/refund`,
    { method: 'POST', body },
  );

  if (status < 200 || status >= 300) {
    logger.warn('moyasar refund rejected', { paymentId, status });
    throw new MoyasarRequestError(status, 'The payment gateway rejected the refund.');
  }

  const parsed = moyasarPaymentSchema.safeParse(json);
  if (!parsed.success) {
    logger.error('moyasar refund response did not match the expected shape', { paymentId });
    throw new MoyasarRequestError(502, 'The payment gateway returned an unexpected response.');
  }

  return parsed.data;
}
