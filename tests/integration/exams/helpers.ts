import { randomUUID } from 'node:crypto';

import type { Prisma, QuestionDomain } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Fixtures for the exam engine suite.
 *
 * Built rather than seeded. The shipped seed contains one 120-question
 * simulator and a 30-question bank, so every attempt against it would fail with
 * a shortage; and a suite that depends on seed data starts failing the moment
 * someone edits the seed for an unrelated reason.
 *
 * Everything is torn down by id. Vitest runs files in parallel workers against
 * one database, so truncating a shared table would delete another file's
 * fixtures mid-assertion.
 *
 * Each fixture also scopes its blueprint to a subskill unique to itself. The
 * eligible pool is genuinely the whole published bank — that is the production
 * behaviour, and narrowing it in the service would be a lie — so without the
 * scope one file's fixture would draw another's questions and the per-domain
 * assertions would depend on test execution order.
 */
export const UNIQUE_EXPLANATION_MARKER = 'EXPLANATION-SENTINEL';
export const UNIQUE_HINT_MARKER = 'HINT-SENTINEL';

function text(value: string) {
  return { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }] };
}

export type ExamFixture = {
  userId: string;
  productId: string;
  simulatorId: string;
  examVersionId: string;
  sectionIds: string[];
  questionIds: string[];
  sectionDurationSec: number;
  questionsPerSection: number;
  domains: QuestionDomain[];
};

export type ExamFixtureOptions = {
  sections?: number;
  questionsPerSection?: number;
  sectionDurationSec?: number;
  /** Questions created per domain. Set below the demand to force a shortage. */
  bankPerDomain?: number;
  domains?: QuestionDomain[];
  entitled?: boolean;
  publish?: boolean;
};

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdQuestionIds: string[] = [];

/**
 * Build a question with a published version snapshot.
 *
 * The snapshot is what the delivery path copies from, so it has to be written
 * exactly as publishing writes it — option keys are the option row ids, and the
 * correct key is stored alongside rather than inside the option list.
 */
async function createQuestion(input: {
  domain: QuestionDomain;
  subskill: string;
  label: string;
  optionCount?: number;
  shuffleOptions?: boolean;
}): Promise<string> {
  const optionCount = input.optionCount ?? 4;
  const correctIndex = 0;

  const question = await prisma.question.create({
    data: {
      stem: text(`نص السؤال ${input.label}`) as unknown as Prisma.InputJsonValue,
      track: 'BOTH',
      domain: input.domain,
      subskill: input.subskill,
      difficulty: 'MEDIUM',
      explanation: text(
        `${UNIQUE_EXPLANATION_MARKER} ${input.label}`,
      ) as unknown as Prisma.InputJsonValue,
      hint: text(`${UNIQUE_HINT_MARKER} ${input.label}`) as unknown as Prisma.InputJsonValue,
      workflow: 'PUBLISHED',
      currentVersion: 1,
      shuffleOptions: input.shuffleOptions ?? true,
      authorOrLicensor: 'اختبار',
      rightsDeclaration: 'ORIGINAL',
      publishedAt: new Date(),
      options: {
        create: Array.from({ length: optionCount }, (_, index) => ({
          content: text(`خيار ${index + 1} — ${input.label}`) as unknown as Prisma.InputJsonValue,
          position: index + 1,
          isCorrect: index === correctIndex,
        })),
      },
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });

  await prisma.questionVersion.create({
    data: {
      questionId: question.id,
      version: 1,
      snapshot: {
        stem: text(`نص السؤال ${input.label}`),
        options: question.options.map((option) => ({
          key: option.id,
          content: option.content,
          position: option.position,
        })),
        correctOptionKey: question.options[correctIndex]!.id,
        explanation: text(`${UNIQUE_EXPLANATION_MARKER} ${input.label}`),
        hint: text(`${UNIQUE_HINT_MARKER} ${input.label}`),
        classification: {
          domain: input.domain,
          subskill: input.subskill,
          difficulty: 'MEDIUM',
          track: 'BOTH',
        },
        stimulus: null,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  createdQuestionIds.push(question.id);
  return question.id;
}

export async function createExamFixture(options: ExamFixtureOptions = {}): Promise<ExamFixture> {
  const sectionCount = options.sections ?? 2;
  const questionsPerSection = options.questionsPerSection ?? 4;
  const sectionDurationSec = options.sectionDurationSec ?? 600;
  const domains: QuestionDomain[] = options.domains ?? ['ARITHMETIC', 'ALGEBRA'];
  const bankPerDomain = options.bankPerDomain ?? sectionCount * questionsPerSection;
  const publish = options.publish ?? true;
  const entitled = options.entitled ?? true;

  const suffix = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: {
      email: `exam-${randomUUID()}@example.test`,
      name: 'طالب اختبار',
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);

  const product = await prisma.product.create({
    data: {
      type: 'EXAM_SIMULATOR',
      slug: `exam-fixture-${suffix}`,
      title: `محاكٍ اختباري ${suffix}`,
      shortDescription: 'محاكٍ اختباري.',
      status: 'PUBLISHED',
      priceHalalas: 10_000,
      publishedAt: new Date(),
      examSimulator: {
        create: { track: 'BOTH', trainingModeEnabled: true, fullSimulationEnabled: true },
      },
    },
    include: { examSimulator: true },
  });
  createdProductIds.push(product.id);

  const simulator = product.examSimulator!;

  if (entitled) {
    await prisma.entitlement.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: 'ACTIVE',
        grantedAt: new Date(),
      },
    });
  }

  // Percentages split evenly across the domains, so a section of four over two
  // domains must draw exactly two from each.
  const share = Math.floor(100 / domains.length);
  const subskillFor = (domain: QuestionDomain) => `مهارة-${suffix}-${domain}`;

  const version = await prisma.examVersion.create({
    data: {
      simulatorId: simulator.id,
      versionNumber: 1,
      status: publish ? 'PUBLISHED' : 'DRAFT',
      selectionMode: 'BLUEPRINT',
      totalQuestions: sectionCount * questionsPerSection,
      totalDurationSec: sectionCount * sectionDurationSec,
      resultDisclaimer: 'إخلاء مسؤولية اختباري.',
      publishedAt: publish ? new Date() : null,
      sections: {
        create: Array.from({ length: sectionCount }, (_, sectionIndex) => ({
          title: `القسم ${sectionIndex + 1}`,
          position: sectionIndex + 1,
          durationSec: sectionDurationSec,
          questionCount: questionsPerSection,
          blueprintRules: {
            create: domains.map((domain, domainIndex) => ({
              position: domainIndex + 1,
              domain,
              // Scoped so this fixture can only draw its own questions.
              subskill: subskillFor(domain),
              percentage: share,
            })),
          },
        })),
      },
    },
    include: { sections: { orderBy: { position: 'asc' }, select: { id: true } } },
  });

  await prisma.examSimulator.update({
    where: { id: simulator.id },
    data: { activeExamVersionId: version.id },
  });

  const questionIds: string[] = [];
  for (const domain of domains) {
    for (let index = 0; index < bankPerDomain; index += 1) {
      questionIds.push(
        await createQuestion({
          domain,
          subskill: subskillFor(domain),
          label: `${suffix}-${domain}-${index}`,
        }),
      );
    }
  }

  return {
    userId: user.id,
    productId: product.id,
    simulatorId: simulator.id,
    examVersionId: version.id,
    sectionIds: version.sections.map((section) => section.id),
    questionIds,
    sectionDurationSec,
    questionsPerSection,
    domains,
  };
}

/** Tear down everything the fixtures in this worker created, deepest edge first. */
export async function cleanupExamFixtures(): Promise<void> {
  if (createdUserIds.length === 0 && createdProductIds.length === 0) return;

  const attempts = await prisma.examAttempt.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  });
  const attemptIds = attempts.map((attempt) => attempt.id);

  await prisma.attemptAnswer.deleteMany({
    where: { attemptQuestion: { attemptSection: { examAttemptId: { in: attemptIds } } } },
  });
  await prisma.attemptQuestion.deleteMany({
    where: { attemptSection: { examAttemptId: { in: attemptIds } } },
  });
  await prisma.attemptSection.deleteMany({ where: { examAttemptId: { in: attemptIds } } });
  await prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } });

  // The simulator points at its active version, so the reference has to be
  // dropped before the version can go.
  await prisma.examSimulator.updateMany({
    where: { productId: { in: createdProductIds } },
    data: { activeExamVersionId: null },
  });

  const versions = await prisma.examVersion.findMany({
    where: { simulator: { productId: { in: createdProductIds } } },
    select: { id: true },
  });
  const versionIds = versions.map((version) => version.id);

  await prisma.examBlueprintRule.deleteMany({
    where: { examSection: { examVersionId: { in: versionIds } } },
  });
  await prisma.examSectionQuestion.deleteMany({
    where: { examSection: { examVersionId: { in: versionIds } } },
  });
  await prisma.examSection.deleteMany({ where: { examVersionId: { in: versionIds } } });
  await prisma.examVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.examSimulator.deleteMany({ where: { productId: { in: createdProductIds } } });

  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { userId: { in: createdUserIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });

  // Deleting a question's frozen version before the question itself is the only
  // possible order (the FK is `Restrict`), so anything still pointing at the
  // question has to go first. Missing one would leave a published question with
  // no version behind — undeliverable data that survives into the next run.
  await prisma.attemptAnswer.deleteMany({
    where: { attemptQuestion: { questionId: { in: createdQuestionIds } } },
  });
  await prisma.attemptQuestion.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.questionVersion.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.questionOption.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });

  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  createdUserIds.length = 0;
  createdProductIds.length = 0;
  createdQuestionIds.length = 0;
}

/** Load an attempt's delivered paper, including the answer key, for assertions. */
export async function loadAttemptPaper(attemptId: string) {
  return prisma.attemptSection.findMany({
    where: { examAttemptId: attemptId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      status: true,
      startedAt: true,
      deadlineAt: true,
      lockedAt: true,
      lockedReason: true,
      durationSecSnapshot: true,
      questions: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          questionId: true,
          position: true,
          domain: true,
          contentSnapshot: true,
          correctOptionKey: true,
        },
      },
    },
  });
}
