import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ExamResults } from '@/components/exam/exam-results';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import {
  loadAttemptReview,
  type AttemptResultSummary,
} from '@/services/exams/attempt-scoring.service';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';

export const metadata: Metadata = {
  title: COPY.exam.resultsTitle,
  // A page containing answer keys has no business in a search index.
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The review, which may show correct answers — but only once the attempt is
 * genuinely over.
 *
 * Resolving the clock first is what makes an abandoned attempt reviewable
 * without a background job: the deadlines have passed, so the request that asks
 * for the results is also the request that finalises and scores them. A still
 * running attempt is not redirected into its workspace but told plainly that
 * the review is not ready, so a shared link cannot pull someone back into a
 * timed section they were not in.
 */
export default async function ExamResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUserPage(`/exam/${attemptId}/results`);

  await resolveAttemptClock(attemptId);

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      totalQuestions: true,
      correctCount: true,
      incorrectCount: true,
      unansweredCount: true,
      resultSummary: true,
      settingsSnapshot: true,
    },
  });

  if (!attempt || attempt.userId !== user.id) notFound();

  if (attempt.status !== 'SUBMITTED' && attempt.status !== 'EXPIRED') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          title={COPY.exam.resultsPendingTitle}
          description={COPY.exam.resultsPendingBody}
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/attempts">{COPY.exam.backToAttempts}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const settings = isRecord(attempt.settingsSnapshot) ? attempt.settingsSnapshot : {};
  const summary = isRecord(attempt.resultSummary)
    ? (attempt.resultSummary as unknown as AttemptResultSummary)
    : null;

  const sections = await loadAttemptReview(prisma, attemptId);

  return (
    <ExamResults
      simulatorTitle={typeof settings.simulatorTitle === 'string' ? settings.simulatorTitle : ''}
      summary={summary}
      sections={sections}
      totals={{
        total: attempt.totalQuestions,
        correct: attempt.correctCount ?? 0,
        incorrect: attempt.incorrectCount ?? 0,
        unanswered: attempt.unansweredCount ?? 0,
      }}
      resultDisclaimer={
        typeof settings.resultDisclaimer === 'string' ? settings.resultDisclaimer : ''
      }
    />
  );
}
