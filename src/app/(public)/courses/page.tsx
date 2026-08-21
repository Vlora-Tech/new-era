import type { Metadata } from 'next';

import { ProductGrid, type CatalogProduct } from '@/components/marketing/product-grid';
import { Container, PageHead } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { mediaAssetUrl } from '@/services/media/media.service';

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
         * The cover, and only what draws it. `visibility` is selected because
         * `mediaAssetUrl` needs it to decide between the public address and the
         * authorising route — a product cover is public, but the helper is the
         * one place that rule lives and it is not this page's to duplicate.
         */
        coverAsset: {
          select: { id: true, objectKey: true, visibility: true, width: true, height: true },
        },
        /*
         * The course behind the product, for the card's taxonomy and size line.
         *
         * The counts are restricted to PUBLISHED content: the card states what a
         * visitor would actually receive, and counting drafts would advertise
         * lessons nobody can open. The duration is summed in the database rather
         * than by loading every lesson row to add them here.
         */
        course: {
          select: {
            category: true,
            level: true,
            _count: { select: { modules: { where: { status: 'PUBLISHED' } } } },
            modules: {
              where: { status: 'PUBLISHED' },
              select: {
                _count: { select: { lessons: { where: { status: 'PUBLISHED' } } } },
                lessons: { where: { status: 'PUBLISHED' }, select: { durationSec: true } },
              },
            },
          },
        },
      },
    });

    products = rows.map(({ course, coverAsset, ...product }) => {
      const lessons = course?.modules.flatMap((module) => module.lessons) ?? [];

      return {
        ...product,
        category: course?.category ?? null,
        level: course?.level ?? null,
        cover: coverAsset
          ? {
              url: mediaAssetUrl(coverAsset),
              width: coverAsset.width,
              height: coverAsset.height,
            }
          : null,
        moduleCount: course?._count.modules ?? 0,
        lessonCount: lessons.length,
        // A course whose lessons carry no duration has no total, which is a
        // different claim from a course that is very short. `0` is dropped by
        // the card rather than printed as "أقل من دقيقة".
        durationSec: lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0),
      };
    });
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
          emptyTitle="لا توجد دورات منشورة بعد."
          emptyDescription="سيظهر هنا كل ما يُنشر من دورات."
          failed={failed}
        />
      </div>
    </Container>
  );
}
