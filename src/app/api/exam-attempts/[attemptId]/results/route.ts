import { apiFailure, apiSuccess, routeHandler } from '@/lib/api';
import { requireAuth } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import { loadAttemptReview } from '@/services/exams/attempt-scoring.service';

export const runtime = 'nodejs';

/**
 * The training review.
 *
 * This is the one endpoint permitted to return correct answers and
 * explanations, and it establishes the precondition itself rather than
 * inheriting it: the attempt must be `SUBMITTED` or `EXPIRED`. Resolving the
 * clock first is what makes an abandoned attempt reviewable — the section
 * deadlines have passed, so the request that asks for the results is also the
 * request that finalises them.
 *
 * A still-running attempt is refused. There is no query parameter, header or
 * role that relaxes that: an administrator wanting to inspect a live paper uses
 * the admin tooling, not a student's review endpoint.
 */
export const GET = routeHandler(
  'GET /api/exam-attempts/[attemptId]/results',
  async (_request, context: { params: Promise<{ attemptId: string }> }) => {
    const user = await requireAuth();
    await enforceRateLimit('examAttemptRead', user.id);

    const { attemptId } = await context.params;
    await resolveAttemptClock(attemptId);

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        status: true,
        mode: true,
        submittedAt: true,
        totalQuestions: true,
        correctCount: true,
        incorrectCount: true,
        unansweredCount: true,
        resultSummary: true,
        settingsSnapshot: true,
      },
    });

    if (!attempt || attempt.userId !== user.id) {
      return apiFailure(404, 'attempt_not_found', COPY.exam.errors.attemptNotFound);
    }

    if (attempt.status !== 'SUBMITTED' && attempt.status !== 'EXPIRED') {
      return apiFailure(409, 'results_not_ready', COPY.exam.errors.resultsNotReady);
    }

    const sections = await loadAttemptReview(prisma, attemptId);

    return apiSuccess({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        mode: attempt.mode,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        unansweredCount: attempt.unansweredCount,
      },
      // Labelled at the source: every consumer of this payload sees that it is
      // training analytics, not a score.
      resultLabel: COPY.legal.trainingResultLabel,
      summary: attempt.resultSummary,
      sections,
    });
  },
);
