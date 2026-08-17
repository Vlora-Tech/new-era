'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

/**
 * Root error boundary.
 *
 * The visitor is shown a plain Arabic message. The error object is not rendered:
 * a stack trace or a database message on screen is an information leak, and it
 * is meaningless to the person reading it. Details go to the console, where the
 * server logger has already recorded the structured entry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('client error boundary', { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <h1 className="text-ink-900 text-3xl font-semibold">{COPY.errors.serverError}</h1>
      <p className="text-ink-700 max-w-md">{COPY.errors.serverErrorBody}</p>
      <Button onClick={reset}>{COPY.common.retry}</Button>
    </main>
  );
}
