import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';
import { COPY } from '@/lib/copy';

/** Page width and gutters, matching the brand grid (1280px, 32/24/16px). */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}

/**
 * A grouping surface. Used only where content genuinely forms a separate
 * object — structured information belongs in a list or a table instead.
 */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-panel border-line-200 bg-surface border', className)}>
      {children}
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-muted text-ink-700',
        brand: 'bg-brand-100 text-brand-700',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        error: 'bg-error-soft text-error',
        outline: 'border border-line-200 text-ink-700',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

/**
 * Status pill. The label always carries the meaning in words, so the state is
 * still legible to someone who cannot distinguish the colours.
 */
export function Badge({
  className,
  variant,
  children,
}: VariantProps<typeof badgeVariants> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}

/**
 * "There is genuinely nothing here yet."
 *
 * Deliberately distinct from ErrorState: an outage rendered as an empty list
 * reads as a true business fact, which is how people end up trusting a number
 * that was never actually loaded.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-panel flex flex-col items-center justify-center gap-3 border border-dashed',
        'border-line-200 bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <Inbox className="text-ink-600 size-8" aria-hidden="true" />
      <p className="text-ink-900 text-base font-medium">{title}</p>
      {description ? <p className="text-ink-700 max-w-prose text-sm">{description}</p> : null}
      {action}
    </div>
  );
}

/**
 * "We could not load this."
 *
 * Never collapses into an empty state or a zero metric.
 */
export function ErrorState({
  title = COPY.common.loadFailedTitle,
  description = COPY.common.loadFailedBody,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-panel flex flex-col items-center justify-center gap-3 border',
        'border-error/30 bg-error-soft px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className="text-error size-8" aria-hidden="true" />
      <p className="text-ink-900 text-base font-medium">{title}</p>
      <p className="text-ink-700 max-w-prose text-sm">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-control bg-surface-muted animate-pulse', className)}
      aria-hidden="true"
    />
  );
}

/** Section heading with optional eyebrow, for marketing and dashboard sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {eyebrow ? <p className="text-brand-700 text-sm font-medium">{eyebrow}</p> : null}
      <h2 className="text-ink-900 text-2xl font-semibold sm:text-3xl">{title}</h2>
      {description ? <p className="text-ink-700 max-w-prose">{description}</p> : null}
    </div>
  );
}
