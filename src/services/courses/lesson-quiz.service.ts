import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { parseRichText, type RichText } from '@/lib/exam/content';
import { createRandom, deriveSeed, shuffle } from '@/lib/exam/rng';
import { logger } from '@/lib/logger';
import { hasActiveEntitlement } from '@/services/access/entitlement';

/**
 * The student's side of the short quiz an administrator attaches to a lesson.
 *
 * The administration screens have been able to build these since the course
 * builder shipped; nothing rendered them to a student. This is that half.
 *
 * ## What it borrows from the exam engine, and what it deliberately does not
 *
 * Borrowed, because the reasons are identical: content is served from the
 * frozen `QuestionVersion`, never from the editable `Question` row, so an item
 * edited or retired tonight cannot change an attempt a student sat this
 * afternoon; and the answer key never leaves PostgreSQL before the student is
 * entitled to see it — `toQuestionView` is built field by field from a select
 * that does not ask for it.
 *
 * Not borrowed: there is no `AttemptQuestion` table here and no content copy.
 * A lesson quiz is a handful of items and `QuestionVersion.snapshot` is already
 * immutable, so pinning the *version number* is enough to reproduce exactly what
 * was shown. That is precisely what `LessonQuizAnswer.questionVersion` is for.
 * The rows are therefore created up front, one per question, at the moment the
 * attempt starts — an empty `LessonQuizAnswer` is the paper, and answering is an
 * update rather than an insert. Without that the version could only be recorded
 * when the student answered, which would pin the wording they *submitted*
 * against rather than the wording they *read*.
 *
 * ## Two feedback modes, one storage shape
 *
 * `FeedbackMode.IMMEDIATE` grades each answer as it arrives: `isCorrect` is
 * written on the spot and the item is then closed, because a question whose
 * answer has been revealed cannot honestly be re-answered.
 * `AFTER_SUBMISSION` stores the selection with `isCorrect` still null and grades
 * everything in one pass at submission. So `isCorrect !== null` is the single
 * fact that decides whether a question's key may be disclosed, in either mode,
 * and no branch of the serialiser has to reason about the mode at all.
 *
 * ## Scoring
 *
 * `correctCount` and `totalCount` are plain counts of questions. `scorePercent`
 * is weighted by `LessonQuizQuestion.points`, which is the only thing that field
 * can mean: the administration screen describes it as «وزن السؤال داخل هذا
 * الاختبار القصير»، and a percentage that ignored it would make the control
 * decorative. With the default of one point each the two coincide.
 */

// ─────────────────────────────── The views ───────────────────────────────

export type LessonQuizOptionView = { key: string; content: RichText };

export type LessonQuizStimulusView = {
  type: $Enums.StimulusType;
  title: string | null;
  content: RichText;
};

/**
 * One question as the student may see it.
 *
 * `outcome` is null for as long as the answer is undisclosed, and it is the only
 * member carrying the key or the explanation. A question that has not been
 * settled has no field in this type that could leak either.
 */
export type LessonQuizQuestionView = {
  questionId: string;
  position: number;
  points: number;
  stem: RichText;
  options: LessonQuizOptionView[];
  stimulus: LessonQuizStimulusView | null;
  selectedOptionKey: string | null;
  outcome: {
    isCorrect: boolean;
    correctOptionKey: string;
    explanation: RichText | null;
  } | null;
};

export type LessonQuizAttemptView = {
  id: string;
  attemptNumber: number;
  submitted: boolean;
  submittedAt: string | null;
  totalCount: number;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  scorePercent: number | null;
  questions: LessonQuizQuestionView[];
};

export type LessonQuizView = {
  quizId: string;
  lessonId: string;
  feedbackMode: $Enums.FeedbackMode;
  /** Null means unlimited. */
  maxAttempts: number | null;
  attemptsUsed: number;
  /** Null when unlimited; never negative. */
  attemptsRemaining: number | null;
  /** How many questions a fresh attempt would contain, as the bank stands now. */
  questionCount: number;
  bestScorePercent: number | null;
  /** The attempt in progress, or the most recent submitted one, or none yet. */
  attempt: LessonQuizAttemptView | null;
  /** False when the retry budget is spent or the bank has nothing to serve. */
  canStart: boolean;
};

// ───────────────────────────── Reading the bank ─────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ParsedVersion = {
  stem: RichText;
  options: Array<{ key: string; content: RichText; position: number }>;
  correctOptionKey: string;
  explanation: RichText | null;
  stimulus: LessonQuizStimulusView | null;
};

/**
 * Read one frozen version.
 *
 * The same contract `attempt-snapshot.service.ts` applies to an exam paper:
 * tolerant about what it ignores, strict about what it requires. A version with
 * no stem, fewer than two options, or a correct key naming none of them is not
 * deliverable, and returning null here removes that one item rather than
 * rendering something a student cannot answer.
 */
function parseVersionSnapshot(value: unknown): ParsedVersion | null {
  if (!isRecord(value)) return null;

  const correctOptionKey = value.correctOptionKey;
  if (typeof correctOptionKey !== 'string' || correctOptionKey.length === 0) return null;
  if (!Array.isArray(value.options)) return null;

  const options: ParsedVersion['options'] = [];
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

  let stimulus: LessonQuizStimulusView | null = null;
  if (isRecord(value.stimulus) && typeof value.stimulus.type === 'string') {
    stimulus = {
      type: value.stimulus.type as $Enums.StimulusType,
      title: typeof value.stimulus.title === 'string' ? value.stimulus.title : null,
      content: parseRichText(value.stimulus.content),
    };
  }

  return {
    stem,
    options,
    correctOptionKey,
    explanation: value.explanation == null ? null : parseRichText(value.explanation),
    stimulus,
  };
}

/**
 * The questions a *new* attempt would be built from.
 *
 * Filtered to what may currently reach a student: `PUBLISHED` with a frozen
 * version behind it. A question retired after it was added to the quiz stops
 * being served without anybody editing the quiz — which is exactly what the
 * administration screen promises when it marks such a row «لم يعُد منشورًا».
 */
async function eligibleQuizQuestions(
  client: PrismaTransaction,
  quizId: string,
): Promise<Array<{ questionId: string; position: number; points: number; version: number }>> {
  const rows = await client.lessonQuizQuestion.findMany({
    where: { quizId, question: { workflow: 'PUBLISHED', currentVersion: { gt: 0 } } },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      questionId: true,
      position: true,
      points: true,
      question: { select: { currentVersion: true } },
    },
  });

  return rows.map((row) => ({
    questionId: row.questionId,
    position: row.position,
    points: row.points,
    version: row.question.currentVersion,
  }));
}

/**
 * Option order for one question of one attempt.
 *
 * Derived rather than stored. There is no column to keep an order in, and a
 * fresh shuffle on every read would reorder the options under a student who
 * merely refreshed — their stored answer would survive, since it is a key, but
 * the screen would look as though it had been tampered with. Seeding from the
 * attempt id and the question id gives an order that is stable for the life of
 * the attempt, different between attempts, and costs nothing to keep.
 *
 * `Question.shuffleOptions === false` is honoured: some items order their
 * options meaningfully — ascending values, «كل ما سبق» — and shuffling those
 * makes them unanswerable.
 */
function stableSeed(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      hash ^= part.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return deriveSeed(hash >>> 1, 0);
}

function orderOptions(
  parsed: ParsedVersion,
  shuffleAllowed: boolean,
  attemptId: string,
  questionId: string,
): LessonQuizOptionView[] {
  const byPosition = [...parsed.options].sort((a, b) => a.position - b.position);
  const ordered = shuffleAllowed
    ? shuffle(byPosition, createRandom(stableSeed(attemptId, questionId)))
    : byPosition;
  return ordered.map((option) => ({ key: option.key, content: option.content }));
}

// ─────────────────────────── Access to the lesson ───────────────────────────

/**
 * Whether this student may open this lesson at all.
 *
 * Identical to the rule the lesson page itself applies — an active entitlement,
 * or a lesson marked as a preview — and re-decided here rather than inherited
 * from the page that rendered the quiz. The publication filters match
 * `getLearningView`: an unpublished lesson, module or product is not reachable,
 * whatever its own status says.
 *
 * Null and `{ open: false }` are different answers and the callers rely on it:
 * the first is "no such lesson" and the second is "not yours yet".
 */
async function gateLesson(lessonId: string, userId: string): Promise<{ open: boolean } | null> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      status: 'PUBLISHED',
      module: { status: 'PUBLISHED', course: { product: { status: 'PUBLISHED' } } },
    },
    select: {
      isPreview: true,
      module: { select: { course: { select: { productId: true } } } },
    },
  });
  if (!lesson) return null;

  if (lesson.isPreview) return { open: true };
  return { open: await hasActiveEntitlement(userId, lesson.module.course.productId) };
}

// ───────────────────────────── Serialising ─────────────────────────────

type AnswerRow = {
  questionId: string;
  questionVersion: number;
  selectedOptionKey: string | null;
  isCorrect: boolean | null;
};

type MembershipRow = { questionId: string; position: number; points: number };

/**
 * Build the student-facing questions of one attempt.
 *
 * The paper is the set of `LessonQuizAnswer` rows, not the quiz's current
 * membership: a question removed from the quiz — or retired from the bank —
 * after the attempt began stays on the paper the student is holding. Position
 * and points come from the membership rows where they still exist, and fall back
 * to what the answer row can supply otherwise, so a removed question keeps a
 * stable place instead of jumping to the front.
 *
 * `disclose` is decided by the caller for the attempt as a whole (submitted) and
 * per row by `isCorrect !== null` (immediate feedback). Both funnel into the
 * same `outcome` field, which is the only place a key or an explanation appears.
 */
async function buildQuestionViews(
  client: PrismaTransaction,
  input: {
    attemptId: string;
    answers: AnswerRow[];
    membership: MembershipRow[];
    discloseAll: boolean;
  },
): Promise<LessonQuizQuestionView[]> {
  const { attemptId, answers, membership, discloseAll } = input;
  if (answers.length === 0) return [];

  const questionIds = answers.map((answer) => answer.questionId);

  const [questions, versions] = await Promise.all([
    client.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, shuffleOptions: true },
    }),
    client.questionVersion.findMany({
      // Exactly the version pinned on each answer row, never "the latest".
      where: {
        OR: answers.map((answer) => ({
          questionId: answer.questionId,
          version: answer.questionVersion,
        })),
      },
      select: { questionId: true, snapshot: true },
    }),
  ]);

  const shuffleById = new Map(questions.map((row) => [row.id, row.shuffleOptions]));
  const snapshotById = new Map(versions.map((row) => [row.questionId, row.snapshot]));
  const membershipById = new Map(membership.map((row) => [row.questionId, row]));

  const views: LessonQuizQuestionView[] = [];
  const broken: string[] = [];

  answers.forEach((answer, index) => {
    const parsed = parseVersionSnapshot(snapshotById.get(answer.questionId));
    if (!parsed) {
      broken.push(answer.questionId);
      return;
    }

    const place = membershipById.get(answer.questionId);
    const disclose = discloseAll || answer.isCorrect !== null;

    views.push({
      questionId: answer.questionId,
      position: place?.position ?? index,
      points: place?.points ?? 1,
      stem: parsed.stem,
      options: orderOptions(
        parsed,
        shuffleById.get(answer.questionId) ?? true,
        attemptId,
        answer.questionId,
      ),
      stimulus: parsed.stimulus,
      selectedOptionKey: answer.selectedOptionKey,
      outcome: disclose
        ? {
            // A submitted attempt grades unanswered rows as incorrect, so the
            // stored flag is authoritative wherever it exists.
            isCorrect: answer.isCorrect ?? false,
            correctOptionKey: parsed.correctOptionKey,
            explanation: parsed.explanation,
          }
        : null,
    });
  });

  if (broken.length > 0) {
    // One unreadable version drops one question rather than the whole quiz. It
    // is logged because it means a published item has an unusable snapshot,
    // which is a content fault somebody has to fix.
    logger.warn('lesson quiz question has no readable version snapshot', {
      attemptId,
      questionIds: broken,
    });
  }

  return views.sort((a, b) => a.position - b.position);
}

function countUnanswered(answers: AnswerRow[]): number {
  return answers.filter((answer) => answer.selectedOptionKey === null).length;
}

async function buildAttemptView(
  client: PrismaTransaction,
  attempt: {
    id: string;
    attemptNumber: number;
    totalCount: number;
    correctCount: number | null;
    scorePercent: number | null;
    submittedAt: Date | null;
    answers: AnswerRow[];
  },
  membership: MembershipRow[],
): Promise<LessonQuizAttemptView> {
  const submitted = attempt.submittedAt !== null;
  const unanswered = submitted ? countUnanswered(attempt.answers) : null;
  const correct = submitted ? (attempt.correctCount ?? 0) : null;

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    submitted,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalCount: attempt.totalCount,
    correctCount: correct,
    incorrectCount:
      submitted && correct !== null && unanswered !== null
        ? Math.max(0, attempt.totalCount - correct - unanswered)
        : null,
    unansweredCount: unanswered,
    scorePercent: attempt.scorePercent,
    questions: await buildQuestionViews(client, {
      attemptId: attempt.id,
      answers: attempt.answers,
      membership,
      discloseAll: submitted,
    }),
  };
}

const ATTEMPT_SELECT = {
  id: true,
  quizId: true,
  userId: true,
  attemptNumber: true,
  totalCount: true,
  correctCount: true,
  scorePercent: true,
  submittedAt: true,
  answers: {
    select: {
      questionId: true,
      questionVersion: true,
      selectedOptionKey: true,
      isCorrect: true,
    },
  },
} as const satisfies Prisma.LessonQuizAttemptSelect;

// ─────────────────────────────── Reads ───────────────────────────────

/**
 * Everything the lesson page needs to render the quiz, or null when there is
 * nothing to render.
 *
 * Null covers four different facts on purpose — no quiz, no lesson, no access,
 * no eligible question — because the lesson page's answer to all four is the
 * same: show the lesson without a quiz section. The `locked` distinction the
 * page *does* draw (a preview lesson whose course is not owned) is already in
 * its hands from `getLearningView`.
 */
export async function getLessonQuizView(
  lessonId: string,
  userId: string,
): Promise<LessonQuizView | null> {
  const gate = await gateLesson(lessonId, userId);
  if (!gate?.open) return null;

  const quiz = await prisma.lessonQuiz.findUnique({
    where: { lessonId },
    select: { id: true, lessonId: true, feedbackMode: true, maxAttempts: true },
  });
  if (!quiz) return null;

  const [membership, attempts] = await Promise.all([
    eligibleQuizQuestions(prisma, quiz.id),
    prisma.lessonQuizAttempt.findMany({
      where: { quizId: quiz.id, userId },
      orderBy: { attemptNumber: 'desc' },
      select: ATTEMPT_SELECT,
    }),
  ]);

  // A quiz whose every question has been retired is not a quiz any more. It is
  // still shown if the student has already sat it, because their own review must
  // not disappear because an author withdrew an item afterwards.
  if (membership.length === 0 && attempts.length === 0) return null;

  const inProgress = attempts.find((attempt) => attempt.submittedAt === null) ?? null;
  const current = inProgress ?? attempts[0] ?? null;

  const submittedScores = attempts
    .filter((attempt) => attempt.submittedAt !== null && attempt.scorePercent !== null)
    .map((attempt) => attempt.scorePercent as number);

  const attemptsUsed = attempts.length;
  const attemptsRemaining =
    quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attemptsUsed);

  return {
    quizId: quiz.id,
    lessonId: quiz.lessonId,
    feedbackMode: quiz.feedbackMode,
    maxAttempts: quiz.maxAttempts,
    attemptsUsed,
    attemptsRemaining,
    questionCount: membership.length,
    bestScorePercent: submittedScores.length > 0 ? Math.max(...submittedScores) : null,
    attempt: current ? await buildAttemptView(prisma, current, membership) : null,
    // An attempt already in progress is resumed, not started, so `canStart`
    // speaks only about opening a new one.
    canStart: inProgress === null && membership.length > 0 && (attemptsRemaining ?? 1) > 0,
  };
}

// ─────────────────────────────── Writes ───────────────────────────────

/**
 * Open an attempt, or hand back the one already open.
 *
 * Idempotent by construction rather than by the caller remembering: a double
 * tap, or a second tab, finds the in-progress attempt and returns it. The
 * `@@unique([quizId, userId, attemptNumber])` constraint is the backstop for two
 * requests that both read "no attempt yet" — the loser is answered with the
 * winner's attempt instead of a 500.
 *
 * The whole paper is written here: one `LessonQuizAnswer` per eligible question,
 * each pinning the version the student is about to read.
 */
export async function startLessonQuizAttempt(
  lessonId: string,
  userId: string,
): Promise<LessonQuizView> {
  const gate = await gateLesson(lessonId, userId);
  if (!gate) throw new HttpError(404, COPY.lessonQuiz.errors.notFound, 'lesson_not_found');
  if (!gate.open) throw new HttpError(403, COPY.lessonQuiz.errors.noAccess, 'lesson_locked');

  const quiz = await prisma.lessonQuiz.findUnique({
    where: { lessonId },
    select: { id: true, maxAttempts: true },
  });
  if (!quiz) throw new HttpError(404, COPY.lessonQuiz.errors.notFound, 'quiz_not_found');

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.lessonQuizAttempt.findFirst({
        where: { quizId: quiz.id, userId, submittedAt: null },
        select: { id: true },
      });
      if (existing) return;

      const used = await tx.lessonQuizAttempt.count({ where: { quizId: quiz.id, userId } });
      if (quiz.maxAttempts !== null && used >= quiz.maxAttempts) {
        throw new HttpError(
          409,
          COPY.lessonQuiz.errors.attemptsExhausted,
          'quiz_attempts_exhausted',
        );
      }

      const membership = await eligibleQuizQuestions(tx, quiz.id);
      if (membership.length === 0) {
        throw new HttpError(409, COPY.lessonQuiz.errors.noQuestions, 'quiz_has_no_questions');
      }

      const attempt = await tx.lessonQuizAttempt.create({
        data: {
          quizId: quiz.id,
          userId,
          attemptNumber: used + 1,
          totalCount: membership.length,
        },
        select: { id: true },
      });

      await tx.lessonQuizAnswer.createMany({
        data: membership.map((question) => ({
          attemptId: attempt.id,
          questionId: question.questionId,
          questionVersion: question.version,
        })),
      });
    });
  } catch (error) {
    // Two tabs raced past the "no attempt yet" read. The winner's attempt is
    // the right answer for both, and the view below reads it.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
  }

  const view = await getLessonQuizView(lessonId, userId);
  if (!view) throw new HttpError(404, COPY.lessonQuiz.errors.notFound, 'quiz_not_found');
  return view;
}

type LoadedAttempt = {
  id: string;
  quizId: string;
  lessonId: string;
  feedbackMode: $Enums.FeedbackMode;
};

/**
 * Load an attempt that belongs to this student and is still open.
 *
 * An unknown id and somebody else's id are answered identically, so the endpoint
 * cannot be used to discover which attempts exist. Access to the lesson is
 * re-checked as well: an entitlement revoked mid-attempt closes the quiz, and
 * inheriting the check from the page that rendered it would not notice.
 */
async function requireOpenAttempt(attemptId: string, userId: string): Promise<LoadedAttempt> {
  const attempt = await prisma.lessonQuizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      quizId: true,
      submittedAt: true,
      quiz: { select: { lessonId: true, feedbackMode: true } },
    },
  });
  if (!attempt) {
    throw new HttpError(404, COPY.lessonQuiz.errors.attemptNotFound, 'quiz_attempt_not_found');
  }
  if (attempt.submittedAt !== null) {
    throw new HttpError(409, COPY.lessonQuiz.errors.attemptFinished, 'quiz_attempt_finished');
  }

  const gate = await gateLesson(attempt.quiz.lessonId, userId);
  if (!gate?.open) {
    throw new HttpError(403, COPY.lessonQuiz.errors.noAccess, 'lesson_locked');
  }

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    lessonId: attempt.quiz.lessonId,
    feedbackMode: attempt.quiz.feedbackMode,
  };
}

export type SaveLessonQuizAnswerResult = {
  questionId: string;
  selectedOptionKey: string | null;
  /** Present only in immediate mode, where this answer is now settled. */
  outcome: LessonQuizQuestionView['outcome'];
};

/**
 * Record one answer.
 *
 * In `AFTER_SUBMISSION` this is an ordinary, reversible selection: the student
 * may change their mind until they submit. In `IMMEDIATE` it is graded and
 * closed here, and a second write to the same question is refused — the
 * explanation has already been on screen, so re-answering would record a
 * response the student never actually made.
 *
 * The chosen key is checked against the *pinned* version's options, not against
 * the live question, so an option added to the bank after the attempt started
 * cannot be submitted into it.
 */
export async function saveLessonQuizAnswer(input: {
  attemptId: string;
  questionId: string;
  userId: string;
  selectedOptionKey: string | null;
}): Promise<SaveLessonQuizAnswerResult> {
  const attempt = await requireOpenAttempt(input.attemptId, input.userId);

  const answer = await prisma.lessonQuizAnswer.findUnique({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
    select: { id: true, questionVersion: true, isCorrect: true },
  });
  if (!answer) {
    throw new HttpError(
      404,
      COPY.lessonQuiz.errors.questionNotInAttempt,
      'quiz_question_not_in_attempt',
    );
  }
  if (answer.isCorrect !== null) {
    throw new HttpError(409, COPY.lessonQuiz.errors.answerLocked, 'quiz_answer_locked');
  }

  const version = await prisma.questionVersion.findUnique({
    where: {
      questionId_version: { questionId: input.questionId, version: answer.questionVersion },
    },
    select: { snapshot: true },
  });
  const parsed = parseVersionSnapshot(version?.snapshot);
  if (!parsed) {
    throw new HttpError(
      409,
      COPY.lessonQuiz.errors.questionNotInAttempt,
      'quiz_question_unreadable',
    );
  }

  if (
    input.selectedOptionKey !== null &&
    !parsed.options.some((option) => option.key === input.selectedOptionKey)
  ) {
    throw new HttpError(400, COPY.lessonQuiz.errors.invalidOption, 'invalid_option');
  }

  // Immediate mode settles the item now; a cleared selection is not a settlement
  // and stays open.
  const settleNow = attempt.feedbackMode === 'IMMEDIATE' && input.selectedOptionKey !== null;
  const isCorrect = settleNow ? input.selectedOptionKey === parsed.correctOptionKey : null;

  // Guarded on `isCorrect: null` so two concurrent taps in immediate mode cannot
  // both settle the same question; the loser updates nothing and is told the
  // answer is already locked.
  const written = await prisma.lessonQuizAnswer.updateMany({
    where: { id: answer.id, isCorrect: null },
    data: { selectedOptionKey: input.selectedOptionKey, isCorrect },
  });
  if (written.count === 0) {
    throw new HttpError(409, COPY.lessonQuiz.errors.answerLocked, 'quiz_answer_locked');
  }

  return {
    questionId: input.questionId,
    selectedOptionKey: input.selectedOptionKey,
    outcome:
      isCorrect === null
        ? null
        : {
            isCorrect,
            correctOptionKey: parsed.correctOptionKey,
            explanation: parsed.explanation,
          },
  };
}

/**
 * Grade the attempt and close it.
 *
 * Every row is graded here, including the ones immediate mode already settled —
 * their `isCorrect` is left exactly as it was written at the time, because that
 * is the verdict the student was shown. Only rows still holding null are
 * decided now, and an unanswered row is wrong rather than excluded: a quiz of
 * ten questions with three answered is three out of ten, not three out of three.
 *
 * The scan reads each answer's own pinned version, so an item republished
 * between the answer and the submission is still marked against the wording the
 * student read.
 */
export async function submitLessonQuizAttempt(
  attemptId: string,
  userId: string,
): Promise<LessonQuizView> {
  const attempt = await requireOpenAttempt(attemptId, userId);

  const answers = await prisma.lessonQuizAnswer.findMany({
    where: { attemptId: attempt.id },
    select: {
      id: true,
      questionId: true,
      questionVersion: true,
      selectedOptionKey: true,
      isCorrect: true,
    },
  });

  const versions = await prisma.questionVersion.findMany({
    where: {
      OR: answers.map((answer) => ({
        questionId: answer.questionId,
        version: answer.questionVersion,
      })),
    },
    select: { questionId: true, snapshot: true },
  });
  const snapshotById = new Map(versions.map((row) => [row.questionId, row.snapshot]));

  const membership = await eligibleQuizQuestions(prisma, attempt.quizId);
  const pointsById = new Map(membership.map((row) => [row.questionId, row.points]));

  const graded = answers.map((answer) => {
    if (answer.isCorrect !== null) return { ...answer, verdict: answer.isCorrect };

    const parsed = parseVersionSnapshot(snapshotById.get(answer.questionId));
    // An unreadable version cannot be marked either way. It is recorded as
    // incorrect rather than left null, so the attempt has no half-graded rows,
    // and the mismatch is logged for somebody to look at.
    if (!parsed) {
      logger.warn('lesson quiz answer graded against an unreadable version', {
        attemptId: attempt.id,
        questionId: answer.questionId,
        questionVersion: answer.questionVersion,
      });
      return { ...answer, verdict: false };
    }

    return {
      ...answer,
      verdict:
        answer.selectedOptionKey !== null && answer.selectedOptionKey === parsed.correctOptionKey,
    };
  });

  const correctCount = graded.filter((row) => row.verdict).length;
  const totalPoints = graded.reduce((sum, row) => sum + (pointsById.get(row.questionId) ?? 1), 0);
  const earnedPoints = graded.reduce(
    (sum, row) => (row.verdict ? sum + (pointsById.get(row.questionId) ?? 1) : sum),
    0,
  );
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  await prisma.$transaction(async (tx) => {
    // Guarded on the attempt still being open, so a second submission from
    // another tab writes nothing rather than re-stamping `submittedAt`.
    const closed = await tx.lessonQuizAttempt.updateMany({
      where: { id: attempt.id, userId, submittedAt: null },
      data: { correctCount, scorePercent, submittedAt: new Date() },
    });
    if (closed.count === 0) return;

    for (const row of graded) {
      if (row.isCorrect !== null) continue;
      await tx.lessonQuizAnswer.update({
        where: { id: row.id },
        data: { isCorrect: row.verdict },
      });
    }
  });

  const view = await getLessonQuizView(attempt.lessonId, userId);
  if (!view) throw new HttpError(404, COPY.lessonQuiz.errors.notFound, 'quiz_not_found');
  return view;
}
