'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

type RefreshResponse = {
  ok: boolean;
  data?: { status?: string; changed?: boolean };
  error?: { message?: string };
};

/**
 * Ask the server to re-check the payment with the gateway.
 *
 * The button reports only whether the order's status moved. It never claims a
 * payment succeeded: the answer comes from the server, which got it from the
 * provider, and this component's job is to re-render the page afterwards.
 */
export function OrderStatusRefresh({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function refresh() {
    setPending(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/payments/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The route reads no body. Sending one would only invite the belief
        // that a client can influence what is reconciled.
      });
      const result = (await response.json()) as RefreshResponse;

      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.common.error);
        return;
      }
      toast.success(
        result.data?.changed ? COPY.commerce.statusRefreshed : COPY.commerce.statusUnchanged,
      );
      router.refresh();
    } catch {
      toast.error(COPY.common.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={refresh} loading={pending}>
      {pending ? COPY.commerce.refreshingStatus : COPY.commerce.refreshStatus}
    </Button>
  );
}
