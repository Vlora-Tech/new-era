import * as React from 'react';

import { ACCENT, type Accent } from '@/lib/accent';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One count on an administration screen.
 *
 * The overview used to render eight of these as eight identical grey boxes, so
 * a screen whose entire job is "tell me the state of the platform at a glance"
 * offered nothing to glance at — every figure had the same weight, and finding
 * the orders meant reading all eight labels.
 *
 * The hue is the product's colour code, assigned by subject domain rather than
 * by position, so the two product counts, the three question counts and the two
 * order counts each read as a block. The icon is the same one the navigation
 * rail uses for that domain, which makes it wayfinding rather than ornament: it
 * points at the section this number belongs to. Neither hue nor icon carries
 * meaning alone — the label states the subject in words in every tile.
 *
 * It stays a count and never becomes a metric. There is no trend, no delta, no
 * sparkline and no comparison against a previous period, because the page loads
 * one number per query and a second number to compare it against does not
 * exist.
 */
export function CountTile({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number;
  accent: Accent;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}) {
  const tone = ACCENT[accent];

  return (
    // A `div` wrapper holding one `dt` and one `dd` is the only grouping the
    // spec allows inside a `dl`, so the icon lives inside the `dt` beside its
    // label rather than in a row of its own.
    <div className={cn('rounded-panel border p-4', tone.soft, tone.hairline)}>
      <dt className="flex items-start justify-between gap-3">
        <span className="text-ink-700 text-[13px] leading-snug font-medium">{label}</span>
        <span
          aria-hidden="true"
          className={cn(
            'rounded-control flex size-8 shrink-0 items-center justify-center',
            tone.fill,
          )}
        >
          <Icon className="size-4 text-white" />
        </span>
      </dt>
      {/* `tabular-nums` so a column of counts stays a column as the values change. */}
      <dd className="font-display text-ink-900 mt-3 text-[30px] leading-none font-bold tabular-nums">
        {formatNumber(value)}
      </dd>
    </div>
  );
}
