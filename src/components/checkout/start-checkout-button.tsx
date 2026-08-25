'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { uuidV4 } from '@/lib/utils';

type OrderResponse = {
  ok: boolean;
  data?: { orderId?: string; checkoutPath?: string };
  error?: { code?: string; message?: string; details?: { orderId?: string } };
};

/**
 * Create the order and move to its checkout page.
 *
 * The idempotency key is generated once, on the first click, and reused for
 * every retry from this component. That is what makes a double-tap, a flaky
 * connection or an impatient second press produce one order rather than three:
 * the server recognises the repeated key and answers with the order it already
 * created.
 *
 * The request names a product and a key. It does not name a price — there is no
 * amount anywhere in this file, because the server takes it from the product.
 */
export function StartCheckoutButton({ productId, label }: { productId: string; label: string }) {
  const router = useRouter();
  const checkoutRequestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    checkoutRequestKey.current ??= uuidV4();

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, checkoutRequestKey: checkoutRequestKey.current }),
      });
      const result = (await response.json()) as OrderResponse;

      if (!result.ok) {
        // A conflict for an order that is already paid still has somewhere
        // useful to go, so the pointer is followed rather than discarded.
        const existing = result.error?.details?.orderId;
        if (existing) {
          router.push(`/checkout/${existing}/result`);
          return;
        }
        toast.error(result.error?.message ?? COPY.commerce.checkoutFailed);
        return;
      }

      router.push(result.data?.checkoutPath ?? `/checkout/${result.data?.orderId}`);
    } catch {
      toast.error(COPY.commerce.checkoutFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="lg" onClick={start} loading={pending}>
      {pending ? COPY.commerce.preparingCheckout : label}
    </Button>
  );
}
