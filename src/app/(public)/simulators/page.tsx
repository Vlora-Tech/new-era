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
    const rows = await prisma.product.findMany({
      where: { type: 'EXAM_SIMULATOR', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceHalalas: true,
        /*
         * The simulator behind the product. Only the track is read: it is a
         * fixed enum with an Arabic label in `copy.ts`, unlike the section and
         * question counts, which belong to a published version and must never
         * be shown as zeroes when there is none.
         */
        examSimulator: { select: { track: true } },
      },
    });

    products = rows.map(({ examSimulator, ...product }) => ({
      ...product,
      track: examSimulator?.track ?? null,
    }));
  } catch {
    failed = true;
  }

  return (
    <Container className="py-12 lg:py-16">
      {/* The v3 heading step, set from here: `PageHead` is shared with the legal pages. */}
      <PageHead
        title={COPY.nav.simulators}
        description={COPY.home.simulatorsBody}
        className="enter [&_h1]:text-h1"
      />

      <div className="reveal mt-12">
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
