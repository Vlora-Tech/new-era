import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';

import { ProductGrid, type CatalogProduct } from '@/components/marketing/product-grid';
import { Container, PageHead } from '@/components/ui/surface';
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
    const rows = await prisma.product.findMany({
      where: { type: 'COURSE', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceHalalas: true,
        /*
         * The course behind the product, for the card's meta line. Both fields
         * are nullable in the schema and a card simply carries one item fewer
         * when they are unset.
         *
         * The module count is deliberately not read: `copy.ts` holds no label
         * for it, and a bare numeral on a card is a figure making no claim.
         */
        course: { select: { category: true, level: true } },
      },
    });

    products = rows.map(({ course, ...product }) => ({
      ...product,
      category: course?.category ?? null,
      level: course?.level ?? null,
    }));
  } catch {
    failed = true;
  }

  return (
    <Container className="py-12 lg:py-16">
      {/*
       * The same ruled head the homepage opens each of its sections with, at the
       * v3 heading step. The step is set from here because `PageHead` is shared
       * with the legal pages, whose h1 is not this screen's to resize.
       */}
      <PageHead
        title={COPY.nav.courses}
        description={COPY.home.coursesBody}
        className="enter [&_h1]:text-h1"
      />

      <div className="reveal mt-12">
        <ProductGrid
          products={products}
          basePath="/courses"
          typeLabel={COPY.statusLabels.productType.COURSE}
          typeVariant="brand"
          icon={BookOpen}
          emptyTitle="لا توجد دورات منشورة بعد."
          emptyDescription="سيظهر هنا كل ما يُنشر من دورات."
          failed={failed}
        />
      </div>
    </Container>
  );
}
