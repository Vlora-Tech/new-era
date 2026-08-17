import type { Prisma, PrismaClient, QuestionDomain } from '@prisma/client';

import { SAMPLE_CONTENT_LABEL, buildQuestionBank, type SeedQuestion } from './question-factory';

/**
 * Exam simulator seed data.
 *
 * The structure below reproduces the publicly described shape of the official
 * test: five sections, 24 questions each, 125 minutes in total. Two details are
 * recorded carefully rather than asserted:
 *
 *  - `sourceRetrievedAt` is the date New Era reviewed the published guide. It is
 *    not the guide's own publication or version date, and the note says so.
 *  - The 25-minute section length is New Era's own default, derived by dividing
 *    the documented 125-minute total across five sections. The source collected
 *    for this build establishes the total, not an equal per-section split, so
 *    the value is labelled as an implementation default and is admin-editable.
 */
const OFFICIAL_GUIDE_URL =
  'https://media.etec.gov.sa/media/1izihxlo/%D8%A7%D9%84%D8%AF%D9%84%D9%8A%D9%84-%D8%A7%D9%84%D8%A7-%D8%B4%D8%A7%D8%AF%D9%8A-%D9%84%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1-%D8%A7%D9%84%D9%82%D8%AF%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9.pdf';

const SOURCE_RETRIEVED_AT = new Date('2026-08-17T00:00:00.000Z');

const SOURCE_NOTE = [
  'تاريخ المراجعة أعلاه هو تاريخ اطّلاع نيو إيرا على المصدر، وليس تاريخ إصداره أو تحديثه من الجهة الرسمية.',
  'المصدر يحدد إجمالي مدة الاختبار بساعتين وخمس دقائق. أما توزيع المدة بالتساوي على الأقسام (٢٥ دقيقة لكل قسم) فهو إعداد افتراضي من نيو إيرا مشتق من الإجمالي، وليس قاعدة رسمية، ويمكن للمشرف تعديله في أي نسخة.',
].join(' ');

const RESULT_DISCLAIMER =
  'منصة نيو إيرا منصة تدريبية مستقلة، وليست تابعة لهيئة تقويم التعليم والتدريب أو للمركز الوطني للقياس، ولا تمثل نتائجها نتيجة رسمية أو ضمانًا لدرجة الاختبار.';

const SECTION_COUNT = 5;
const QUESTIONS_PER_SECTION = 24;
const SECTION_DURATION_SEC = 25 * 60;
const TOTAL_DURATION_SEC = 125 * 60;

/** Blueprint percentages, in a fixed domain order. */
const DOMAIN_ORDER: QuestionDomain[] = [
  'VERBAL_ANALOGY',
  'SENTENCE_COMPLETION',
  'CONTEXTUAL_ERROR',
  'READING_COMPREHENSION',
  'ARITHMETIC',
  'GEOMETRY',
  'ALGEBRA',
  'DATA_ANALYSIS',
];

const SCIENTIFIC_PERCENTAGES = [17, 7, 10, 21, 23, 10, 4, 8];
const THEORETICAL_PERCENTAGES = [21, 13, 16, 25, 13, 8, 0, 4];

async function ensureQuestion(
  prisma: PrismaClient,
  question: SeedQuestion,
  options: { authorId: string | null; stimulusId?: string },
): Promise<void> {
  // `externalKey` is carried in the provenance note so the seed can find its own
  // rows again without adding a column that only the seed would ever use.
  const provenanceNote = `${SAMPLE_CONTENT_LABEL} — مرجع داخلي: ${question.externalKey}`;

  const existing = await prisma.question.findFirst({
    where: { provenanceNote },
    select: { id: true },
  });
  if (existing) return;

  const created = await prisma.question.create({
    data: {
      stem: question.stem as unknown as Prisma.InputJsonValue,
      track: 'BOTH',
      domain: question.domain,
      subskill: question.subskill,
      difficulty: question.difficulty,
      explanation: question.explanation as unknown as Prisma.InputJsonValue,
      hint: question.hint ? (question.hint as unknown as Prisma.InputJsonValue) : undefined,
      workflow: 'PUBLISHED',
      currentVersion: 1,
      shuffleOptions: question.shuffleOptions ?? true,
      authorOrLicensor: 'نيو إيرا',
      provenanceNote,
      rightsDeclaration: 'ORIGINAL',
      createdById: options.authorId,
      reviewedById: options.authorId,
      reviewedAt: new Date(),
      publishedAt: new Date(),
      stimulusId: options.stimulusId,
      options: {
        create: question.options.map((content, index) => ({
          content: content as unknown as Prisma.InputJsonValue,
          position: index + 1,
          isCorrect: index === question.correctIndex,
        })),
      },
    },
    include: { options: true },
  });

  // Publishing freezes the served content, so the version snapshot is written
  // in the same pass rather than being derived later.
  const ordered = [...created.options].sort((a, b) => a.position - b.position);
  await prisma.questionVersion.create({
    data: {
      questionId: created.id,
      version: 1,
      createdById: options.authorId,
      snapshot: {
        stem: question.stem,
        options: ordered.map((option) => ({
          key: option.id,
          content: option.content,
          position: option.position,
        })),
        correctOptionKey: ordered[question.correctIndex]!.id,
        explanation: question.explanation,
        hint: question.hint ?? null,
        classification: {
          domain: question.domain,
          subskill: question.subskill,
          difficulty: question.difficulty,
          track: 'BOTH',
        },
        stimulus: null,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function seedQuestionBank(
  prisma: PrismaClient,
  options: { authorId: string | null },
): Promise<number> {
  const bank = buildQuestionBank();

  for (const question of bank.standalone) {
    await ensureQuestion(prisma, question, options);
  }

  // Each reading set shares one passage, which is what makes a stimulus
  // reusable rather than duplicated onto every question. The passage is keyed
  // on its title so a re-run attaches to the row it created last time.
  for (const passage of bank.passages) {
    let stimulus = await prisma.questionStimulus.findFirst({
      where: { title: passage.title },
      select: { id: true },
    });

    if (!stimulus) {
      stimulus = await prisma.questionStimulus.create({
        data: {
          type: 'PASSAGE',
          title: passage.title,
          content: {
            blocks: [{ type: 'paragraph', children: [{ type: 'text', text: passage.body }] }],
          } as unknown as Prisma.InputJsonValue,
          authorOrLicensor: 'نيو إيرا',
          provenanceNote: `${SAMPLE_CONTENT_LABEL} — مرجع داخلي: ${passage.externalKey}`,
          rightsDeclaration: 'ORIGINAL',
        },
        select: { id: true },
      });
    }

    for (const question of passage.questions) {
      await ensureQuestion(prisma, question, { ...options, stimulusId: stimulus.id });
    }
  }

  return prisma.question.count();
}

async function seedSimulator(
  prisma: PrismaClient,
  config: {
    slug: string;
    title: string;
    shortDescription: string;
    track: 'SCIENTIFIC' | 'THEORETICAL';
    percentages: number[];
    priceHalalas: number;
    publish: boolean;
  },
): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { slug: config.slug } });
  if (existing) {
    console.log(`  simulator: "${config.title}" already exists`);
    return;
  }

  const product = await prisma.product.create({
    data: {
      type: 'EXAM_SIMULATOR',
      slug: config.slug,
      title: config.title,
      shortDescription: config.shortDescription,
      longDescription: `اختبار محاكٍ مكوّن من ${SECTION_COUNT} أقسام، في كل قسم ${QUESTIONS_PER_SECTION} سؤالًا، بإجمالي ${SECTION_COUNT * QUESTIONS_PER_SECTION} سؤالًا. ${RESULT_DISCLAIMER}`,
      status: config.publish ? 'PUBLISHED' : 'DRAFT',
      priceHalalas: config.priceHalalas,
      featured: config.publish,
      publishedAt: config.publish ? new Date() : null,
      examSimulator: {
        create: {
          track: config.track,
          trainingModeEnabled: true,
          fullSimulationEnabled: true,
        },
      },
    },
    include: { examSimulator: true },
  });

  const simulator = product.examSimulator!;

  const version = await prisma.examVersion.create({
    data: {
      simulatorId: simulator.id,
      versionNumber: 1,
      status: config.publish ? 'PUBLISHED' : 'DRAFT',
      selectionMode: 'BLUEPRINT',
      sourceLabel: 'قدرات عامة — إعداد إرشادي',
      sourceUrl: OFFICIAL_GUIDE_URL,
      sourceRetrievedAt: SOURCE_RETRIEVED_AT,
      sourceNote: SOURCE_NOTE,
      totalQuestions: SECTION_COUNT * QUESTIONS_PER_SECTION,
      totalDurationSec: TOTAL_DURATION_SEC,
      resultDisclaimer: RESULT_DISCLAIMER,
      changeSummary: 'النسخة الأولى من الإعداد الافتراضي.',
      publishedAt: config.publish ? new Date() : null,
      sections: {
        create: Array.from({ length: SECTION_COUNT }, (_, sectionIndex) => ({
          title: `القسم ${sectionIndex + 1}`,
          position: sectionIndex + 1,
          durationSec: SECTION_DURATION_SEC,
          questionCount: QUESTIONS_PER_SECTION,
          // The guide describes a disabled calculator and an available
          // electronic scratchpad, with review confined to the current section.
          calculatorEnabled: false,
          scratchpadEnabled: true,
          allowReviewWithinSection: true,
          lockOnAdvance: true,
          pauseEnabled: false,
          blueprintRules: {
            create: DOMAIN_ORDER.map((domain, domainIndex) => ({
              position: domainIndex + 1,
              domain,
              percentage: config.percentages[domainIndex]!,
            })),
          },
        })),
      },
    },
  });

  if (config.publish) {
    await prisma.examSimulator.update({
      where: { id: simulator.id },
      data: { activeExamVersionId: version.id },
    });
  }

  console.log(`  simulator: created "${config.title}" (${config.publish ? 'published' : 'draft'})`);
}

export async function seedExamContent(
  prisma: PrismaClient,
  options: { authorId: string | null; studentId: string | null },
): Promise<void> {
  const questionCount = await seedQuestionBank(prisma, { authorId: options.authorId });
  console.log(`  question bank: ${questionCount} questions available`);

  await seedSimulator(prisma, {
    slug: 'qudurat-simulator-scientific',
    title: 'محاكي قدرات — المسار العلمي',
    shortDescription:
      'اختبار محاكٍ بخمسة أقسام موقوتة، بتوزيع مهارات يناسب المسار العلمي، مع مراجعة تدريبية بعد التسليم.',
    track: 'SCIENTIFIC',
    percentages: SCIENTIFIC_PERCENTAGES,
    priceHalalas: 29_900,
    publish: true,
  });

  await seedSimulator(prisma, {
    slug: 'qudurat-simulator-theoretical',
    title: 'محاكي قدرات — المسار النظري',
    shortDescription: 'اختبار محاكٍ بخمسة أقسام موقوتة، بتوزيع مهارات يناسب المسار النظري.',
    track: 'THEORETICAL',
    percentages: THEORETICAL_PERCENTAGES,
    priceHalalas: 29_900,
    publish: false,
  });
}
