'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { BrandBarLink } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Public header.
 *
 * An 80px bar — 96px from `lg` — closed by one hairline. The ground is the
 * design system's frosted bar (`bg-surface/85 backdrop-blur-xl`): 85% white is
 * still an effectively solid ground for the brand mark over the cool canvas,
 * and the blur keeps scrolled content from ghosting through the artwork.
 *
 * The 2026 landing design draws this bar at 72% white. It is held at 85% here
 * on purpose: the brand guidelines forbid the supplied artwork on a tinted
 * surface, and at 72% a scrolled section ghosts through the lockup's own white
 * ground. The rest of the design's bar — the pill rail, the gradient action —
 * is adopted as drawn.
 *
 * The bar is that tall because the mark is the supplied artwork rather than set
 * type, and the bar is sized to the mark instead of the mark being shrunk to the
 * bar. It is still under the guidelines' 220px legibility floor: that is an
 * owner-directed deviation, recorded in docs/brand-assets-needed.md, and the
 * commissioned horizontal lockup removes it — `HORIZONTAL_LOCKUP_SRC` in
 * `brand.tsx` switches every bar on the site at once, after which this bar can
 * lose its extra height. The full-size lockup still appears in the footer and on
 * the sign-in and registration pages.
 *
 * NOTE: the bar's height is load-bearing elsewhere — the drawer's `max-h` below
 * and every landing section's `scroll-mt` both subtract it. Changing
 * `h-20 lg:h-24` means changing those too.
 *
 * Navigation state is carried by three signals and never by colour alone: the
 * ground changes, the weight goes up, and `aria-current` is set. The rail's
 * links are pills rather than full-height targets — the design's shape, and the
 * reason the active state is a filled ground here instead of the underline the
 * previous bar drew on its own hairline.
 *
 * Two of the five targets are section anchors on the landing page. They are
 * written root-relative (`/#faq`, not `#faq`) so they work from `/courses`,
 * `/login` or any other public route: the browser navigates home, then scrolls.
 */
const NAV_LINKS = [
  { href: '/', label: COPY.nav.home },
  { href: '/courses', label: COPY.nav.courses },
  { href: '/simulators', label: COPY.nav.simulators },
  { href: '/#how-it-works', label: COPY.nav.howItWorks },
  { href: '/#faq', label: COPY.nav.faq },
] as const;

export function PublicHeader({ isSignedIn }: { isSignedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  /**
   * `usePathname()` never returns a fragment, so a hash link can never match it
   * — comparing them marked "كيف تعمل المنصة؟" as inactive forever. Section
   * links are therefore never active, and a product detail route keeps its
   * catalogue link lit.
   *
   * `/` is matched exactly. Without that clause every route would light the
   * home pill, since every path starts with a slash.
   */
  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Closing returns focus to the control that opened the panel, so keyboard
  // users are not dropped at the top of the document.
  const closeMenu = () => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // The panel is in flow, not an overlay, so the page behind it must keep
    // scrolling: locking `body` here used to make the sign-in and register
    // buttons unreachable whenever the panel was taller than the viewport.
  }, [menuOpen]);

  return (
    <header className="border-line-200/70 bg-surface/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-24 lg:px-8">
        <BrandBarLink />

        <nav
          aria-label={COPY.nav.mainNavigation}
          className="border-line-200 bg-surface/70 hidden items-center gap-1 rounded-full border p-1.5 shadow-xs lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2.5 text-[14.5px]',
                  'transition-colors duration-150 ease-out',
                  active
                    ? 'bg-brand-100 text-brand-700 font-semibold'
                    : 'text-ink-700 hover:bg-surface-muted hover:text-ink-900 font-medium',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isSignedIn ? (
            <Button asChild variant="gradient" shape="pill" size="md">
              <Link href="/dashboard">{COPY.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" shape="pill" size="md">
                <Link href="/login">{COPY.nav.login}</Link>
              </Button>
              <Button asChild variant="gradient" shape="pill" size="md">
                <Link href="/register">{COPY.nav.start}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-control text-ink-900 inline-flex size-11 items-center justify-center lg:hidden"
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
        <div
          id="public-mobile-nav"
          // 5rem/6rem, matching `h-20 lg:h-24` above. It was still subtracting
          // the old 4rem bar, which let the panel run past the bottom of the
          // viewport by the difference and put the register button out of reach.
          // Solid white, not the bar's frosted ground: a reading list over
          // scrolled page content is exactly what a blur cannot keep legible.
          className="border-line-200 bg-surface panel-in max-h-[calc(100dvh-5rem)] overflow-y-auto border-t lg:hidden lg:max-h-[calc(100dvh-6rem)]"
        >
          <nav
            aria-label={COPY.nav.mainNavigation}
            className="mx-auto w-full max-w-[1280px] px-4 sm:px-6"
          >
            <ul className="divide-line-200 flex flex-col divide-y">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={closeMenu}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-ink-900 flex min-h-[52px] items-center text-[16px] font-medium',
                        'transition-colors duration-150 ease-out',
                        active && 'border-brand-700 text-brand-700 border-s-2 ps-3',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-line-200 flex flex-col gap-3 border-t py-4">
              {isSignedIn ? (
                <Button asChild variant="gradient" shape="pill" size="lg" className="w-full">
                  <Link href="/dashboard" onClick={closeMenu}>
                    {COPY.nav.dashboard}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="secondary" shape="pill" size="lg" className="w-full">
                    <Link href="/login" onClick={closeMenu}>
                      {COPY.nav.login}
                    </Link>
                  </Button>
                  <Button asChild variant="gradient" shape="pill" size="lg" className="w-full">
                    <Link href="/register" onClick={closeMenu}>
                      {COPY.nav.start}
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
