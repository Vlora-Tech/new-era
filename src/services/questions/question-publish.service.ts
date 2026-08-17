import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { AUDIT_ACTIONS, writeAuditLog } from '@/services/audit/audit.service';
import type { QuestionAdminContext } from '@/services/questions/question-admin.service';
import type { QuestionTransitionInput } from '@/validators/admin-question';

/**
 * The review workflow, and the snapshot that publication freezes.
 *
 * ## Why a snapshot exists at all
 *
 * A `Question` row is an editable draft. A student is never served it. Publishing
 * copies the stem, the ordered options *with the correct key*, the explanation,
 * the hint, the classification and the embedded stimulus into an immutable
 * `QuestionVersion`, and points `currentVersion` at it. `attempt-snapshot.service.ts`
 * copies from that frozen row into the attempt.
 *
 * The property this buys is the whole reason for the design: an exam a student is
 * sitting cannot change under them. Fixing a typo, swapping a distractor,
 * withdrawing an item — none of it reaches a paper already generated, and none of
 * it can turn an answer that was right when it was given into a wrong one. A
 * result that cannot be reproduced from the content the student actually saw is
 * not a result.
 *
 * The eligible pool is `currentVersion > 0 AND workflow != RETIRED`. Both halves
 * matter: the first guarantees a frozen version exists to copy, the second is how
 * an item leaves service without anything being deleted.
 *
 * ## Why retiring is not deleting
 *
 * `QuestionVersion.questionId` is `onDelete: Restrict`, as are the exam-section,
 * lesson-quiz and attempt edges. A question that has ever been served has to
 * survive, because a past attempt's score was computed against it. Retirement is
 * therefore the withdrawal mechanism, and `deleteQuestion` refuses everything
 * except a draft that was never published and that nothing points at.
 */

// ───────────────────────────── The state machine ────────────────────────────

/**
 * Permitted workflow transitions, written out rather than implied by `if`s.
 *
 * The forward path is DRAFT → IN_REVIEW → APPROVED → PUBLISHED → RETIRED. Three
 * backward edges are legitimate and each has a distinct meaning:
 *
 *  - `IN_REVIEW → DRAFT` — the reviewer asked for changes.
 *  - `APPROVED → DRAFT` — the item was approved and then needed further editing;
 *    the approval it had no longer describes what the row now says, so it is
 *    dropped rather than carried forward.
 *  - `RETIRED → DRAFT` — a withdrawn item is being rewritten. It has to be
 *    reviewed and approved again before it can serve anybody, which is why
 *    `currentVersion` is reset when this edge is taken.
 *
 * `PUBLISHED → DRAFT` is deliberately absent. A published item is edited in place
 * — the draft and the served snapshot are different things — and it leaves
 * service by being retired, never by quietly becoming a draft again.
 */
export const QUESTION_TRANSITIONS = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['RETIRED'],
  RETIRED: ['DRAFT'],
} as const satisfies Record<$Enums.QuestionWorkflow, readonly $Enums.QuestionWorkflow[]>;

/**
 * Whether a question may move between two states.
 *
 * A move to the state it is already in is not a transition and returns false, so
 * a caller that needs an idempotent or repeating operation has to say so — see
 * `isQuestionRepublication`, which is the only such case.
 */
export function canTransitionQuestion(
  from: $Enums.QuestionWorkflow,
  to: $Enums.QuestionWorkflow,
): boolean {
  return (QUESTION_TRANSITIONS[from] as readonly $Enums.QuestionWorkflow[]).includes(to);
}

/**
 * Publishing an already-published question: a re-publication, not a transition.
 *
 * Editing a published question changes the draft and leaves students on the
 * frozen version until a new one is cut — that is what the editor is told on the
 * screen. Cutting that new version is `PUBLISHED → PUBLISHED`, which is a real
 * operation with a real effect (a new `QuestionVersion`, `currentVersion + 1`)
 * even though the workflow column does not move. It is kept out of the table
 * above so the table stays a description of the review path rather than a mix of
 * state changes and actions.
 */
export function isQuestionRepublication(
  from: $Enums.QuestionWorkflow,
  to: $Enums.QuestionWorkflow,
): boolean {
  return from === 'PUBLISHED' && to === 'PUBLISHED';
}

/** Every move this service will accept, transitions and re-publication alike. */
export function isQuestionMoveAllowed(
  from: $Enums.QuestionWorkflow,
  to: $Enums.QuestionWorkflow,
): boolean {
  return canTransitionQuestion(from, to) || isQuestionRepublication(from, to);
}

/** A verdict stamps the reviewer; publishing and retiring do not. */
function isReviewVerdict(from: $Enums.QuestionWorkflow, to: $Enums.QuestionWorkflow): boolean {
  if (to === 'APPROVED') return true;
  return to === 'DRAFT' && (from === 'IN_REVIEW' || from === 'APPROVED');
}

// ─────────────────────────── The version snapshot ───────────────────────────

/**
 * What one frozen version holds.
 *
 * The shape is fixed by `parseVersionSnapshot` in `attempt-snapshot.service.ts`,
 * which refuses a version without a stem, without two options, or without a
 * correct key that names one of them. Option keys are the option row ids as they
 * were at publication; the live rows may be replaced by a later edit, and the
 * snapshot keeps working because it never looks them up again.
 */
type VersionSnapshot = {
  stem: Prisma.JsonValue;
  options: Array<{ key: string; content: Prisma.JsonValue; position: number }>;
  correctOptionKey: string;
  explanation: Prisma.JsonValue | null;
  hint: Prisma.JsonValue | null;
  classification: {
    domain: $Enums.QuestionDomain;
    subskill: string | null;
    difficulty: $Enums.QuestionDifficulty;
    track: $Enums.QuestionTrack;
  };
  stimulus: {
    type: $Enums.StimulusType;
    title: string | null;
    content: Prisma.JsonValue;
  } | null;
};

const PUBLISH_SOURCE_SELECT = {
  id: true,
  stem: true,
  explanation: true,
  hint: true,
  domain: true,
  subskill: true,
  difficulty: true,
  track: true,
  workflow: true,
  currentVersion: true,
  authorOrLicensor: true,
  rightsDeclaration: true,
  options: {
    orderBy: { position: 'asc' },
    select: { id: true, content: true, position: true, isCorrect: true },
  },
  stimulus: { select: { type: true, title: true, content: true } },
} as const satisfies Prisma.QuestionSelect;

type PublishSource = Prisma.QuestionGetPayload<{ select: typeof PUBLISH_SOURCE_SELECT }>;

/**
 * Everything that must be true before an item can reach a student.
 *
 * The rights check is the one that is not merely hygiene.
 * `docs/content-and-legal-checklist.md` allows only original New Era material or
 * content covered by a documented written licence into the bank, and blocks
 * publication when the author or licensor and the declaration are not both
 * recorded. The column is nullable for rows that predate the rule, so the check
 * lives here rather than being assumed from the schema.
 */
function assertPublishable(question: PublishSource): void {
  if (question.options.length < 2) {
    throw new HttpError(409, COPY.adminQuestions.errors.needsTwoOptions, 'needs_two_options');
  }
  if (question.options.filter((option) => option.isCorrect).length !== 1) {
    throw new HttpError(
      409,
      COPY.adminQuestions.errors.needsExactlyOneCorrect,
      'needs_exactly_one_correct',
    );
  }
  if (question.authorOrLicensor.trim().length === 0 || question.rightsDeclaration === null) {
    throw new HttpError(409, COPY.adminQuestions.errors.rightsRequired, 'rights_required');
  }
}

function buildVersionSnapshot(question: PublishSource): VersionSnapshot {
  const ordered = [...question.options].sort((a, b) => a.position - b.position);
  const correct = ordered.find((option) => option.isCorrect);

  // `assertPublishable` has already run; this narrows the type rather than
  // re-deciding the rule.
  if (!correct) {
    throw new HttpError(
      409,
      COPY.adminQuestions.errors.needsExactlyOneCorrect,
      'needs_exactly_one_correct',
    );
  }

  return {
    stem: question.stem,
    options: ordered.map((option) => ({
      key: option.id,
      content: option.content,
      position: option.position,
    })),
    correctOptionKey: correct.id,
    explanation: question.explanation,
    hint: question.hint,
    classification: {
      domain: question.domain,
      subskill: question.subskill,
      difficulty: question.difficulty,
      track: question.track,
    },
    // Embedded, not referenced. A shared reading passage that is edited later
    // must not change under an attempt that already quoted it.
    stimulus: question.stimulus
      ? {
          type: question.stimulus.type,
          title: question.stimulus.title,
          content: question.stimulus.content,
        }
      : null,
  };
}

/**
 * Write the frozen version and point the question at it.
 *
 * The version number comes from the highest one already written, not from
 * `currentVersion` + 1. They differ after a restore, which resets
 * `currentVersion` to zero while the historical versions stay in place; deriving
 * from the counter would try to write version 1 twice and collide with the
 * `(questionId, version)` unique constraint.
 */
async function freezeVersion(
  tx: PrismaTransaction,
  question: PublishSource,
  context: QuestionAdminContext,
): Promise<number> {
  const highest = await tx.questionVersion.aggregate({
    where: { questionId: question.id },
    _max: { version: true },
  });
  const version = (highest._max.version ?? 0) + 1;

  await tx.questionVersion.create({
    data: {
      questionId: question.id,
      version,
      createdById: context.actor.id,
      snapshot: buildVersionSnapshot(question) as unknown as Prisma.InputJsonValue,
    },
  });

  return version;
}

// ───────────────────────────────── Transitions ──────────────────────────────

export type QuestionTransitionResult = {
  questionId: string;
  from: $Enums.QuestionWorkflow;
  workflow: $Enums.QuestionWorkflow;
  currentVersion: number;
  /** True when this call cut a new frozen version. */
  published: boolean;
};

/**
 * Move a question through the review workflow.
 *
 * The whole operation runs inside one transaction that opens by locking the
 * question row. Two administrators pressing "publish" at the same moment would
 * otherwise both read `APPROVED`, both compute version 1 and the second would die
 * on the `(questionId, version)` unique constraint with the first one's snapshot
 * already committed. Serialised here, the second caller blocks, re-reads a row
 * that now says `PUBLISHED`, and its call becomes an ordinary re-publication that
 * cuts version 2 — an outcome with an audit row rather than a 500.
 *
 * `questionTransitionSchema` only guarantees the target state exists. Whether
 * the move is legal *from where the row currently is* is a business rule, and
 * this is the only layer that can see the current state.
 */
export async function transitionQuestion(
  questionId: string,
  input: QuestionTransitionInput,
  context: QuestionAdminContext,
): Promise<QuestionTransitionResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "questions" WHERE "id" = ${questionId}::uuid FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new HttpError(404, COPY.adminQuestions.errors.notFound, 'question_not_found');
    }

    const question = await tx.question.findUniqueOrThrow({
      where: { id: questionId },
      select: PUBLISH_SOURCE_SELECT,
    });

    const from = question.workflow;
    const to = input.to;

    if (!isQuestionMoveAllowed(from, to)) {
      // Publishing something nobody approved is the mistake worth naming, since
      // "you cannot go from here to there" does not say what is missing.
      if (to === 'PUBLISHED') {
        throw new HttpError(409, COPY.adminQuestions.errors.reviewRequired, 'review_required');
      }
      throw new HttpError(409, COPY.adminQuestions.errors.invalidTransition, 'invalid_transition');
    }

    const now = new Date();
    const note = input.note?.trim() ? input.note.trim() : null;

    const data: Prisma.QuestionUpdateInput = { workflow: to };
    if (note !== null) data.reviewNote = note;
    if (isReviewVerdict(from, to)) {
      data.reviewedBy = { connect: { id: context.actor.id } };
      data.reviewedAt = now;
    }

    let published = false;
    let currentVersion = question.currentVersion;

    if (to === 'PUBLISHED') {
      assertPublishable(question);
      currentVersion = await freezeVersion(tx, question, context);
      data.currentVersion = currentVersion;
      data.publishedAt = now;
      // A question coming back into service is no longer withdrawn.
      data.retiredAt = null;
      published = true;
    }

    if (to === 'RETIRED') {
      data.retiredAt = now;
    }

    if (to === 'DRAFT' && from === 'RETIRED') {
      // Restoring a withdrawn item returns it to the editor, not to service.
      // The eligible pool is `currentVersion > 0 AND workflow != RETIRED`, so
      // leaving the counter alone would silently put the old, withdrawn snapshot
      // back in front of students the instant the workflow column moved off
      // RETIRED — the opposite of what the confirmation promises. The frozen
      // `QuestionVersion` rows stay exactly where they are, because attempts
      // built from them still have to be readable.
      data.currentVersion = 0;
      data.retiredAt = null;
      currentVersion = 0;
    }

    await tx.question.update({ where: { id: questionId }, data });

    await writeAuditLog(tx, {
      actor: context.actor,
      // The specific spelling where one exists: publication and retirement are
      // the two events anybody will ever filter this table for.
      action: published
        ? AUDIT_ACTIONS.QUESTION_PUBLISHED
        : to === 'RETIRED'
          ? AUDIT_ACTIONS.QUESTION_RETIRED
          : AUDIT_ACTIONS.QUESTION_WORKFLOW_CHANGED,
      targetType: 'Question',
      targetId: questionId,
      metadata: {
        from,
        to,
        version: currentVersion,
        republished: isQuestionRepublication(from, to),
        note,
      },
      requestId: context.requestId,
    });

    return { questionId, from, workflow: to, currentVersion, published };
  });
}
