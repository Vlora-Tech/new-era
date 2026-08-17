import type { Metadata } from 'next';

import { Card, EmptyState, ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.admin.overview };

type CountRow = { key: string; label: string; value: number };

/**
 * The only real data on this screen: eight counts, read in one transaction so
 * they describe a single consistent moment rather than eight different ones.
 *
 * Nothing here is derived, projected or compared against a previous period. A
 * count is a fact; a trend line drawn over two of them would not be.
 */
async function loadCounts(): Promise<CountRow[]> {
  const labels = COPY.adminPages.counts;

  const [
    publishedProducts,
    draftProducts,
    students,
    publishedQuestions,
    inReviewQuestions,
    draftQuestions,
    paidOrders,
    pendingOrders,
  ] = await prisma.$transaction([
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.question.count({ where: { workflow: 'PUBLISHED' } }),
    prisma.question.count({ where: { workflow: 'IN_REVIEW' } }),
    prisma.question.count({ where: { workflow: 'DRAFT' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
  ]);

  return [
    { key: 'publishedProducts', label: labels.publishedProducts, value: publishedProducts },
    { key: 'draftProducts', label: labels.draftProducts, value: draftProducts },
    { key: 'students', label: labels.students, value: students },
    { key: 'publishedQuestions', label: labels.publishedQuestions, value: publishedQuestions },
    { key: 'inReviewQuestions', label: labels.inReviewQuestions, value: inReviewQuestions },
    { key: 'draftQuestions', label: labels.draftQuestions, value: draftQuestions },
    { key: 'paidOrders', label: labels.paidOrders, value: paidOrders },
    { key: 'pendingOrders', label: labels.pendingOrders, value: pendingOrders },
  ];
}

export default async function AdminOverviewPage() {
  // A failed query becomes an error panel, never a row of zeros: a zero here is
  // indistinguishable from "the platform genuinely has none of these".
  let counts: CountRow[] | null = null;
  try {
    counts = await loadCounts();
  } catch (error) {
    logger.error('admin overview counts failed', { error });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold">{COPY.admin.overview}</h1>
        <p className="text-ink-700 max-w-prose">{COPY.adminPages.overviewDescription}</p>
      </header>

      {counts ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-ink-900 text-lg font-semibold">{COPY.adminPages.counts.title}</h2>
          <p className="text-ink-700 mt-1 max-w-prose text-sm">{COPY.adminPages.counts.note}</p>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {counts.map((row) => (
              <div
                key={row.key}
                className="rounded-panel border-line-200 bg-surface-muted border px-4 py-3"
              >
                <dt className="text-ink-700 text-sm">{row.label}</dt>
                <dd className="text-ink-900 mt-1 text-2xl font-semibold">
                  {formatNumber(row.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : (
        <ErrorState />
      )}

      <EmptyState
        title={COPY.adminPages.overviewRestTitle}
        description={COPY.adminPages.overviewRestBody}
      />
    </div>
  );
}
