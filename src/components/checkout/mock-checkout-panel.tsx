'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

type MockResponse = {
  ok: boolean;
  data?: { redirectTo?: string };
  error?: { message?: string };
};

/**
 * Development payment simulator.
 *
 * Labelled as a simulation in three places at once — a badge, a heading and a
 * body paragraph — because the one thing this panel must never do is read as a
 * real payment form. It collects nothing: no card, no name, no amount. It only
 * asks the server to write a mock payment with the outcome chosen here, which
 * the server then verifies through the ordinary reconciliation path.
 */
export function MockCheckoutPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<'paid' | 'failed' | null>(null);

  async function complete(outcome: 'paid' | 'failed') {
    setPending(outcome);
    try {
      const response = await fetch('/api/dev/mock-payments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, outcome }),
      });
      const result = (await response.json()) as MockResponse;

      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.common.error);
        return;
      }
      // The server decides where to go, and it has already validated the path.
      router.push(result.data?.redirectTo ?? `/checkout/${orderId}/result`);
      router.refresh();
    } catch {
      toast.error(COPY.common.error);
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="mock-checkout-title"
      className="rounded-panel border-warning/40 bg-warning-soft flex flex-col gap-4 border p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="text-warning size-5" aria-hidden="true" />
        <Badge variant="warning">{COPY.commerce.mockBadge}</Badge>
      </div>

      <h2 id="mock-checkout-title" className="text-ink-900 text-lg font-semibold">
        {COPY.commerce.mockTitle}
      </h2>
      <p className="text-ink-700 text-sm leading-relaxed">{COPY.commerce.mockBody}</p>
      <p className="text-ink-900 text-sm font-medium">{COPY.commerce.mockNoMoneyNote}</p>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => complete('paid')}
          loading={pending === 'paid'}
          disabled={pending !== null}
        >
          {pending === 'paid' ? COPY.commerce.mockProcessing : COPY.commerce.mockSucceed}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => complete('failed')}
          loading={pending === 'failed'}
          disabled={pending !== null}
        >
          {pending === 'failed' ? COPY.commerce.mockProcessing : COPY.commerce.mockFail}
        </Button>
      </div>
    </section>
  );
}
