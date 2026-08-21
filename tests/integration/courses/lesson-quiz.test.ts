import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The student's lesson quiz, exercised through the services and the routes.
 *
 * Only the session guard is stubbed. The origin check, the rate limiter, the
 * Zod schemas and the database are all real, because the property that matters
 * most here — "the answer key does not leave the server before the student has
 * earned it" — is a property of the bytes a route returns, not of a function's
 * return type.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: 'quiz@example.test',
    name: 'طالب',
    role: 'STUDENT' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => session.user,
    requireStudent: async () => session.user,
  };
});

import { HttpError } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { resetMemoryBucketsForTests } from '@/lib/security/rate-limit';
import {
  getLessonQuizView,
  saveLessonQuizAnswer,
  startLessonQuizAttempt,
  submitLessonQuizAttempt,
} from '@/services/courses/lesson-quiz.service';

import {
  EXPLANATION_MARKER,
  addQuestionToQuiz,
  cleanupLessonQuizFixtures,
  createLessonQuizFixture,
  type LessonQuizFixture,
} from './helpers';

const ORIGIN = 'http://localhost:3000';

beforeEach(() => {
  resetMemoryBucketsForTests();
});

afterAll(async () => {
  await cleanupLessonQuizFixtures();
});

/** Point the stubbed session at the fixture's own student. */
function signIn(fixture: LessonQuizFixture) {
  session.user = { id: fixture.userId, email: 'quiz@example.test', name: 'طالب', role: 'STUDENT' };
}

/**
 * Assert a rejection's status and code.
 *
 * The promise is awaited once and its rejection captured, rather than asserted
 * against twice: a service call is not necessarily idempotent, and re-running
 * one to inspect its error a second time has already changed the database.
 */
async function expectHttpError(promise: Promise<unknown>, status: number, code?: string) {
  const thrown = await promise.then(
    () => null,
    (error: unknown) => error,
  );

  expect(thrown).toBeInstanceOf(HttpError);
  const error = thrown as HttpError;
  expect(error.status).toBe(status);
  if (code) expect(error.code).toBe(code);
}

describe('lesson quiz — access', () => {
  it('is invisible to a student without an entitlement', async () => {
    const fixture = await createLessonQuizFixture({ entitled: false });
    signIn(fixture);

    expect(await getLessonQuizView(fixture.lessonId, fixture.userId)).toBeNull();
    await expectHttpError(
      startLessonQuizAttempt(fixture.lessonId, fixture.userId),
      403,
      'lesson_locked',
    );
  });

  it('is open on a preview lesson even without an entitlement', async () => {
    const fixture = await createLessonQuizFixture({ entitled: false, isPreview: true });
    signIn(fixture);

    const view = await getLessonQuizView(fixture.lessonId, fixture.userId);
    expect(view?.questionCount).toBe(3);
  });

  it('is invisible while the lesson is unpublished', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);
    await prisma.lesson.update({ where: { id: fixture.lessonId }, data: { status: 'DRAFT' } });

    expect(await getLessonQuizView(fixture.lessonId, fixture.userId)).toBeNull();
  });
});

describe('lesson quiz — the attempt', () => {
  it('pins a version for every question when the attempt opens', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const view = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    expect(view.attempt?.totalCount).toBe(3);
    expect(view.attempt?.questions).toHaveLength(3);

    const answers = await prisma.lessonQuizAnswer.findMany({
      where: { attemptId: view.attempt!.id },
      select: { questionId: true, questionVersion: true, selectedOptionKey: true, isCorrect: true },
    });
    expect(answers).toHaveLength(3);
    expect(answers.every((answer) => answer.questionVersion === 1)).toBe(true);
    expect(answers.every((answer) => answer.selectedOptionKey === null)).toBe(true);
    expect(answers.every((answer) => answer.isCorrect === null)).toBe(true);
  });

  it('returns the attempt already open rather than starting a second one', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const first = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const second = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);

    expect(second.attempt?.id).toBe(first.attempt?.id);
    expect(await prisma.lessonQuizAttempt.count({ where: { quizId: fixture.quizId } })).toBe(1);
  });

  it('refuses a new attempt once the cap is spent', async () => {
    const fixture = await createLessonQuizFixture({ maxAttempts: 1 });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);

    await expectHttpError(
      startLessonQuizAttempt(fixture.lessonId, fixture.userId),
      409,
      'quiz_attempts_exhausted',
    );

    const view = await getLessonQuizView(fixture.lessonId, fixture.userId);
    expect(view?.canStart).toBe(false);
    expect(view?.attemptsRemaining).toBe(0);
    // The review of what they already sat must survive the cap.
    expect(view?.attempt?.submitted).toBe(true);
  });
});

/*
 * Non-disclosure is asserted against the *shape* of the payload, never by
 * searching it for the correct key's value.
 *
 * The key is an option row's id, so it is necessarily one of the option keys the
 * student is offered — it has to be, or they could not choose it. What must not
 * appear is anything that says *which* one, and that is exactly the `outcome`
 * object: it is the only member of `LessonQuizQuestionView` carrying
 * `correctOptionKey` or an explanation. So the assertions are that no question
 * has an outcome, that the string `correctOptionKey` is absent from the bytes,
 * and that the explanation sentinel is absent.
 */
describe('lesson quiz — non-disclosure', () => {
  it('withholds the key and the explanation until submission', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const target = fixture.questions[0]!;

    const saved = await saveLessonQuizAnswer({
      attemptId: started.attempt!.id,
      questionId: target.id,
      userId: fixture.userId,
      selectedOptionKey: target.correctOptionKey,
    });
    // Answering in deferred mode settles nothing and reveals nothing.
    expect(saved.outcome).toBeNull();

    const view = await getLessonQuizView(fixture.lessonId, fixture.userId);
    expect(view?.attempt?.questions).toHaveLength(3);
    expect(view?.attempt?.questions.every((question) => question.outcome === null)).toBe(true);
    // Nothing is graded on the row either, so a later read cannot open it.
    expect(view?.attempt?.correctCount).toBeNull();

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(EXPLANATION_MARKER);
    expect(serialised).not.toContain('correctOptionKey');
  });

  it('keeps the key out of the route response too', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);
    await startLessonQuizAttempt(fixture.lessonId, fixture.userId);

    const { GET } = await import('@/app/api/lessons/[lessonId]/quiz/route');
    const response = await GET(
      new Request(`${ORIGIN}/api/lessons/${fixture.lessonId}/quiz`, {
        headers: { Accept: 'application/json' },
      }),
      { params: Promise.resolve({ lessonId: fixture.lessonId }) },
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain(EXPLANATION_MARKER);
    expect(body).not.toContain('correctOptionKey');
  });

  it('discloses one question at a time under immediate feedback', async () => {
    const fixture = await createLessonQuizFixture({ feedbackMode: 'IMMEDIATE' });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const [first, second, third] = fixture.questions;

    const saved = await saveLessonQuizAnswer({
      attemptId: started.attempt!.id,
      questionId: first!.id,
      userId: fixture.userId,
      selectedOptionKey: first!.optionKeys[1]!,
    });

    expect(saved.outcome).not.toBeNull();
    expect(saved.outcome?.isCorrect).toBe(false);
    expect(saved.outcome?.correctOptionKey).toBe(first!.correctOptionKey);

    const view = await getLessonQuizView(fixture.lessonId, fixture.userId);
    const byId = new Map(
      (view?.attempt?.questions ?? []).map((question) => [question.questionId, question]),
    );

    // The answered question is open; the two untouched ones are still sealed.
    expect(byId.get(first!.id)?.outcome?.correctOptionKey).toBe(first!.correctOptionKey);
    expect(byId.get(second!.id)?.outcome).toBeNull();
    expect(byId.get(third!.id)?.outcome).toBeNull();

    // Exactly one explanation crossed the wire.
    const serialised = JSON.stringify(view);
    expect(serialised.split(EXPLANATION_MARKER)).toHaveLength(2);
  });

  it('refuses to rewrite an answer immediate feedback has already settled', async () => {
    const fixture = await createLessonQuizFixture({ feedbackMode: 'IMMEDIATE' });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const target = fixture.questions[0]!;

    await saveLessonQuizAnswer({
      attemptId: started.attempt!.id,
      questionId: target.id,
      userId: fixture.userId,
      selectedOptionKey: target.optionKeys[1]!,
    });

    await expectHttpError(
      saveLessonQuizAnswer({
        attemptId: started.attempt!.id,
        questionId: target.id,
        userId: fixture.userId,
        selectedOptionKey: target.correctOptionKey,
      }),
      409,
      'quiz_answer_locked',
    );
  });

  it('refuses an option that belongs to another question', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);

    await expectHttpError(
      saveLessonQuizAnswer({
        attemptId: started.attempt!.id,
        questionId: fixture.questions[0]!.id,
        userId: fixture.userId,
        selectedOptionKey: fixture.questions[1]!.correctOptionKey,
      }),
      400,
      'invalid_option',
    );
  });

  it('answers an attempt belonging to someone else with a 404, not a 403', async () => {
    const owner = await createLessonQuizFixture();
    const stranger = await createLessonQuizFixture();
    signIn(owner);

    const started = await startLessonQuizAttempt(owner.lessonId, owner.userId);

    await expectHttpError(
      saveLessonQuizAnswer({
        attemptId: started.attempt!.id,
        questionId: owner.questions[0]!.id,
        userId: stranger.userId,
        selectedOptionKey: null,
      }),
      404,
      'quiz_attempt_not_found',
    );
  });
});

describe('lesson quiz — scoring', () => {
  it('counts unanswered questions as wrong and reports the three totals', async () => {
    const fixture = await createLessonQuizFixture({ questionCount: 3 });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const attemptId = started.attempt!.id;

    await saveLessonQuizAnswer({
      attemptId,
      questionId: fixture.questions[0]!.id,
      userId: fixture.userId,
      selectedOptionKey: fixture.questions[0]!.correctOptionKey,
    });
    await saveLessonQuizAnswer({
      attemptId,
      questionId: fixture.questions[1]!.id,
      userId: fixture.userId,
      selectedOptionKey: fixture.questions[1]!.optionKeys[2]!,
    });
    // The third is left alone.

    const view = await submitLessonQuizAttempt(attemptId, fixture.userId);
    const attempt = view.attempt!;

    expect(attempt.submitted).toBe(true);
    expect(attempt.correctCount).toBe(1);
    expect(attempt.incorrectCount).toBe(1);
    expect(attempt.unansweredCount).toBe(1);
    expect(attempt.scorePercent).toBe(33);
    expect(view.bestScorePercent).toBe(33);
  });

  it('weights the percentage by the points on each question', async () => {
    // Three points on the first question, one on each of the others: answering
    // only the first is 3/5, not 1/3.
    const fixture = await createLessonQuizFixture({ questionCount: 3, points: [3, 1, 1] });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    await saveLessonQuizAnswer({
      attemptId: started.attempt!.id,
      questionId: fixture.questions[0]!.id,
      userId: fixture.userId,
      selectedOptionKey: fixture.questions[0]!.correctOptionKey,
    });

    const view = await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);
    expect(view.attempt?.correctCount).toBe(1);
    expect(view.attempt?.scorePercent).toBe(60);
  });

  it('discloses every key and explanation once submitted', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const view = await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);

    const serialised = JSON.stringify(view);
    expect(serialised).toContain(EXPLANATION_MARKER);
    for (const question of fixture.questions) {
      expect(serialised).toContain(question.correctOptionKey);
    }
  });

  it('refuses a second submission', async () => {
    const fixture = await createLessonQuizFixture();
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);

    await expectHttpError(
      submitLessonQuizAttempt(started.attempt!.id, fixture.userId),
      409,
      'quiz_attempt_finished',
    );
  });
});

describe('lesson quiz — the bank moving underneath it', () => {
  it('drops a retired question from a new attempt but not from an open one', async () => {
    const fixture = await createLessonQuizFixture({ questionCount: 2 });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    expect(started.attempt?.questions).toHaveLength(2);

    await prisma.question.update({
      where: { id: fixture.questions[1]!.id },
      data: { workflow: 'RETIRED', retiredAt: new Date() },
    });

    // The paper the student is holding is unchanged.
    const during = await getLessonQuizView(fixture.lessonId, fixture.userId);
    expect(during?.attempt?.questions).toHaveLength(2);
    // What a fresh attempt would contain is not.
    expect(during?.questionCount).toBe(1);

    await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);
    const next = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    expect(next.attempt?.questions).toHaveLength(1);
    expect(next.attempt?.totalCount).toBe(1);
  });

  it('serves the version pinned at the start, not one published later', async () => {
    const fixture = await createLessonQuizFixture({ questionCount: 1 });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    const target = fixture.questions[0]!;

    // A second version, with a different correct key, cut mid-attempt.
    await prisma.questionVersion.create({
      data: {
        questionId: target.id,
        version: 2,
        snapshot: {
          stem: { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'مُعدّل' }] }] },
          options: target.optionKeys.map((key, index) => ({
            key,
            content: {
              blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'خيار' }] }],
            },
            position: index + 1,
          })),
          correctOptionKey: target.optionKeys[3]!,
          explanation: null,
          hint: null,
          classification: {
            domain: 'ARITHMETIC',
            subskill: null,
            difficulty: 'MEDIUM',
            track: 'BOTH',
          },
          stimulus: null,
        },
      },
    });
    await prisma.question.update({ where: { id: target.id }, data: { currentVersion: 2 } });

    await saveLessonQuizAnswer({
      attemptId: started.attempt!.id,
      questionId: target.id,
      userId: fixture.userId,
      selectedOptionKey: target.correctOptionKey,
    });

    // Marked against version 1, which is what the student read.
    const view = await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);
    expect(view.attempt?.correctCount).toBe(1);
    expect(view.attempt?.questions[0]?.outcome?.correctOptionKey).toBe(target.correctOptionKey);
  });

  it('counts a question added to the quiz mid-attempt only in the next attempt', async () => {
    const fixture = await createLessonQuizFixture({ questionCount: 1 });
    signIn(fixture);

    const started = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    await addQuestionToQuiz(fixture.quizId, `late-${fixture.quizId.slice(0, 6)}`, 1);

    const during = await getLessonQuizView(fixture.lessonId, fixture.userId);
    expect(during?.attempt?.questions).toHaveLength(1);
    expect(during?.questionCount).toBe(2);

    await submitLessonQuizAttempt(started.attempt!.id, fixture.userId);
    const next = await startLessonQuizAttempt(fixture.lessonId, fixture.userId);
    expect(next.attempt?.questions).toHaveLength(2);
  });
});
