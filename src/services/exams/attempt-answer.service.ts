import 'server-only';

import { Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';

/**
 * Autosave, with optimistic concurrency.
 *
 * Two tabs on the same attempt is a normal accident: a student reopens the exam
 * on a second device, or restores a session the browser had suspended. Both
 * tabs then hold an answer state, and one of them is stale. Last-write-wins
 * would silently discard a real answer; merging would invent one.
 *
 * So each save states the `saveVersion` it believes it is updating, and the
 * write is a compare-and-set. A stale tab matches zero rows and is answered 409
 * **with the current server state**, which is what lets it rebase and show the
 * student what is actually stored rather than what it wishes were stored.
 *
 * Every authorization fact is re-checked here, not inherited from the page that
 * rendered the question. A locked section rejects writes at this layer, because
 * the confirmation dialog that locked it lives in a browser the server does not
 * control.
 */

export type AnswerState = {
  attemptQuestionId: string;
  selectedOptionKey: string | null;
  flagged: boolean;
  saveVersion: number;
  savedAt: string | null;
};

export type SaveAnswerResult =
  | { outcome: 'saved'; state: AnswerState }
  | { outcome: 'conflict'; state: AnswerState };

export type SaveAnswerInput = {
  attemptId: string;
  attemptQuestionId: string;
  userId: string;
  /** Null clears the selection; the student is allowed to un-answer. */
  selectedOptionKey: string | null;
  flagged: boolean;
  /** The version the client believes it is updating. 0 means "no row yet". */
  saveVersion: number;
  /** Client-reported and clamped here. Indicative only; never used for scoring. */
  timeSpentSeconds?: number;
};

/** A single question cannot plausibly consume more than this. */
const MAX_TIME_SPENT_SECONDS = 24 * 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Option keys frozen into this attempt's snapshot of the question. */
function snapshotOptionKeys(contentSnapshot: unknown): string[] {
  if (!isRecord(contentSnapshot) || !Array.isArray(contentSnapshot.options)) return [];
  return contentSnapshot.options.flatMap((option) =>
    isRecord(option) && typeof option.key === 'string' ? [option.key] : [],
  );
}

function toState(
  attemptQuestionId: string,
  row: {
    selectedOptionKey: string | null;
    flagged: boolean;
    saveVersion: number;
    savedAt: Date | null;
  } | null,
): AnswerState {
  return {
    attemptQuestionId,
    selectedOptionKey: row?.selectedOptionKey ?? null,
    flagged: row?.flagged ?? false,
    saveVersion: row?.saveVersion ?? 0,
    savedAt: row?.savedAt?.toISOString() ?? null,
  };
}

async function currentState(attemptQuestionId: string): Promise<AnswerState> {
  const row = await prisma.attemptAnswer.findUnique({
    where: { attemptQuestionId },
    select: { selectedOptionKey: true, flagged: true, saveVersion: true, savedAt: true },
  });
  return toState(attemptQuestionId, row);
}

/**
 * Persist one answer.
 *
 * Callers must have resolved the attempt clock first: a section whose deadline
 * passed while the request was in flight must already be `LOCKED` by the time
 * the status check below runs, or a late save would be accepted into a section
 * that was over.
 */
export async function saveAnswer(
  input: SaveAnswerInput,
  now: Date = new Date(),
): Promise<SaveAnswerResult> {
  const question = await prisma.attemptQuestion.findFirst({
    where: { id: input.attemptQuestionId, attemptSection: { examAttemptId: input.attemptId } },
    select: {
      id: true,
      contentSnapshot: true,
      attemptSection: {
        select: {
          status: true,
          attempt: { select: { userId: true, status: true } },
        },
      },
      answer: { select: { revealedAt: true } },
    },
  });

  // Unknown id and someone else's id are answered identically, so the endpoint
  // cannot be used to discover which attempt questions exist.
  if (!question || question.attemptSection.attempt.userId !== input.userId) {
    throw new HttpError(404, COPY.exam.errors.attemptNotFound, 'attempt_question_not_found');
  }

  const attemptStatus = question.attemptSection.attempt.status;
  if (attemptStatus === 'CREATED') {
    throw new HttpError(409, COPY.exam.errors.notStarted, 'attempt_not_started');
  }
  if (attemptStatus !== 'IN_PROGRESS') {
    throw new HttpError(409, COPY.exam.errors.alreadyFinished, 'attempt_finished');
  }
  if (question.attemptSection.status !== 'IN_PROGRESS') {
    throw new HttpError(409, COPY.exam.errors.sectionLocked, 'section_locked');
  }
  if (question.answer?.revealedAt != null) {
    // Training mode showed the answer for this item; editing afterwards would
    // make the recorded response meaningless.
    throw new HttpError(409, COPY.exam.errors.sectionLocked, 'answer_revealed');
  }

  if (input.selectedOptionKey !== null) {
    const keys = snapshotOptionKeys(question.contentSnapshot);
    if (!keys.includes(input.selectedOptionKey)) {
      throw new HttpError(400, COPY.exam.errors.invalidOption, 'invalid_option');
    }
  }

  const timeSpentSeconds = Math.min(
    MAX_TIME_SPENT_SECONDS,
    Math.max(0, Math.trunc(input.timeSpentSeconds ?? 0)),
  );

  if (input.saveVersion === 0) {
    try {
      const created = await prisma.attemptAnswer.create({
        data: {
          attemptQuestionId: question.id,
          selectedOptionKey: input.selectedOptionKey,
          flagged: input.flagged,
          saveVersion: 1,
          savedAt: now,
          timeSpentSeconds,
        },
        select: { selectedOptionKey: true, flagged: true, saveVersion: true, savedAt: true },
      });
      return { outcome: 'saved', state: toState(question.id, created) };
    } catch (error) {
      // The unique constraint on `attemptQuestionId` caught a second tab that
      // also believed no answer existed. That is a stale client, not an error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { outcome: 'conflict', state: await currentState(question.id) };
      }
      throw error;
    }
  }

  const updated = await prisma.attemptAnswer.updateMany({
    where: { attemptQuestionId: question.id, saveVersion: input.saveVersion },
    data: {
      selectedOptionKey: input.selectedOptionKey,
      flagged: input.flagged,
      saveVersion: input.saveVersion + 1,
      savedAt: now,
      timeSpentSeconds,
    },
  });

  if (updated.count === 0) {
    return { outcome: 'conflict', state: await currentState(question.id) };
  }

  return { outcome: 'saved', state: await currentState(question.id) };
}
