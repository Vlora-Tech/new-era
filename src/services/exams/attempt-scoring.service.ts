import 'server-only';

import type { $Enums, Prisma } from '@prisma/client';

import { INDEPENDENCE_DISCLAIMER, COPY } from '@/lib/copy';
import type { PrismaTransaction } from '@/lib/db';
import { parseRichText, type RichText } from '@/lib/exam/content';

/**
 * Scoring, shared by deliberate submission and by expiry.
 *
 * Both paths must produce identical analytics: a student who ran out of time
 * has still sat the exam, and their review would be worthless if it were
 * computed by a second, slightly different code path.
 *
 * What this deliberately does not compute:
 *
 *   - No percentile, no band, no comparison against other students.
 *   - No official score, and nothing shaped like one — no 0–100 "درجة".
 *   - No pass/fail, and no admission or eligibility prediction.
 *
 * The platform is independent of the official test. Anything resembling a
 * predicted official score would be a claim it has no standing to make, and
 * students would reasonably read it as one. What is reported instead is
 * descriptive: how many were right, where the misses cluster by skill, and how
 * long each section actually took. That is training analytics, and the summary
 * carries the `نتيجة تدريبية` label so it cannot be quoted as anything else.
 */

export type DomainBreakdown = {
  domain: $Enums.QuestionDomain;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Correct ÷ total, as a ratio. Not a grade. */
  accuracy: number;
};

export type SubskillBreakdown = {
  domain: $Enums.QuestionDomain;
  subskill: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
};

export type SectionBreakdown = {
  attemptSectionId: string;
  position: number;
  title: string;
  allowedSec: number | null;
  /** Wall-clock time the section was open, from its own stored timestamps. */
  elapsedSec: number | null;
  lockReason: $Enums.AttemptSectionLockReason | null;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
};

export type AttemptResultSummary = {
  /** Discriminator so a consumer cannot mistake this for an official record. */
  kind: 'training';
  label: string;
  version: 1;
  computedAt: string;
  finalisedBy: 'SUBMITTED' | 'EXPIRED';
  totals: {
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy: number;
  };
  domains: DomainBreakdown[];
  subskills: SubskillBreakdown[];
  sections: SectionBreakdown[];
  disclaimer: string;
};

function accuracyOf(correct: number, total: number): number {
  if (total === 0) return 0;
  // Rounded to four places so the stored JSON is stable and comparable rather
  // than carrying the full binary expansion of a division.
  return Math.round((correct / total) * 10_000) / 10_000;
}

/**
 * Score an attempt and write its result.
 *
 * Runs inside the caller's transaction so an attempt can never be observed as
 * terminal while its per-answer correctness is still unwritten.
 *
 * Correctness is compared against `AttemptQuestion.correctOptionKey` — the key
 * frozen into this attempt — not against the live question. An item edited or
 * retired after the attempt began is still scored as it was delivered.
 */
export async function scoreAttempt(
  tx: PrismaTransaction,
  input: {
    attemptId: string;
    finalisedBy: 'SUBMITTED' | 'EXPIRED';
    computedAt: Date;
  },
): Promise<AttemptResultSummary> {
  const sections = await tx.attemptSection.findMany({
    where: { examAttemptId: input.attemptId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      titleSnapshot: true,
      durationSecSnapshot: true,
      startedAt: true,
      lockedAt: true,
      lockedReason: true,
      questions: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          domain: true,
          subskill: true,
          correctOptionKey: true,
          answer: { select: { id: true, selectedOptionKey: true } },
        },
      },
    },
  });

  const correctIds: string[] = [];
  const incorrectIds: string[] = [];

  const totals = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
  const domainMap = new Map<$Enums.QuestionDomain, DomainBreakdown>();
  const subskillMap = new Map<string, SubskillBreakdown>();
  const sectionBreakdowns: SectionBreakdown[] = [];

  for (const section of sections) {
    const sectionTally = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };

    for (const question of section.questions) {
      const selected = question.answer?.selectedOptionKey ?? null;
      const answered = selected !== null;
      const isCorrect = answered && selected === question.correctOptionKey;

      if (question.answer) {
        (isCorrect ? correctIds : incorrectIds).push(question.answer.id);
      }

      const domain =
        domainMap.get(question.domain) ??
        ({
          domain: question.domain,
          total: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          accuracy: 0,
        } satisfies DomainBreakdown);
      domainMap.set(question.domain, domain);

      const subskillKey = `${question.domain}::${question.subskill ?? ''}`;
      let subskill: SubskillBreakdown | null = null;
      if (question.subskill) {
        subskill =
          subskillMap.get(subskillKey) ??
          ({
            domain: question.domain,
            subskill: question.subskill,
            total: 0,
            correct: 0,
            incorrect: 0,
            unanswered: 0,
            accuracy: 0,
          } satisfies SubskillBreakdown);
        subskillMap.set(subskillKey, subskill);
      }

      for (const bucket of [totals, sectionTally, domain, subskill]) {
        if (!bucket) continue;
        bucket.total += 1;
        if (!answered) bucket.unanswered += 1;
        else if (isCorrect) bucket.correct += 1;
        else bucket.incorrect += 1;
      }
    }

    sectionBreakdowns.push({
      attemptSectionId: section.id,
      position: section.position,
      title: section.titleSnapshot,
      allowedSec: section.durationSecSnapshot,
      // Derived from the section's own timestamps, so a section that expired
      // while the student was offline still reports the time it was actually
      // open rather than the time they were present for.
      elapsedSec:
        section.startedAt && section.lockedAt
          ? Math.max(
              0,
              Math.round((section.lockedAt.getTime() - section.startedAt.getTime()) / 1_000),
            )
          : null,
      lockReason: section.lockedReason,
      ...sectionTally,
    });
  }

  for (const breakdown of domainMap.values()) {
    breakdown.accuracy = accuracyOf(breakdown.correct, breakdown.total);
  }
  for (const breakdown of subskillMap.values()) {
    breakdown.accuracy = accuracyOf(breakdown.correct, breakdown.total);
  }

  // Two statements rather than one per answer: an attempt holds a hundred-odd
  // answers, and a round trip each would dominate the submission transaction.
  if (correctIds.length > 0) {
    await tx.attemptAnswer.updateMany({ where: { id: { in: correctIds } }, data: { isCorrect: true } });
  }
  if (incorrectIds.length > 0) {
    await tx.attemptAnswer.updateMany({
      where: { id: { in: incorrectIds } },
      data: { isCorrect: false },
    });
  }

  const summary: AttemptResultSummary = {
    kind: 'training',
    label: COPY.legal.trainingResultLabel,
    version: 1,
    computedAt: input.computedAt.toISOString(),
    finalisedBy: input.finalisedBy,
    totals: { ...totals, accuracy: accuracyOf(totals.correct, totals.total) },
    domains: [...domainMap.values()].sort((a, b) => a.domain.localeCompare(b.domain)),
    subskills: [...subskillMap.values()].sort(
      (a, b) => a.domain.localeCompare(b.domain) || a.subskill.localeCompare(b.subskill),
    ),
    sections: sectionBreakdowns,
    disclaimer: INDEPENDENCE_DISCLAIMER,
  };

  await tx.examAttempt.update({
    where: { id: input.attemptId },
    data: {
      correctCount: totals.correct,
      incorrectCount: totals.incorrect,
      unansweredCount: totals.unanswered,
      resultSummary: summary as unknown as Prisma.InputJsonValue,
    },
  });

  return summary;
}

// ─────────────────────────────── Review ───────────────────────────────

/**
 * The post-submission review.
 *
 * This is the one read path that may carry correct answers and explanations,
 * and it is separate from the delivery path on purpose: the caller has to reach
 * for a differently named function to obtain them, having already established
 * that the attempt is terminal. There is no flag on the delivery query that
 * could be flipped to the same effect.
 */
export type ReviewQuestion = {
  id: string;
  position: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
  stem: RichText;
  options: Array<{ key: string; content: RichText }>;
  correctOptionKey: string;
  selectedOptionKey: string | null;
  isCorrect: boolean;
  flagged: boolean;
  explanation: RichText | null;
};

export type ReviewSection = {
  id: string;
  position: number;
  title: string;
  questions: ReviewQuestion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadAttemptReview(
  client: PrismaTransaction,
  attemptId: string,
): Promise<ReviewSection[]> {
  const sections = await client.attemptSection.findMany({
    where: { examAttemptId: attemptId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      titleSnapshot: true,
      questions: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          domain: true,
          subskill: true,
          difficulty: true,
          contentSnapshot: true,
          correctOptionKey: true,
          explanationSnapshot: true,
          answer: { select: { selectedOptionKey: true, flagged: true } },
        },
      },
    },
  });

  return sections.map((section) => ({
    id: section.id,
    position: section.position,
    title: section.titleSnapshot,
    questions: section.questions.map((question) => {
      const content = isRecord(question.contentSnapshot) ? question.contentSnapshot : {};
      const rawOptions = Array.isArray(content.options) ? content.options : [];
      const selectedOptionKey = question.answer?.selectedOptionKey ?? null;

      return {
        id: question.id,
        position: question.position,
        domain: question.domain,
        subskill: question.subskill,
        difficulty: question.difficulty,
        stem: parseRichText(content.stem),
        options: rawOptions.flatMap((option) =>
          isRecord(option) && typeof option.key === 'string'
            ? [{ key: option.key, content: parseRichText(option.content) }]
            : [],
        ),
        correctOptionKey: question.correctOptionKey,
        selectedOptionKey,
        isCorrect: selectedOptionKey === question.correctOptionKey,
        flagged: question.answer?.flagged ?? false,
        explanation:
          question.explanationSnapshot == null ? null : parseRichText(question.explanationSnapshot),
      };
    }),
  }));
}
