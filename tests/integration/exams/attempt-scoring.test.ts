import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { saveAnswer } from '@/services/exams/attempt-answer.service';
import {
  advanceSection,
  createAttempt,
  startAttempt,
  submitAttempt,
} from '@/services/exams/attempt-lifecycle.service';
import type { AttemptResultSummary } from '@/services/exams/attempt-scoring.service';

import { cleanupExamFixtures, createExamFixture, loadAttemptPaper } from './helpers';

/**
 * Submission and scoring.
 *
 * Two things are asserted beyond the arithmetic: that a replayed submission
 * returns the stored result rather than recomputing it, and that the summary
 * contains nothing resembling an official score. The second is a product
 * constraint, not a stylistic one — a percentile or a pass/fail here would be a
 * claim the platform has no standing to make.
 */
afterAll(async () => {
  await cleanupExamFixtures();
});

const QUESTIONS_PER_SECTION = 4;

async function runningAttempt(sections = 2) {
  const fixture = await createExamFixture({
    sections,
    questionsPerSection: QUESTIONS_PER_SECTION,
    sectionDurationSec: 1_800,
    bankPerDomain: sections * QUESTIONS_PER_SECTION,
  });
  const { attemptId } = await createAttempt({
    userId: fixture.userId,
    simulatorId: fixture.simulatorId,
    mode: 'FULL_SIMULATION',
    actorRole: 'STUDENT',
  });
  await startAttempt(attemptId, fixture.userId);
  return { fixture, attemptId };
}

describe('submitAttempt', () => {
  it('counts correct, incorrect and unanswered questions', async () => {
    const { fixture, attemptId } = await runningAttempt(2);
    const paper = await loadAttemptPaper(attemptId);
    // Only the live section accepts answers, so section two stays untouched —
    // which is also the case that proves unanswered questions are counted.
    const questions = paper[0]!.questions;

    for (const [index, question] of questions.entries()) {
      const options = (question.contentSnapshot as { options: Array<{ key: string }> }).options;
      const wrongKey = options.find((option) => option.key !== question.correctOptionKey)!.key;

      await saveAnswer({
        attemptId,
        attemptQuestionId: question.id,
        userId: fixture.userId,
        selectedOptionKey: index < 2 ? question.correctOptionKey : wrongKey,
        flagged: false,
        saveVersion: 0,
      });
    }

    const result = await submitAttempt(attemptId, fixture.userId);

    expect(result.status).toBe('SUBMITTED');
    expect(result.finalised).toBe(true);
    expect(result.summary?.totals).toMatchObject({
      total: 8,
      correct: 2,
      incorrect: 2,
      unanswered: 4,
    });

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { correctCount: true, incorrectCount: true, unansweredCount: true },
    });
    expect(attempt).toEqual({ correctCount: 2, incorrectCount: 2, unansweredCount: 4 });

    // Per-answer correctness is written at submission, never before.
    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptQuestion: { attemptSection: { examAttemptId: attemptId } } },
      select: { isCorrect: true },
    });
    expect(answers.filter((answer) => answer.isCorrect === true)).toHaveLength(2);
    expect(answers.filter((answer) => answer.isCorrect === false)).toHaveLength(2);
  });

  it('locks every remaining section and records why', async () => {
    const { fixture, attemptId } = await runningAttempt(3);

    await submitAttempt(attemptId, fixture.userId);

    const paper = await loadAttemptPaper(attemptId);
    for (const section of paper) {
      expect(section.status).toBe('LOCKED');
      expect(section.lockedReason).toBe('FINALIZED');
    }
  });

  it('returns the same result when submitted twice', async () => {
    const { fixture, attemptId } = await runningAttempt(1);

    const first = await submitAttempt(attemptId, fixture.userId);
    const second = await submitAttempt(attemptId, fixture.userId);

    expect(first.finalised).toBe(true);
    // The replay reports that it changed nothing, and reports the same figures.
    expect(second.finalised).toBe(false);
    expect(second.status).toBe('SUBMITTED');
    expect(second.submittedAt?.getTime()).toBe(first.submittedAt?.getTime());
    expect(second.summary?.computedAt).toBe(first.summary?.computedAt);
    expect(second.summary?.totals).toEqual(first.summary?.totals);
  });

  it('produces the same result under a concurrent double submit', async () => {
    const { fixture, attemptId } = await runningAttempt(1);

    const [a, b] = await Promise.all([
      submitAttempt(attemptId, fixture.userId),
      submitAttempt(attemptId, fixture.userId),
    ]);

    expect(a.status).toBe('SUBMITTED');
    expect(b.status).toBe('SUBMITTED');
    expect(a.submittedAt?.getTime()).toBe(b.submittedAt?.getTime());
    // Exactly one of the two did the work.
    expect([a.finalised, b.finalised].filter(Boolean)).toHaveLength(1);
  });

  it('breaks results down by domain and by subskill', async () => {
    const { fixture, attemptId } = await runningAttempt(2);
    const paper = await loadAttemptPaper(attemptId);

    // Worked through the way a student would: answer, advance, answer again.
    for (const [index, section] of paper.entries()) {
      for (const question of section.questions) {
        await saveAnswer({
          attemptId,
          attemptQuestionId: question.id,
          userId: fixture.userId,
          selectedOptionKey: question.correctOptionKey,
          flagged: false,
          saveVersion: 0,
        });
      }
      if (index < paper.length - 1) {
        await advanceSection({ attemptId, attemptSectionId: section.id, userId: fixture.userId });
      }
    }

    const result = await submitAttempt(attemptId, fixture.userId);
    const summary = result.summary!;

    expect(summary.totals.correct).toBe(8);
    expect(summary.totals.accuracy).toBe(1);

    // *Which* skills appear is not this suite's to say: a section draws its
    // count from the whole bank, so a paper may hold another worker's questions.
    // What must hold is that the grouping accounts for every question exactly
    // once and agrees with the totals above.
    expect(summary.domains.length).toBeGreaterThan(0);
    expect(summary.domains.reduce((sum, domain) => sum + domain.total, 0)).toBe(8);
    for (const domain of summary.domains) {
      expect(domain.accuracy).toBe(1);
    }

    // Only questions that carry a sub-skill are grouped by one, so this is a
    // subset of the paper rather than all of it.
    expect(summary.subskills.reduce((sum, entry) => sum + entry.total, 0)).toBeLessThanOrEqual(8);
    for (const entry of summary.subskills) {
      expect(entry.subskill).toBeTruthy();
    }

    expect(summary.sections).toHaveLength(2);
    for (const section of summary.sections) {
      expect(section.elapsedSec).not.toBeNull();
      expect(section.allowedSec).toBe(1_800);
    }
  });

  it('labels the result as training analytics and computes nothing score-like', async () => {
    const { fixture, attemptId } = await runningAttempt(1);
    const result = await submitAttempt(attemptId, fixture.userId);

    const summary = result.summary as AttemptResultSummary;
    expect(summary.kind).toBe('training');
    expect(summary.label).toBe('نتيجة تدريبية');
    expect(summary.disclaimer).toContain('مستقلة');

    // Nothing in the stored JSON may read as an official score, a rank or a
    // prediction — including as a key a future consumer might pick up.
    const serialised = JSON.stringify(summary).toLowerCase();
    for (const forbidden of [
      'percentile',
      'passed',
      'pass_fail',
      'passfail',
      'grade',
      'rank',
      'percentileband',
      'prediction',
      'predicted',
      'officialscore',
      'admission',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('refuses to submit an attempt that has not started', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    const { attemptId } = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });

    await expect(submitAttempt(attemptId, fixture.userId)).rejects.toMatchObject({
      status: 409,
      code: 'attempt_not_started',
    });
  });
});
