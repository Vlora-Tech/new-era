import type { Metadata } from 'next';
import Link from 'next/link';

import { OwnedProductList, type OwnedProduct } from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.mySimulators };
export const dynamic = 'force-dynamic';

export default async function DashboardSimulatorsPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let simulators: OwnedProduct[] = [];
  let failed = false;

  try {
    simulators = await prisma.entitlement.findMany({
      where: { userId: user.id, status: 'ACTIVE', product: { type: 'EXAM_SIMULATOR' } },
      orderBy: { grantedAt: 'desc' },
      select: {
        id: true,
        grantedAt: true,
        product: { select: { slug: true, title: true, shortDescription: true, type: true } },
      },
    });
  } catch (error) {
    failed = true;
    logger.error('dashboard simulators query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.dashboard.mySimulators}
        </h1>
        <p className="text-ink-700">{COPY.dashboard.simulatorsSubtitle}</p>
      </header>

      <OwnedProductList
        items={simulators}
        failed={failed}
        emptyTitle={COPY.dashboard.noSimulators}
        emptyDescription={COPY.dashboard.noSimulatorsBody}
        emptyAction={
          <Button asChild>
            <Link href={ROUTES.simulators}>{COPY.dashboard.noSimulatorsAction}</Link>
          </Button>
        }
      />

      {/* The independence statement belongs anywhere a simulator is presented,
          including the student's own list of them. */}
      <p className="text-ink-600 max-w-prose text-xs leading-relaxed">
        {COPY.legal.independenceDisclaimer}
      </p>
    </div>
  );
}
