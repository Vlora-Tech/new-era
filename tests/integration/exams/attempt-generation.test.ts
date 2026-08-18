import { afterAll, describe, expect, it } from 'vitest';

import { HttpError } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAttempt } from '@/services/exams/attempt-lifecycle.service';

import { cleanupExamFixtures, createExamFixture, loadAttemptPaper } from './helpers';

/**
 * Attempt generation against a real database.
 *
 * The properties asserted here are the ones a unit test cannot reach: that the
 * transaction leaves nothing behind when it aborts, that the snapshot is a copy
 * and not a view, and that the partial unique index really does make a
 * double-click idempotent.
 */
afterAll(async () => {
  await cleanupExamFixtures();
});

describe('createAttempt', () => {
  it('builds a paper that matches the blueprint with no repeated question', async () => {
    const fixture = await createExamFixture({
      sections: 3,
      questionsPerSection: 6,
      bankPerDomain: 20,
    });

    const { attemptId, created } = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });

    expect(created).toBe(true);

    const paper = await loadAttemptPaper(attemptId);
    expect(paper).toHaveLength(3);

    const allQuestionIds: string[] = [];
    for (const section of paper) {
      expect(section.questions).toHaveLength(6);
      expect(section.status).toBe('PENDING');
      // No clock until the attempt is started; generation must not cost time.
      expect(section.startedAt).toBeNull();
      expect(section.deadlineAt).toBeNull();

      const byDomain = new Map<string, number>();
      for (const question of section.questions) {
        byDomain.set(question.domain, (byDomain.get(question.domain) ?? 0) + 1);
        allQuestionIds.push(question.questionId);
      }
      // Two domains at 50% each over six questions.
      expect(byDomain.get('ARITHMETIC')).toBe(3);
      expect(byDomain.get('ALGEBRA')).toBe(3);

      // Positions are dense and one-based, so "question 3 of 6" is meaningful.
      expect(section.questions.map((question) => question.position)).toEqual([1, 2, 3, 4, 5, 6]);
    }

    expect(allQuestionIds).toHaveLength(18);
    expect(new Set(allQuestionIds).size).toBe(18);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, seed: true, startedAt: true, totalQuestions: true },
    });
    expect(attempt.status).toBe('CREATED');
    expect(attempt.startedAt).toBeNull();
    expect(attempt.totalQuestions).toBe(18);
    // The seed is stored, which is what makes the selection reproducible later.
    expect(Number.isInteger(attempt.seed)).toBe(true);
  });

  it('detaches the snapshot from the source question', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    const { attemptId } = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });

    const before = await loadAttemptPaper(attemptId);
    const delivered = before[0]!.questions[0]!;

    // Edit the source in every way an administrator could: the live row, its
    // options, the frozen version, and the workflow state.
    await prisma.question.update({
      where: { id: delivered.questionId },
      data: {
        stem: { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'نص مُعدَّل' }] }] },
        workflow: 'RETIRED',
        retiredAt: new Date(),
      },
    });
    await prisma.questionOption.updateMany({
      where: { questionId: delivered.questionId },
      data: {
        content: {
          blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'خيار مُعدَّل' }] }],
        },
      },
    });
    await prisma.questionVersion.updateMany({
      where: { questionId: delivered.questionId },
      data: { snapshot: { stem: null, options: [], correctOptionKey: 'moved' } },
    });

    const after = await loadAttemptPaper(attemptId);
    const stillDelivered = after[0]!.questions[0]!;

    expect(stillDelivered.contentSnapshot).toEqual(delivered.contentSnapshot);
    expect(stillDelivered.correctOptionKey).toBe(delivered.correctOptionKey);
    expect(JSON.stringify(stillDelivered.contentSnapshot)).not.toContain('مُعدَّل');
  });

  it('returns the existing live attempt instead of creating a second one', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });

    const first = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });
    const second = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });

    expect(second.attemptId).toBe(first.attemptId);
    expect(second.created).toBe(false);

    const count = await prisma.examAttempt.count({ where: { userId: fixture.userId } });
    expect(count).toBe(1);
  });

  it('creates exactly one attempt when two requests race', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });

    const results = await Promise.all([
      createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      }),
      createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      }),
    ]);

    expect(results[0].attemptId).toBe(results[1].attemptId);
    const count = await prisma.examAttempt.count({ where: { userId: fixture.userId } });
    expect(count).toBe(1);
  });

  it('aborts entirely when the bank cannot fill a rule', async () => {
    const fixture = await createExamFixture({
      sections: 2,
      questionsPerSection: 10,
      // Five per domain against a demand of ten across the attempt.
      bankPerDomain: 5,
    });

    let thrown: unknown;
    try {
      await createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(409);
    expect((thrown as HttpError).code).toBe('question_shortage');

    // Nothing partial survives: a half-written attempt would occupy the "one
    // live attempt" slot and block the student from ever creating a real one.
    expect(await prisma.examAttempt.count({ where: { userId: fixture.userId } })).toBe(0);
    expect(
      await prisma.attemptSection.count({ where: { attempt: { userId: fixture.userId } } }),
    ).toBe(0);
  });

  it('refuses a student with no active entitlement', async () => {
    const fixture = await createExamFixture({
      sections: 1,
      questionsPerSection: 4,
      entitled: false,
    });

    await expect(
      createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      }),
    ).rejects.toMatchObject({ status: 403, code: 'no_entitlement' });
  });

  it('refuses an unpublished version for a student but allows an admin dry run', async () => {
    const fixture = await createExamFixture({
      sections: 1,
      questionsPerSection: 4,
      publish: false,
    });

    await expect(
      createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'version_not_published' });

    const dryRun = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      isDryRun: true,
      actorRole: 'ADMIN',
    });

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: dryRun.attemptId },
      select: { isDryRun: true },
    });
    expect(attempt.isDryRun).toBe(true);
  });
});

/**
 * The `FIXED` selection mode.
 *
 * These exist because the mode used to be half-built: the version editor offered
 * it, `assertVersionPublishable` accepted it, and the engine had no branch for
 * it — every student who pressed ابدأ on a published fixed exam got a 409
 * instead of a paper, while the administration screen reported the version as
 * healthy. Nothing here can pass unless the engine actually reads
 * `ExamSectionQuestion`.
 */
describe('createAttempt for a FIXED version', () => {
  /**
   * Turn a fixture's blueprint version into a fixed one.
   *
   * Written straight to the tables rather than through the admin routes: those
   * belong to the simulators suite, and what this file is about is what the
   * engine does with the rows once they exist.
   */
  async function pinQuestions(input: {
    versionId: string;
    sectionId: string;
    questionIds: readonly string[];
  }) {
    await prisma.examBlueprintRule.deleteMany({
      where: { examSectionId: input.sectionId },
    });
    await prisma.examVersion.update({
      where: { id: input.versionId },
      data: { selectionMode: 'FIXED' },
    });
    await prisma.examSectionQuestion.createMany({
      data: input.questionIds.map((questionId, index) => ({
        examSectionId: input.sectionId,
        questionId,
        questionVersion: 1,
        position: index + 1,
      })),
    });
  }

  it('delivers exactly the pinned questions, in the order they were pinned', async () => {
    const fixture = await createExamFixture({
      sections: 1,
      questionsPerSection: 4,
      bankPerDomain: 4,
    });

    // Four questions drawn from both domains, so the delivered order cannot
    // match by accident from a domain-grouped blueprint draw.
    const pinned = [
      fixture.questionIds[0]!,
      fixture.questionIds[5]!,
      fixture.questionIds[1]!,
      fixture.questionIds[4]!,
    ];

    await pinQuestions({
      versionId: fixture.examVersionId,
      sectionId: fixture.sectionIds[0]!,
      questionIds: pinned,
    });

    const { attemptId, created } = await createAttempt({
      userId: fixture.userId,
      simulatorId: fixture.simulatorId,
      mode: 'FULL_SIMULATION',
      actorRole: 'STUDENT',
    });
    expect(created).toBe(true);

    const paper = await loadAttemptPaper(attemptId);
    expect(paper).toHaveLength(1);
    // Not shuffled: an administrator arranged these positions deliberately, and
    // reordering them would discard the only thing a fixed paper has.
    expect(paper[0]!.questions.map((question) => question.questionId)).toEqual(pinned);
    expect(paper[0]!.questions.map((question) => question.position)).toEqual([1, 2, 3, 4]);

    // The snapshot is still a real copy, exactly as on the blueprint path.
    expect(paper[0]!.questions[0]!.correctOptionKey).toBeTruthy();

    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { totalQuestions: true },
    });
    expect(attempt.totalQuestions).toBe(4);
  });

  it('refuses when a pinned question has been retired, and leaves nothing behind', async () => {
    const fixture = await createExamFixture({
      sections: 1,
      questionsPerSection: 4,
      bankPerDomain: 4,
    });

    const pinned = fixture.questionIds.slice(0, 4);
    await pinQuestions({
      versionId: fixture.examVersionId,
      sectionId: fixture.sectionIds[0]!,
      questionIds: pinned,
    });

    // The bank moves under a published version: one item is withdrawn after it
    // was pinned. Nineteen questions of twenty is a different exam.
    await prisma.question.update({
      where: { id: pinned[2]! },
      data: { workflow: 'RETIRED' },
    });

    await expect(
      createAttempt({
        userId: fixture.userId,
        simulatorId: fixture.simulatorId,
        mode: 'FULL_SIMULATION',
        actorRole: 'STUDENT',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'question_shortage' });

    expect(await prisma.examAttempt.count({ where: { userId: fixture.userId } })).toBe(0);
  });
});
