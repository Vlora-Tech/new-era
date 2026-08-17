import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The heading block every administration screen opens with.
 *
 * The shape is lifted verbatim from the overview page, which was the only real
 * admin screen when the other ten were still routes: an `h1`, a description held
 * to a readable measure, and an optional action on the inline end. Repeating it
 * by hand across eleven files is how eleven screens end up with three different
 * heading sizes.
 *
 * It is a Server Component — no interactivity of its own. The `action` slot takes
 * whatever the screen needs, including a client component, without this file
 * crossing the boundary.
 *
 * Deliberately *not* built on `PageHead` from `surface.tsx`: that is the public
 * site's masthead, with a ruled head and a facing description column tuned for a
 * marketing page. Borrowing it here would either drag that figure into the
 * administration area or force it to grow a variant to suit a tool.
 */
export function AdminPageHead({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** Primary action for the screen, e.g. "منتج جديد". */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {/*
        `ms-auto` on the action rather than `justify-between`: when the action is
        absent the heading keeps its natural position instead of the row
        collapsing to a single stretched child. `ms` is the inline start, so the
        action sits on the left under `dir="rtl"` with no physical offset.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-ink-900 min-w-0 text-2xl font-semibold">{title}</h1>
        {action ? <div className="ms-auto flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>

      {description ? <p className="text-ink-700 max-w-prose">{description}</p> : null}
    </header>
  );
}
