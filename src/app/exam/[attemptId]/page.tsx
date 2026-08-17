import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ExamInstructions, type InstructionsSection } from '@/components/exam/exam-instructions';
import { ExamWorkspace } from '@/components/exam/exam-workspace';
import { requireUserPage } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import { loadStudentAttemptState } from '@/services/exams/attempt-snapshot.service';

export const metadata: Metadata = { title: COPY.dashboard.myAttempts, robots: { index: false } };
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read the structure the attempt froze at creation, for the instructions screen. */
function readSettings(value: unknown): {
  simulatorTitle: string;
  totalQuestions: number;
  totalDurationSec: number;
  resultDisclaimer: string;
  sections: InstructionsSection[];
} {
  const settings = isRecord(value) ? value : {};
  const rawSections = Array.isArray(settings.sections) ? settings.sections : [];

  const sections: InstructionsSection[] = [];
  for (const raw of rawSections) {
    if (!isRecord(raw)) continue;
    sections.push({
      position: typeof raw.position === 'number' ? raw.position : sections.length + 1,
      title: typeof raw.title === 'string' ? raw.title : '',
      durationSec: typeof raw.durationSec === 'number' ? raw.durationSec : 0,
      questionCount: typeof raw.questionCount === 'number' ? raw.questionCount : 0,
    });
  }

  return {
    simulatorTitle: typeof settings.simulatorTitle === 'string' ? settings.simulatorTitle : '',
    totalQuestions: typeof settings.totalQuestions === 'number' ? settings.totalQuestions : 0,
    totalDurationSec: typeof settings.totalDurationSec === 'number' ? settings.totalDurationSec : 0,
    resultDisclaimer:
      typeof settings.resultDisclaimer === 'string' ? settings.resultDisclaimer : '',
    sections,
  };
}

/**
 * One route, three states.
 *
 * `CREATED` shows the instructions and nothing else; the attempt exists but no
 * clock is running. `IN_PROGRESS` renders the workspace. Anything terminal
 * redirects to the review — a submitted attempt has no working screen, and
 * leaving one reachable is how a stale tab ends up posting into a finished exam.
 *
 * The clock is resolved before the branch is chosen, so an attempt whose last
 * section expired while the tab was closed lands on its results rather than on
 * a workspace it would immediately have to abandon.
 */
export default async function ExamAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUserPage(`/exam/${attemptId}`);

  const now = new Date();
  await resolveAttemptClock(attemptId, now);

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, status: true, settingsSnapshot: true },
  });

  // An attempt belonging to someone else is indistinguishable from one that
  // does not exist.
  if (!attempt || attempt.userId !== user.id) notFound();

  if (attempt.status === 'CREATED') {
    const settings = readSettings(attempt.settingsSnapshot);
    return (
      <ExamInstructions
        attemptId={attempt.id}
        simulatorTitle={settings.simulatorTitle}
        sections={settings.sections}
        totalQuestions={settings.totalQuestions}
        totalDurationSec={settings.totalDurationSec}
        resultDisclaimer={settings.resultDisclaimer}
      />
    );
  }

  if (attempt.status !== 'IN_PROGRESS') redirect(`/exam/${attemptId}/results`);

  const state = await loadStudentAttemptState(prisma, {
    attemptId,
    userId: user.id,
    serverTime: now,
  });
  if (!state) notFound();

  return <ExamWorkspace initialState={state} />;
}
