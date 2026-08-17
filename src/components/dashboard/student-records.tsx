import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import type { $Enums } from '@prisma/client';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatHalalas, formatNumber, formatPercent } from '@/lib/format';

/**
 * The record lists the student area shows, in one place.
 *
 * The overview repeats the same rows the dedicated pages show, so the shape of
 * an order or an attempt is defined once here rather than three times. Each list
 * keeps the three outcomes distinct — rows, a genuinely empty history, and a
 * failed query — because an outage rendered as an empty list reads as a true
 * statement about the student's account.
 *
 * The props are plain shapes rather than Prisma payload generics, so a page's
 * `select` has to keep matching them for the file to compile.
 */
type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * Colour is a second channel only. Every badge below carries its Arabic label,
 * so the state survives greyscale, low contrast and colour-blindness.
 */
const ORDER_STATUS_VARIANTS: Record<$Enums.OrderStatus, BadgeVariant> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  FAILED: 'error',
  REFUNDED: 'neutral',
  CANCELLED: 'neutral',
};

const ATTEMPT_STATUS_VARIANTS: Record<$Enums.AttemptStatus, BadgeVariant> = {
  CREATED: 'neutral',
  IN_PROGRESS: 'brand',
  SUBMITTED: 'success',
  EXPIRED: 'warning',
  ABANDONED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: $Enums.OrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANTS[status]}>{COPY.statusLabels.orderStatus[status]}</Badge>
  );
}

export function AttemptStatusBadge({ status }: { status: $Enums.AttemptStatus }) {
  return (
    <Badge variant={ATTEMPT_STATUS_VARIANTS[status]}>
      {COPY.statusLabels.attemptStatus[status]}
    </Badge>
  );
}

/** Label/value pair inside a record card. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-ink-900 font-medium">{children}</dd>
    </div>
  );
}

// ───────────────────────────── Owned products ─────────────────────────────

export type OwnedProduct = {
  id: string;
  grantedAt: Date;
  product: {
    slug: string;
    title: string;
    shortDescription: string;
    type: $Enums.ProductType;
  };
};

/** Catalogue path each product type is browsed and read under. */
const PRODUCT_BASE_PATH: Record<$Enums.ProductType, string> = {
  COURSE: '/courses',
  EXAM_SIMULATOR: '/simulators',
};

export function OwnedProductList({
  items,
  failed = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  items: OwnedProduct[];
  failed?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (failed) return <ErrorState />;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <Card className="flex h-full flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{COPY.statusLabels.productType[item.product.type]}</Badge>
              <Badge variant="success">{COPY.statusLabels.entitlementStatus.ACTIVE}</Badge>
            </div>

            <h3 className="text-ink-900 text-lg font-semibold">{item.product.title}</h3>
            <p className="text-ink-700 flex-1 text-sm leading-relaxed">
              {item.product.shortDescription}
            </p>

            <dl className="text-sm">
              <Detail label={COPY.dashboard.accessGrantedAt}>{formatDate(item.grantedAt)}</Detail>
            </dl>

            <div className="border-line-200 border-t pt-4">
              <Button asChild variant="secondary" size="sm">
                <Link href={`${PRODUCT_BASE_PATH[item.product.type]}/${item.product.slug}`}>
                  {COPY.dashboard.openItem}
                </Link>
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────────── Exam attempts ─────────────────────────────

export type StudentAttempt = {
  id: string;
  mode: $Enums.AttemptMode;
  status: $Enums.AttemptStatus;
  createdAt: Date;
  submittedAt: Date | null;
  correctCount: number | null;
  totalQuestions: number;
  simulator: { product: { title: string } };
};

export function AttemptList({
  items,
  failed = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  items: StudentAttempt[];
  failed?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (failed) return <ErrorState />;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((attempt) => {
        // A score exists only once the attempt was graded at submission. Before
        // that there is no number to show, and inventing a zero would read as a
        // result rather than as an absence.
        const correctCount =
          attempt.correctCount !== null && attempt.totalQuestions > 0 ? attempt.correctCount : null;

        return (
          <li key={attempt.id}>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-ink-900 text-base font-semibold">
                  {attempt.simulator.product.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{COPY.statusLabels.attemptMode[attempt.mode]}</Badge>
                  <AttemptStatusBadge status={attempt.status} />
                </div>
              </div>

              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                <Detail label={COPY.dashboard.attemptDate}>{formatDate(attempt.createdAt)}</Detail>
                {attempt.submittedAt ? (
                  <Detail label={COPY.dashboard.attemptSubmittedAt}>
                    {formatDate(attempt.submittedAt)}
                  </Detail>
                ) : null}
                {correctCount !== null ? (
                  <Detail label={COPY.dashboard.attemptCorrectCount}>
                    {formatNumber(correctCount)} {COPY.dashboard.outOf}{' '}
                    {formatNumber(attempt.totalQuestions)} (
                    {formatPercent(correctCount / attempt.totalQuestions)})
                  </Detail>
                ) : null}
              </dl>

              {correctCount !== null ? (
                <p className="text-ink-600 text-xs">{COPY.legal.trainingResultLabel}</p>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────────── Orders ─────────────────────────────

export type StudentOrder = {
  id: string;
  productTitle: string;
  productType: $Enums.ProductType;
  amountHalalas: number;
  status: $Enums.OrderStatus;
  createdAt: Date;
};

export function OrderList({
  items,
  failed = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  items: StudentOrder[];
  failed?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (failed) return <ErrorState />;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((order) => (
        <li key={order.id}>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-ink-900 text-base font-semibold">{order.productTitle}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{COPY.statusLabels.productType[order.productType]}</Badge>
                <OrderStatusBadge status={order.status} />
              </div>
            </div>

            <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <Detail label={COPY.dashboard.orderAmount}>
                {formatHalalas(order.amountHalalas)}
              </Detail>
              <Detail label={COPY.dashboard.orderDate}>{formatDate(order.createdAt)}</Detail>
            </dl>

            {/* The identifier is what a support conversation is opened with, so
                it is shown in full and isolated from the surrounding Arabic. */}
            <p className="text-ink-600 text-xs">
              {COPY.dashboard.orderReference}: <bdi dir="ltr">{order.id}</bdi>
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
