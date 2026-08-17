import type { Metadata } from 'next';

import { ProductGrid, type CatalogProduct } from '@/components/marketing/product-grid';
import { Container, SectionHeading } from '@/components/ui/surface';
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
    <Container className="py-12 lg:py-16">
      <SectionHeading title={COPY.nav.simulators} description={COPY.home.simulatorsBody} />
      <div className="mt-8">
        <ProductGrid
          products={products}
          basePath="/simulators"
          typeLabel="محاكي اختبار"
          emptyTitle="لا توجد محاكيات منشورة بعد."
          emptyDescription="سيظهر هنا كل ما يُنشر من محاكيات."
          failed={failed}
        />
      </div>

      {/* The independence statement appears wherever simulators are presented. */}
      <p className="text-ink-700 mt-10 max-w-3xl text-sm leading-relaxed">
        {INDEPENDENCE_DISCLAIMER}
      </p>
    </Container>
  );
}
