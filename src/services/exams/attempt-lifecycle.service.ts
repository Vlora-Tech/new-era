import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { createRandom, deriveSeed, newAttemptSeed, shuffle } from '@/lib/exam/rng';
import { AllocationError } from '@/lib/exam/largest-remainder';
import { logger } from '@/lib/logger';
import { hasActiveEntitlement } from '@/services/access/entitlement';
import { resolveAttemptClock } from '@/services/exams/attempt-clock';
import {
  QuestionShortageError,
  selectAttemptQuestions,
  type SectionInput,
} from '@/services/exams/attempt-selection.service';
import {
  SnapshotIntegrityError,
  prepareAttemptQuestions,
  toAttemptQuestionCreate,
} from '@/services/exams/attempt-snapshot.service';
import { scoreAttempt, type AttemptResultSummary } from '@/services/exams/attempt-scoring.service';

/**
 * The attempt lifecycle, in two phases.
 *
 * Creation and starting are deliberately separate operations. Generating a
 * hundred-odd snapshot rows takes long enough that folding it into "start"
 * would charge the student for the server's work: their first section would
 * already be a few seconds old when the page rendered. So `createAttempt`
 * builds the whole paper with no clock at all, and `startAttempt` does nothing
 * but stamp timestamps — which is fast, and therefore fair.
 *
 * Every state transition below is a rowcount-guarded `updateMany` against the
 * status it expects. Read-then-write would let a double-clicked button, a
 * duplicated tab and a retried request each observe the same "not yet started"
 * and all act on it. Guarding on the status means exactly one of them wins and
 * the rest learn they lost, without a lock the application has to remember to
 * take.
 */

// ─────────────────────────── Shared helpers ───────────────────────────

/** Internal sentinel: a guarded transition matched no rows. */
class TransitionRaceLost extends Error {
  constructor() {
    super('attempt transition resolved concurrently');
    this.name = 'TransitionRaceLost';
  }
}

/**
 * Load an attempt the caller owns.
 *
 * A non-owner is answered 404, not 403. Confirming that an attempt id exists
 * but belongs to someone else is an enumeration oracle, and there is nothing
 * useful the person could do with the distinction anyway.
 */
async function loadOwnedAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      mode: true,
      startedAt: true,
      maxEndAt: true,
      submittedAt: true,
      resultSummary: true,
    },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, COPY.exam.errors.attemptNotFound, 'attempt_not_found');
  }
  return attempt;
}

// ─────────────────────────── Phase 1: create ───────────────────────────

export type CreateAttemptInput = {
  userId: string;
  simulatorId: string;
  mode: $Enums.AttemptMode;
  /** Administrator rehearsal against a version students cannot reach yet. */
  isDryRun?: boolean;
  actorRole: 'STUDENT' | 'ADMIN';
};

export type CreateAttemptResult = {
  attemptId: string;
  /** False when an existing live attempt was returned instead of a new one. */
  created: boolean;
};

type SectionPolicySnapshot = {
  calculatorEnabled: boolean;
  scratchpadEnabled: boolean;
  allowReviewWithinSection: boolean;
  lockOnAdvance: boolean;
  pauseEnabled: boolean;
};

export type AttemptSettingsSnapshot = {
  simulatorTitle: string;
  track: $Enums.QuestionTrack;
  mode: $Enums.AttemptMode;
  examVersion: { id: string; versionNumber: number };
  totalQuestions: number;
  totalDurationSec: number;
  resultDisclaimer: string;
  policy: {
    /** Hints exist for practice, not for a simulation of the real thing. */
    hintsEnabled: boolean;
    feedback: $Enums.FeedbackMode;
  };
  sections: Array<
    {
      position: number;
      title: string;
      durationSec: number;
      questionCount: number;
    } & SectionPolicySnapshot
  >;
};

/** Find the live attempt the partial unique index permits, if there is one. */
async function findLiveAttempt(
  client: PrismaTransaction,
  input: { userId: string; examVersionId: string },
): Promise<{ id: string } | null> {
  return client.examAttempt.findFirst({
    where: {
      userId: input.userId,
      examVersionId: input.examVersionId,
      mode: 'FULL_SIMULATION',
      isDryRun: false,
      status: { in: ['CREATED', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
}

/**
 * Build a complete attempt: selection, snapshot, sections, all or nothing.
 *
 * The whole generation is one transaction. A partially written attempt — three
 * sections of five, or questions without their section — would be indexed as a
 * live attempt by the partial unique index and would then block the student
 * from creating a working one. Aborting leaves no trace instead.
 */
export async function createAttempt(input: CreateAttemptInput): Promise<CreateAttemptResult> {
  const { userId, simulatorId, mode, actorRole } = input;
  const isDryRun = Boolean(input.isDryRun) && actorRole === 'ADMIN';

  const simulator = await prisma.examSimulator.findUnique({
    where: { id: simulatorId },
    select: {
      id: true,
      track: true,
      productId: true,
      trainingModeEnabled: true,
      fullSimulationEnabled: true,
      product: { select: { title: true } },
      activeExamVersion: {
        select: {
          id: true,
          status: true,
          versionNumber: true,
          totalQuestions: true,
          totalDurationSec: true,
          resultDisclaimer: true,
          sections: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              position: true,
              durationSec: true,
              questionCount: true,
              calculatorEnabled: true,
              scratchpadEnabled: true,
              allowReviewWithinSection: true,
              lockOnAdvance: true,
              pauseEnabled: true,
              blueprintRules: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  position: true,
                  track: true,
                  domain: true,
                  subskill: true,
                  difficulty: true,
                  percentage: true,
                  questionCount: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!simulator) {
    throw new HttpError(404, COPY.exam.errors.simulatorNotFound, 'simulator_not_found');
  }

  const version = simulator.activeExamVersion;
  if (!version || version.sections.length === 0) {
    throw new HttpError(409, COPY.exam.errors.versionNotPublished, 'version_not_ready');
  }

  if (mode === 'FULL_SIMULATION' && !simulator.fullSimulationEnabled) {
    throw new HttpError(409, COPY.exam.errors.modeUnavailable, 'mode_unavailable');
  }
  if (mode === 'TRAINING' && !simulator.trainingModeEnabled) {
    throw new HttpError(409, COPY.exam.errors.modeUnavailable, 'mode_unavailable');
  }

  if (!isDryRun) {
    if (version.status !== 'PUBLISHED') {
      throw new HttpError(409, COPY.exam.errors.versionNotPublished, 'version_not_published');
    }
    // Access is decided from the entitlement rows, never from anything the
    // browser carried into this request.
    const entitled = await hasActiveEntitlement(userId, simulator.productId);
    if (!entitled) {
      throw new HttpError(403, COPY.exam.errors.noAccess, 'no_entitlement');
    }
  }

  const isLiveCandidate = mode === 'FULL_SIMULATION' && !isDryRun;

  if (isLiveCandidate) {
    const existing = await findLiveAttempt(prisma, { userId, examVersionId: version.id });
    if (existing) return { attemptId: existing.id, created: false };
  }

  const sectionInputs: SectionInput[] = version.sections.map((section) => ({
    id: section.id,
    position: section.position,
    questionCount: section.questionCount,
    blueprintRules: section.blueprintRules,
  }));

  const settings: AttemptSettingsSnapshot = {
    simulatorTitle: simulator.product.title,
    track: simulator.track,
    mode,
    examVersion: { id: version.id, versionNumber: version.versionNumber },
    totalQuestions: version.totalQuestions,
    totalDurationSec: version.totalDurationSec,
    resultDisclaimer: version.resultDisclaimer,
    policy: {
      hintsEnabled: mode === 'TRAINING',
      feedback: mode === 'TRAINING' ? 'IMMEDIATE' : 'AFTER_SUBMISSION',
    },
    sections: version.sections.map((section) => ({
      position: section.position,
      title: section.title,
      durationSec: section.durationSec,
      questionCount: section.questionCount,
      calculatorEnabled: section.calculatorEnabled,
      scratchpadEnabled: section.scratchpadEnabled,
      allowReviewWithinSection: section.allowReviewWithinSection,
      lockOnAdvance: section.lockOnAdvance,
      pauseEnabled: section.pauseEnabled,
    })),
  };

  const seed = newAttemptSeed();

  try {
    const attemptId = await prisma.$transaction(async (tx) => {
      const selection = await selectAttemptQuestions(tx, {
        sections: sectionInputs,
        seed,
        defaultTrack: simulator.track,
      });

      const totalQuestions = selection.reduce((sum, section) => sum + section.questions.length, 0);

      const attempt = await tx.examAttempt.create({
        data: {
          userId,
          simulatorId: simulator.id,
          examVersionId: version.id,
          mode,
          status: 'CREATED',
          settingsSnapshot: settings as unknown as Prisma.InputJsonValue,
          seed,
          isDryRun,
          totalQuestions,
        },
        select: { id: true },
      });

      for (const sectionSelection of selection) {
        const source = version.sections.find(
          (section) => section.id === sectionSelection.examSectionId,
        )!;

        const attemptSection = await tx.attemptSection.create({
          data: {
            examAttemptId: attempt.id,
            examSectionId: source.id,
            position: source.position,
            titleSnapshot: source.title,
            durationSecSnapshot: source.durationSec,
            policySnapshot: {
              calculatorEnabled: source.calculatorEnabled,
              scratchpadEnabled: source.scratchpadEnabled,
              allowReviewWithinSection: source.allowReviewWithinSection,
              lockOnAdvance: source.lockOnAdvance,
              pauseEnabled: source.pauseEnabled,
            } satisfies SectionPolicySnapshot as unknown as Prisma.InputJsonValue,
            status: 'PENDING',
          },
          select: { id: true },
        });

        // Delivered order is shuffled away from the blueprint's rule order:
        // otherwise every paper would open with four analogies in a row, which
        // tells the student which skill is being tested before they read it.
        const ordered = shuffle(
          sectionSelection.questions,
          createRandom(deriveSeed(seed, sectionSelection.position)),
        );

        const prepared = await prepareAttemptQuestions(tx, {
          sourceQuestions: ordered.map((question) => ({
            questionId: question.id,
            questionVersion: question.currentVersion,
            domain: question.domain,
            subskill: question.subskill,
            difficulty: question.difficulty,
          })),
          seed,
          sectionPosition: sectionSelection.position,
        });

        await tx.attemptQuestion.createMany({
          data: prepared.map((question) => toAttemptQuestionCreate(attemptSection.id, question)),
        });
      }

      return attempt.id;
    });

    logger.info('exam attempt created', { attemptId, userId, simulatorId, mode, isDryRun });
    return { attemptId, created: true };
  } catch (error) {
    // The partial unique index is the real idempotency guarantee: two requests
    // can both pass the read above, and only one insert survives. The loser
    // returns the winner's attempt rather than an error the student cannot act
    // on.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      isLiveCandidate
    ) {
      const existing = await findLiveAttempt(prisma, { userId, examVersionId: version.id });
      if (existing) return { attemptId: existing.id, created: false };
    }

    if (error instanceof QuestionShortageError) {
      logger.error('attempt generation aborted: question shortage', {
        userId,
        simulatorId,
        examVersionId: version.id,
        shortages: error.shortages,
      });
      throw new HttpError(409, COPY.exam.errors.questionShortage, 'question_shortage');
    }

    if (error instanceof SnapshotIntegrityError || error instanceof AllocationError) {
      logger.error('attempt generation aborted', {
        userId,
        simulatorId,
        examVersionId: version.id,
        error,
      });
      throw new HttpError(409, COPY.exam.errors.generationFailed, 'generation_failed');
    }

    throw error;
  }
}

// ─────────────────────────── Phase 2: start ───────────────────────────

export type StartAttemptResult = {
  attemptId: string;
  status: $Enums.AttemptStatus;
  startedAt: Date | null;
  maxEndAt: Date | null;
  /** False when the attempt was already running; the call is still a success. */
  started: boolean;
};

/**
 * Put the attempt on the clock.
 *
 * `maxEndAt` is recorded as the latest instant the attempt could still be open,
 * assuming every section runs its full length. It is an upper bound used by list
 * queries so a stale attempt can be described without resolving its clock;
 * advancing early makes the real end earlier, never later.
 */
export async function startAttempt(
  attemptId: string,
  userId: string,
  now: Date = new Date(),
): Promise<StartAttemptResult> {
  const attempt = await loadOwnedAttempt(attemptId, userId);

  if (attempt.status === 'IN_PROGRESS') {
    return {
      attemptId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      maxEndAt: attempt.maxEndAt,
      started: false,
    };
  }
  if (attempt.status !== 'CREATED') {
    throw new HttpError(409, COPY.exam.errors.alreadyFinished, 'attempt_finished');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sections = await tx.attemptSection.findMany({
        where: { examAttemptId: attemptId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true, durationSecSnapshot: true },
      });
      if (sections.length === 0) throw new TransitionRaceLost();

      const totalSec = sections.reduce(
        (sum, section) => sum + (section.durationSecSnapshot ?? 0),
        0,
      );

      const started = await tx.examAttempt.updateMany({
        where: { id: attemptId, status: 'CREATED' },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
          maxEndAt: new Date(now.getTime() + totalSec * 1_000),
        },
      });
      if (started.count === 0) throw new TransitionRaceLost();

      const first = sections[0]!;
      const deadlineAt =
        first.durationSecSnapshot == null
          ? null
          : new Date(now.getTime() + first.durationSecSnapshot * 1_000);

      const activated = await tx.attemptSection.updateMany({
        where: { id: first.id, status: 'PENDING' },
        data: { status: 'IN_PROGRESS', startedAt: now, deadlineAt },
      });
      if (activated.count === 0) throw new TransitionRaceLost();
    });
  } catch (error) {
    if (!(error instanceof TransitionRaceLost)) throw error;
  }

  const fresh = await loadOwnedAttempt(attemptId, userId);
  logger.info('exam attempt started', { attemptId, userId });
  return {
    attemptId,
    status: fresh.status,
    startedAt: fresh.startedAt,
    maxEndAt: fresh.maxEndAt,
    started: fresh.status === 'IN_PROGRESS',
  };
}

// ─────────────────────────── Advancing ───────────────────────────

export type AdvanceSectionResult =
  | { outcome: 'advanced'; nextSectionId: string; nextPosition: number }
  | { outcome: 'submitted'; summary: AttemptResultSummary | null };

/**
 * Close the current section and open the next.
 *
 * Irreversible by design, and enforced here rather than in the interface: the
 * confirmation dialog can be bypassed by anyone with a terminal, so the answer
 * service checks section status on every write. Once this returns, the section
 * is `LOCKED` and no request can reopen it.
 *
 * Advancing out of the last section finalises the attempt, so a student who
 * reaches the end by advancing gets the same result as one who pressed submit.
 */
export async function advanceSection(input: {
  attemptId: string;
  attemptSectionId: string;
  userId: string;
  now?: Date;
}): Promise<AdvanceSectionResult> {
  const now = input.now ?? new Date();

  // The clock may already have closed this section; resolving first means the
  // student is told "it expired" rather than being credited with an advance.
  await resolveAttemptClock(input.attemptId, now);

  const attempt = await loadOwnedAttempt(input.attemptId, input.userId);
  if (attempt.status === 'CREATED') {
    throw new HttpError(409, COPY.exam.errors.notStarted, 'attempt_not_started');
  }
  if (attempt.status !== 'IN_PROGRESS') {
    return { outcome: 'submitted', summary: readSummary(attempt.resultSummary) };
  }

  let outcome: AdvanceSectionResult | null = null;

  try {
    outcome = await prisma.$transaction(async (tx) => {
      const section = await tx.attemptSection.findFirst({
        where: { id: input.attemptSectionId, examAttemptId: input.attemptId },
        select: { id: true, position: true, status: true },
      });
      if (!section) {
        throw new HttpError(404, COPY.exam.errors.attemptNotFound, 'section_not_found');
      }
      if (section.status !== 'IN_PROGRESS') {
        throw new HttpError(409, COPY.exam.errors.sectionLocked, 'section_locked');
      }

      const locked = await tx.attemptSection.updateMany({
        where: { id: section.id, status: 'IN_PROGRESS' },
        data: { status: 'LOCKED', lockedAt: now, lockedReason: 'ADVANCED' },
      });
      if (locked.count === 0) throw new TransitionRaceLost();

      const next = await tx.attemptSection.findFirst({
        where: { examAttemptId: input.attemptId, position: section.position + 1 },
        select: { id: true, position: true, durationSecSnapshot: true },
      });

      if (!next) {
        const summary = await finaliseAttempt(tx, {
          attemptId: input.attemptId,
          status: 'SUBMITTED',
          finalisedAt: now,
        });
        return { outcome: 'submitted', summary } satisfies AdvanceSectionResult;
      }

      // The next section starts now, not at the section's original deadline:
      // time given up by advancing early is forfeited, not banked.
      const deadlineAt =
        next.durationSecSnapshot == null
          ? null
          : new Date(now.getTime() + next.durationSecSnapshot * 1_000);

      const activated = await tx.attemptSection.updateMany({
        where: { id: next.id, status: 'PENDING' },
        data: { status: 'IN_PROGRESS', startedAt: now, deadlineAt },
      });
      if (activated.count === 0) throw new TransitionRaceLost();

      return {
        outcome: 'advanced',
        nextSectionId: next.id,
        nextPosition: next.position,
      } satisfies AdvanceSectionResult;
    });
  } catch (error) {
    if (!(error instanceof TransitionRaceLost)) throw error;
  }

  if (outcome) {
    logger.info('exam section advanced', {
      attemptId: input.attemptId,
      attemptSectionId: input.attemptSectionId,
      outcome: outcome.outcome,
    });
    return outcome;
  }

  // Another request advanced or expired the same section between our checks.
  const fresh = await loadOwnedAttempt(input.attemptId, input.userId);
  if (fresh.status !== 'IN_PROGRESS') {
    return { outcome: 'submitted', summary: readSummary(fresh.resultSummary) };
  }
  throw new HttpError(409, COPY.exam.errors.sectionLocked, 'section_locked');
}

// ─────────────────────────── Submitting ───────────────────────────

export type SubmitAttemptResult = {
  attemptId: string;
  status: $Enums.AttemptStatus;
  submittedAt: Date | null;
  summary: AttemptResultSummary | null;
  /** False when the attempt was already terminal and the stored result stands. */
  finalised: boolean;
};

function readSummary(value: unknown): AttemptResultSummary | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as AttemptResultSummary;
}

/**
 * Close every remaining section and score the attempt.
 *
 * Shared by deliberate submission and by advancing out of the last section, and
 * shaped so expiry can reuse it too. Sections still open are locked with
 * `FINALIZED` rather than `EXPIRED`, so the review can tell "you submitted with
 * time to spare" apart from "the clock ran out".
 */
async function finaliseAttempt(
  tx: PrismaTransaction,
  input: { attemptId: string; status: 'SUBMITTED'; finalisedAt: Date },
): Promise<AttemptResultSummary> {
  const closed = await tx.examAttempt.updateMany({
    where: { id: input.attemptId, status: 'IN_PROGRESS' },
    data: { status: input.status, submittedAt: input.finalisedAt },
  });
  if (closed.count === 0) throw new TransitionRaceLost();

  await tx.attemptSection.updateMany({
    where: { examAttemptId: input.attemptId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { status: 'LOCKED', lockedAt: input.finalisedAt, lockedReason: 'FINALIZED' },
  });

  return scoreAttempt(tx, {
    attemptId: input.attemptId,
    finalisedBy: 'SUBMITTED',
    computedAt: input.finalisedAt,
  });
}

/**
 * Submit, idempotently.
 *
 * A replayed submission — the retry of a request whose response was lost, a
 * second tab, a double tap — returns the result that was already computed. It
 * must never re-score: scoring twice would rewrite `computedAt` and could
 * produce a different summary if the clock resolved differently in between.
 */
export async function submitAttempt(
  attemptId: string,
  userId: string,
  now: Date = new Date(),
): Promise<SubmitAttemptResult> {
  await resolveAttemptClock(attemptId, now);

  const attempt = await loadOwnedAttempt(attemptId, userId);

  if (attempt.status === 'CREATED') {
    throw new HttpError(409, COPY.exam.errors.notStarted, 'attempt_not_started');
  }
  if (attempt.status !== 'IN_PROGRESS') {
    return {
      attemptId,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      summary: readSummary(attempt.resultSummary),
      finalised: false,
    };
  }

  let summary: AttemptResultSummary | null = null;
  try {
    summary = await prisma.$transaction((tx) =>
      finaliseAttempt(tx, { attemptId, status: 'SUBMITTED', finalisedAt: now }),
    );
  } catch (error) {
    if (!(error instanceof TransitionRaceLost)) throw error;
  }

  const fresh = await loadOwnedAttempt(attemptId, userId);
  if (summary) logger.info('exam attempt submitted', { attemptId, userId });

  return {
    attemptId,
    status: fresh.status,
    submittedAt: fresh.submittedAt,
    summary: summary ?? readSummary(fresh.resultSummary),
    finalised: summary !== null,
  };
}
