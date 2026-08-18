import type { ComponentProps, ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import type { $Enums } from '@prisma/client';
import { GraduationCap, MonitorPlay } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatHalalas, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

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

/**
 * The colour code, applied to an owned product.
 *
 * Blue for a course and teal for a simulator are not choices made here: they are
 * the meanings globals.css publishes for those two hues, and the same pair the
 * overview's stat tiles and section heads use. A student scanning the grid can
 * tell the two products apart before reading either title — and the type badge
 * still spells it out in words, so nothing depends on seeing the difference.
 *
 * The cap rule and the icon chip are both the hue's `fill` — the vivid solid
 * `accent.ts` publishes for graphics — so the two marks on one card are the same
 * blue rather than two neighbouring ones. The chip carries a white GLYPH, which
 * clears the 3:1 graphics floor; nothing on either sets white text.
 */
type ProductTone = {
  rule: string;
  chip: string;
  badge: BadgeVariant;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
};

const PRODUCT_TONES: Record<$Enums.ProductType, ProductTone> = {
  COURSE: {
    rule: 'bg-brand-600',
    chip: 'bg-brand-600 text-white',
    badge: 'brand',
    icon: GraduationCap,
  },
  EXAM_SIMULATOR: {
    rule: 'bg-accent-teal-fill',
    chip: 'bg-accent-teal-fill text-white',
    badge: 'teal',
    icon: MonitorPlay,
  },
};

export function OwnedProductList({
  items,
  failed = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderAction,
}: {
  items: OwnedProduct[];
  failed?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /**
   * An extra control per card, beside «فتح».
   *
   * A slot rather than a `type === 'EXAM_SIMULATOR'` branch inside this
   * component: what a simulator's primary action needs — the `ExamSimulator`
   * id, which is not the product id — is not in `OwnedProduct` and has no
   * business being added to it for one caller. The page that knows about
   * simulators supplies the button; this component only decides where it sits.
   */
  renderAction?: (item: OwnedProduct) => ReactNode;
}) {
  if (failed) return <ErrorState />;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const tone = PRODUCT_TONES[item.product.type];
        const Icon = tone.icon;

        return (
          <li key={item.id} className="reveal">
            {/*
              Rests on `shadow-card` with no hover lift: the lift is the cue for
              a card whose whole surface is a link, and this card's only link is
              the button inside it — a card that rises but does not open would
              promise a click it cannot honour.
            */}
            <Card className="flex h-full flex-col overflow-hidden">
              {/*
                A 3px rule across the head of the card, in the product's own
                hue — the same figure `RuledHead` opens a page with, so the
                grid rhymes with the marketing pages instead of inventing a
                card style. It is a rule, not a shadow and not a lift.
              */}
              <span aria-hidden="true" className={cn('block h-[3px] w-full', tone.rule)} />

              <div className="flex flex-1 flex-col gap-4 p-5">
                {/*
                  Chip, then title, then the badges under it. The badges led the
                  card before, which ranked the type and the access state — two
                  labels every card in the grid repeats — above the one line that
                  differs between cards.

                  There is deliberately no progress bar here. `OwnedProduct`
                  carries the entitlement and the product, and nothing about
                  lessons completed; a bar would either be invented or need a
                  query this component has no business adding.
                */}
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'rounded-control inline-flex size-10 shrink-0 items-center justify-center',
                      tone.chip,
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>

                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-ink-900 text-lg font-semibold text-balance">
                      {item.product.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={tone.badge}>
                        {COPY.statusLabels.productType[item.product.type]}
                      </Badge>
                      <Badge variant="success">{COPY.statusLabels.entitlementStatus.ACTIVE}</Badge>
                    </div>
                  </div>
                </div>

                <p className="text-ink-700 flex-1 text-sm leading-relaxed">
                  {item.product.shortDescription}
                </p>

                <dl className="text-sm">
                  <Detail label={COPY.dashboard.accessGrantedAt}>
                    {formatDate(item.grantedAt)}
                  </Detail>
                </dl>

                {/*
                  The supplied action leads, «فتح» follows: for a simulator the
                  primary act is sitting the exam, and the product page is the
                  reference beside it.
                */}
                <div className="border-line-200 flex flex-wrap gap-2 border-t pt-4">
                  {renderAction?.(item)}
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${PRODUCT_BASE_PATH[item.product.type]}/${item.product.slug}`}>
                      {COPY.dashboard.openItem}
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
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

/**
 * A graded attempt's score, as a bar.
 *
 * Green is the colour code's "readiness" hue, which is what a score is. The
 * whole figure is `aria-hidden` on purpose: the `<dl>` directly above it already
 * states the count, the total and the percentage in words and digits, so
 * announcing the same number a second time as a meter is noise rather than
 * access. Nothing here is carried by the bar alone.
 *
 * The track is the shared `ProgressBar` — same contract, and it grows from the
 * inline start under `dir="rtl"` for free. The fill takes green's vivid `fill`
 * because it is a graphic; the percentage beside it stays on the darker `ink`,
 * because it is text and text has a 4.5:1 floor.
 */
function ScoreMeter({ value }: { value: number }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <ProgressBar
        className="min-w-0 flex-1"
        value={value * 100}
        tone="bg-accent-green-fill"
        track="bg-accent-green-soft"
      />
      <span className="text-accent-green font-display text-base font-bold tabular-nums">
        {formatPercent(value)}
      </span>
    </div>
  );
}

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
          <li key={attempt.id} className="reveal">
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-ink-900 text-lg font-semibold text-balance">
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
                <>
                  <ScoreMeter value={correctCount / attempt.totalQuestions} />
                  <p className="text-ink-600 text-xs">{COPY.legal.trainingResultLabel}</p>
                </>
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
        <li key={order.id} className="reveal">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Same rank as an attempt row: the two lists are one card recipe,
                  and only the colour code separates a result from a receipt. */}
              <h3 className="text-ink-900 text-lg font-semibold text-balance">
                {order.productTitle}
              </h3>
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
