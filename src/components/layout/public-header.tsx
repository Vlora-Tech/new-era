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
 * A 64px bar on a solid white ground, closed by one hairline. It is deliberately
 * opaque: a translucent, blurred bar is the frosted-panel treatment the brief
 * rules out, and it also puts whatever happens to be scrolling underneath behind
 * the brand mark.
 *
 * The mark here is set type, not the supplied artwork. The stacked lockup needs
 * 220px of width for its two wordmarks to read, which a 64px bar cannot give;
 * scaling it to fit turns both wordmarks into a smudge, and that is improvising
 * the compact lockup the guidelines say must be commissioned. So the artwork
 * appears at full size where there is genuinely room for it — the homepage
 * masthead, the footer, and the sign-in and registration pages — and the bar
 * carries the name as type until the horizontal lockup is delivered.
 * See docs/brand-assets-needed.md.
 *
 * Navigation state is carried by three signals and never by colour alone: the
 * hue changes, a 2px rule is drawn under the active link, and `aria-current`
 * is set. The links are full-height targets rather than pills.
 */
const NAV_LINKS = [
  { href: '/courses', label: COPY.nav.courses },
  { href: '/simulators', label: COPY.nav.simulators },
  { href: '/#how-it-works', label: COPY.nav.howItWorks },
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
   */
  const isActive = (href: string) =>
    href.startsWith('/#') ? false : pathname === href || pathname.startsWith(`${href}/`);

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
    <header className="border-line-200 bg-surface sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-24 lg:px-8">
        <div className="flex h-20 items-center gap-7 lg:h-24 lg:gap-9">
          <BrandBarLink />

          <nav
            aria-label={COPY.nav.mainNavigation}
            className="hidden h-20 items-center md:flex lg:h-24"
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // Full bar height, so the target is 64px tall and the rule
                    // it draws when active lands on the header's own hairline.
                    'inline-flex h-20 items-center border-b-2 px-3.5 lg:h-24',
                    'text-ink-700 text-[14px] font-medium',
                    'transition-colors duration-150 ease-out',
                    'hover:text-ink-900 border-transparent',
                    active && 'border-brand-700 text-brand-700',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isSignedIn ? (
            <Button asChild size="md">
              <Link href="/dashboard">{COPY.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="md">
                <Link href="/login">{COPY.nav.login}</Link>
              </Button>
              <Button asChild size="md">
                <Link href="/register">{COPY.nav.register}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          ref={toggleRef}
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
        <div
          id="public-mobile-nav"
          className="border-line-200 bg-surface panel-in max-h-[calc(100dvh-4rem)] overflow-y-auto border-t md:hidden"
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
                <Button asChild size="lg" className="w-full">
                  <Link href="/dashboard" onClick={closeMenu}>
                    {COPY.nav.dashboard}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" variant="secondary" className="w-full">
                    <Link href="/login" onClick={closeMenu}>
                      {COPY.nav.login}
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="w-full">
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
