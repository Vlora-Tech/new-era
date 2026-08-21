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
  MessageSquareText,
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

type NavGroup = { label: string; items: readonly NavItem[] };

/**
 * Eleven items in three named groups.
 *
 * The order was always build → operate → govern; the groups only say so out
 * loud. An undifferentiated list of eleven is scanned linearly every time,
 * because nothing tells the reader which third of it their task lives in.
 *
 * One outline family at one size; the icons are wayfinding, not decoration.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: COPY.adminPages.railGroups.catalog,
    items: [
      { href: '/admin', label: COPY.admin.overview, icon: LayoutDashboard },
      { href: '/admin/products', label: COPY.admin.products, icon: Package },
      { href: '/admin/courses', label: COPY.admin.courses, icon: GraduationCap },
      { href: '/admin/questions', label: COPY.admin.questionBank, icon: FileQuestion },
      { href: '/admin/simulators', label: COPY.admin.simulators, icon: Timer },
    ],
  },
  {
    label: COPY.adminPages.railGroups.operations,
    items: [
      { href: '/admin/students', label: COPY.admin.students, icon: Users },
      { href: '/admin/orders', label: COPY.admin.orders, icon: ReceiptText },
      { href: '/admin/entitlements', label: COPY.admin.entitlements, icon: KeyRound },
      { href: '/admin/attempts', label: COPY.admin.attempts, icon: ClipboardList },
      {
        href: '/admin/contact-messages',
        label: COPY.admin.contactMessages,
        icon: MessageSquareText,
      },
    ],
  },
  {
    label: COPY.adminPages.railGroups.governance,
    items: [
      { href: '/admin/settings', label: COPY.admin.settings, icon: Settings },
      { href: '/admin/audit-log', label: COPY.admin.auditLog, icon: ScrollText },
    ],
  },
];

/** Flat, for the top bar's "where am I" lookup. */
const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

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
    <nav aria-label={COPY.adminPages.shellLabel} className="flex flex-col gap-3.5 p-3 pb-5">
      {NAV_GROUPS.map((group) => (
        /*
          A labelled `<section>`, not a bare `<div>`. The group label is what
          makes «الحكم» mean anything to a screen reader walking the rail, and a
          visual-only label would leave the eleven links as flat as they were.
        */
        <section key={group.label} aria-label={group.label} className="flex flex-col gap-0.5">
          <p className="text-ink-600 px-2.5 pt-2 pb-1.5 text-[11.5px] font-semibold">
            {group.label}
          </p>

          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                // The active item is carried by `aria-current`, by weight and by
                // a drawn bar — never by colour alone.
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-control relative flex min-h-11 items-center gap-3 px-3 py-2 text-sm',
                  'transition-colors duration-150',
                  active
                    ? 'bg-brand-100 text-brand-700 font-semibold'
                    : 'text-ink-700 hover:bg-brand-50 hover:text-ink-900',
                )}
              >
                {/*
                  A 3px marker on the rail's own reading edge — the right edge
                  under `dir="rtl"`. `-start-3` puts it in the gutter the nav's
                  own padding provides, so it lands on the rail's edge rather
                  than on the pill's, which is what makes it a tab marker rather
                  than a broken border.
                */}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="bg-brand-700 absolute inset-y-2 -start-3 w-[3px] rounded-full"
                  />
                ) : null}
                {/*
                  The icon takes the brand hue only while active. At rest it
                  stays `ink-600`, so the rail reads as one quiet index rather
                  than as eleven coloured lines.
                */}
                <Icon
                  className={cn('size-5 shrink-0', active ? 'text-brand-700' : 'text-ink-600')}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </section>
      ))}
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
          'sticky top-0 hidden h-dvh w-68 shrink-0 flex-col',
          'border-line-200 bg-surface border-e lg:flex',
        )}
      >
        {/*
          Name over chip, not name beside chip.

          Stacking is what lets the chip sit under the wordmark it qualifies
          instead of trailing it like a second word, and it buys the rail's
          264→272px without the header wrapping. The height stays `h-16` so this
          hairline lands on the top bar's, which a taller header would break by
          a few pixels — the kind of offset that reads as a mistake rather than
          as a decision.
        */}
        <div className="border-line-200 flex h-16 shrink-0 items-center border-b px-4">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <BrandWordmarkLink compact />
            <span className="bg-brand-100 text-brand-700 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {COPY.admin.title}
            </span>
          </div>
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
