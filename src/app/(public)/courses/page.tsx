import type { Metadata } from 'next';

import { ProductGrid, type CatalogProduct } from '@/components/marketing/product-grid';
import { Container, SectionHeading } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: COPY.nav.courses,
  description: COPY.home.coursesBody,
};

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  let products: CatalogProduct[] = [];
  let failed = false;

  try {
    products = await prisma.product.findMany({
      where: { type: 'COURSE', status: 'PUBLISHED' },
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
      <SectionHeading title={COPY.nav.courses} description={COPY.home.coursesBody} />
      <div className="mt-8">
        <ProductGrid
          products={products}
          basePath="/courses"
          typeLabel="دورة"
          emptyTitle="لا توجد دورات منشورة بعد."
          emptyDescription="سيظهر هنا كل ما يُنشر من دورات."
          failed={failed}
        />
      </div>
    </Container>
  );
}
