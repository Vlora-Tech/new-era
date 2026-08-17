import type { Metadata } from 'next';
import Link from 'next/link';

import {
  AttemptList,
  OrderList,
  OwnedProductList,
  type OwnedProduct,
  type StudentAttempt,
  type StudentOrder,
} from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.title };
export const dynamic = 'force-dynamic';

/** How many of the newest attempts and orders the overview repeats. */
const RECENT_LIMIT = 3;

type Overview = {
  entitlements: OwnedProduct[];
  attempts: StudentAttempt[];
  orders: StudentOrder[];
};

export default async function DashboardOverviewPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let overview: Overview | null = null;
  try {
    const [entitlements, attempts, orders] = await Promise.all([
      prisma.entitlement.findMany({
        // Revoked access is deliberately excluded: this section answers "what can
        // I open right now", not "what did I once have".
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { grantedAt: 'desc' },
        select: {
          id: true,
          grantedAt: true,
          product: { select: { slug: true, title: true, shortDescription: true, type: true } },
        },
      }),
      prisma.examAttempt.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
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
      }),
      prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        select: {
          id: true,
          productTitle: true,
          productType: true,
          amountHalalas: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    overview = { entitlements, attempts, orders };
  } catch (error) {
    logger.error('dashboard overview query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.dashboard.welcome}، {user.name}
        </h1>
        <p className="text-ink-700">{COPY.dashboard.overviewSubtitle}</p>
      </header>

      {/*
        A failed query replaces the whole overview rather than each section: with
        one round trip for all three lists there is no partial truth to show, and
        rendering empty sections would claim the student owns nothing.
      */}
      {overview === null ? <ErrorState /> : <OverviewSections overview={overview} />}
    </div>
  );
}

function OverviewSections({ overview }: { overview: Overview }) {
  const courses = overview.entitlements.filter((item) => item.product.type === 'COURSE');
  const simulators = overview.entitlements.filter((item) => item.product.type === 'EXAM_SIMULATOR');

  // Nothing owned at all is a different situation from owning courses but no
  // simulators: it deserves one clear invitation instead of two empty sections.
  if (overview.entitlements.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <EmptyState
          title={COPY.dashboard.noCourses}
          description={COPY.dashboard.noCoursesBody}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href={ROUTES.courses}>{COPY.dashboard.noCoursesAction}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={ROUTES.simulators}>{COPY.dashboard.noSimulatorsAction}</Link>
              </Button>
            </div>
          }
        />

        <RecentOrders orders={overview.orders} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Section title={COPY.dashboard.myCourses} href={ROUTES.dashboardCourses}>
        <OwnedProductList
          items={courses}
          emptyTitle={COPY.dashboard.noCourses}
          emptyDescription={COPY.dashboard.noCoursesBody}
          emptyAction={
            <Button asChild variant="secondary">
              <Link href={ROUTES.courses}>{COPY.dashboard.noCoursesAction}</Link>
            </Button>
          }
        />
      </Section>

      <Section title={COPY.dashboard.mySimulators} href={ROUTES.dashboardSimulators}>
        <OwnedProductList
          items={simulators}
          emptyTitle={COPY.dashboard.noSimulators}
          emptyDescription={COPY.dashboard.noSimulatorsBody}
          emptyAction={
            <Button asChild variant="secondary">
              <Link href={ROUTES.simulators}>{COPY.dashboard.noSimulatorsAction}</Link>
            </Button>
          }
        />
      </Section>

      <Section title={COPY.dashboard.recentAttempts} href={ROUTES.dashboardAttempts}>
        <AttemptList
          items={overview.attempts}
          emptyTitle={COPY.dashboard.noAttempts}
          emptyDescription={COPY.dashboard.noAttemptsBody}
        />
      </Section>

      <RecentOrders orders={overview.orders} />
    </div>
  );
}

function RecentOrders({ orders }: { orders: StudentOrder[] }) {
  return (
    <Section title={COPY.dashboard.recentOrders} href={ROUTES.dashboardOrders}>
      <OrderList
        items={orders}
        emptyTitle={COPY.dashboard.noOrders}
        emptyDescription={COPY.dashboard.noOrdersBody}
      />
    </Section>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-900 text-xl font-semibold">{title}</h2>
        <Link
          href={href}
          className="rounded-control text-brand-700 text-sm font-medium hover:underline"
        >
          {COPY.dashboard.viewAll}
          <span className="sr-only"> — {title}</span>
        </Link>
      </div>
      {children}
    </section>
  );
}
