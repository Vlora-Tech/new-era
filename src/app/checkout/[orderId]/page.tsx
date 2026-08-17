import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { MockCheckoutPanel } from '@/components/checkout/mock-checkout-panel';
import { MoyasarPaymentForm } from '@/components/checkout/moyasar-payment-form';
import { Button } from '@/components/ui/button';
import { Card, Container, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { isCommerceEnabled } from '@/lib/env';
import { formatDateTime, formatHalalas } from '@/lib/format';
import { getPaymentProvider } from '@/services/payments/payment-provider';

export const metadata: Metadata = { title: COPY.commerce.checkoutTitle };
export const dynamic = 'force-dynamic';

/**
 * Checkout for one order.
 *
 * Ownership is decided here, on the server, against the database — not by the
 * order id being hard to guess. A signed-in student who opens someone else's
 * order id is answered with a 404 rather than a 403: whether an order exists is
 * itself information they are not entitled to.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUserPage(`/checkout/${orderId}`);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true,
      productId: true,
      productTitle: true,
      productType: true,
      amountHalalas: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });
  if (!order) notFound();

  // A settled order has nothing left to pay; the result page is the honest
  // destination for every one of those states.
  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'FAILED') {
    redirect(`/checkout/${order.id}/result`);
  }

  const attempt = await prisma.paymentAttempt.findFirst({
    where: { orderId: order.id, providerPaymentId: null, status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const commerceEnabled = isCommerceEnabled();
  const checkout =
    commerceEnabled && attempt
      ? getPaymentProvider().getCheckoutConfig({
          orderId: order.id,
          paymentAttemptId: attempt.id,
          amountHalalas: order.amountHalalas,
          currency: order.currency,
          description: order.productTitle,
        })
      : null;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.commerce.checkoutTitle}
        </h1>
        <p className="text-ink-700">{COPY.commerce.checkoutSubtitle}</p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-ink-900 text-lg font-semibold">{COPY.commerce.orderSummary}</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">{COPY.commerce.productLabel}</dt>
            <dd className="text-ink-900 font-medium">{order.productTitle}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">{COPY.commerce.orderDate}</dt>
            <dd className="text-ink-900">{formatDateTime(order.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">{COPY.commerce.orderReference}</dt>
            {/* Identifiers are Latin; isolating them keeps the RTL line stable. */}
            <dd className="text-ink-600 font-mono text-xs" dir="ltr">
              {order.id}
            </dd>
          </div>
          <div className="border-line-200 flex flex-wrap items-baseline justify-between gap-2 border-t pt-3">
            <dt className="text-ink-900 font-medium">{COPY.commerce.amountDue}</dt>
            <dd className="text-ink-900 text-lg font-semibold">
              {formatHalalas(order.amountHalalas)}
            </dd>
          </div>
        </dl>
        <p className="text-ink-600 text-xs">{COPY.commerce.currencyNote}</p>
      </Card>

      {checkout === null ? (
        <ErrorState
          title={COPY.commerce.paymentFormUnavailable}
          description={COPY.commerce.paymentFormUnavailableBody}
          action={
            <Button asChild variant="secondary">
              <Link href={ROUTES.dashboardOrders}>{COPY.commerce.backToOrders}</Link>
            </Button>
          }
        />
      ) : checkout.kind === 'mock' ? (
        <MockCheckoutPanel orderId={order.id} />
      ) : (
        <MoyasarPaymentForm
          orderId={order.id}
          config={{
            publishableKey: checkout.publishableKey,
            amountHalalas: checkout.amountHalalas,
            currency: checkout.currency,
            description: checkout.description,
            callbackUrl: checkout.callbackUrl,
            metadata: checkout.metadata,
          }}
        />
      )}

      <p className="text-ink-700 text-sm">{COPY.commerce.doNotPayTwice}</p>
    </Container>
  );
}
