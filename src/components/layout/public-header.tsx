'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { BrandWordmarkLink } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Public header.
 *
 * A slim white bar with a single hairline border, not a floating pill: the brand
 * reads as structural, and a raised capsule would fight that.
 *
 * The brand is set as type here rather than as the supplied logo. The artwork is
 * a stacked lockup that needs 220px of width to stay legible, and the guidelines
 * forbid cropping it or extracting the symbol. Until a horizontal lockup is
 * commissioned, typography is the honest fit for a 64px bar.
 */
const NAV_LINKS = [
  { href: '/courses', label: COPY.nav.courses },
  { href: '/simulators', label: COPY.nav.simulators },
  { href: '/#how-it-works', label: COPY.nav.howItWorks },
] as const;

export function PublicHeader({ isSignedIn }: { isSignedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // The drawer closes from the interaction that navigates, not from an effect
  // watching the path: reacting to the change would cause a second render pass
  // after every navigation for something the click already knows.
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header className="border-line-200 bg-surface sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <BrandWordmarkLink />

          <nav aria-label={COPY.nav.mainNavigation} className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-control text-ink-700 text-sm font-medium transition-colors',
                  'hover:text-brand-700',
                  pathname === link.href && 'text-brand-700',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isSignedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">{COPY.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{COPY.nav.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{COPY.nav.register}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-control text-ink-900 inline-flex size-11 items-center justify-center md:hidden"
          aria-expanded={menuOpen}
          aria-controls="public-mobile-nav"
          aria-label={menuOpen ? COPY.nav.closeMenu : COPY.nav.openMenu}
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOpen ? (
        <div id="public-mobile-nav" className="border-line-200 bg-surface border-t md:hidden">
          <nav aria-label={COPY.nav.mainNavigation} className="flex flex-col px-4 py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="rounded-control text-ink-900 hover:bg-surface-muted px-2 py-3 text-base font-medium"
              >
                {link.label}
              </Link>
            ))}

            <div className="border-line-200 mt-2 flex flex-col gap-2 border-t pt-3 pb-2">
              {isSignedIn ? (
                <Button asChild>
                  <Link href="/dashboard" onClick={closeMenu}>
                    {COPY.nav.dashboard}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="secondary">
                    <Link href="/login" onClick={closeMenu}>
                      {COPY.nav.login}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register" onClick={closeMenu}>
                      {COPY.nav.register}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
