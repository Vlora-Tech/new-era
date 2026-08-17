import { BrandWordmarkLink } from '@/components/layout/brand';

/**
 * Checkout chrome.
 *
 * Deliberately minimal: no navigation rail, no marketing footer. A page where
 * someone is about to enter a card should offer as few ways to wander off it as
 * possible, and every link that is not part of paying is a way to lose an order
 * halfway through.
 *
 * There is no session check here, and that is on purpose. Each page below
 * performs its own, because each one has a different place to send a visitor
 * back to after signing in — the product they were buying, or the order they
 * were paying for. A guard in this layout would race the page's own guard and
 * could win with the wrong return path, dropping the purchase the visitor was
 * halfway through. Every page under `/checkout` calls `requireUserPage`.
 */
export const dynamic = 'force-dynamic';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
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
