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
 *
 * Cards rest on `shadow-card`, the identity's one panel elevation
 * (docs/design-system.md). `interactive` adds the sanctioned hover lift: half a
 * step of translate and one step of shadow, collapsed automatically under
 * reduced motion by the global rule.
 */
export function Card({
  className,
  interactive = false,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-panel border-line-200 bg-surface shadow-card border',
        interactive &&
          'hover:border-brand-500/40 hover:shadow-card-lg transition-all duration-200 ease-out hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] leading-[18px] font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-muted text-ink-700',
        brand: 'bg-brand-100 text-brand-700',
        // The colour code's teal, for the label that distinguishes a simulator
        // from a course. 4.85:1 on its own ground.
        teal: 'bg-accent-teal-soft text-accent-teal',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        error: 'bg-error-soft text-error',
        outline: 'border border-line-200 text-ink-700',
      },
      /*
       * A status is a pill; a category label is not. Keeping the two apart is what
       * stops the interface acquiring pill styling on every control, and it lets a
       * catalogue row carry a taxonomy label without it reading as a live state.
       */
      shape: {
        pill: 'rounded-full',
        square: 'rounded-[4px]',
      },
    },
    defaultVariants: { variant: 'neutral', shape: 'pill' },
  },
);

/**
 * Status pill. The label always carries the meaning in words, so the state is
 * still legible to someone who cannot distinguish the colours.
 */
export function Badge({
  className,
  variant,
  shape,
  children,
}: VariantProps<typeof badgeVariants> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badgeVariants({ variant, shape }), className)}>{children}</span>;
}

/**
 * The page's opening landmark: a hairline with a short brand rule standing on
 * it. Every public page opens on this figure, at one of two scales, which is
 * what makes a catalogue, a product page and a legal document read as parts of
 * one document rather than three unrelated screens.
 *
 * It is a rule and a tick, not a heading — the caller supplies the heading, so
 * the same figure can open an `<h1>` page, an `<h2>` section or a masthead that
 * carries badges above its title.
 */
export function RuledHead({
  size = 'lg',
  className,
  children,
}: {
  size?: 'lg' | 'sm';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-line-200 relative border-t',
        size === 'lg' ? 'pt-6' : 'pt-5',
        className,
      )}
    >
      {/*
       * `-top-px` places the bar's own top edge on the hairline's top edge, so
       * it stands on the rule rather than floating above or below it.
       */}
      <span
        aria-hidden="true"
        className={cn(
          'bg-brand-700 absolute start-0 -top-px block',
          size === 'lg' ? 'h-[3px] w-10' : 'h-0.5 w-6',
        )}
      />
      {children}
    </div>
  );
}

/**
 * A public page's masthead: the ruled head, the page's `<h1>`, and an optional
 * description set in a facing column so the two read as a spread rather than a
 * stack.
 *
 * `SectionHeading` below is deliberately left alone — the dashboard and the
 * administration area depend on it, and changing a component they share to suit
 * the marketing pages is risk with no return.
 */
export function PageHead({
  title,
  description,
  meta,
  className,
}: {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <RuledHead className={className}>
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-baseline">
        <div>
          <h1 className="text-ink-900 text-[28px] leading-[1.3] font-semibold sm:text-[34px] sm:leading-[1.24]">
            {title}
          </h1>
          {meta ? <div className="mt-4">{meta}</div> : null}
        </div>
        {description ? (
          <p className="text-ink-700 measure-ar text-[16px] leading-[1.8]">{description}</p>
        ) : null}
      </div>
    </RuledHead>
  );
}

/** The same figure at section scale, for the parts of a long page. */
export function Subhead({
  title,
  id,
  className,
}: {
  title: string;
  id?: string;
  className?: string;
}) {
  return (
    <RuledHead size="sm" className={className}>
      <h2 id={id} className="text-ink-900 text-[20px] leading-[1.45] font-semibold lg:text-[22px]">
        {title}
      </h2>
    </RuledHead>
  );
}

const noticeVariants = cva('rounded-panel border border-s-2 px-5 py-4 text-[15px] leading-[1.85]', {
  variants: {
    tone: {
      /* A standing disclosure: always true, never an alert. */
      neutral: 'border-line-200 border-s-line-500 bg-surface-muted text-ink-900',
      /* A caveat about the document the reader is looking at. */
      warning: 'border-warning/25 border-s-warning bg-warning-soft text-ink-900',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/**
 * A standing disclosure — the independence statement, or a document's "this is
 * not final" caveat.
 *
 * It is deliberately *not* an alert: nothing has gone wrong, and giving it
 * `role="alert"` would make a screen reader interrupt on a fact that is always
 * true. `ErrorState` remains the only thing on the site that alerts. The tone
 * is carried by a ground *and* an inline-start rule, never by colour alone.
 */
export function Notice({
  tone,
  role,
  label,
  className,
  children,
}: VariantProps<typeof noticeVariants> & {
  role?: 'note' | 'status';
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role={role} aria-label={label} className={cn(noticeVariants({ tone }), className)}>
      {children}
    </div>
  );
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
      <span
        aria-hidden="true"
        className="bg-surface-muted text-ink-600 rounded-panel flex size-12 items-center justify-center"
      >
        <Inbox className="size-6" />
      </span>
      <p className="text-ink-900 text-base font-semibold">{title}</p>
      {description ? <p className="text-ink-700 max-w-prose text-sm">{description}</p> : null}
      {action}
    </div>
  );
}

/**
 * "We could not load this."
 *
 * Never collapses into an empty state or a zero metric. Four signals separate it
 * from EmptyState and none of them is colour: a solid border rather than a
 * dashed one, a warning icon rather than an inbox, different words, and
 * `role="alert"`.
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
      <span
        aria-hidden="true"
        className="text-error rounded-panel flex size-12 items-center justify-center bg-white/70"
      >
        <AlertTriangle className="size-6" />
      </span>
      <p className="text-ink-900 text-base font-semibold">{title}</p>
      <p className="text-ink-700 max-w-prose text-sm">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        // The global reduced-motion rule forces `animation-duration: 0.01ms`,
        // which turns a pulse into a strobe — worse than the animation it was
        // meant to suppress. This opts the pulse out entirely instead.
        'rounded-control bg-surface-muted animate-pulse motion-reduce:animate-none',
        className,
      )}
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
