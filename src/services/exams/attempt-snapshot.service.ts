import 'server-only';

import type { $Enums, Prisma } from '@prisma/client';

import type { PrismaTransaction } from '@/lib/db';
import { parseRichText, type RichText } from '@/lib/exam/content';
import { createRandom, deriveSeed, shuffle } from '@/lib/exam/rng';

/**
 * The attempt snapshot, and the single door content passes through on its way
 * to a student.
 *
 * Two separate guarantees live in this file.
 *
 * **Detachment.** An `AttemptQuestion` is a copy, taken from the question's
 * frozen `QuestionVersion` at the moment the attempt is created. Editing the
 * source question afterwards — fixing a typo, swapping an option, retiring the
 * item — must not change an exam a student is sitting or a result that has
 * already been reported. Nothing in the delivery or scoring path reads the
 * live `Question` row.
 *
 * **Non-disclosure.** The schema stores `correctOptionKey`, `explanationSnapshot`
 * and `hintSnapshot` in columns of their own, deliberately outside
 * `contentSnapshot`. That is what makes `toStudentQuestionView` safe by
 * construction rather than by vigilance: the select below never asks the
 * database for the answer key, so no future edit to this function can leak it,
 * and the view's input type has no field that could carry it.
 */

// ─────────────────────────── Snapshot shapes ───────────────────────────

export type SnapshotOption = { key: string; content: RichText };

export type SnapshotStimulus = {
  type: $Enums.StimulusType;
  title: string | null;
  content: RichText;
};

/** What `AttemptQuestion.contentSnapshot` holds. Never the answer. */
export type QuestionContentSnapshot = {
  stem: RichText;
  options: SnapshotOption[];
  stimulus: SnapshotStimulus | null;
  estimatedSeconds: number | null;
};

/** Raised when a question in the eligible pool has no usable frozen version. */
export class SnapshotIntegrityError extends Error {
  readonly code = 'snapshot_integrity';
  readonly questionIds: string[];

  constructor(questionIds: string[]) {
    super('تعذّر تجهيز نسخة الأسئلة لهذه المحاولة، فلم يبدأ الاختبار.');
    this.name = 'SnapshotIntegrityError';
    this.questionIds = questionIds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the published version snapshot.
 *
 * Tolerant about what it ignores and strict about what it requires: a version
 * without a stem, without at least two options, or without a correct key is not
 * deliverable, and saying so here stops a broken item reaching a timed section.
 */
function parseVersionSnapshot(value: unknown): {
  stem: RichText;
  options: Array<{ key: string; content: RichText; position: number }>;
  correctOptionKey: string;
  explanation: RichText | null;
  hint: RichText | null;
  stimulus: SnapshotStimulus | null;
} | null {
  if (!isRecord(value)) return null;

  const correctOptionKey = value.correctOptionKey;
  if (typeof correctOptionKey !== 'string' || correctOptionKey.length === 0) return null;
  if (!Array.isArray(value.options)) return null;

  const options: Array<{ key: string; content: RichText; position: number }> = [];
  value.options.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.key !== 'string') return;
    options.push({
      key: raw.key,
      content: parseRichText(raw.content),
      position: typeof raw.position === 'number' ? raw.position : index + 1,
    });
  });

  if (options.length < 2) return null;
  if (!options.some((option) => option.key === correctOptionKey)) return null;

  const stem = parseRichText(value.stem);
  if (stem.blocks.length === 0) return null;

  const explanation = value.explanation == null ? null : parseRichText(value.explanation);
  const hint = value.hint == null ? null : parseRichText(value.hint);

  let stimulus: SnapshotStimulus | null = null;
  if (isRecord(value.stimulus) && typeof value.stimulus.type === 'string') {
    stimulus = {
      type: value.stimulus.type as $Enums.StimulusType,
      title: typeof value.stimulus.title === 'string' ? value.stimulus.title : null,
      content: parseRichText(value.stimulus.content),
    };
  }

  return { stem, options, correctOptionKey, explanation, hint, stimulus };
}

// ─────────────────────────── Building the snapshot ───────────────────────────

export type SnapshotSourceQuestion = {
  questionId: string;
  questionVersion: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
};

export type PreparedAttemptQuestion = {
  questionId: string;
  questionVersion: number;
  position: number;
  contentSnapshot: QuestionContentSnapshot;
  correctOptionKey: string;
  explanationSnapshot: RichText | null;
  hintSnapshot: RichText | null;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
};

/**
 * Copy the frozen content for a set of selected questions.
 *
 * Option order is decided here and then fixed for the life of the attempt, so a
 * refetch after a reconnect shows the paper the student was already looking at.
 * `Question.shuffleOptions === false` is honoured: some items order their
 * options meaningfully — ascending values, "كل ما سبق" — and shuffling those
 * makes them unanswerable.
 *
 * The stimulus is embedded rather than referenced. A shared reading passage that
 * is later edited must not change under an attempt that already quoted it.
 */
export async function prepareAttemptQuestions(
  client: PrismaTransaction,
  input: {
    sourceQuestions: SnapshotSourceQuestion[];
    seed: number;
    /** Distinguishes one section's stream from another's. */
    sectionPosition: number;
  },
): Promise<PreparedAttemptQuestion[]> {
  const { sourceQuestions, seed, sectionPosition } = input;
  if (sourceQuestions.length === 0) return [];

  const questionIds = sourceQuestions.map((question) => question.questionId);

  const [questions, versions] = await Promise.all([
    client.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        shuffleOptions: true,
        estimatedSeconds: true,
        stimulus: { select: { type: true, title: true, content: true } },
      },
    }),
    client.questionVersion.findMany({
      // Exactly the published version of each question, never "the latest row".
      where: {
        OR: sourceQuestions.map((question) => ({
          questionId: question.questionId,
          version: question.questionVersion,
        })),
      },
      select: { questionId: true, snapshot: true },
    }),
  ]);

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const snapshotById = new Map(versions.map((row) => [row.questionId, row.snapshot]));

  const prepared: PreparedAttemptQuestion[] = [];
  const broken: string[] = [];

  sourceQuestions.forEach((source, index) => {
    const question = questionById.get(source.questionId);
    const parsed = parseVersionSnapshot(snapshotById.get(source.questionId));

    if (!question || !parsed) {
      broken.push(source.questionId);
      return;
    }

    const byPosition = [...parsed.options].sort((a, b) => a.position - b.position);
    const ordered = question.shuffleOptions
      ? shuffle(byPosition, createRandom(deriveSeed(seed, sectionPosition * 100_000 + index)))
      : byPosition;

    prepared.push({
      questionId: source.questionId,
      questionVersion: source.questionVersion,
      position: index + 1,
      contentSnapshot: {
        stem: parsed.stem,
        options: ordered.map((option) => ({ key: option.key, content: option.content })),
        stimulus:
          parsed.stimulus ??
          (question.stimulus
            ? {
                type: question.stimulus.type,
                title: question.stimulus.title,
                content: parseRichText(question.stimulus.content),
              }
            : null),
        estimatedSeconds: question.estimatedSeconds,
      },
      correctOptionKey: parsed.correctOptionKey,
      explanationSnapshot: parsed.explanation,
      hintSnapshot: parsed.hint,
      domain: source.domain,
      subskill: source.subskill,
      difficulty: source.difficulty,
    });
  });

  if (broken.length > 0) throw new SnapshotIntegrityError(broken);

  return prepared;
}

/** Cast a prepared question into the shape `attemptQuestion.createMany` wants. */
export function toAttemptQuestionCreate(
  attemptSectionId: string,
  prepared: PreparedAttemptQuestion,
): Prisma.AttemptQuestionCreateManyInput {
  return {
    attemptSectionId,
    questionId: prepared.questionId,
    questionVersion: prepared.questionVersion,
    position: prepared.position,
    contentSnapshot: prepared.contentSnapshot as unknown as Prisma.InputJsonValue,
    correctOptionKey: prepared.correctOptionKey,
    explanationSnapshot: (prepared.explanationSnapshot ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
    hintSnapshot: (prepared.hintSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
    domain: prepared.domain,
    subskill: prepared.subskill,
    difficulty: prepared.difficulty,
  };
}

// ─────────────────────── The student-facing projection ───────────────────────

/**
 * The only select a delivery query may use.
 *
 * `correctOptionKey` and `explanationSnapshot` are absent on purpose. Every
 * before-submission read path goes through this constant, so the answer key is
 * not merely omitted from the response — it never leaves PostgreSQL.
 */
export const STUDENT_QUESTION_SELECT = {
  id: true,
  position: true,
  domain: true,
  subskill: true,
  difficulty: true,
  contentSnapshot: true,
  hintSnapshot: true,
  answer: {
    select: {
      selectedOptionKey: true,
      flagged: true,
      saveVersion: true,
      savedAt: true,
    },
  },
} as const satisfies Prisma.AttemptQuestionSelect;

export type StudentQuestionRow = Prisma.AttemptQuestionGetPayload<{
  select: typeof STUDENT_QUESTION_SELECT;
}>;

export type StudentQuestionView = {
  id: string;
  position: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
  content: QuestionContentSnapshot;
  /** Present only where the attempt's policy allows it, i.e. training mode. */
  hint: RichText | null;
  answer: {
    selectedOptionKey: string | null;
    flagged: boolean;
    saveVersion: number;
    savedAt: string | null;
  };
};

/**
 * Serialise one question toward a student.
 *
 * This is the only function permitted to do so before submission. It builds its
 * result field by field rather than spreading the row, so a column added to the
 * schema later cannot ride along into the response by default.
 */
export function toStudentQuestionView(
  row: StudentQuestionRow,
  options: { includeHint: boolean },
): StudentQuestionView {
  const content = row.contentSnapshot as unknown;
  const parsed = isRecord(content) ? content : {};

  const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];
  const snapshotOptions: SnapshotOption[] = [];
  for (const option of rawOptions) {
    if (!isRecord(option) || typeof option.key !== 'string') continue;
    snapshotOptions.push({ key: option.key, content: parseRichText(option.content) });
  }

  let stimulus: SnapshotStimulus | null = null;
  if (isRecord(parsed.stimulus) && typeof parsed.stimulus.type === 'string') {
    stimulus = {
      type: parsed.stimulus.type as $Enums.StimulusType,
      title: typeof parsed.stimulus.title === 'string' ? parsed.stimulus.title : null,
      content: parseRichText(parsed.stimulus.content),
    };
  }

  return {
    id: row.id,
    position: row.position,
    domain: row.domain,
    subskill: row.subskill,
    difficulty: row.difficulty,
    content: {
      stem: parseRichText(parsed.stem),
      options: snapshotOptions,
      stimulus,
      estimatedSeconds:
        typeof parsed.estimatedSeconds === 'number' ? parsed.estimatedSeconds : null,
    },
    hint: options.includeHint && row.hintSnapshot != null ? parseRichText(row.hintSnapshot) : null,
    answer: {
      selectedOptionKey: row.answer?.selectedOptionKey ?? null,
      flagged: row.answer?.flagged ?? false,
      saveVersion: row.answer?.saveVersion ?? 0,
      savedAt: row.answer?.savedAt?.toISOString() ?? null,
    },
  };
}
