import { BrandWordmarkLink } from '@/components/layout/brand';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';

/**
 * Checkout chrome.
 *
 * Deliberately minimal: no navigation rail, no marketing footer. A page where
 * someone is about to enter a card should offer as few ways to wander off it as
 * possible, and every link that is not part of paying is a way to lose an order
 * halfway through.
 *
 * `proxy.ts` does not guard `/checkout`, so this is the first authentication
 * check on the path and it must never be cached.
 */
export const dynamic = 'force-dynamic';

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage(ROUTES.dashboardOrders);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line-200 bg-surface border-b">
        <div className="mx-auto flex w-full max-w-[1280px] items-center px-4 py-4 sm:px-6 lg:px-8">
          <BrandWordmarkLink />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
