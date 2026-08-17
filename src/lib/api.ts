import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { logger, newRequestId } from '@/lib/logger';

/**
 * One response envelope for every route handler.
 *
 * Success: `{ ok: true, data }`. Failure: `{ ok: false, error: { code, message } }`
 * where `message` is Arabic and safe to display.
 *
 * Provider and database errors never reach the client verbatim. An unexpected
 * failure is logged with its stack server-side and answered with a generic
 * Arabic message, so an internal detail — a connection string, a provider's
 * English error, a stack frame — cannot leak through an error path.
 */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function apiFailure(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false as const, error: { code, message, details } }, { status });
}

/**
 * Translate a thrown value into a safe response.
 *
 * Recognised: `HttpError` (already carries a safe Arabic message and a status)
 * and `ZodError` (field messages are authored in Arabic in the schemas).
 * Anything else is treated as unexpected.
 */
export function handleApiError(error: unknown, context: { requestId: string; route: string }) {
  if (error instanceof HttpError) {
    logger.info('request rejected', {
      requestId: context.requestId,
      route: context.route,
      status: error.status,
      code: error.code,
    });
    return apiFailure(error.status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_';
      fieldErrors[key] ??= issue.message;
    }
    return apiFailure(400, 'validation_error', COPY.errors.validation, fieldErrors);
  }

  logger.error('unhandled route error', {
    requestId: context.requestId,
    route: context.route,
    error,
  });
  return apiFailure(500, 'server_error', COPY.common.unexpectedError);
}

/**
 * Wrap a route handler with request correlation and safe error handling.
 * The request id is echoed in a header so a report can be traced to its logs.
 */
export function routeHandler<A extends unknown[]>(
  route: string,
  handler: (request: Request, ...args: A) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: A): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      const response = await handler(request, ...args);
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      const response = handleApiError(error, { requestId, route });
      response.headers.set('x-request-id', requestId);
      return response;
    }
  };
}
