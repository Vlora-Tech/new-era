import type { Metadata } from 'next';
import Link from 'next/link';

import { OwnedProductList, type OwnedProduct } from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.myCourses };
export const dynamic = 'force-dynamic';

export default async function DashboardCoursesPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let courses: OwnedProduct[] = [];
  let failed = false;

  try {
    courses = await prisma.entitlement.findMany({
      where: { userId: user.id, status: 'ACTIVE', product: { type: 'COURSE' } },
      orderBy: { grantedAt: 'desc' },
      select: {
        id: true,
        grantedAt: true,
        product: { select: { slug: true, title: true, shortDescription: true, type: true } },
      },
    });
  } catch (error) {
    // `failed` is kept separate from an empty result on purpose: the list must
    // not report "you own no courses" when the query never answered.
    failed = true;
    logger.error('dashboard courses query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">{COPY.dashboard.myCourses}</h1>
        <p className="text-ink-700">{COPY.dashboard.coursesSubtitle}</p>
      </header>

      <OwnedProductList
        items={courses}
        failed={failed}
        emptyTitle={COPY.dashboard.noCourses}
        emptyDescription={COPY.dashboard.noCoursesBody}
        emptyAction={
          <Button asChild>
            <Link href={ROUTES.courses}>{COPY.dashboard.noCoursesAction}</Link>
          </Button>
        }
      />
    </div>
  );
}
