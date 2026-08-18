import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The FAQ, as native disclosure widgets.
 *
 * `<details>`/`<summary>` rather than a hand-rolled accordion, and that is the
 * whole design: the browser supplies the button semantics, the expanded state,
 * Enter/Space activation, focus handling and — critically — find-in-page, which
 * opens the matching answer. A div-with-onClick reimplements four of those
 * badly and loses the fifth entirely.
 *
 * It also stays a Server Component. There is no state to hydrate, so the
 * answers are in the HTML: crawlable, and readable before any JavaScript runs.
 *
 * What is animated is the affordance, not the height. Animating `details` to an
 * auto height needs either a fixed measurement or `::details-content`, which is
 * not yet safe across browsers; the mark rotates and the answer fades in, and
 * the panel itself snaps the way a native disclosure does. The global
 * reduced-motion rule collapses both.
 */
export function FaqAccordion({
  items,
  className,
}: {
  items: readonly { question: string; answer: string }[];
  className?: string;
}) {
  return (
    <div className={cn('divide-line-200 border-line-200 divide-y border-y', className)}>
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary
            className={cn(
              // `list-none` + the WebKit pseudo removes the native triangle in
              // every engine; the marker below replaces it on the correct side.
              'flex cursor-pointer list-none items-start justify-between gap-4 py-5',
              'rounded-control transition-colors duration-150',
              'hover:text-brand-700 focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2',
              '[&::-webkit-details-marker]:hidden',
            )}
          >
            <h3 className="text-ink-900 text-[17px] leading-[1.6] font-bold">{item.question}</h3>
            <span
              aria-hidden="true"
              className={cn(
                'bg-brand-100 text-brand-700 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                'transition-transform duration-200 ease-out group-open:rotate-45',
              )}
            >
              <Plus className="size-4" />
            </span>
          </summary>

          <p className="text-ink-700 measure-ar-lg pop-in pb-6 text-[15px] leading-[1.9]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
