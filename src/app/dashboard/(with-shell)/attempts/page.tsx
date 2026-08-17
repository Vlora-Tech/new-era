import type { Metadata } from 'next';
import Link from 'next/link';

import { AttemptList, type StudentAttempt } from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.myAttempts };
export const dynamic = 'force-dynamic';

/** Ceiling on one page of history; pagination arrives with the results screens. */
const ATTEMPT_LIMIT = 50;

export default async function DashboardAttemptsPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let attempts: StudentAttempt[] = [];
  let failed = false;

  try {
    attempts = await prisma.examAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: ATTEMPT_LIMIT,
      select: {
        id: true,
        mode: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        correctCount: true,
        totalQuestions: true,
        simulator: { select: { product: { select: { title: true } } } },
      },
    });
  } catch (error) {
    failed = true;
    logger.error('dashboard attempts query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.dashboard.myAttempts}
        </h1>
        <p className="text-ink-700">{COPY.dashboard.attemptsSubtitle}</p>
      </header>

      <AttemptList
        items={attempts}
        failed={failed}
        emptyTitle={COPY.dashboard.noAttempts}
        emptyDescription={COPY.dashboard.noAttemptsBody}
        emptyAction={
          <Button asChild>
            <Link href={ROUTES.simulators}>{COPY.dashboard.noAttemptsAction}</Link>
          </Button>
        }
      />

      <p className="text-ink-600 max-w-prose text-xs leading-relaxed">
        {COPY.legal.independenceDisclaimer}
      </p>
    </div>
  );
}
