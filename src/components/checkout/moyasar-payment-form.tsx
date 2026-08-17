'use client';

import { useCallback, useRef, useState } from 'react';
import Script from 'next/script';
import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

/**
 * Moyasar hosted card form.
 *
 * Card data is entered into the gateway's own form and never touches this
 * application: no field here is read, stored or transmitted by New Era. When the
 * gateway finishes creating the payment, `on_completed` sends the server exactly
 * one value — `payment.id`. Not the payment object, not the amount, not the
 * status, and certainly not the card. Everything the server needs to know about
 * that payment it asks the gateway for itself.
 *
 * `metadata` carries the two identifiers reconciliation needs to find its way
 * back to an order, and nothing else. It is assembled on the server.
 */
const MOYASAR_SCRIPT_URL = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.js';
const MOYASAR_STYLE_URL = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.css';

type MoyasarConfig = {
  publishableKey: string;
  amountHalalas: number;
  currency: string;
  description: string;
  callbackUrl: string;
  metadata: { order_id: string; payment_attempt_id: string };
};

type MoyasarGlobal = {
  init: (config: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    Moyasar?: MoyasarGlobal;
  }
}

export function MoyasarPaymentForm({
  orderId,
  config,
}: {
  orderId: string;
  config: MoyasarConfig;
}) {
  const initialised = useRef(false);
  const [failed, setFailed] = useState(false);

  const initialise = useCallback(() => {
    // The script can fire `onLoad` again after a client-side navigation back to
    // this page; initialising twice would render two card forms.
    if (initialised.current) return;
    const moyasar = window.Moyasar;
    if (!moyasar) {
      setFailed(true);
      return;
    }
    initialised.current = true;

    moyasar.init({
      element: '.mysr-form',
      amount: config.amountHalalas,
      currency: config.currency,
      description: config.description,
      publishable_api_key: config.publishableKey,
      callback_url: config.callbackUrl,
      language: 'ar',
      methods: ['creditcard'],
      supported_networks: ['mada', 'visa', 'mastercard'],
      apply_coupon: false,
      metadata: config.metadata,

      /**
       * Runs once the gateway has created the payment and before the browser
       * leaves for 3-D Secure. Only the identifier is sent.
       */
      on_completed: async (payment: { id?: string }) => {
        if (!payment?.id) return;
        const response = await fetch(`/api/orders/${orderId}/payments/attach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: payment.id }),
        });
        if (!response.ok) {
          // Surfaced, but not fatal: the payment still exists at the gateway,
          // and the webhook and the reconciliation sweep will both find it
          // through its metadata even if this binding never landed.
          toast.error(COPY.common.saveFailed);
        }
      },
    });
  }, [config, orderId]);

  if (failed) {
    return (
      <ErrorState
        title={COPY.commerce.paymentFormUnavailable}
        description={COPY.commerce.paymentFormUnavailableBody}
      />
    );
  }

  return (
    <section aria-labelledby="card-form-title" className="flex flex-col gap-4">
      {/* React hoists this into the document head; the gateway's form is
          unstyled without it. */}
      <link rel="stylesheet" href={MOYASAR_STYLE_URL} precedence="default" />

      <h2 id="card-form-title" className="text-ink-900 text-lg font-semibold">
        {COPY.commerce.cardDetailsTitle}
      </h2>

      <ul className="text-ink-700 flex flex-col gap-2 text-sm leading-relaxed">
        <li className="flex items-start gap-2">
          <Info className="text-brand-500 mt-1 size-4 shrink-0" aria-hidden="true" />
          <span className="text-ink-900 font-medium">{COPY.commerce.cardholderNameGuidance}</span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck className="text-brand-500 mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>{COPY.commerce.otpNote}</span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck className="text-brand-500 mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>{COPY.commerce.securityNote}</span>
        </li>
      </ul>

      <p className="text-ink-600 text-sm">{COPY.commerce.supportedNetworks}</p>

      <div className="mysr-form" />

      <Script
        src={MOYASAR_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={initialise}
        onError={() => setFailed(true)}
      />
    </section>
  );
}
