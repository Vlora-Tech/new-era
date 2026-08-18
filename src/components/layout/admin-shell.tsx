'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import {
  ClipboardList,
  FileQuestion,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Timer,
  Users,
  X,
} from 'lucide-react';

import { BrandWordmarkLink } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Administration chrome.
 *
 * The whole shell is a client component because every part of it depends on the
 * current path: the rail's active item, the drawer that must close after a
 * navigation, and the section label in the top bar. `children` is still a
 * server-rendered tree — it arrives as a prop, so the pages inside stay Server
 * Components and no page code crosses the client boundary.
 *
 * Only the two fields the chrome displays are passed in, rather than the whole
 * `CurrentUser`: the shell has no business shipping a role or an id to the
 * browser, and `guards.ts` is `server-only` in any case.
 */
export type AdminShellUser = {
  name: string;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

/** One outline family at one size; the icons are wayfinding, not decoration. */
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', label: COPY.admin.overview, icon: LayoutDashboard },
  { href: '/admin/products', label: COPY.admin.products, icon: Package },
  { href: '/admin/courses', label: COPY.admin.courses, icon: GraduationCap },
  { href: '/admin/questions', label: COPY.admin.questionBank, icon: FileQuestion },
  { href: '/admin/simulators', label: COPY.admin.simulators, icon: Timer },
  { href: '/admin/students', label: COPY.admin.students, icon: Users },
  { href: '/admin/orders', label: COPY.admin.orders, icon: ReceiptText },
  { href: '/admin/entitlements', label: COPY.admin.entitlements, icon: KeyRound },
  { href: '/admin/attempts', label: COPY.admin.attempts, icon: ClipboardList },
  { href: '/admin/settings', label: COPY.admin.settings, icon: Settings },
  { href: '/admin/audit-log', label: COPY.admin.auditLog, icon: ScrollText },
];

/**
 * `/admin` is the parent of every other admin route, so prefix matching would
 * leave the overview permanently highlighted. It matches exactly and nothing
 * else; every other item also claims its own subtree.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label={COPY.adminPages.shellLabel} className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            // The active item is carried by `aria-current`, by weight and by a
            // drawn bar — never by colour alone.
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-control relative flex min-h-11 items-center gap-3 py-2 ps-4 pe-3 text-sm',
              'transition-colors duration-150',
              active
                ? 'bg-brand-100 text-brand-700 font-semibold'
                : 'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
            )}
          >
            {/*
              A 3px marker on the rail's own reading edge — the right edge under
              `dir="rtl"`. `inset-y-2` keeps it clear of the pill's 8px corners,
              so it reads as a tab marker rather than as a broken border.
            */}
            {active ? (
              <span
                aria-hidden="true"
                className="bg-brand-700 absolute inset-y-2 start-0 w-[3px] rounded-full"
              />
            ) : null}
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
function AdminMobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);

  // Crossing into the desktop breakpoint hides the panel with CSS, which would
  // otherwise leave the page scroll-locked and the focus trapped in something
  // nobody can see.
  React.useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 64rem)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={COPY.adminPages.openMenu}
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
          <Dialog.Title className="sr-only">{COPY.adminPages.shellLabel}</Dialog.Title>
          <Dialog.Description className="sr-only">{COPY.admin.title}</Dialog.Description>

          <div className="border-line-200 flex h-16 items-center justify-between gap-2 border-b px-3">
            {/* The same lockup and chip the desktop rail carries, so the drawer
                reads as that rail moved rather than as a different object. */}
            <div className="flex min-w-0 items-center gap-2">
              <BrandWordmarkLink className="px-1" compact />
              <span className="bg-brand-100 text-brand-700 truncate rounded-full px-2.5 py-1 text-xs font-semibold">
                {COPY.admin.title}
              </span>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={COPY.adminPages.closeMenu}
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

          {/*
            Dismissing on the click rather than on the resulting route change:
            it closes at the moment the intent is expressed, instead of waiting
            for the server render, and it still fires when the destination is
            the page already open.
          */}
          <div className="flex-1 overflow-y-auto">
            <AdminNav pathname={pathname} onNavigate={() => setOpen(false)} />
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
        toast.error(COPY.adminPages.logoutFailed);
        setPending(false);
        return;
      }

      toast.success(COPY.auth.logoutSuccess);
      router.push('/');
      // The cookie is gone, but the router still holds the signed-in render.
      router.refresh();
    } catch {
      toast.error(COPY.adminPages.logoutFailed);
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      loading={pending}
      onClick={onLogout}
      // The label collapses to the icon on narrow screens, where a `display:
      // none` span would leave the control with no accessible name at all.
      aria-label={COPY.nav.logout}
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{COPY.nav.logout}</span>
    </Button>
  );
}

export function AdminShell({
  user,
  children,
}: {
  user: AdminShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));

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
          <BrandWordmarkLink compact />
          {/*
            A chip rather than a second run of muted text: it separates the tool
            from the brand instead of reading as a continuation of the wordmark.
          */}
          <span className="bg-brand-100 text-brand-700 truncate rounded-full px-2.5 py-1 text-xs font-semibold">
            {COPY.admin.title}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNav pathname={pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3',
            // Translucent with a blur, so content scrolling under the bar reads
            // as beneath it rather than clipped by it. No scroll listener.
            'border-line-200/70 bg-surface/85 border-b px-3 backdrop-blur-xl sm:px-6',
          )}
        >
          <AdminMobileNav pathname={pathname} />

          {/*
            A locator, not a heading: the page below owns the only `h1`, so this
            line stays small rather than competing with it. The current section
            gets the brand hue and its own icon, which makes the bar answer
            "where am I" at a glance instead of after a read.
          */}
          <p className="text-brand-700 flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-semibold">
            <span className="sr-only">{COPY.adminPages.currentSection}: </span>
            {current ? <current.icon className="size-4 shrink-0" aria-hidden="true" /> : null}
            {current?.label ?? COPY.admin.title}
          </p>

          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <div className="min-w-0 text-end">
              <span className="sr-only">{COPY.admin.signedInAs}: </span>
              <span className="text-ink-900 block truncate text-sm font-medium">{user.name}</span>
              {/*
                The address is Latin inside an Arabic layout; isolating it stops a
                leading digit or symbol from reordering the line around it.
              */}
              <span className="text-ink-600 block truncate text-xs">
                <bdi dir="ltr">{user.email}</bdi>
              </span>
            </div>
            {/*
              The signed-in initial. Decorative and `aria-hidden`: the name and
              address sit next to it in text, so a screen reader that also
              announced a bare letter would be reading the same fact twice.
            */}
            <span
              aria-hidden="true"
              className="bg-brand-100 text-brand-700 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            >
              {[...user.name.trim()][0] ?? ''}
            </span>
          </div>

          <LogoutButton />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
