import { randomUUID } from 'node:crypto';

import type { Prisma, QuestionDomain } from '@prisma/client';

import { prisma } from '@/lib/db';

import { releaseFixtureQuestions } from '../question-cleanup';

/**
 * Fixtures for the exam engine suite.
 *
 * Built rather than seeded. A suite that depends on seed data starts failing
 * the moment someone edits the seed for an unrelated reason, and these tests
 * need pools sized to the case under test — including pools deliberately too
 * small, which the shipped bank is not.
 *
 * Everything is torn down by id. Vitest runs files in parallel workers against
 * one database, so truncating a shared table would delete another file's
 * fixtures mid-assertion.
 *
 * Each fixture still scopes its blueprint rules to a subskill unique to itself,
 * and that no longer isolates anything: a blueprint section draws its count from
 * the whole eligible bank and the rules are not read (see the head of
 * `attempt-selection.service.ts`). The scoping is kept because the rows are what
 * the rule editor restores to, but no assertion may depend on it.
 *
 * What follows from that, and is the trap worth naming: **a fixture cannot own
 * its pool**. Vitest runs files in parallel against one database, so a draw may
 * legitimately return another file's questions, or a leftover from a previous
 * run. Assert counts, uniqueness and the absence of partial writes — never which
 * questions came back. To test a shortage, ask for more than
 * `countEligibleQuestions()` reports, not for more than this fixture created.
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
  /**
   * How the version fills its sections. `FIXED` by default, and that default is
   * the isolation this file used to get from subskill-scoped rules.
   *
   * A `FIXED` fixture pins its own questions, so the attempt it generates is a
   * function of this fixture alone — which is what a clock, answer or scoring
   * test actually needs. A `BLUEPRINT` fixture draws from the whole bank in a
   * database several workers are writing to, so ask for it only when the draw
   * itself is what is under test.
   */
  selectionMode?: 'FIXED' | 'BLUEPRINT';
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
 *
 * Both writes are one transaction, which matters more than it looks. A blueprint
 * section draws from the whole bank, so between "the question is `PUBLISHED`
 * with `currentVersion: 1`" and "its snapshot exists" there is a window where
 * another worker's draw can select a question that cannot be delivered, and fail
 * with a `SnapshotIntegrityError` that has nothing to do with its own fixture.
 * `question-publish.service.ts` writes both in one transaction for the same
 * reason.
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

  return prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
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

    await tx.questionVersion.create({
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
  });
}

export async function createExamFixture(options: ExamFixtureOptions = {}): Promise<ExamFixture> {
  const sectionCount = options.sections ?? 2;
  const questionsPerSection = options.questionsPerSection ?? 4;
  const sectionDurationSec = options.sectionDurationSec ?? 600;
  const domains: QuestionDomain[] = options.domains ?? ['ARITHMETIC', 'ALGEBRA'];
  const bankPerDomain = options.bankPerDomain ?? sectionCount * questionsPerSection;
  const publish = options.publish ?? true;
  const entitled = options.entitled ?? true;
  const selectionMode = options.selectionMode ?? 'FIXED';

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
      selectionMode,
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

  // A fixed version names its questions, so pin this fixture's own — in order,
  // section by section. Nothing else in the database can then change what this
  // attempt contains.
  if (selectionMode === 'FIXED') {
    const needed = sectionCount * questionsPerSection;
    if (questionIds.length < needed) {
      throw new Error(
        `A FIXED fixture needs ${needed} questions to pin and built ${questionIds.length}. ` +
          'Raise `bankPerDomain`, or ask for `selectionMode: "BLUEPRINT"` if the draw is the point.',
      );
    }

    await prisma.examSectionQuestion.createMany({
      data: version.sections.flatMap((section, sectionIndex) =>
        Array.from({ length: questionsPerSection }, (_, index) => ({
          examSectionId: section.id,
          questionId: questionIds[sectionIndex * questionsPerSection + index]!,
          questionVersion: 1,
          position: index + 1,
        })),
      ),
    });
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

/**
 * How many questions a blueprint draw could return right now.
 *
 * The engine's own eligibility rule, counted rather than assumed: a test that
 * wants a shortage has to out-ask the whole bank, including whatever the other
 * workers have created this run.
 */
export async function countEligibleQuestions(): Promise<number> {
  return prisma.question.count({
    where: { currentVersion: { gt: 0 }, workflow: { not: 'RETIRED' } },
  });
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

  // This file's own attempts went with the users above. What may still point at
  // these questions is *another worker's* attempt — a blueprint section draws
  // from the whole bank — and those rows are not this file's to delete: they are
  // a record of what a student was given, and the suite that owns them is very
  // likely still asserting against them. `releaseFixtureQuestions` deletes what
  // nobody holds and retires the rest, so nothing undeliverable survives into
  // the next run either way.
  await releaseFixtureQuestions(createdQuestionIds);

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
