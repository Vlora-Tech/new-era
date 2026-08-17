import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';

import { OrderStatusRefresh } from '@/components/checkout/order-status-refresh';
import { Button } from '@/components/ui/button';
import { Badge, Card, Container } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatDateTime, formatHalalas } from '@/lib/format';

export const metadata: Metadata = { title: COPY.commerce.resultTitle };
export const dynamic = 'force-dynamic';

/**
 * What happened to an order.
 *
 * Every word on this page is derived from the order's own status column, which
 * is only ever written by reconciliation after the provider confirmed the
 * payment. Nothing is read from the URL — arriving here is not evidence of
 * anything, which is why there is no "success" variant reachable by navigation.
 */
const PRESENTATION = {
  PAID: {
    title: COPY.commerce.resultPaidTitle,
    body: COPY.commerce.resultPaidBody,
    badge: 'success',
    icon: CheckCircle2,
    tone: 'text-success',
  },
  PENDING_PAYMENT: {
    title: COPY.commerce.resultPendingTitle,
    body: COPY.commerce.resultPendingBody,
    badge: 'warning',
    icon: Clock,
    tone: 'text-warning',
  },
  FAILED: {
    title: COPY.commerce.resultFailedTitle,
    body: COPY.commerce.resultFailedBody,
    badge: 'error',
    icon: XCircle,
    tone: 'text-error',
  },
  CANCELLED: {
    title: COPY.commerce.resultCancelledTitle,
    body: COPY.commerce.resultCancelledBody,
    badge: 'neutral',
    icon: XCircle,
    tone: 'text-ink-600',
  },
  REFUNDED: {
    title: COPY.commerce.resultRefundedTitle,
    body: COPY.commerce.resultRefundedBody,
    badge: 'neutral',
    icon: RotateCcw,
    tone: 'text-ink-600',
  },
} as const;

export default async function CheckoutResultPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requireUserPage(`/checkout/${orderId}/result`);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true,
      productId: true,
      productType: true,
      productTitle: true,
      amountHalalas: true,
      status: true,
      createdAt: true,
      paidAt: true,
    },
  });
  if (!order) notFound();

  const view = PRESENTATION[order.status];
  const Icon = view.icon;
  const productPath =
    order.productType === 'COURSE' ? ROUTES.dashboardCourses : ROUTES.dashboardSimulators;

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Icon className={`${view.tone} size-7`} aria-hidden="true" />
          <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">{view.title}</h1>
        </div>
        <p className="text-ink-700 leading-relaxed">{view.body}</p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink-900 text-lg font-semibold">{COPY.commerce.orderSummary}</h2>
          <Badge variant={view.badge}>{COPY.statusLabels.orderStatus[order.status]}</Badge>
        </div>

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">{COPY.commerce.productLabel}</dt>
            <dd className="text-ink-900 font-medium">{order.productTitle}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">
              {order.status === 'PAID' ? COPY.commerce.amountPaid : COPY.commerce.amountDue}
            </dt>
            <dd className="text-ink-900 font-medium">{formatHalalas(order.amountHalalas)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">
              {order.paidAt ? COPY.dashboard.accessGrantedAt : COPY.commerce.orderDate}
            </dt>
            <dd className="text-ink-900">{formatDateTime(order.paidAt ?? order.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-ink-700">{COPY.commerce.orderReference}</dt>
            <dd className="text-ink-600 font-mono text-xs" dir="ltr">
              {order.id}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {order.status === 'PAID' ? (
          <Button asChild>
            <Link href={productPath}>{COPY.commerce.openProduct}</Link>
          </Button>
        ) : null}

        {order.status === 'PENDING_PAYMENT' ? <OrderStatusRefresh orderId={order.id} /> : null}

        {order.status === 'FAILED' ? (
          <Button asChild>
            <Link href={`/checkout/${order.id}`}>{COPY.commerce.payNow}</Link>
          </Button>
        ) : null}

        <Button asChild variant="outline">
          <Link href={ROUTES.dashboardOrders}>{COPY.commerce.backToOrders}</Link>
        </Button>
      </div>

      {order.status === 'PENDING_PAYMENT' ? (
        <p className="text-ink-700 text-sm">{COPY.commerce.doNotPayTwice}</p>
      ) : null}
    </Container>
  );
}
