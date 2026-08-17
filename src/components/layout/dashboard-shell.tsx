'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import {
  ClipboardList,
  GraduationCap,
  House,
  LogOut,
  Menu,
  MonitorPlay,
  ReceiptText,
  UserRound,
  X,
} from 'lucide-react';

import { BrandWordmarkLink } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Student chrome.
 *
 * The whole shell is a client component because every part of it depends on the
 * current path: the rail's active item and the drawer that must close after a
 * navigation. `children` is still a server-rendered tree — it arrives as a prop,
 * so the pages inside stay Server Components and no page code, and no Prisma
 * result, crosses the client boundary.
 *
 * Only the name is passed in, not the whole `CurrentUser`: the chrome has no
 * business shipping a role or an id to the browser, and `guards.ts` is
 * `server-only` in any case.
 */
type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

/** One outline family at one size; the icons are wayfinding, not decoration. */
const NAV_ITEMS: readonly NavItem[] = [
  { href: ROUTES.dashboard, label: COPY.dashboard.home, icon: House },
  { href: ROUTES.dashboardCourses, label: COPY.dashboard.myCourses, icon: GraduationCap },
  { href: ROUTES.dashboardSimulators, label: COPY.dashboard.mySimulators, icon: MonitorPlay },
  { href: ROUTES.dashboardAttempts, label: COPY.dashboard.myAttempts, icon: ClipboardList },
  { href: ROUTES.dashboardOrders, label: COPY.dashboard.myOrders, icon: ReceiptText },
  { href: ROUTES.dashboardAccount, label: COPY.dashboard.myAccount, icon: UserRound },
];

/**
 * `/dashboard` is the parent of every other student route, so prefix matching
 * would leave the overview permanently highlighted. It matches exactly and
 * nothing else; every other item also claims its own subtree, so a future
 * `/dashboard/orders/[id]` still highlights طلباتي.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === ROUTES.dashboard) return pathname === ROUTES.dashboard;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label={COPY.dashboard.navigationLabel} className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            // The active item is carried by `aria-current` and by weight, not by
            // colour alone.
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-control flex min-h-11 items-center gap-3 px-3 py-2 text-sm',
              'transition-colors duration-150',
              active
                ? 'bg-brand-100 text-brand-700 font-medium'
                : 'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile navigation.
 *
 * Built on Radix Dialog rather than by hand: it already provides the focus
 * trap, focus restoration to the trigger, Escape-to-close, `aria-modal`, the
 * `aria-expanded`/`aria-controls` pair on the trigger, and the body scroll lock.
 * Re-implementing those is where accessible drawers usually go wrong.
 */
function DashboardMobileNav({ pathname }: { pathname: string }) {
  /*
   * A link inside the panel navigates without unmounting the shell, so the route
   * change is the only signal that the drawer has done its job.
   *
   * What is stored is the path the drawer was opened on, not a boolean: openness
   * is then derived, and a navigation closes the drawer during the same render
   * that shows the new page. Reacting to the path in an effect would instead
   * paint the drawer over the new page for one frame and cost a second render.
   */
  const [openedOnPath, setOpenedOnPath] = React.useState<string | null>(null);
  const open = openedOnPath === pathname;

  const setOpen = React.useCallback(
    (next: boolean) => setOpenedOnPath(next ? pathname : null),
    [pathname],
  );

  // Crossing into the desktop breakpoint hides the panel with CSS, which would
  // otherwise leave the page scroll-locked and the focus trapped in something
  // nobody can see.
  React.useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 64rem)');
    // The state setter is used directly here rather than the `setOpen` wrapper,
    // which would tie this subscription to the current path for no gain.
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenedOnPath(null);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={COPY.dashboard.openMenu}
          className={cn(
            'rounded-control inline-flex size-11 shrink-0 items-center justify-center',
            'text-ink-700 hover:bg-surface-muted hover:text-ink-900 transition-colors duration-150',
            'lg:hidden',
          )}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink-900/40 fixed inset-0 z-40 lg:hidden" />
        {/*
          `start-0` is the inline start, which under `dir="rtl"` is the right
          edge — the same side as the desktop rail, with no physical offset.
        */}
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col',
            'border-line-200 bg-surface shadow-overlay border-e lg:hidden',
          )}
        >
          <Dialog.Title className="sr-only">{COPY.dashboard.navigationLabel}</Dialog.Title>
          <Dialog.Description className="sr-only">{COPY.dashboard.title}</Dialog.Description>

          <div className="border-line-200 flex h-16 items-center justify-between gap-2 border-b px-3">
            <BrandWordmarkLink className="px-1" />
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={COPY.dashboard.closeMenu}
                className={cn(
                  'rounded-control inline-flex size-11 shrink-0 items-center justify-center',
                  'text-ink-700 transition-colors duration-150',
                  'hover:bg-surface-muted hover:text-ink-900',
                )}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            <DashboardNav pathname={pathname} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onLogout() {
    setPending(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const result = (await response.json()) as { ok: boolean };
      if (!result.ok) {
        toast.error(COPY.dashboard.logoutFailed);
        setPending(false);
        return;
      }

      toast.success(COPY.auth.logoutSuccess);
      router.push('/');
      // The cookie is gone, but the router still holds the signed-in render.
      router.refresh();
    } catch {
      toast.error(COPY.dashboard.logoutFailed);
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" loading={pending} onClick={onLogout}>
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{COPY.nav.logout}</span>
    </Button>
  );
}

export function DashboardShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="bg-canvas flex min-h-dvh">
      {/*
        The rail is first in the DOM, which places it on the inline start — the
        right-hand side under `dir="rtl"` — with no physical offset, and keeps
        the tab order matching the reading order.

        `h-dvh` is what makes `sticky` work here: an explicit cross-size opts the
        aside out of the flex container's stretch, leaving room to stick against.
      */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh w-66 shrink-0 flex-col',
          'border-line-200 bg-surface border-e lg:flex',
        )}
      >
        <div className="border-line-200 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <BrandWordmarkLink />
          <span className="text-ink-600 truncate text-sm">{COPY.dashboard.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DashboardNav pathname={pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3',
            'border-line-200 bg-surface border-b px-3 sm:px-6',
          )}
        >
          <DashboardMobileNav pathname={pathname} />

          {/*
            A locator, not a heading: the page below owns the only `h1`, so the
            name stays small rather than competing with it.
          */}
          <p className="text-ink-700 min-w-0 flex-1 truncate text-sm">
            <span className="sr-only">{COPY.dashboard.signedInAs}: </span>
            <span className="text-ink-900 font-medium">{userName}</span>
          </p>

          <LogoutButton />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
