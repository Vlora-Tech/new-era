import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The attempts administration routes, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed; the schemas, the service and the database
 * are real. The properties under test are properties of the whole pipeline and
 * of what the pipeline refuses to contain:
 *
 *   - a student cannot read an attempt, and the answer key travels only on this
 *     administrator route;
 *   - the record shows what the student was shown, not what the question bank
 *     says today;
 *   - administrator rehearsals stay out of the default view;
 *   - **there is no verb that writes to an attempt**, which is asserted
 *     structurally because that is what the refusal actually is.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: '',
    name: 'مسؤول',
    role: 'ADMIN' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      return session.user;
    },
    requireAdmin: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      if (session.user.role !== 'ADMIN') {
        throw new actual.HttpError(403, 'forbidden', 'forbidden');
      }
      return session.user;
    },
  };
});

import { prisma } from '@/lib/db';

const ORIGIN = 'http://localhost:3000';

/** Scopes every row this file creates, so parallel workers never collide. */
const RUN = randomUUID().slice(0, 8);

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdQuestionIds: string[] = [];
const createdAttemptIds: string[] = [];

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

function text(value: string) {
  return { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }] };
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email: `admin-attempts-${randomUUID()}@example.test`,
      name: 'حساب اختبار',
      passwordHash: 'not-a-real-hash',
      role,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

/**
 * A simulator with one published version and one section.
 *
 * Built rather than seeded: a suite that depends on seed data starts failing the
 * moment somebody edits the seed for an unrelated reason.
 */
async function createSimulator() {
  const suffix = randomUUID().slice(0, 8);

  const product = await prisma.product.create({
    data: {
      type: 'EXAM_SIMULATOR',
      slug: `admin-attempts-${suffix}`,
      title: `محاكٍ ${RUN}-${suffix}`,
      shortDescription: 'محاكٍ اختباري.',
      status: 'PUBLISHED',
      priceHalalas: 10_000,
      publishedAt: new Date(),
      examSimulator: { create: { track: 'BOTH', fullSimulationEnabled: true } },
    },
    include: { examSimulator: true },
  });
  createdProductIds.push(product.id);

  const version = await prisma.examVersion.create({
    data: {
      simulatorId: product.examSimulator!.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      selectionMode: 'BLUEPRINT',
      totalQuestions: 2,
      totalDurationSec: 600,
      resultDisclaimer: `إخلاء مسؤولية ${RUN}`,
      publishedAt: new Date(),
      sections: {
        create: [{ title: `القسم الأول ${RUN}`, position: 1, durationSec: 600, questionCount: 2 }],
      },
    },
    include: { sections: true },
  });

  return {
    productId: product.id,
    simulatorId: product.examSimulator!.id,
    simulatorTitle: product.title,
    examVersionId: version.id,
    examSectionId: version.sections[0]!.id,
  };
}

/** A published bank question with two options, the second of them correct. */
async function createQuestion(label: string) {
  const question = await prisma.question.create({
    data: {
      stem: text(`نص السؤال الأصلي ${label}`) as unknown as Prisma.InputJsonValue,
      track: 'BOTH',
      domain: 'ARITHMETIC',
      subskill: `مهارة-${RUN}`,
      difficulty: 'MEDIUM',
      workflow: 'PUBLISHED',
      currentVersion: 1,
      shuffleOptions: true,
      authorOrLicensor: 'اختبار',
      rightsDeclaration: 'ORIGINAL',
      publishedAt: new Date(),
      options: {
        create: [
          {
            content: text(`خيار أول ${label}`) as unknown as Prisma.InputJsonValue,
            position: 1,
            isCorrect: false,
          },
          {
            content: text(`خيار ثانٍ ${label}`) as unknown as Prisma.InputJsonValue,
            position: 2,
            isCorrect: true,
          },
        ],
      },
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });
  createdQuestionIds.push(question.id);
  return question;
}

type AttemptFixtureOptions = {
  status?: 'IN_PROGRESS' | 'SUBMITTED';
  isDryRun?: boolean;
};

/**
 * One attempt, written the way the engine writes it.
 *
 * The rows are created directly rather than through the lifecycle service: this
 * file is about the administration read path, and driving the whole generator
 * would make every assertion here depend on the selection algorithm as well.
 */
async function createAttempt(
  simulator: Awaited<ReturnType<typeof createSimulator>>,
  options: AttemptFixtureOptions = {},
) {
  const status = options.status ?? 'SUBMITTED';

  const student = await prisma.user.create({
    data: {
      email: `attempt-student-${randomUUID()}@example.test`,
      name: `طالب ${RUN}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(student.id);

  const first = await createQuestion(`أ-${randomUUID().slice(0, 4)}`);
  const second = await createQuestion(`ب-${randomUUID().slice(0, 4)}`);

  const startedAt = new Date(Date.now() - 30 * 60 * 1_000);
  const submittedAt = status === 'SUBMITTED' ? new Date(Date.now() - 10 * 60 * 1_000) : null;

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: student.id,
      simulatorId: simulator.simulatorId,
      examVersionId: simulator.examVersionId,
      mode: 'FULL_SIMULATION',
      status,
      isDryRun: options.isDryRun ?? false,
      seed: 4_242,
      totalQuestions: 2,
      startedAt,
      maxEndAt: new Date(startedAt.getTime() + 600 * 1_000),
      submittedAt,
      correctCount: status === 'SUBMITTED' ? 1 : null,
      incorrectCount: status === 'SUBMITTED' ? 0 : null,
      unansweredCount: status === 'SUBMITTED' ? 1 : null,
      settingsSnapshot: {
        simulatorTitle: simulator.simulatorTitle,
        resultDisclaimer: `إخلاء مسؤولية ${RUN}`,
      } as unknown as Prisma.InputJsonValue,
      resultSummary:
        status === 'SUBMITTED'
          ? ({
              kind: 'training',
              label: 'نتيجة تدريبية',
              version: 1,
              computedAt: new Date().toISOString(),
              finalisedBy: 'SUBMITTED',
              totals: { total: 2, correct: 1, incorrect: 0, unanswered: 1, accuracy: 0.5 },
              domains: [
                {
                  domain: 'ARITHMETIC',
                  total: 2,
                  correct: 1,
                  incorrect: 0,
                  unanswered: 1,
                  accuracy: 0.5,
                },
              ],
              subskills: [],
              sections: [],
              disclaimer: `إخلاء مسؤولية ${RUN}`,
            } as unknown as Prisma.InputJsonValue)
          : undefined,
    },
    select: { id: true },
  });
  createdAttemptIds.push(attempt.id);

  const section = await prisma.attemptSection.create({
    data: {
      examAttemptId: attempt.id,
      examSectionId: simulator.examSectionId,
      position: 1,
      titleSnapshot: `القسم الأول ${RUN}`,
      durationSecSnapshot: 600,
      policySnapshot: {} as unknown as Prisma.InputJsonValue,
      status: status === 'SUBMITTED' ? 'LOCKED' : 'IN_PROGRESS',
      startedAt,
      deadlineAt: new Date(startedAt.getTime() + 600 * 1_000),
      lockedAt: submittedAt,
      lockedReason: status === 'SUBMITTED' ? 'FINALIZED' : null,
    },
    select: { id: true },
  });

  const snapshotFor = (question: Awaited<ReturnType<typeof createQuestion>>, label: string) => ({
    stem: text(`نص السؤال الأصلي ${label}`),
    options: question.options.map((option) => ({
      key: option.id,
      content: option.content,
    })),
    stimulus: null,
    estimatedSeconds: null,
  });

  const firstAttemptQuestion = await prisma.attemptQuestion.create({
    data: {
      attemptSectionId: section.id,
      questionId: first.id,
      questionVersion: 1,
      position: 1,
      contentSnapshot: snapshotFor(first, 'الأول') as unknown as Prisma.InputJsonValue,
      correctOptionKey: first.options[1]!.id,
      domain: 'ARITHMETIC',
      subskill: `مهارة-${RUN}`,
      difficulty: 'MEDIUM',
    },
    select: { id: true },
  });

  await prisma.attemptQuestion.create({
    data: {
      attemptSectionId: section.id,
      questionId: second.id,
      questionVersion: 1,
      position: 2,
      contentSnapshot: snapshotFor(second, 'الثاني') as unknown as Prisma.InputJsonValue,
      correctOptionKey: second.options[1]!.id,
      domain: 'ARITHMETIC',
      subskill: `مهارة-${RUN}`,
      difficulty: 'MEDIUM',
    },
    select: { id: true },
  });

  // The first question answered correctly; the second deliberately left alone,
  // so "unanswered" and "wrong" can be told apart in the assertions.
  await prisma.attemptAnswer.create({
    data: {
      attemptQuestionId: firstAttemptQuestion.id,
      selectedOptionKey: first.options[1]!.id,
      isCorrect: status === 'SUBMITTED' ? true : null,
      timeSpentSeconds: 45,
      flagged: true,
    },
  });

  return { attemptId: attempt.id, student, firstQuestionId: first.id };
}

async function getAttempts(query = '') {
  const { GET } = await import('@/app/api/admin/attempts/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/attempts${query}`));
  return {
    response,
    payload: (await response.json()) as Envelope<{
      rows: Array<{ id: string; isDryRun: boolean; accuracy: number | null }>;
      total: number;
      page: number;
      perPage: number;
    }>,
  };
}

async function getAttempt(attemptId: string) {
  const { GET } = await import('@/app/api/admin/attempts/[attemptId]/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/attempts/${attemptId}`), {
    params: Promise.resolve({ attemptId }),
  });
  return { response, payload: (await response.json()) as Envelope<Record<string, unknown>> };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/** Torn down by id, deepest edge first. */
afterAll(async () => {
  await prisma.attemptAnswer.deleteMany({
    where: { attemptQuestion: { attemptSection: { examAttemptId: { in: createdAttemptIds } } } },
  });
  await prisma.attemptQuestion.deleteMany({
    where: { attemptSection: { examAttemptId: { in: createdAttemptIds } } },
  });
  await prisma.attemptSection.deleteMany({ where: { examAttemptId: { in: createdAttemptIds } } });
  await prisma.examAttempt.deleteMany({ where: { id: { in: createdAttemptIds } } });

  // The simulator points at its active version, so that reference has to go
  // before the version can.
  await prisma.examSimulator.updateMany({
    where: { productId: { in: createdProductIds } },
    data: { activeExamVersionId: null },
  });

  const versions = await prisma.examVersion.findMany({
    where: { simulator: { productId: { in: createdProductIds } } },
    select: { id: true },
  });
  const versionIds = versions.map((version) => version.id);

  await prisma.examSection.deleteMany({ where: { examVersionId: { in: versionIds } } });
  await prisma.examVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.examSimulator.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });

  await prisma.questionOption.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });

  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('GET /api/admin/attempts', () => {
  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await getAttempts();
    expect(response.status).toBe(403);
  });

  it('keeps administrator rehearsals out of the default view', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const real = await createAttempt(simulator);
    const rehearsal = await createAttempt(simulator, { isDryRun: true });

    const byDefault = await getAttempts(`?simulatorId=${simulator.simulatorId}`);
    expect(byDefault.payload.data?.rows.map((row) => row.id)).toEqual([real.attemptId]);

    const only = await getAttempts(`?simulatorId=${simulator.simulatorId}&dryRun=only`);
    expect(only.payload.data?.rows.map((row) => row.id)).toEqual([rehearsal.attemptId]);

    const both = await getAttempts(`?simulatorId=${simulator.simulatorId}&dryRun=include`);
    expect(both.payload.data?.total).toBe(2);
  });

  it('searches by the student address and filters by status', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const submitted = await createAttempt(simulator);
    await createAttempt(simulator, { status: 'IN_PROGRESS' });

    const byEmail = await getAttempts(`?q=${encodeURIComponent(submitted.student.email)}`);
    expect(byEmail.payload.data?.total).toBe(1);
    expect(byEmail.payload.data?.rows[0]?.id).toBe(submitted.attemptId);

    const running = await getAttempts(`?simulatorId=${simulator.simulatorId}&status=IN_PROGRESS`);
    expect(running.payload.data?.total).toBe(1);
    expect(running.payload.data?.rows[0]?.id).not.toBe(submitted.attemptId);
  });

  it('reports an unscored attempt as having no result rather than as a zero', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const running = await createAttempt(simulator, { status: 'IN_PROGRESS' });

    const { payload } = await getAttempts(`?q=${encodeURIComponent(running.student.email)}`);
    // Not `0`: an attempt still in progress has no result, and a zero would read
    // as one.
    expect(payload.data?.rows[0]?.accuracy).toBeNull();
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getAttempts(
      '?page=abc&status=nonsense&perPage=99999&simulatorId=not-a-uuid&from=13-13-13',
    );

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });
});

describe('GET /api/admin/attempts/[attemptId]', () => {
  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const attempt = await createAttempt(simulator);

    await signInAs('STUDENT');
    const { response } = await getAttempt(attempt.attemptId);
    // The response carries the answer key for every delivered question, which is
    // why this guard matters more here than on any other read.
    expect(response.status).toBe(403);
  });

  it('answers a malformed id with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getAttempt('not-a-uuid');
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('attempt_not_found');
  });

  it('answers an unknown attempt with 404', async () => {
    await signInAs('ADMIN');
    const { response } = await getAttempt(randomUUID());
    expect(response.status).toBe(404);
  });

  it('tells an unanswered question apart from a wrong one', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const attempt = await createAttempt(simulator);

    const { response, payload } = await getAttempt(attempt.attemptId);
    expect(response.status).toBe(200);

    const detail = payload.data as unknown as {
      sections: Array<{
        questions: Array<{
          position: number;
          outcome: string;
          selectedOptionLabel: string | null;
          correctOptionLabel: string | null;
          flagged: boolean;
        }>;
      }>;
      result: { totals: { correct: number; accuracy: number }; disclaimer: string } | null;
    };

    const questions = detail.sections[0]!.questions;
    expect(questions.map((question) => question.outcome)).toEqual(['CORRECT', 'UNANSWERED']);
    // The option's own text, resolved against the options frozen into the
    // attempt — not the stored uuid key.
    expect(questions[0]!.selectedOptionLabel).toContain('خيار ثانٍ');
    expect(questions[1]!.selectedOptionLabel).toBeNull();
    expect(questions[1]!.correctOptionLabel).toContain('خيار ثانٍ');
    expect(questions[0]!.flagged).toBe(true);

    // The training summary, with the disclaimer the student was shown.
    expect(detail.result?.totals.correct).toBe(1);
    expect(detail.result?.disclaimer).toBe(`إخلاء مسؤولية ${RUN}`);
  });

  it('shows the question as it was delivered, not as the bank reads today', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const attempt = await createAttempt(simulator);

    // The bank moves on: a typo is fixed, an option is rewritten. An attempt
    // already sat must not move with it, or the record stops answering "what did
    // this student actually see".
    await prisma.question.update({
      where: { id: attempt.firstQuestionId },
      data: {
        stem: text('نص السؤال بعد التعديل') as unknown as Prisma.InputJsonValue,
        currentVersion: 2,
      },
    });

    const { payload } = await getAttempt(attempt.attemptId);
    const detail = payload.data as unknown as {
      sections: Array<{ questions: Array<{ stem: string; questionVersion: number }> }>;
    };

    expect(detail.sections[0]!.questions[0]!.stem).toContain('نص السؤال الأصلي');
    expect(detail.sections[0]!.questions[0]!.stem).not.toContain('بعد التعديل');
    // The version pinned into the attempt, not the question's version today.
    expect(detail.sections[0]!.questions[0]!.questionVersion).toBe(1);
  });

  it('reports a running attempt without inventing a result', async () => {
    await signInAs('ADMIN');
    const simulator = await createSimulator();
    const attempt = await createAttempt(simulator, { status: 'IN_PROGRESS' });

    const { payload } = await getAttempt(attempt.attemptId);
    const detail = payload.data as unknown as {
      result: unknown;
      correctCount: number | null;
      accuracy: number | null;
      sections: Array<{ questions: Array<{ outcome: string }> }>;
    };

    expect(detail.result).toBeNull();
    expect(detail.correctCount).toBeNull();
    expect(detail.accuracy).toBeNull();
    // An answered question in an unfinalised attempt is not "wrong": it has not
    // been marked at all.
    expect(detail.sections[0]!.questions[0]!.outcome).toBe('NOT_GRADED');
  });

  it('exposes no verb that could alter a student exam record', async () => {
    // The refusal is expressed by the handlers not existing, so the test has to
    // check exactly that rather than a message. Adding a POST here to "fix a
    // stuck attempt" should fail this line.
    const record = await import('@/app/api/admin/attempts/[attemptId]/route');
    expect(Object.keys(record).sort()).toEqual(['GET', 'runtime']);

    const collection = await import('@/app/api/admin/attempts/route');
    expect(Object.keys(collection).sort()).toEqual(['GET', 'runtime']);
  });
});
