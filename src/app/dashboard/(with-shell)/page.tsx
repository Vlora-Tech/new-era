import type { Metadata } from 'next';
import Link from 'next/link';

import { ClipboardList, GraduationCap, MonitorPlay, ReceiptText } from 'lucide-react';

import {
  DashboardMasthead,
  JourneyStrip,
  StartHere,
  StatStrip,
  ToneSectionHead,
  type OverviewStats,
} from '@/components/dashboard/overview-surface';
import {
  AttemptList,
  OrderList,
  OwnedProductList,
  type OwnedProduct,
  type StudentAttempt,
  type StudentOrder,
} from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.title };
export const dynamic = 'force-dynamic';

/** How many of the newest attempts and orders the overview repeats. */
const RECENT_LIMIT = 3;

/**
 * Ceiling on the rows scanned to find the best score.
 *
 * Two integers per row and no relations, so this is cheap, but it is still a
 * scan: the ratio `correctCount / totalQuestions` is not a column, so the
 * database cannot order by it and a `MAX` aggregate cannot be asked for. A
 * student past 500 graded attempts sees the best of their most recent 500,
 * which is the only inaccuracy here and is documented rather than silent.
 */
const BEST_SCORE_SCAN_LIMIT = 500;

type Overview = {
  entitlements: OwnedProduct[];
  attempts: StudentAttempt[];
  orders: StudentOrder[];
  /** Every attempt ever started, not just the three repeated below. */
  attemptCount: number;
  /** Best graded attempt as a 0–1 fraction, or null when nothing is graded. */
  bestScore: number | null;
  /** Attempts the student could resume right now. */
  inProgressCount: number;
};

export default async function DashboardOverviewPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let overview: Overview | null = null;
  try {
    const [entitlements, attempts, orders, attemptCount, inProgressCount, gradedAttempts] =
      await Promise.all([
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
        prisma.examAttempt.count({ where: { userId: user.id } }),
        // Read rather than assumed: the strip caption says how many attempts are
        // live, and a fixed sentence there would be the one invented figure on a
        // page whose rule is that every number comes from the database.
        prisma.examAttempt.count({
          where: { userId: user.id, status: { in: ['CREATED', 'IN_PROGRESS'] } },
        }),
        // Only graded rows: an attempt still in progress has no score, and
        // treating its null as a zero would invent a result the student never got.
        prisma.examAttempt.findMany({
          where: { userId: user.id, correctCount: { not: null }, totalQuestions: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          take: BEST_SCORE_SCAN_LIMIT,
          select: { correctCount: true, totalQuestions: true },
        }),
      ]);

    const bestScore = gradedAttempts.reduce<number | null>((best, attempt) => {
      // `correctCount` is non-null by the `where` above; TypeScript cannot see
      // that through a Prisma filter, so the guard stays.
      if (attempt.correctCount === null) return best;
      const ratio = attempt.correctCount / attempt.totalQuestions;
      return best === null || ratio > best ? ratio : best;
    }, null);

    overview = { entitlements, attempts, orders, attemptCount, inProgressCount, bestScore };
  } catch (error) {
    logger.error('dashboard overview query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-10">
      {/*
        The masthead sits outside the error branch: it greets a student by a
        name the guard already returned, so it stays true even when the record
        queries fail, and a failed load still arrives on a page rather than on
        a bare alert.
      */}
      <DashboardMasthead userName={user.name} />

      {/*
        A failed query replaces the whole overview rather than each section: with
        one round trip for all the lists there is no partial truth to show, and
        rendering empty sections — or a strip of zeroes — would claim the student
        owns nothing.
      */}
      {overview === null ? <ErrorState /> : <OverviewSections overview={overview} />}
    </div>
  );
}

function OverviewSections({ overview }: { overview: Overview }) {
  const courses = overview.entitlements.filter((item) => item.product.type === 'COURSE');
  const simulators = overview.entitlements.filter((item) => item.product.type === 'EXAM_SIMULATOR');

  const stats: OverviewStats = {
    courses: courses.length,
    simulators: simulators.length,
    attempts: overview.attemptCount,
    inProgressCount: overview.inProgressCount,
    bestScore: overview.bestScore,
  };

  // Nothing owned at all is a different situation from owning courses but no
  // simulators: it deserves one clear invitation instead of two empty sections.
  const empty = overview.entitlements.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {/*
        The strip is rendered in both states, and its zeroes are the point: an
        account that only acquires colour after a purchase is one nobody comes
        back to. Every figure in it is real — no placeholder progress, and the
        score reads "no result yet" rather than 0%.
      */}
      <StatStrip stats={stats} />

      {empty ? (
        <>
          <StartHere />
          {/* The method, in the same four hues the strip above uses, so the
              colours are already meaningful by the time content arrives. */}
          <JourneyStrip />
        </>
      ) : (
        <>
          <Section
            tone="brand"
            icon={GraduationCap}
            title={COPY.dashboard.myCourses}
            href={ROUTES.dashboardCourses}
          >
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

          <Section
            tone="teal"
            icon={MonitorPlay}
            title={COPY.dashboard.mySimulators}
            href={ROUTES.dashboardSimulators}
          >
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

          <Section
            tone="gold"
            icon={ClipboardList}
            title={COPY.dashboard.recentAttempts}
            href={ROUTES.dashboardAttempts}
          >
            <AttemptList
              items={overview.attempts}
              emptyTitle={COPY.dashboard.noAttempts}
              emptyDescription={COPY.dashboard.noAttemptsBody}
            />
          </Section>
        </>
      )}

      <RecentOrders orders={overview.orders} />
    </div>
  );
}

function RecentOrders({ orders }: { orders: StudentOrder[] }) {
  return (
    <Section
      tone="neutral"
      icon={ReceiptText}
      title={COPY.dashboard.recentOrders}
      href={ROUTES.dashboardOrders}
    >
      <OrderList
        items={orders}
        emptyTitle={COPY.dashboard.noOrders}
        emptyDescription={COPY.dashboard.noOrdersBody}
      />
    </Section>
  );
}

function Section({
  tone,
  icon,
  title,
  href,
  children,
}: {
  tone: React.ComponentProps<typeof ToneSectionHead>['tone'];
  icon: React.ComponentProps<typeof ToneSectionHead>['icon'];
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <ToneSectionHead tone={tone} icon={icon} title={title} href={href} />
      {children}
    </section>
  );
}
