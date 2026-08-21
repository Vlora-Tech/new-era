import { randomUUID } from 'node:crypto';

import type { FeedbackMode, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Fixtures for the lesson-quiz suite.
 *
 * Built rather than seeded, for the same reason the exam fixtures are: these
 * cases need quizzes shaped to the property under test — a retired question, a
 * two-attempt cap, uneven points — and none of those shapes belong in the
 * shipped seed.
 *
 * Everything is torn down by id. Vitest runs files in parallel workers against
 * one database, so truncating a shared table would delete another file's
 * fixtures mid-assertion.
 */
export const EXPLANATION_MARKER = 'QUIZ-EXPLANATION-SENTINEL';

function text(value: string) {
  return { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }] };
}

export type QuizQuestionFixture = {
  id: string;
  /** The option row ids, in published order. The first is the correct one. */
  optionKeys: string[];
  correctOptionKey: string;
};

export type LessonQuizFixture = {
  userId: string;
  productId: string;
  lessonId: string;
  quizId: string;
  questions: QuizQuestionFixture[];
};

export type LessonQuizFixtureOptions = {
  questionCount?: number;
  feedbackMode?: FeedbackMode;
  maxAttempts?: number | null;
  entitled?: boolean;
  isPreview?: boolean;
  /** Per-question weights, defaulting to one each. */
  points?: number[];
};

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdQuestionIds: string[] = [];

/**
 * A published question with a frozen version behind it.
 *
 * The snapshot is written exactly as `question-publish.service.ts` writes it —
 * option keys are the option row ids, and the correct key is stored beside the
 * list rather than inside it — because the delivery path reads that shape and
 * nothing else.
 */
export async function createPublishedQuestion(label: string): Promise<QuizQuestionFixture> {
  // One transaction. A blueprint exam section draws from the whole bank, so
  // between the question being committed as `PUBLISHED` and its snapshot
  // existing there is a window in which another worker can draw a question it
  // cannot then deliver.
  return prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        stem: text(`نص السؤال ${label}`) as unknown as Prisma.InputJsonValue,
        track: 'BOTH',
        domain: 'ARITHMETIC',
        subskill: `مهارة-${label}`,
        difficulty: 'MEDIUM',
        explanation: text(`${EXPLANATION_MARKER} ${label}`) as unknown as Prisma.InputJsonValue,
        workflow: 'PUBLISHED',
        currentVersion: 1,
        // Fixed order, so a test can name "the first option" without reproducing
        // the shuffle. Shuffling itself is covered by the exam suite's rng tests.
        shuffleOptions: false,
        authorOrLicensor: 'اختبار',
        rightsDeclaration: 'ORIGINAL',
        publishedAt: new Date(),
        options: {
          create: Array.from({ length: 4 }, (_, index) => ({
            content: text(`خيار ${index + 1} — ${label}`) as unknown as Prisma.InputJsonValue,
            position: index + 1,
            isCorrect: index === 0,
          })),
        },
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });

    const correctOptionKey = question.options[0]!.id;

    await tx.questionVersion.create({
      data: {
        questionId: question.id,
        version: 1,
        snapshot: {
          stem: text(`نص السؤال ${label}`),
          options: question.options.map((option) => ({
            key: option.id,
            content: option.content,
            position: option.position,
          })),
          correctOptionKey,
          explanation: text(`${EXPLANATION_MARKER} ${label}`),
          hint: null,
          classification: {
            domain: 'ARITHMETIC',
            subskill: `مهارة-${label}`,
            difficulty: 'MEDIUM',
            track: 'BOTH',
          },
          stimulus: null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    createdQuestionIds.push(question.id);
    return {
      id: question.id,
      optionKeys: question.options.map((option) => option.id),
      correctOptionKey,
    };
  });
}

export async function createLessonQuizFixture(
  options: LessonQuizFixtureOptions = {},
): Promise<LessonQuizFixture> {
  const questionCount = options.questionCount ?? 3;
  const suffix = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: {
      email: `quiz-${randomUUID()}@example.test`,
      name: 'طالب اختبار',
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);

  const product = await prisma.product.create({
    data: {
      type: 'COURSE',
      slug: `quiz-fixture-${suffix}`,
      title: `دورة اختبارية ${suffix}`,
      shortDescription: 'دورة اختبارية.',
      status: 'PUBLISHED',
      priceHalalas: 10_000,
      publishedAt: new Date(),
      course: {
        create: {
          modules: {
            create: {
              title: 'الوحدة الأولى',
              position: 0,
              status: 'PUBLISHED',
              lessons: {
                create: {
                  title: 'الدرس الأول',
                  position: 0,
                  status: 'PUBLISHED',
                  isPreview: options.isPreview ?? false,
                },
              },
            },
          },
        },
      },
    },
    include: { course: { include: { modules: { include: { lessons: true } } } } },
  });
  createdProductIds.push(product.id);

  const lessonId = product.course!.modules[0]!.lessons[0]!.id;

  if (options.entitled ?? true) {
    await prisma.entitlement.create({
      data: { userId: user.id, productId: product.id, status: 'ACTIVE', grantedAt: new Date() },
    });
  }

  const questions: QuizQuestionFixture[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    questions.push(await createPublishedQuestion(`${suffix}-${index}`));
  }

  const quiz = await prisma.lessonQuiz.create({
    data: {
      lessonId,
      feedbackMode: options.feedbackMode ?? 'AFTER_SUBMISSION',
      maxAttempts: options.maxAttempts ?? null,
      questions: {
        create: questions.map((question, index) => ({
          questionId: question.id,
          position: index,
          points: options.points?.[index] ?? 1,
        })),
      },
    },
    select: { id: true },
  });

  return { userId: user.id, productId: product.id, lessonId, quizId: quiz.id, questions };
}

/** Attach one more published question to an existing quiz. */
export async function addQuestionToQuiz(
  quizId: string,
  label: string,
  position: number,
  points = 1,
): Promise<QuizQuestionFixture> {
  const question = await createPublishedQuestion(label);
  await prisma.lessonQuizQuestion.create({
    data: { quizId, questionId: question.id, position, points },
  });
  return question;
}

/** Tear down everything this worker's fixtures created, deepest edge first. */
export async function cleanupLessonQuizFixtures(): Promise<void> {
  if (createdUserIds.length === 0 && createdProductIds.length === 0) return;

  const attempts = await prisma.lessonQuizAttempt.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  });
  const attemptIds = attempts.map((attempt) => attempt.id);

  await prisma.lessonQuizAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } });
  await prisma.lessonQuizAttempt.deleteMany({ where: { id: { in: attemptIds } } });

  const quizzes = await prisma.lessonQuiz.findMany({
    where: { lesson: { module: { course: { productId: { in: createdProductIds } } } } },
    select: { id: true },
  });
  const quizIds = quizzes.map((quiz) => quiz.id);

  await prisma.lessonQuizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
  await prisma.lessonQuiz.deleteMany({ where: { id: { in: quizIds } } });

  await prisma.lessonProgress.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { userId: { in: createdUserIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.order.deleteMany({ where: { userId: { in: createdUserIds } } });
  // Lessons and modules cascade from the course, which cascades from the product.
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });

  /*
   * The questions are retired before anything is deleted, and the delete is
   * allowed to fail.
   *
   * Blueprint rules are no longer applied (see the head of
   * `attempt-selection.service.ts`), so an exam attempt's candidate pool is now
   * *the entire published bank* — including questions this file published a
   * moment ago in another worker. Two consequences follow, and retirement
   * answers both. It takes them out of the eligible pool
   * (`workflow != RETIRED`) the instant this suite finishes, so they stop
   * turning up in someone else's paper; and where an attempt has already
   * referenced one, `attempt_questions_questionId_fkey` refuses the delete,
   * which must not fail the run. Deleting that attempt instead would destroy
   * another worker's fixture mid-assertion, which is worse than leaving a
   * withdrawn row behind.
   */
  await prisma.question.updateMany({
    where: { id: { in: createdQuestionIds } },
    data: { workflow: 'RETIRED', retiredAt: new Date(), currentVersion: 0 },
  });

  for (const questionId of createdQuestionIds) {
    try {
      // A question's frozen version is `Restrict`, so it has to go first.
      await prisma.questionVersion.deleteMany({ where: { questionId } });
      await prisma.questionOption.deleteMany({ where: { questionId } });
      await prisma.question.delete({ where: { id: questionId } });
    } catch {
      // Referenced by something another worker owns. Already retired above.
    }
  }

  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  createdUserIds.length = 0;
  createdProductIds.length = 0;
  createdQuestionIds.length = 0;
}
