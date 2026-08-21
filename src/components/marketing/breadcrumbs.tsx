import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * The trail above a detail page's masthead.
 *
 * Two details that are easy to get wrong in an RTL document:
 *
 *  - the separator points LEFT. Forward is left here, which is the same rule
 *    the rest of the product follows for its arrows (docs/design-system.md
 *    § Hard rules), and `ChevronLeft` is the shape that means "and then".
 *  - the last crumb is not a link. It is the page you are already on, so it
 *    carries `aria-current="page"` and no href — a link to the current URL is a
 *    tab stop that does nothing.
 *
 * The ink is `ink-600`, not the canvas's #8a91a2. That grey is `ink-500`, which
 * is 3.16:1 and is restricted to non-text; a trail is live navigation, so it
 * takes the smallest ink the system allows on real text.
 */
export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: readonly Crumb[]; className?: string }) {
  return (
    <nav aria-label={COPY.catalog.detail.breadcrumb} className={className}>
      <ol className="text-ink-600 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="hover:text-brand-700 rounded-control transition-colors duration-150"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(last && 'text-ink-900')}
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}

              {last ? null : (
                <ChevronLeft className="text-line-500 size-4 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
