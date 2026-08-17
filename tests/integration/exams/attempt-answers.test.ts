import { afterAll, describe, expect, it } from 'vitest';

import { HttpError } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { saveAnswer } from '@/services/exams/attempt-answer.service';
import {
  advanceSection,
  createAttempt,
  startAttempt,
} from '@/services/exams/attempt-lifecycle.service';

import { cleanupExamFixtures, createExamFixture, loadAttemptPaper } from './helpers';

/**
 * Autosave and the section boundary.
 *
 * The two properties here are the ones a student would notice if they broke: a
 * second tab must not silently overwrite the first, and a section that has been
 * advanced past must refuse writes no matter how the request is constructed.
 */
afterAll(async () => {
  await cleanupExamFixtures();
});

async function runningAttempt(sections = 2) {
  const fixture = await createExamFixture({
    sections,
    questionsPerSection: 4,
    sectionDurationSec: 900,
    bankPerDomain: sections * 4,
  });
  const { attemptId } = await createAttempt({
    userId: fixture.userId,
    simulatorId: fixture.simulatorId,
    mode: 'FULL_SIMULATION',
    actorRole: 'STUDENT',
  });
  await startAttempt(attemptId, fixture.userId);
  const paper = await loadAttemptPaper(attemptId);
  return { fixture, attemptId, paper };
}

describe('saveAnswer', () => {
  it('stores a first answer and increments the save version', async () => {
    const { fixture, attemptId, paper } = await runningAttempt();
    const question = paper[0]!.questions[0]!;
    const option = (question.contentSnapshot as { options: Array<{ key: string }> }).options[1]!;

    const result = await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: option.key,
      flagged: false,
      saveVersion: 0,
    });

    expect(result.outcome).toBe('saved');
    expect(result.state.saveVersion).toBe(1);
    expect(result.state.selectedOptionKey).toBe(option.key);
    expect(result.state.savedAt).not.toBeNull();
  });

  it('rejects a stale save version and returns the current server state', async () => {
    const { fixture, attemptId, paper } = await runningAttempt();
    const question = paper[0]!.questions[0]!;
    const options = (question.contentSnapshot as { options: Array<{ key: string }> }).options;

    await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: options[0]!.key,
      flagged: false,
      saveVersion: 0,
    });

    // A second tab that still believes nothing has been saved.
    const stale = await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: options[1]!.key,
      flagged: true,
      saveVersion: 0,
    });

    expect(stale.outcome).toBe('conflict');
    // The response describes what the server holds, so the stale tab can rebase
    // rather than guess.
    expect(stale.state.saveVersion).toBe(1);
    expect(stale.state.selectedOptionKey).toBe(options[0]!.key);
    expect(stale.state.flagged).toBe(false);

    const stored = await prisma.attemptAnswer.findUniqueOrThrow({
      where: { attemptQuestionId: question.id },
      select: { selectedOptionKey: true, saveVersion: true },
    });
    expect(stored.selectedOptionKey).toBe(options[0]!.key);
    expect(stored.saveVersion).toBe(1);
  });

  it('accepts a save that states the current version', async () => {
    const { fixture, attemptId, paper } = await runningAttempt();
    const question = paper[0]!.questions[0]!;
    const options = (question.contentSnapshot as { options: Array<{ key: string }> }).options;

    await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: options[0]!.key,
      flagged: false,
      saveVersion: 0,
    });

    const updated = await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: options[2]!.key,
      flagged: true,
      saveVersion: 1,
    });

    expect(updated.outcome).toBe('saved');
    expect(updated.state.saveVersion).toBe(2);
    expect(updated.state.selectedOptionKey).toBe(options[2]!.key);
    expect(updated.state.flagged).toBe(true);
  });

  it('refuses an option key that belongs to another question', async () => {
    const { fixture, attemptId, paper } = await runningAttempt();
    const question = paper[0]!.questions[0]!;
    const other = paper[0]!.questions[1]!;
    const foreignKey = (other.contentSnapshot as { options: Array<{ key: string }> }).options[0]!
      .key;

    await expect(
      saveAnswer({
        attemptId,
        attemptQuestionId: question.id,
        userId: fixture.userId,
        selectedOptionKey: foreignKey,
        flagged: false,
        saveVersion: 0,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_option' });
  });

  it('refuses a save from someone who does not own the attempt', async () => {
    const { attemptId, paper } = await runningAttempt();
    const other = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    const question = paper[0]!.questions[0]!;

    await expect(
      saveAnswer({
        attemptId,
        attemptQuestionId: question.id,
        userId: other.userId,
        selectedOptionKey: null,
        flagged: true,
        saveVersion: 0,
      }),
      // 404 rather than 403: confirming the id exists would be an enumeration
      // oracle, and there is nothing they could do with the distinction.
    ).rejects.toMatchObject({ status: 404 });
  });

  it('clamps a client-reported time rather than trusting it', async () => {
    const { fixture, attemptId, paper } = await runningAttempt();
    const question = paper[0]!.questions[0]!;

    await saveAnswer({
      attemptId,
      attemptQuestionId: question.id,
      userId: fixture.userId,
      selectedOptionKey: null,
      flagged: false,
      saveVersion: 0,
      timeSpentSeconds: 999_999_999,
    });

    const stored = await prisma.attemptAnswer.findUniqueOrThrow({
      where: { attemptQuestionId: question.id },
      select: { timeSpentSeconds: true },
    });
    expect(stored.timeSpentSeconds).toBe(86_400);
  });
});

describe('advanceSection', () => {
  it('is irreversible: the locked section refuses further saves', async () => {
    const { fixture, attemptId, paper } = await runningAttempt(2);
    const first = paper[0]!;
    const question = first.questions[0]!;
    const optionKey = (question.contentSnapshot as { options: Array<{ key: string }> }).options[0]!
      .key;

    const result = await advanceSection({
      attemptId,
      attemptSectionId: first.id,
      userId: fixture.userId,
    });
    expect(result.outcome).toBe('advanced');

    const after = await loadAttemptPaper(attemptId);
    expect(after[0]!.status).toBe('LOCKED');
    expect(after[0]!.lockedReason).toBe('ADVANCED');
    expect(after[1]!.status).toBe('IN_PROGRESS');

    // The service the API calls is what refuses; the dialog in the browser is
    // only a courtesy.
    await expect(
      saveAnswer({
        attemptId,
        attemptQuestionId: question.id,
        userId: fixture.userId,
        selectedOptionKey: optionKey,
        flagged: false,
        saveVersion: 0,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'section_locked' });
  });

  it('rejects a second advance of the same section', async () => {
    const { fixture, attemptId, paper } = await runningAttempt(3);
    const first = paper[0]!;

    await advanceSection({ attemptId, attemptSectionId: first.id, userId: fixture.userId });

    let thrown: unknown;
    try {
      await advanceSection({ attemptId, attemptSectionId: first.id, userId: fixture.userId });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(409);
    expect((thrown as HttpError).code).toBe('section_locked');

    // The attempt did not skip ahead: section two is still the live one.
    const after = await loadAttemptPaper(attemptId);
    expect(after[1]!.status).toBe('IN_PROGRESS');
    expect(after[2]!.status).toBe('PENDING');
  });

  it('finalises the attempt when the last section is advanced past', async () => {
    const { fixture, attemptId, paper } = await runningAttempt(1);

    const result = await advanceSection({
      attemptId,
      attemptSectionId: paper[0]!.id,
      userId: fixture.userId,
    });

    expect(result.outcome).toBe('submitted');

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, resultSummary: true },
    });
    expect(attempt.status).toBe('SUBMITTED');
    expect(attempt.resultSummary).not.toBeNull();
  });
});
