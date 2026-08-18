import * as React from 'react';

import { Card } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * The administration record view: a panel of labelled fields.
 *
 * `DataTable` covers the list screens. Five of the remaining administration
 * screens are the other shape — one student, one order, one attempt, one
 * entitlement, one audit entry — and that shape is a definition list, not a
 * table of one row. Before this file, the two record screens that existed had
 * each written their own `<dl>` with a different grid, a different label colour
 * and a different answer to "what is shown when the value is empty"; five more
 * would have made seven.
 *
 * Presentational only. No data fetching, no state, no client boundary, so it
 * renders inside an `async` Server Component page.
 *
 * It deliberately has **no `failed` prop**, unlike `DataTable`. A list screen can
 * lose one table while the rest of the page is sound, so that component has to be
 * able to draw an `ErrorState` in place of itself. A record screen's fields all
 * come from the one read that produced the record: if it threw there is no record
 * to draw a panel around, and the page renders `ErrorState` instead of this — the
 * same decision `products/[productId]/page.tsx` already makes. A panel that could
 * render itself half-failed would invite the page to skip that.
 */
export type DetailItem = {
  /** Stable identifier, also the React key. */
  key: string;
  label: string;
  /**
   * `null` or `undefined` renders `COPY.common.notAvailable` rather than a blank
   * cell, because an empty `<dd>` is indistinguishable from a field that failed
   * to render. Pass a more specific absence — "لم يُضف" for a phone number nobody
   * entered — when the field has one.
   */
  value: React.ReactNode;
  /**
   * `ltr` for Latin content: addresses, uuids, slugs, ISO dates, amounts.
   * Isolating them keeps the RTL layout stable — a value starting with a digit
   * or a hyphen otherwise reorders against the Arabic label beside it.
   */
  dir?: 'ltr';
  /** A short clarification under the value, for a field whose meaning is not obvious. */
  hint?: string;
  /** Let a long value take the full width instead of one grid column. */
  span?: 'full';
};

const COLUMN_CLASSES: Record<1 | 2 | 3, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
};

export function DetailPanel({
  title,
  description,
  badges,
  items,
  columns = 2,
  footer,
  className,
  children,
}: {
  /** Panel heading. Omit for a panel that sits under the page's own `h1`. */
  title?: string;
  description?: string;
  /** Status pills and the like, rendered above the fields. */
  badges?: React.ReactNode;
  items: readonly DetailItem[];
  columns?: 1 | 2 | 3;
  /** Actions or notes, separated from the fields by a rule. */
  footer?: React.ReactNode;
  className?: string;
  /** Anything further inside the panel, below the fields and above the footer. */
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn('flex flex-col gap-4 p-5 sm:p-6', className)}>
      {title || description ? (
        <div className="flex flex-col gap-1">
          {title ? <h2 className="text-ink-900 text-lg font-semibold">{title}</h2> : null}
          {description ? <p className="text-ink-700 max-w-prose text-sm">{description}</p> : null}
        </div>
      ) : null}

      {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}

      {items.length > 0 ? (
        <dl className={cn('grid gap-x-8 gap-y-4', COLUMN_CLASSES[columns])}>
          {items.map((item) => (
            <div
              key={item.key}
              className={cn(
                'flex min-w-0 flex-col gap-1',
                item.span === 'full' && 'sm:col-span-full',
              )}
            >
              <dt className="text-ink-600 text-xs font-medium">{item.label}</dt>
              {/*
                `min-w-0` and `break-words`: a uuid or a long address is one
                unbreakable token, and without them it pushes its grid column
                wider than the panel and the whole page acquires a horizontal
                scrollbar.

                The `dir="ltr"` goes on an inner span rather than on the `<dd>`
                itself, and the difference is visible. Setting it on the `<dd>`
                would make `text-start` resolve to that box's *left* edge, so the
                value would sit against one side of the column while its label
                sits against the other. On the span it does the one job it is
                there for — isolating the Latin run so it cannot reorder against
                the Arabic around it — while the block stays in the page's
                direction and stays aligned under its label.
              */}
              <dd className="text-ink-900 min-w-0 text-start text-sm font-medium break-words">
                {item.dir === 'ltr' ? (
                  <span dir="ltr">{item.value ?? COPY.common.notAvailable}</span>
                ) : (
                  (item.value ?? COPY.common.notAvailable)
                )}
              </dd>
              {item.hint ? <p className="text-ink-600 text-xs">{item.hint}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}

      {children}

      {footer ? <div className="border-line-200 border-t pt-4">{footer}</div> : null}
    </Card>
  );
}
