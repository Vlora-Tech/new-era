import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import { createAttempt, startAttempt } from '@/services/exams/attempt-lifecycle.service';

import { cleanupExamFixtures, createExamFixture, loadAttemptPaper } from './helpers';

/**
 * The clock, including the case the product exists to get right: a student who
 * disappears for an hour.
 *
 * The property under test is that offline time is never returned as exam time.
 * A section that expires while nobody is looking must be recorded as having
 * ended at its own deadline, and the section after it must begin there — not at
 * the moment the server happened to notice.
 */
afterAll(async () => {
  await cleanupExamFixtures();
});

const SECTION_SEC = 60;

async function startedAttempt(startAt: Date, sections = 3) {
  const fixture = await createExamFixture({
    sections,
    questionsPerSection: 4,
    sectionDurationSec: SECTION_SEC,
    bankPerDomain: sections * 4,
  });

  const { attemptId } = await createAttempt({
    userId: fixture.userId,
    simulatorId: fixture.simulatorId,
    mode: 'FULL_SIMULATION',
    actorRole: 'STUDENT',
  });

  await startAttempt(attemptId, fixture.userId, startAt);
  return { fixture, attemptId };
}

describe('resolveAttemptClock', () => {
  it('does nothing while the active section still has time', async () => {
    const start = new Date('2026-03-01T08:00:00.000Z');
    const { attemptId } = await startedAttempt(start);

    const state = await resolveAttemptClock(attemptId, new Date(start.getTime() + 30_000));

    expect(state?.status).toBe('IN_PROGRESS');
    expect(state?.activeSection?.position).toBe(1);
    expect(state?.changed).toBe(false);
  });

  it('locks an expired section at its stored deadline, not at the moment noticed', async () => {
    const start = new Date('2026-03-01T09:00:00.000Z');
    const { attemptId } = await startedAttempt(start);

    // Noticed a full ten minutes after the section actually ended.
    await resolveAttemptClock(attemptId, new Date(start.getTime() + 70_000 + 600_000));

    const paper = await loadAttemptPaper(attemptId);
    const first = paper[0]!;

    expect(first.status).toBe('LOCKED');
    expect(first.lockedReason).toBe('EXPIRED');
    expect(first.lockedAt?.toISOString()).toBe(
      new Date(start.getTime() + SECTION_SEC * 1_000).toISOString(),
    );
  });

  it('chains sections from the previous deadline so offline time is not returned', async () => {
    const start = new Date('2026-03-01T10:00:00.000Z');
    const { attemptId } = await startedAttempt(start, 3);

    // Away for 130 seconds: sections 1 and 2 are both over.
    const state = await resolveAttemptClock(attemptId, new Date(start.getTime() + 130_000));

    expect(state?.status).toBe('IN_PROGRESS');
    expect(state?.activeSection?.position).toBe(3);

    const paper = await loadAttemptPaper(attemptId);
    const [first, second, third] = paper;

    expect(first!.lockedAt?.getTime()).toBe(start.getTime() + 60_000);
    expect(second!.startedAt?.getTime()).toBe(start.getTime() + 60_000);
    expect(second!.lockedAt?.getTime()).toBe(start.getTime() + 120_000);

    // Section three begins where section two ended. Starting it at "now"
    // (start + 130s) would have handed back the ten seconds spent offline.
    expect(third!.startedAt?.getTime()).toBe(start.getTime() + 120_000);
    expect(third!.deadlineAt?.getTime()).toBe(start.getTime() + 180_000);
  });

  it('never extends the total time beyond the sum of the sections', async () => {
    const start = new Date('2026-03-01T11:00:00.000Z');
    const { attemptId } = await startedAttempt(start, 3);

    // Gone for an hour against a three-minute exam.
    await resolveAttemptClock(attemptId, new Date(start.getTime() + 3_600_000));

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, submittedAt: true, correctCount: true, resultSummary: true },
    });

    expect(attempt.status).toBe('EXPIRED');
    // The attempt ended when the last section's deadline passed.
    expect(attempt.submittedAt?.getTime()).toBe(start.getTime() + 180_000);
    expect(attempt.correctCount).not.toBeNull();
    expect(attempt.resultSummary).not.toBeNull();

    const paper = await loadAttemptPaper(attemptId);
    const totalOpenMs = paper.reduce(
      (sum, section) =>
        sum + ((section.lockedAt?.getTime() ?? 0) - (section.startedAt?.getTime() ?? 0)),
      0,
    );
    expect(totalOpenMs).toBe(3 * SECTION_SEC * 1_000);
  });

  it('is idempotent under concurrent calls', async () => {
    const start = new Date('2026-03-01T12:00:00.000Z');
    const { attemptId } = await startedAttempt(start, 2);
    const later = new Date(start.getTime() + 500_000);

    const states = await Promise.all([
      resolveAttemptClock(attemptId, later),
      resolveAttemptClock(attemptId, later),
      resolveAttemptClock(attemptId, later),
    ]);

    for (const state of states) expect(state?.status).toBe('EXPIRED');

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { submittedAt: true, resultSummary: true },
    });
    expect(attempt.submittedAt?.getTime()).toBe(start.getTime() + 120_000);

    // Re-resolving after the fact must not re-score or move the finalisation.
    const summary = JSON.stringify(attempt.resultSummary);
    await resolveAttemptClock(attemptId, new Date(start.getTime() + 900_000));
    const again = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { submittedAt: true, resultSummary: true },
    });
    expect(again.submittedAt?.getTime()).toBe(start.getTime() + 120_000);
    expect(JSON.stringify(again.resultSummary)).toBe(summary);
  });

  it('reports section times from the stored timestamps, not from presence', async () => {
    const start = new Date('2026-03-01T13:00:00.000Z');
    const { attemptId } = await startedAttempt(start, 2);

    await resolveAttemptClock(attemptId, new Date(start.getTime() + 3_600_000));

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { resultSummary: true },
    });
    const summary = attempt.resultSummary as unknown as {
      finalisedBy: string;
      sections: Array<{ elapsedSec: number | null; allowedSec: number | null }>;
    };

    expect(summary.finalisedBy).toBe('EXPIRED');
    for (const section of summary.sections) {
      expect(section.elapsedSec).toBe(SECTION_SEC);
      expect(section.allowedSec).toBe(SECTION_SEC);
    }
  });
});

describe('startAttempt', () => {
  it('is idempotent and does not restart the clock', async () => {
    const start = new Date('2026-03-01T14:00:00.000Z');
    const { fixture, attemptId } = await startedAttempt(start, 2);

    const replay = await startAttempt(
      attemptId,
      fixture.userId,
      new Date(start.getTime() + 30_000),
    );

    expect(replay.started).toBe(false);
    expect(replay.startedAt?.getTime()).toBe(start.getTime());

    const paper = await loadAttemptPaper(attemptId);
    expect(paper[0]!.deadlineAt?.getTime()).toBe(start.getTime() + SECTION_SEC * 1_000);
  });

  it('sets maxEndAt to the sum of every section duration', async () => {
    const start = new Date('2026-03-01T15:00:00.000Z');
    const { attemptId } = await startedAttempt(start, 3);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { maxEndAt: true },
    });
    expect(attempt.maxEndAt?.getTime()).toBe(start.getTime() + 3 * SECTION_SEC * 1_000);
  });
});
