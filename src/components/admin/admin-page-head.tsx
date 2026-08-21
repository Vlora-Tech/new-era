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
      {/*
        Title and description form one column, with the action beside the pair
        rather than above the description. Aligning on `items-end` sits the
        action on the description's baseline-ish edge, so a two-line description
        does not leave the button floating opposite whitespace.
      */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <h1 className="text-ink-900 font-display min-w-0 text-[29px] leading-[1.35] font-bold sm:text-[31px]">
            {title}
          </h1>
          {description ? (
            <p className="text-ink-700 max-w-[62ch] text-[15px] leading-[1.8]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
