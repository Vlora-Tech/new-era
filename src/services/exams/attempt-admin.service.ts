import 'server-only';

import type { $Enums, Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { parseRichText, richTextToPlain } from '@/lib/exam/content';
import type { AttemptListQuery } from '@/validators/admin-attempt';

/**
 * Exam attempts, for the administration screens.
 *
 * **This module is read-only, and that is the feature.** There is no exported
 * function here that writes to `ExamAttempt`, `AttemptSection`, `AttemptQuestion`
 * or `AttemptAnswer` — no clock extension, no re-mark, no reopening of a locked
 * section, no deletion. An attempt is the record of what a student was shown and
 * what they did with it; an attempt an administrator can edit is not a record of
 * anything. When an attempt is stuck, the repair is a fix in the engine and a
 * fresh attempt for the student, not a hand-edited row.
 *
 * Two further properties shape what it returns:
 *
 *  - **Everything rendered comes from the attempt's own snapshots.** Question
 *    text, option text and the correct key are read from `AttemptQuestion`, never
 *    from the live `Question`. An item edited or retired after the attempt is
 *    still shown here exactly as it was delivered, which is the only version of
 *    it that can answer "what did this student actually see".
 *  - **Numbers are counts, never a score.** `resultSummary` is written by
 *    `attempt-scoring.service.ts` and carries its own `نتيجة تدريبية` label and
 *    the independence disclaimer. Nothing in this file computes a band, a
 *    percentile or a prediction, and `accuracy` is passed through as the ratio it
 *    is rather than dressed up as a grade.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): never {
  throw new HttpError(404, COPY.adminAttempts.errors.notFound, 'attempt_not_found');
}

/** A malformed path segment names an attempt that does not exist, not a fault. */
export function parseAttemptId(value: string): string {
  if (!UUID_PATTERN.test(value)) notFound();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── List ─────────────────────────────────────────────────────────────────

const ATTEMPT_ROW_SELECT = {
  id: true,
  mode: true,
  status: true,
  isDryRun: true,
  startedAt: true,
  submittedAt: true,
  maxEndAt: true,
  createdAt: true,
  totalQuestions: true,
  correctCount: true,
  incorrectCount: true,
  unansweredCount: true,
} satisfies Prisma.ExamAttemptSelect;

const ATTEMPT_ROW_WITH_RELATIONS = {
  ...ATTEMPT_ROW_SELECT,
  user: { select: { id: true, name: true, email: true } },
  // The simulator's name is its product's title; the simulator row has none of
  // its own. Read through the relation rather than duplicated onto the attempt.
  simulator: { select: { id: true, product: { select: { title: true } } } },
  examVersion: { select: { id: true, versionNumber: true, status: true } },
} satisfies Prisma.ExamAttemptSelect;

type AttemptRowPayload = Prisma.ExamAttemptGetPayload<{
  select: typeof ATTEMPT_ROW_WITH_RELATIONS;
}>;

export type AdminAttemptRow = Prisma.ExamAttemptGetPayload<{
  select: typeof ATTEMPT_ROW_SELECT;
}> & {
  student: { id: string; name: string; email: string };
  simulator: { id: string; title: string };
  examVersion: { id: string; versionNumber: number; status: $Enums.ExamVersionStatus };
  /** Start to submission, in seconds. Null while an attempt is still open. */
  durationSec: number | null;
  /** Correct ÷ total. Null until the attempt has been scored. Not a grade. */
  accuracy: number | null;
};

export type AdminAttemptPage = {
  rows: AdminAttemptRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

function accuracyOf(correct: number | null, total: number): number | null {
  if (correct === null || total <= 0) return null;
  return Math.round((correct / total) * 10_000) / 10_000;
}

function toRow(row: AttemptRowPayload): AdminAttemptRow {
  const { user, simulator, examVersion, ...attempt } = row;

  return {
    ...attempt,
    student: user,
    simulator: { id: simulator.id, title: simulator.product.title },
    examVersion,
    durationSec:
      attempt.startedAt && attempt.submittedAt
        ? Math.max(
            0,
            Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1_000),
          )
        : null,
    accuracy: accuracyOf(attempt.correctCount, attempt.totalQuestions),
  };
}

function buildAttemptWhere(query: AttemptListQuery): Prisma.ExamAttemptWhereInput {
  const and: Prisma.ExamAttemptWhereInput[] = [];

  if (query.mode) and.push({ mode: query.mode });
  if (query.status) and.push({ status: query.status });
  if (query.simulatorId) and.push({ simulatorId: query.simulatorId });
  if (query.examVersionId) and.push({ examVersionId: query.examVersionId });

  // The default excludes administrator rehearsals. They are attempts against a
  // version rather than a student sitting an exam, and leaving them in by
  // default makes every count on the screen answer a slightly different question
  // from the one it appears to answer.
  if (query.dryRun === 'exclude') and.push({ isDryRun: false });
  if (query.dryRun === 'only') and.push({ isDryRun: true });

  if (query.from || query.to) {
    and.push({
      createdAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    });
  }

  if (query.q) {
    const term = query.q.normalize('NFKC');
    and.push({
      OR: [
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { simulator: { product: { title: { contains: term, mode: 'insensitive' } } } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/**
 * One page of attempts.
 *
 * `createdAt desc, id desc` rather than `createdAt` alone. This table grows
 * faster than every other in the system, so a tie with no defined resolution is
 * not a theoretical concern here: it is how one attempt appears on two
 * consecutive pages while another is never listed at all. The count and the page
 * are read in one transaction, so the summary describes the rows beneath it.
 */
export async function listAttempts(query: AttemptListQuery): Promise<AdminAttemptPage> {
  const where = buildAttemptWhere(query);

  const [total, rows] = await prisma.$transaction([
    prisma.examAttempt.count({ where }),
    prisma.examAttempt.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: ATTEMPT_ROW_WITH_RELATIONS,
    }),
  ]);

  return {
    rows: rows.map(toRow),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

export type AttemptFilterOptions = {
  simulators: Array<{ id: string; title: string }>;
  versions: Array<{ id: string; simulatorId: string; versionNumber: number }>;
};

/**
 * The values the two relation filters offer.
 *
 * Read from the tables rather than hard-coded, and small by construction: a
 * platform has a handful of simulators and a handful of versions each. If that
 * ever stops being true the filter becomes a search field, not a longer list.
 */
export async function listAttemptFilterOptions(): Promise<AttemptFilterOptions> {
  const [simulators, versions] = await Promise.all([
    prisma.examSimulator.findMany({
      orderBy: { product: { title: 'asc' } },
      select: { id: true, product: { select: { title: true } } },
    }),
    prisma.examVersion.findMany({
      orderBy: [{ simulatorId: 'asc' }, { versionNumber: 'desc' }],
      select: { id: true, simulatorId: true, versionNumber: true },
    }),
  ]);

  return {
    simulators: simulators.map((simulator) => ({
      id: simulator.id,
      title: simulator.product.title,
    })),
    versions,
  };
}

// ── Detail ───────────────────────────────────────────────────────────────

/**
 * What happened to one delivered question.
 *
 * Four values rather than a boolean, because a boolean would have to answer
 * "was it correct" for a question nobody answered and for an attempt nobody has
 * submitted, and both of those are `false` in a way that reads as a wrong
 * answer.
 */
export type AttemptQuestionOutcome = 'CORRECT' | 'INCORRECT' | 'UNANSWERED' | 'NOT_GRADED';

export type AdminAttemptQuestionRow = {
  id: string;
  position: number;
  questionId: string;
  /** The frozen version this attempt received, not the question's version today. */
  questionVersion: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
  /** Plain-text projection of the snapshot the student was shown. */
  stem: string;
  selectedOptionLabel: string | null;
  correctOptionLabel: string | null;
  outcome: AttemptQuestionOutcome;
  flagged: boolean;
  timeSpentSeconds: number;
  revealedAt: Date | null;
};

export type AdminAttemptSectionRow = {
  id: string;
  position: number;
  title: string;
  status: $Enums.AttemptSectionStatus;
  allowedSec: number | null;
  /** Wall-clock time the section was open, from its own stored timestamps. */
  elapsedSec: number | null;
  startedAt: Date | null;
  deadlineAt: Date | null;
  lockedAt: Date | null;
  lockedReason: $Enums.AttemptSectionLockReason | null;
  questionCount: number;
  answeredCount: number;
  questions: AdminAttemptQuestionRow[];
};

export type AttemptBreakdownRow = {
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
};

/** The stored training summary, re-read defensively rather than trusted. */
export type AdminAttemptResult = {
  label: string;
  computedAt: string | null;
  finalisedBy: string | null;
  totals: {
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy: number;
  };
  domains: AttemptBreakdownRow[];
  subskills: AttemptBreakdownRow[];
  disclaimer: string | null;
};

export type AdminAttemptDetail = {
  id: string;
  mode: $Enums.AttemptMode;
  status: $Enums.AttemptStatus;
  isDryRun: boolean;
  seed: number;
  startedAt: Date | null;
  maxEndAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalQuestions: number;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  accuracy: number | null;
  durationSec: number | null;
  student: { id: string; name: string; email: string };
  simulator: { id: string; productId: string; title: string };
  examVersion: {
    id: string;
    versionNumber: number;
    status: $Enums.ExamVersionStatus;
  };
  /**
   * The legible parts of `settingsSnapshot`. The column is a frozen copy of the
   * version's rules; what a record screen needs from it is the two facts that
   * survive a later edit to the version — the name the student saw, and the
   * disclaimer they were shown with their result.
   */
  settings: { simulatorTitle: string | null; resultDisclaimer: string | null };
  /** Present only for a training attempt; the engine leaves it null otherwise. */
  hasTrainingConfig: boolean;
  sections: AdminAttemptSectionRow[];
  result: AdminAttemptResult | null;
};

/** Read one option's text out of a question's content snapshot. */
function optionLabels(contentSnapshot: Prisma.JsonValue): Map<string, string> {
  const content = isRecord(contentSnapshot) ? contentSnapshot : {};
  const rawOptions = Array.isArray(content.options) ? content.options : [];

  const labels = new Map<string, string>();
  for (const option of rawOptions) {
    if (!isRecord(option) || typeof option.key !== 'string') continue;
    labels.set(option.key, richTextToPlain(parseRichText(option.content)));
  }
  return labels;
}

function numberAt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toBreakdown(value: unknown): AttemptBreakdownRow[] {
  if (!Array.isArray(value)) return [];

  const rows: AttemptBreakdownRow[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.domain !== 'string') continue;
    rows.push({
      domain: entry.domain as $Enums.QuestionDomain,
      subskill: typeof entry.subskill === 'string' ? entry.subskill : null,
      total: numberAt(entry.total),
      correct: numberAt(entry.correct),
      incorrect: numberAt(entry.incorrect),
      unanswered: numberAt(entry.unanswered),
      accuracy: numberAt(entry.accuracy),
    });
  }
  return rows;
}

/**
 * Parse `resultSummary` without trusting its shape.
 *
 * The column is written by this codebase, so the shape is known — but it is a
 * `Json` column holding a document written by an older deployment's version of
 * the scorer, and a record screen that throws on a summary written last month is
 * a screen that cannot be used to investigate last month.
 */
function parseResultSummary(value: Prisma.JsonValue | null): AdminAttemptResult | null {
  if (!isRecord(value)) return null;
  const totals = isRecord(value.totals) ? value.totals : null;
  if (!totals) return null;

  return {
    // The stored label, so the screen shows the same words the student's own
    // result carried rather than a second wording invented here.
    label: typeof value.label === 'string' ? value.label : COPY.legal.trainingResultLabel,
    computedAt: typeof value.computedAt === 'string' ? value.computedAt : null,
    finalisedBy: typeof value.finalisedBy === 'string' ? value.finalisedBy : null,
    totals: {
      total: numberAt(totals.total),
      correct: numberAt(totals.correct),
      incorrect: numberAt(totals.incorrect),
      unanswered: numberAt(totals.unanswered),
      accuracy: numberAt(totals.accuracy),
    },
    domains: toBreakdown(value.domains),
    subskills: toBreakdown(value.subskills),
    disclaimer: typeof value.disclaimer === 'string' ? value.disclaimer : null,
  };
}

/**
 * One attempt, with every section and every delivered question.
 *
 * Loaded in a single nested query. An attempt holds a hundred-odd questions and
 * a round trip each would make this screen the slowest in the administration
 * area, but the stronger reason is consistency: the sections, the questions and
 * the answers have to describe one moment, and three separate reads of a running
 * attempt do not.
 */
export async function getAttemptForAdmin(attemptId: string): Promise<AdminAttemptDetail | null> {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      mode: true,
      status: true,
      isDryRun: true,
      seed: true,
      startedAt: true,
      maxEndAt: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      totalQuestions: true,
      correctCount: true,
      incorrectCount: true,
      unansweredCount: true,
      settingsSnapshot: true,
      trainingConfig: true,
      resultSummary: true,
      user: { select: { id: true, name: true, email: true } },
      simulator: {
        select: { id: true, productId: true, product: { select: { title: true } } },
      },
      examVersion: { select: { id: true, versionNumber: true, status: true } },
      sections: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          titleSnapshot: true,
          durationSecSnapshot: true,
          status: true,
          startedAt: true,
          deadlineAt: true,
          lockedAt: true,
          lockedReason: true,
          questions: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              position: true,
              questionId: true,
              questionVersion: true,
              domain: true,
              subskill: true,
              difficulty: true,
              contentSnapshot: true,
              correctOptionKey: true,
              answer: {
                select: {
                  selectedOptionKey: true,
                  flagged: true,
                  isCorrect: true,
                  timeSpentSeconds: true,
                  revealedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) return null;

  const settings = isRecord(attempt.settingsSnapshot) ? attempt.settingsSnapshot : {};

  const sections: AdminAttemptSectionRow[] = attempt.sections.map((section) => {
    let answeredCount = 0;

    const questions: AdminAttemptQuestionRow[] = section.questions.map((question) => {
      const labels = optionLabels(question.contentSnapshot);
      const content = isRecord(question.contentSnapshot) ? question.contentSnapshot : {};
      const selectedKey = question.answer?.selectedOptionKey ?? null;
      if (selectedKey !== null) answeredCount += 1;

      const outcome: AttemptQuestionOutcome =
        selectedKey === null
          ? 'UNANSWERED'
          : question.answer?.isCorrect === true
            ? 'CORRECT'
            : question.answer?.isCorrect === false
              ? 'INCORRECT'
              : 'NOT_GRADED';

      return {
        id: question.id,
        position: question.position,
        questionId: question.questionId,
        questionVersion: question.questionVersion,
        domain: question.domain,
        subskill: question.subskill,
        difficulty: question.difficulty,
        stem: richTextToPlain(parseRichText(content.stem)),
        selectedOptionLabel: selectedKey === null ? null : (labels.get(selectedKey) ?? null),
        // The key frozen into the attempt, resolved against the options frozen
        // beside it. Never looked up in the live question, whose options may have
        // been rewritten since.
        correctOptionLabel: labels.get(question.correctOptionKey) ?? null,
        outcome,
        flagged: question.answer?.flagged ?? false,
        timeSpentSeconds: question.answer?.timeSpentSeconds ?? 0,
        revealedAt: question.answer?.revealedAt ?? null,
      };
    });

    return {
      id: section.id,
      position: section.position,
      title: section.titleSnapshot,
      status: section.status,
      allowedSec: section.durationSecSnapshot,
      // From the section's own timestamps, so a section that expired while the
      // student was offline reports the time it was open rather than the time
      // they were present for.
      elapsedSec:
        section.startedAt && section.lockedAt
          ? Math.max(
              0,
              Math.round((section.lockedAt.getTime() - section.startedAt.getTime()) / 1_000),
            )
          : null,
      startedAt: section.startedAt,
      deadlineAt: section.deadlineAt,
      lockedAt: section.lockedAt,
      lockedReason: section.lockedReason,
      questionCount: section.questions.length,
      answeredCount,
      questions,
    };
  });

  return {
    id: attempt.id,
    mode: attempt.mode,
    status: attempt.status,
    isDryRun: attempt.isDryRun,
    seed: attempt.seed,
    startedAt: attempt.startedAt,
    maxEndAt: attempt.maxEndAt,
    submittedAt: attempt.submittedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    unansweredCount: attempt.unansweredCount,
    accuracy: accuracyOf(attempt.correctCount, attempt.totalQuestions),
    durationSec:
      attempt.startedAt && attempt.submittedAt
        ? Math.max(
            0,
            Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1_000),
          )
        : null,
    student: attempt.user,
    simulator: {
      id: attempt.simulator.id,
      productId: attempt.simulator.productId,
      title: attempt.simulator.product.title,
    },
    examVersion: attempt.examVersion,
    settings: {
      simulatorTitle: typeof settings.simulatorTitle === 'string' ? settings.simulatorTitle : null,
      resultDisclaimer:
        typeof settings.resultDisclaimer === 'string' ? settings.resultDisclaimer : null,
    },
    hasTrainingConfig: attempt.trainingConfig !== null,
    sections,
    result: parseResultSummary(attempt.resultSummary),
  };
}
