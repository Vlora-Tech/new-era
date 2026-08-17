import type { Metadata } from 'next';

import { ProductGrid, type CatalogProduct } from '@/components/marketing/product-grid';
import { Container, PageHead } from '@/components/ui/surface';
import { COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: COPY.nav.simulators,
  description: COPY.home.simulatorsBody,
};

export const dynamic = 'force-dynamic';

export default async function SimulatorsPage() {
  let products: CatalogProduct[] = [];
  let failed = false;

  try {
    products = await prisma.product.findMany({
      where: { type: 'EXAM_SIMULATOR', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceHalalas: true,
      },
    });
  } catch {
    failed = true;
  }

  return (
    <Container className="py-10 lg:py-16">
      <PageHead title={COPY.nav.simulators} description={COPY.home.simulatorsBody} />

      <div className="mt-12">
        <ProductGrid
          products={products}
          basePath="/simulators"
          typeLabel={COPY.statusLabels.productType.EXAM_SIMULATOR}
          emptyTitle="لا توجد محاكيات منشورة بعد."
          emptyDescription="سيظهر هنا كل ما يُنشر من محاكيات."
          failed={failed}
        />
      </div>

      {/*
       * The independence statement appears wherever simulators are presented,
       * set as a colophon under its own rule — the same figure the homepage
       * closes on. It is a standing disclosure, not a layout element that can be
       * trimmed.
       */}
      <p className="border-line-200 text-ink-700 measure-ar-lg mt-16 border-t pt-8 text-sm leading-[1.9]">
        {INDEPENDENCE_DISCLAIMER}
      </p>
    </Container>
  );
}
