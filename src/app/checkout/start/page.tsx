import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StartCheckoutButton } from '@/components/checkout/start-checkout-button';
import { Button } from '@/components/ui/button';
import { Badge, Card, Container, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { isCommerceEnabled } from '@/lib/env';
import { formatHalalas } from '@/lib/format';
import { hasActiveEntitlement } from '@/services/access/entitlement';

export const metadata: Metadata = { title: COPY.commerce.checkoutTitle };
export const dynamic = 'force-dynamic';

/**
 * The bridge from a product page into checkout.
 *
 * A confirmation step rather than an automatic redirect: the person sees what
 * they are about to buy and for how much before an order row exists. The price
 * shown is read here from the product, and the price charged is read again from
 * the product on the server — this page never passes an amount anywhere.
 *
 * `requireUserPage` carries the full path, so signing in returns the visitor to
 * the product they were buying rather than to a generic dashboard.
 */
export default async function StartCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: slug } = await searchParams;
  if (!slug) notFound();

  const user = await requireUserPage(`/checkout/start?product=${encodeURIComponent(slug)}`);

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      type: true,
      title: true,
      shortDescription: true,
      status: true,
      priceHalalas: true,
    },
  });
  if (!product || product.status !== 'PUBLISHED') notFound();

  const owned = await hasActiveEntitlement(user.id, product.id);
  const productPath =
    product.type === 'COURSE' ? ROUTES.dashboardCourses : ROUTES.dashboardSimulators;

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.commerce.checkoutTitle}
        </h1>
        <p className="text-ink-700">{COPY.commerce.checkoutSubtitle}</p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <Badge variant="brand">{COPY.statusLabels.productType[product.type]}</Badge>
        <h2 className="text-ink-900 text-lg font-semibold">{product.title}</h2>
        <p className="text-ink-700 text-sm leading-relaxed">{product.shortDescription}</p>

        <div className="border-line-200 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
          <span className="text-ink-700 text-sm">{COPY.commerce.amountDue}</span>
          <span className="text-ink-900 text-xl font-semibold">
            {formatHalalas(product.priceHalalas)}
          </span>
        </div>
        <p className="text-ink-600 text-xs">{COPY.commerce.currencyNote}</p>
      </Card>

      {owned ? (
        <div className="flex flex-col gap-3">
          <p className="text-ink-900 font-medium">{COPY.commerce.alreadyOwned}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={productPath}>{COPY.commerce.openProduct}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.dashboardOrders}>{COPY.commerce.backToOrders}</Link>
            </Button>
          </div>
        </div>
      ) : !isCommerceEnabled() ? (
        <ErrorState
          title={COPY.commerce.paymentFormUnavailable}
          description={COPY.commerce.paymentFormUnavailableBody}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <StartCheckoutButton productId={product.id} label={COPY.commerce.payNow} />
          <Button asChild variant="outline">
            <Link href={ROUTES.dashboardOrders}>{COPY.commerce.backToOrders}</Link>
          </Button>
        </div>
      )}
    </Container>
  );
}
