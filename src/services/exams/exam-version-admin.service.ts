import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { parseRichText, richTextToPlain } from '@/lib/exam/content';
// `allocateByLargestRemainder` returns with the per-rule coverage pass below;
// its module and its unit tests are untouched.
import { AllocationError } from '@/lib/exam/largest-remainder';
import { formatNumber } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  AUDIT_ACTIONS,
  auditChanges,
  writeAuditLog,
  type AuditAction,
} from '@/services/audit/audit.service';
import {
  generateSelection,
  loadCandidatePool,
  QuestionShortageError,
  type SectionInput,
} from '@/services/exams/attempt-selection.service';
import {
  applyActiveVersionChange,
  parseUuidOr404,
  type AdminSimulatorContext,
} from '@/services/exams/simulator-admin.service';
import type {
  CreateBlueprintRuleInput,
  CreateExamSectionInput,
  CreateExamVersionInput,
  ExamSectionSettingsInput,
  ExamVersionAction,
  UpdateExamVersionInput,
} from '@/validators/admin-simulator';

/**
 * The exam version and everything it owns: sections, their fixed question lists
 * and their blueprint rules.
 *
 * One aggregate, one file, because they share one invariant that nothing below
 * the aggregate can enforce.
 *
 * ## Why a version is frozen
 *
 * `ExamAttempt.examVersionId` pins an attempt to the version it was generated
 * from, and `AttemptSection`/`AttemptQuestion` hold snapshots of what the
 * student was actually shown. Editing a published version would therefore not
 * corrupt a running attempt — but it would make two students who both "sat
 * version 3" have sat different exams, with nothing recording that the exam
 * changed between them. A result that cannot be traced to a definition is not a
 * result, so publication freezes the structure and the way to change it is to
 * clone into a new draft. Every mutation below refuses on anything but `DRAFT`.
 *
 * ## Why publication and activation are separate
 *
 * Publishing says "this structure is final". Activating says "this is the one
 * students receive", and it is the simulator that holds that pointer. Collapsing
 * them would mean a version reviewed on Sunday goes live the instant it is
 * frozen, which is precisely the moment nobody has looked at it end to end yet.
 *
 * ## Why coverage is checked before publication and not only at attempt time
 *
 * `attempt-selection.service.ts` refuses to generate a paper whose rules the
 * bank cannot fill, and it is right to: a section one question short is not the
 * exam the student was told they were sitting. But that refusal arrives when a
 * student presses "ابدأ". `buildCoverageReport` runs the same allocation and the
 * same eligibility rule against the bank as it stands now, so the failure is
 * found by the person who can fix it.
 */

// ─────────────────────────────── Identifiers ────────────────────────────────

export function parseExamVersionId(value: string): string {
  return parseUuidOr404(
    value,
    COPY.adminSimulators.errors.versionNotFound,
    'exam_version_not_found',
  );
}

export function parseExamSectionId(value: string): string {
  return parseUuidOr404(
    value,
    COPY.adminSimulators.errors.sectionNotFound,
    'exam_section_not_found',
  );
}

function versionNotFound(): never {
  throw new HttpError(404, COPY.adminSimulators.errors.versionNotFound, 'exam_version_not_found');
}

function sectionNotFound(): never {
  throw new HttpError(404, COPY.adminSimulators.errors.sectionNotFound, 'exam_section_not_found');
}

function ruleNotFound(): never {
  throw new HttpError(404, COPY.adminSimulators.errors.ruleNotFound, 'blueprint_rule_not_found');
}

/**
 * The one refusal every child mutation shares.
 *
 * Named `frozen` rather than `forbidden` because nothing is wrong with the
 * request: the version is simply no longer editable, and the copy points at the
 * clone that is.
 */
function versionFrozen(): never {
  throw new HttpError(
    409,
    COPY.adminSimulators.errors.versionImmutableAfterPublish,
    'exam_version_frozen',
  );
}

// ───────────────────────────────── Selects ──────────────────────────────────

const RULE_SELECT = {
  id: true,
  position: true,
  track: true,
  domain: true,
  subskill: true,
  difficulty: true,
  percentage: true,
  questionCount: true,
} satisfies Prisma.ExamBlueprintRuleSelect;

const SECTION_SELECT = {
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
  blueprintRules: { orderBy: { position: 'asc' }, select: RULE_SELECT },
  fixedQuestions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      questionId: true,
      questionVersion: true,
      question: {
        select: {
          id: true,
          stem: true,
          domain: true,
          difficulty: true,
          track: true,
          workflow: true,
          currentVersion: true,
        },
      },
    },
  },
} satisfies Prisma.ExamSectionSelect;

const VERSION_DETAIL_SELECT = {
  id: true,
  simulatorId: true,
  versionNumber: true,
  status: true,
  selectionMode: true,
  totalQuestions: true,
  totalDurationSec: true,
  resultDisclaimer: true,
  changeSummary: true,
  sourceLabel: true,
  sourceUrl: true,
  sourceRetrievedAt: true,
  sourceNote: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  simulator: {
    select: {
      id: true,
      track: true,
      activeExamVersionId: true,
      product: { select: { id: true, title: true, slug: true, status: true } },
    },
  },
  sections: { orderBy: { position: 'asc' }, select: SECTION_SELECT },
  _count: { select: { attempts: true } },
} satisfies Prisma.ExamVersionSelect;

type VersionDetailRow = Prisma.ExamVersionGetPayload<{ select: typeof VERSION_DETAIL_SELECT }>;

// ────────────────────────────────── Shapes ──────────────────────────────────

export type AdminExamRuleRow = {
  id: string;
  position: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty | null;
  track: $Enums.QuestionTrack | null;
  percentage: number | null;
  questionCount: number | null;
};

export type AdminExamFixedQuestionRow = {
  id: string;
  position: number;
  questionId: string;
  /** The bank version pinned when the question was attached. */
  questionVersion: number;
  stemExcerpt: string;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
  workflow: $Enums.QuestionWorkflow;
  currentVersion: number;
};

export type AdminExamSectionRow = {
  id: string;
  title: string;
  position: number;
  durationSec: number;
  questionCount: number;
  calculatorEnabled: boolean;
  scratchpadEnabled: boolean;
  allowReviewWithinSection: boolean;
  lockOnAdvance: boolean;
  pauseEnabled: boolean;
  rules: AdminExamRuleRow[];
  fixedQuestions: AdminExamFixedQuestionRow[];
};

export type AdminExamVersionDetail = {
  id: string;
  simulatorId: string;
  simulatorTrack: $Enums.QuestionTrack;
  productId: string;
  productTitle: string;
  productStatus: $Enums.ProductStatus;
  versionNumber: number;
  status: $Enums.ExamVersionStatus;
  selectionMode: $Enums.SelectionMode;
  totalQuestions: number;
  totalDurationSec: number;
  resultDisclaimer: string;
  changeSummary: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceRetrievedAt: Date | null;
  sourceNote: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  attemptCount: number;
  sections: AdminExamSectionRow[];
  /**
   * The sums the version's own totals are supposed to agree with, computed here
   * so the screen can show the disagreement while it is still editable rather
   * than only when publication refuses it.
   */
  sectionQuestionTotal: number;
  sectionDurationTotal: number;
  /** False once published or retired: every mutation below will refuse. */
  editable: boolean;
};

const STEM_EXCERPT_LENGTH = 120;

function excerpt(stem: Prisma.JsonValue): string {
  const plain = richTextToPlain(parseRichText(stem)).replace(/\s+/g, ' ').trim();
  return plain.length > STEM_EXCERPT_LENGTH ? `${plain.slice(0, STEM_EXCERPT_LENGTH)}…` : plain;
}

function toDetail(row: VersionDetailRow): AdminExamVersionDetail {
  const sections: AdminExamSectionRow[] = row.sections.map((section) => ({
    id: section.id,
    title: section.title,
    position: section.position,
    durationSec: section.durationSec,
    questionCount: section.questionCount,
    calculatorEnabled: section.calculatorEnabled,
    scratchpadEnabled: section.scratchpadEnabled,
    allowReviewWithinSection: section.allowReviewWithinSection,
    lockOnAdvance: section.lockOnAdvance,
    pauseEnabled: section.pauseEnabled,
    rules: section.blueprintRules.map((rule) => ({ ...rule })),
    fixedQuestions: section.fixedQuestions.map((entry) => ({
      id: entry.id,
      position: entry.position,
      questionId: entry.questionId,
      questionVersion: entry.questionVersion,
      stemExcerpt: excerpt(entry.question.stem),
      domain: entry.question.domain,
      difficulty: entry.question.difficulty,
      track: entry.question.track,
      workflow: entry.question.workflow,
      currentVersion: entry.question.currentVersion,
    })),
  }));

  return {
    id: row.id,
    simulatorId: row.simulatorId,
    simulatorTrack: row.simulator.track,
    productId: row.simulator.product.id,
    productTitle: row.simulator.product.title,
    productStatus: row.simulator.product.status,
    versionNumber: row.versionNumber,
    status: row.status,
    selectionMode: row.selectionMode,
    totalQuestions: row.totalQuestions,
    totalDurationSec: row.totalDurationSec,
    resultDisclaimer: row.resultDisclaimer,
    changeSummary: row.changeSummary,
    sourceLabel: row.sourceLabel,
    sourceUrl: row.sourceUrl,
    sourceRetrievedAt: row.sourceRetrievedAt,
    sourceNote: row.sourceNote,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isActive: row.simulator.activeExamVersionId === row.id,
    attemptCount: row._count.attempts,
    sections,
    sectionQuestionTotal: sections.reduce((sum, section) => sum + section.questionCount, 0),
    sectionDurationTotal: sections.reduce((sum, section) => sum + section.durationSec, 0),
    editable: row.status === 'DRAFT',
  };
}

// ─────────────────────────────────── Reads ──────────────────────────────────

export async function getExamVersionForAdmin(
  versionId: string,
): Promise<AdminExamVersionDetail | null> {
  const version = await prisma.examVersion.findUnique({
    where: { id: versionId },
    select: VERSION_DETAIL_SELECT,
  });

  return version ? toDetail(version) : null;
}

// ────────────────────────────── Shared loaders ──────────────────────────────

type EditableVersion = {
  id: string;
  simulatorId: string;
  status: $Enums.ExamVersionStatus;
  selectionMode: $Enums.SelectionMode;
  totalQuestions: number;
  simulatorTrack: $Enums.QuestionTrack;
};

/**
 * Load a version and refuse if it is not editable.
 *
 * Every section and rule mutation goes through this rather than repeating the
 * status check, which is what stops the next endpoint added to this file from
 * being the one that forgets and lets somebody edit a live exam.
 */
async function loadEditableVersion(
  tx: PrismaTransaction,
  versionId: string,
): Promise<EditableVersion> {
  const version = await tx.examVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      simulatorId: true,
      status: true,
      selectionMode: true,
      totalQuestions: true,
      simulator: { select: { track: true } },
    },
  });
  if (!version) versionNotFound();
  if (version.status !== 'DRAFT') versionFrozen();

  return {
    id: version.id,
    simulatorId: version.simulatorId,
    status: version.status,
    selectionMode: version.selectionMode,
    totalQuestions: version.totalQuestions,
    simulatorTrack: version.simulator.track,
  };
}

/** A section together with the editable version that owns it. */
async function loadEditableSection(
  tx: PrismaTransaction,
  sectionId: string,
): Promise<{
  section: { id: string; examVersionId: string; questionCount: number; title: string };
  version: EditableVersion;
}> {
  const section = await tx.examSection.findUnique({
    where: { id: sectionId },
    select: { id: true, examVersionId: true, questionCount: true, title: true },
  });
  if (!section) sectionNotFound();

  const version = await loadEditableVersion(tx, section.examVersionId);
  return { section, version };
}

// ───────────────────────────── Version lifecycle ────────────────────────────

const AUDITED_VERSION_FIELDS = [
  'selectionMode',
  'totalQuestions',
  'totalDurationSec',
  'resultDisclaimer',
  'changeSummary',
  'sourceLabel',
  'sourceUrl',
  'sourceRetrievedAt',
  'sourceNote',
] as const;

type AuditableVersion = {
  selectionMode: $Enums.SelectionMode;
  totalQuestions: number;
  totalDurationSec: number;
  resultDisclaimer: string;
  changeSummary: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sourceRetrievedAt: Date | null;
  sourceNote: string | null;
};

/**
 * The next version number for a simulator.
 *
 * Derived from `MAX(versionNumber)` rather than from a count: deleting a draft
 * would otherwise hand its number to the next version created, and two rows in
 * the audit trail would both call themselves "الإصدار ٣". The unique constraint
 * would catch the collision only while the older row still exists.
 */
async function nextVersionNumber(tx: PrismaTransaction, simulatorId: string): Promise<number> {
  const highest = await tx.examVersion.aggregate({
    where: { simulatorId },
    _max: { versionNumber: true },
  });
  return (highest._max.versionNumber ?? 0) + 1;
}

/**
 * Create a version, blank or as a copy of an existing one.
 *
 * The clone is the answer to "I need to change a published exam". It copies the
 * structure — sections, their fixed questions with the pinned bank version, and
 * their blueprint rules — into a fresh `DRAFT`, leaving the published original
 * exactly as the attempts that reference it expect to find it. Provenance and
 * the disclaimer travel with the copy because they describe the same structure;
 * `changeSummary` does not, because the new version's summary is what makes it
 * *different* from the one it came from.
 */
export async function createExamVersion(
  simulatorId: string,
  input: CreateExamVersionInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  try {
    return await createExamVersionUnguarded(simulatorId, input, context);
  } catch (error) {
    // `nextVersionNumber` is an aggregate and takes no row lock, so two
    // administrators pressing إنشاء إصدار at the same moment — or one
    // double-clicking — both read `MAX(versionNumber) = 3` and both try to
    // create version 4. `@@unique([simulatorId, versionNumber])` rejects the
    // loser, and without this arm it escapes as an unexplained 500. The
    // situation is entirely recoverable and the refusal says how: reload, and
    // the next number is free.
    if (isVersionNumberConflict(error)) {
      logger.warn('exam version number collided with a concurrent creation', {
        simulatorId,
        requestId: context.requestId,
      });
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.versionNumberConflict,
        'exam_version_number_conflict',
      );
    }
    throw error;
  }
}

/**
 * True for the unique violation on `(simulatorId, versionNumber)` specifically.
 *
 * Narrowed by target rather than accepting any `P2002`, so a future unique index
 * on this table cannot be silently reported as "somebody else created a version
 * at the same moment" — which would send an administrator to reload a page that
 * will refuse them again.
 */
function isVersionNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return fields.some((field) => field.includes('versionNumber'));
}

async function createExamVersionUnguarded(
  simulatorId: string,
  input: CreateExamVersionInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const created = await prisma.$transaction(async (tx) => {
    const simulator = await tx.examSimulator.findUnique({
      where: { id: simulatorId },
      select: { id: true },
    });
    if (!simulator) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.simulatorNotFound,
        'simulator_not_found',
      );
    }

    const versionNumber = await nextVersionNumber(tx, simulatorId);

    if (input.mode === 'blank') {
      const version = await tx.examVersion.create({
        data: {
          simulatorId,
          versionNumber,
          // Never accepted from the request: a version that could be created
          // already published would bypass every precondition below.
          status: 'DRAFT',
          selectionMode: input.selectionMode,
          totalQuestions: input.totalQuestions,
          totalDurationSec: input.totalDurationSec,
          resultDisclaimer: input.resultDisclaimer,
          changeSummary: input.changeSummary,
          sourceLabel: input.sourceLabel,
          sourceUrl: input.sourceUrl,
          sourceRetrievedAt: input.sourceRetrievedAt,
          sourceNote: input.sourceNote,
        },
        select: VERSION_DETAIL_SELECT,
      });

      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.EXAM_VERSION_CREATED,
        targetType: 'ExamVersion',
        targetId: version.id,
        metadata: {
          simulatorId,
          versionNumber,
          ...auditChanges<AuditableVersion>(null, version, AUDITED_VERSION_FIELDS),
        },
        requestId: context.requestId,
      });

      return version;
    }

    const source = await tx.examVersion.findUnique({
      where: { id: input.sourceVersionId },
      select: {
        id: true,
        simulatorId: true,
        versionNumber: true,
        selectionMode: true,
        totalQuestions: true,
        totalDurationSec: true,
        resultDisclaimer: true,
        sourceLabel: true,
        sourceUrl: true,
        sourceRetrievedAt: true,
        sourceNote: true,
        sections: { orderBy: { position: 'asc' }, select: SECTION_SELECT },
      },
    });
    // A version from another simulator is reported as absent rather than as a
    // mismatch: cloning across products would copy one exam's structure onto
    // another's catalogue entry, and the id was never this caller's to use.
    if (!source || source.simulatorId !== simulatorId) versionNotFound();

    const version = await tx.examVersion.create({
      data: {
        simulatorId,
        versionNumber,
        status: 'DRAFT',
        selectionMode: source.selectionMode,
        totalQuestions: source.totalQuestions,
        totalDurationSec: source.totalDurationSec,
        resultDisclaimer: source.resultDisclaimer,
        changeSummary: input.changeSummary,
        sourceLabel: source.sourceLabel,
        sourceUrl: source.sourceUrl,
        sourceRetrievedAt: source.sourceRetrievedAt,
        sourceNote: source.sourceNote,
        sections: {
          create: source.sections.map((section) => ({
            title: section.title,
            position: section.position,
            durationSec: section.durationSec,
            questionCount: section.questionCount,
            calculatorEnabled: section.calculatorEnabled,
            scratchpadEnabled: section.scratchpadEnabled,
            allowReviewWithinSection: section.allowReviewWithinSection,
            lockOnAdvance: section.lockOnAdvance,
            pauseEnabled: section.pauseEnabled,
            // The pinned `questionVersion` is copied rather than re-read from
            // the bank: the clone is meant to start as an exact restatement of
            // the source, and silently upgrading every item to whatever is
            // current would make "نسخة" mean something else.
            fixedQuestions: {
              create: section.fixedQuestions.map((entry) => ({
                questionId: entry.questionId,
                questionVersion: entry.questionVersion,
                position: entry.position,
              })),
            },
            blueprintRules: {
              create: section.blueprintRules.map((rule) => ({
                position: rule.position,
                track: rule.track,
                domain: rule.domain,
                subskill: rule.subskill,
                difficulty: rule.difficulty,
                percentage: rule.percentage,
                questionCount: rule.questionCount,
              })),
            },
          })),
        },
      },
      select: VERSION_DETAIL_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_VERSION_DUPLICATED,
      targetType: 'ExamVersion',
      targetId: version.id,
      metadata: {
        simulatorId,
        versionNumber,
        sourceVersionId: source.id,
        sourceVersionNumber: source.versionNumber,
        sectionCount: source.sections.length,
      },
      requestId: context.requestId,
    });

    return version;
  });

  logger.info('exam version created', {
    simulatorId,
    versionId: created.id,
    mode: input.mode,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return toDetail(created);
}

/** Save the version's own fields. Refused on anything but a draft. */
export async function updateExamVersion(
  versionId: string,
  input: UpdateExamVersionInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.examVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        status: true,
        selectionMode: true,
        totalQuestions: true,
        totalDurationSec: true,
        resultDisclaimer: true,
        changeSummary: true,
        sourceLabel: true,
        sourceUrl: true,
        sourceRetrievedAt: true,
        sourceNote: true,
      },
    });
    if (!before) versionNotFound();
    if (before.status !== 'DRAFT') versionFrozen();

    const after = await tx.examVersion.update({
      where: { id: versionId },
      data: {
        selectionMode: input.selectionMode,
        totalQuestions: input.totalQuestions,
        totalDurationSec: input.totalDurationSec,
        resultDisclaimer: input.resultDisclaimer,
        changeSummary: input.changeSummary,
        sourceLabel: input.sourceLabel,
        sourceUrl: input.sourceUrl,
        sourceRetrievedAt: input.sourceRetrievedAt,
        sourceNote: input.sourceNote,
      },
      select: VERSION_DETAIL_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_VERSION_UPDATED,
      targetType: 'ExamVersion',
      targetId: versionId,
      metadata: auditChanges<AuditableVersion>(before, after, AUDITED_VERSION_FIELDS),
      requestId: context.requestId,
    });

    return after;
  });

  return toDetail(updated);
}

/**
 * Delete a draft version.
 *
 * Three refusals, each naming its own obstacle rather than sharing one sentence:
 * a published or retired version is part of the record even if nobody sat it, a
 * version with attempts is the definition those results were computed against,
 * and the active version is what the simulator is currently serving.
 * `exam_versions.simulatorId` is `Restrict` and `exam_attempts.examVersionId` is
 * too, so the database is the backstop — but a foreign-key violation reaches an
 * administrator as an unexplained failure, and these say what to do instead.
 */
export async function deleteExamVersion(
  versionId: string,
  context: AdminSimulatorContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const version = await tx.examVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        simulatorId: true,
        versionNumber: true,
        status: true,
        _count: { select: { attempts: true } },
        simulator: { select: { activeExamVersionId: true } },
      },
    });
    if (!version) versionNotFound();

    if (version.status !== 'DRAFT') {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.versionDeleteBlockedByStatus,
        'exam_version_delete_blocked',
      );
    }
    if (version._count.attempts > 0) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.versionDeleteBlockedByAttempts,
        'exam_version_delete_blocked',
      );
    }
    if (version.simulator.activeExamVersionId === version.id) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.versionDeleteBlockedByActive,
        'exam_version_delete_blocked',
      );
    }

    // Written before the row disappears, and inside the transaction, so the
    // trail records the deletion only if the deletion actually commits.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_VERSION_DELETED,
      targetType: 'ExamVersion',
      targetId: version.id,
      metadata: { simulatorId: version.simulatorId, versionNumber: version.versionNumber },
      requestId: context.requestId,
    });

    // Sections cascade, and their rules and fixed-question rows cascade with
    // them. Nothing outside the version's own tree points at a draft.
    await tx.examVersion.delete({ where: { id: versionId } });
  });

  logger.info('exam version deleted', {
    versionId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });
}

// ───────────────────────────── Coverage and publish ─────────────────────────

export type CoverageRuleReport = {
  ruleId: string;
  position: number;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty | null;
  track: $Enums.QuestionTrack | null;
  required: number;
  available: number;
  shortfall: number;
};

export type CoverageSectionReport = {
  sectionId: string;
  title: string;
  position: number;
  questionCount: number;
  /** Set when the rules cannot be turned into whole numbers at all. */
  allocationError: string | null;
  rules: CoverageRuleReport[];
};

export type CoverageReport = {
  ok: boolean;
  /** False for a `FIXED` version: there is nothing to draw, so nothing to cover. */
  applicable: boolean;
  sections: CoverageSectionReport[];
  /**
   * Every rule the bank cannot fill, in reading order.
   *
   * Always empty while blueprint rules are unapplied — a section draws from the
   * whole bank, so a shortage belongs to the version, not to a rule. Kept on the
   * type so the rule table restores without a shape change.
   */
  shortfalls: CoverageRuleReport[];
  /** Published, non-retired questions in the bank at `checkedAt`. */
  bankSize: number;
  /** What every section of this version adds up to. */
  totalRequired: number;
  /** `max(0, totalRequired - bankSize)`: how many questions are missing. */
  shortfall: number;
  checkedAt: Date;
};

/* Restore with the per-rule coverage pass in `buildCoverageReport`.

type CandidateQuestion = {
  id: string;
  track: $Enums.QuestionTrack;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
};

/**
 * Which question tracks satisfy a requested track.
 *
 * A restatement of `tracksMatching` in `attempt-selection.service.ts`, which is
 * not exported. The duplication is the uncomfortable part of this file and it is
 * mitigated rather than removed: the probe runs below call the real
 * `generateSelection`, so if these two ever disagree the dry run still reports
 * the truth and this function is only ever wrong about *which* rule to blame.
 *
function tracksMatching(requested: $Enums.QuestionTrack | null): $Enums.QuestionTrack[] | null {
  if (requested === null) return null;
  if (requested === 'BOTH') return ['SCIENTIFIC', 'THEORETICAL', 'BOTH'];
  return [requested, 'BOTH'];
}

function matchesRule(
  question: CandidateQuestion,
  rule: AdminExamRuleRow,
  defaultTrack: $Enums.QuestionTrack | null,
): boolean {
  if (question.domain !== rule.domain) return false;
  if (rule.subskill !== null && question.subskill !== rule.subskill) return false;
  if (rule.difficulty !== null && question.difficulty !== rule.difficulty) return false;

  const tracks = tracksMatching(rule.track ?? defaultTrack);
  return tracks === null || tracks.includes(question.track);
}
*/

/**
 * Fixed probes for the dry run.
 *
 * Three seeds rather than one is a habit from when rules competed for the same
 * rows and a draw could pass or fail by luck. A section now takes its count off
 * the top of the whole bank, so the outcome no longer depends on the seed —
 * the probes are kept because they run the *real* selection code, which is what
 * makes this report a dry run rather than a second opinion.
 */
const COVERAGE_PROBE_SEEDS = [1, 2_654_435_761, 987_654_321] as const;

function toSelectionInput(sections: readonly AdminExamSectionRow[]): SectionInput[] {
  return sections.map((section) => ({
    id: section.id,
    position: section.position,
    questionCount: section.questionCount,
    blueprintRules: section.rules.map((rule) => ({
      id: rule.id,
      position: rule.position,
      track: rule.track,
      domain: rule.domain,
      subskill: rule.subskill,
      difficulty: rule.difficulty,
      percentage: rule.percentage,
      questionCount: rule.questionCount,
    })),
    fixedQuestions: section.fixedQuestions.map((entry) => ({
      questionId: entry.questionId,
      position: entry.position,
    })),
  }));
}

/**
 * Compare what this version needs against what the bank actually holds.
 *
 * Since a blueprint section means "take this many questions from the bank", the
 * whole check is one subtraction — every section of the version competes for one
 * pool, so what matters is the total, not any section alone. Two passes still:
 *
 *  1. **The arithmetic.** Eligible questions (`currentVersion > 0` and not
 *     `RETIRED`, the engine's own rule) against the sum of every section's
 *     `questionCount`. This is the pass that produces a number to act on.
 *  2. **End to end, against the real algorithm.** `generateSelection` is run for
 *     a few fixed seeds, so the report is a dry run of the code that will
 *     actually assemble the paper rather than a restatement of it.
 *
 * The answer describes this moment. Publishing a question later fixes a
 * shortfall; retiring one creates a new one. The screen says so.
 */
export async function buildCoverageReport(
  version: AdminExamVersionDetail,
  /**
   * The transaction the publish check is already running in, so its bank read
   * sees the same snapshot as the rest of that transaction. Defaulted to the
   * root client for the page, which is only asking a question — and defaulting
   * it is what keeps `prisma` out of a page's import list.
   */
  client: PrismaTransaction = prisma,
): Promise<CoverageReport> {
  const checkedAt = new Date();

  if (version.selectionMode === 'FIXED') {
    return {
      ok: true,
      applicable: false,
      sections: [],
      shortfalls: [],
      bankSize: 0,
      totalRequired: 0,
      shortfall: 0,
      checkedAt,
    };
  }

  const selectionInput = toSelectionInput(version.sections);
  const pool = await loadCandidatePool(client, selectionInput);

  const bankSize = pool.length;
  const totalRequired = version.sections.reduce((sum, section) => sum + section.questionCount, 0);
  const shortfall = Math.max(0, totalRequired - bankSize);

  // Every section still gets a row: the panel lists what each one will draw, and
  // that is the part an administrator can change. `rules` and `allocationError`
  // stay on the shape and stay empty — see `CoverageReport`.
  const sections: CoverageSectionReport[] = version.sections.map((section) => ({
    sectionId: section.id,
    title: section.title,
    position: section.position,
    questionCount: section.questionCount,
    allocationError: null,
    rules: [],
  }));

  // Pass 2 — the real algorithm, so this stays a dry run of what will happen
  // rather than a second implementation of it.
  let probeFailed = false;

  for (const seed of COVERAGE_PROBE_SEEDS) {
    try {
      generateSelection({
        sections: selectionInput,
        pool,
        seed,
        defaultTrack: version.simulatorTrack,
        // Stated rather than defaulted: this probe is only ever reached for a
        // blueprint version — the `FIXED` branch returned long before — and
        // naming it keeps that true if the early return ever moves.
        selectionMode: 'BLUEPRINT',
      });
    } catch (error) {
      if (error instanceof QuestionShortageError) {
        probeFailed = true;
        continue;
      }
      // An allocation failure would be a fault now that nothing allocates;
      // anything unexpected is the caller's to see.
      if (!(error instanceof AllocationError)) throw error;
      probeFailed = true;
    }
  }

  return {
    ok: shortfall === 0 && !probeFailed,
    applicable: true,
    sections,
    shortfalls: [],
    bankSize,
    totalRequired,
    shortfall,
    checkedAt,
  };
}

/** The coverage report for a version, for the screen's own check button. */
export async function getCoverageReport(versionId: string): Promise<CoverageReport | null> {
  const version = await getExamVersionForAdmin(versionId);
  return version ? buildCoverageReport(version) : null;
}

/**
 * Spell the shortfall out, so the refusal carries the three numbers.
 *
 * It used to name the rule that went short — a domain, a difficulty and a count.
 * With sections drawing from the whole bank there is no rule to blame and only
 * one thing to say: this is what the version needs, this is what the bank holds,
 * write this many more. Built from copy tokens rather than a sentence template,
 * so the refusal reads in the same words as the panel above it.
 */
function describeShortfalls(report: CoverageReport): string {
  const coverage = COPY.adminSimulators.blueprint.coverage;

  return [
    `${coverage.requiredLabel} ${formatNumber(report.totalRequired)}`,
    `${coverage.bankSizeLabel} ${formatNumber(report.bankSize)}`,
    `${coverage.shortfallLabel} ${formatNumber(report.shortfall)}`,
  ].join(COPY.adminCommon.listSeparator);
}

/**
 * Everything that must be true before a version can generate a live attempt.
 *
 * Ordered from cheapest to most expensive, and from most to least likely: the
 * disclaimer and the totals are decided by reading the row, the coverage check
 * costs a query over the bank. Each refusal names the missing thing, because
 * "تعذّر النشر" on a screen the administrator has just filled in leaves them
 * nothing to do but press the button again.
 */
async function assertVersionPublishable(
  tx: PrismaTransaction,
  version: AdminExamVersionDetail,
): Promise<void> {
  if (version.resultDisclaimer.trim().length === 0) {
    throw new HttpError(
      409,
      COPY.adminSimulators.errors.disclaimerRequiredToPublish,
      'disclaimer_required',
    );
  }

  if (version.sections.length === 0) {
    throw new HttpError(
      409,
      COPY.adminSimulators.errors.sectionsRequiredToPublish,
      'sections_required',
    );
  }

  // The version's own totals are what the student is told before they start and
  // what the results screen divides by. A disagreement with the sections is not
  // a rounding difference — it is two different exams described in one row.
  if (version.totalQuestions !== version.sectionQuestionTotal) {
    throw new HttpError(
      409,
      COPY.adminSimulators.errors.questionCountMismatch,
      'question_count_mismatch',
    );
  }
  if (version.totalDurationSec !== version.sectionDurationTotal) {
    throw new HttpError(409, COPY.adminSimulators.errors.durationMismatch, 'duration_mismatch');
  }

  if (version.selectionMode === 'FIXED') {
    const incomplete = version.sections.find(
      (section) => section.fixedQuestions.length !== section.questionCount,
    );
    if (incomplete) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.fixedQuestionsRequiredToPublish,
        'fixed_questions_required',
      );
    }

    const pinned = version.sections.flatMap((section) => section.fixedQuestions);

    // `addSectionQuestion` checked this when the question was attached, but a
    // draft can sit for weeks and the bank moves underneath it. This is the
    // `FIXED` equivalent of the coverage report: without it, a version whose
    // questions have since been retired publishes as healthy and then refuses
    // every student who presses ابدأ, which is precisely the failure the
    // publication preconditions exist to catch while it is still an
    // administrator's problem.
    const unusable = pinned.filter(
      (entry) => entry.currentVersion <= 0 || entry.workflow === 'RETIRED',
    );
    if (unusable.length > 0) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.fixedQuestionsNotPublished,
        'fixed_questions_not_published',
      );
    }

    // `@@unique([examSectionId, questionId])` prevents a repeat inside one
    // section and says nothing about two. A question pinned into sections 1 and
    // 4 would be delivered twice in one paper — a shorter exam than the version
    // describes — so the whole-version uniqueness the blueprint path guarantees
    // by construction is asserted here explicitly.
    if (new Set(pinned.map((entry) => entry.questionId)).size !== pinned.length) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.fixedQuestionsDuplicatedAcrossSections,
        'fixed_questions_duplicated',
      );
    }

    return;
  }

  /* Restore with the blueprint rule editor.

     A section without rules could not be generated when rules decided the draw,
     so publishing one was refused. A section is now "take this many from the
     bank", which needs no rules at all — and keeping this check would have made
     every simplified version unpublishable.

  const withoutRules = version.sections.find((section) => section.rules.length === 0);
  if (withoutRules) {
    throw new HttpError(409, COPY.adminSimulators.errors.rulesRequiredToPublish, 'rules_required');
  }
  */

  const report = await buildCoverageReport(version, tx);

  const broken = report.sections.find((section) => section.allocationError !== null);
  if (broken) {
    // Unreachable while nothing allocates — `allocationError` is always null —
    // and kept because it is the rule editor's refusal, not this path's.
    throw new HttpError(
      409,
      `${COPY.adminSimulators.errors.ruleAllocationMismatch} ${broken.allocationError ?? ''}`.trim(),
      'rule_allocation_mismatch',
    );
  }

  if (!report.ok) {
    throw new HttpError(
      409,
      `${COPY.adminSimulators.errors.questionShortage} ${describeShortfalls(report)}`.trim(),
      'question_shortage',
    );
  }
}

export type ExamVersionTransitionResult = {
  version: AdminExamVersionDetail;
  /** False when the version was already where it was asked to go. */
  changed: boolean;
};

const TRANSITION_ACTIONS: Record<'publish' | 'retire', AuditAction> = {
  publish: AUDIT_ACTIONS.EXAM_VERSION_PUBLISHED,
  retire: AUDIT_ACTIONS.EXAM_VERSION_RETIRED,
};

/**
 * Publish, retire, activate or deactivate.
 *
 * The four live in one function because they are one decision surface, but they
 * touch two tables: publication and retirement move `ExamVersion.status`, while
 * activation moves `ExamSimulator.activeExamVersionId`. The second pair delegate
 * to `applyActiveVersionChange`, which is also what the settings form calls, so
 * the preconditions for "students receive this" exist in exactly one place.
 *
 * The whole operation opens by locking the version row. Two administrators
 * pressing "publish" at the same moment would otherwise both read `DRAFT`, both
 * run the coverage check and both stamp `publishedAt`; serialised here, the
 * second re-reads a row that now says `PUBLISHED` and is answered honestly as no
 * change rather than as a second publication.
 */
export async function transitionExamVersion(
  versionId: string,
  action: ExamVersionAction,
  context: AdminSimulatorContext,
): Promise<ExamVersionTransitionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "exam_versions" WHERE "id" = ${versionId}::uuid FOR UPDATE
    `;
    if (locked.length === 0) versionNotFound();

    const current = await tx.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: VERSION_DETAIL_SELECT,
    });
    const detail = toDetail(current);

    if (action === 'activate' || action === 'deactivate') {
      // Checked *before* the change is applied, not after. "Deactivate" on a
      // version that is not the active one has to be a no-op, and clearing the
      // pointer regardless would switch off whichever *other* version the
      // simulator was actually serving — from a button that named this one.
      if (action === 'deactivate' && current.simulator.activeExamVersionId !== versionId) {
        return { version: detail, changed: false };
      }

      const changed = await applyActiveVersionChange(
        tx,
        { id: detail.simulatorId, activeExamVersionId: current.simulator.activeExamVersionId },
        action === 'activate' ? versionId : null,
        context,
      );

      const after = await tx.examVersion.findUniqueOrThrow({
        where: { id: versionId },
        select: VERSION_DETAIL_SELECT,
      });
      return { version: toDetail(after), changed };
    }

    const target: $Enums.ExamVersionStatus = action === 'publish' ? 'PUBLISHED' : 'RETIRED';

    // Answered honestly rather than re-stamped. Re-running the update would move
    // `publishedAt` and write a second audit row for a publication that already
    // happened, which is exactly the noise that makes a trail unreadable.
    if (detail.status === target) return { version: detail, changed: false };

    if (action === 'publish') {
      if (detail.status !== 'DRAFT') {
        throw new HttpError(
          409,
          COPY.adminSimulators.errors.invalidTransition,
          'invalid_transition',
        );
      }
      await assertVersionPublishable(tx, detail);
    } else {
      if (detail.status !== 'PUBLISHED') {
        throw new HttpError(
          409,
          COPY.adminSimulators.errors.invalidTransition,
          'invalid_transition',
        );
      }
      // Retiring the version the simulator is pointed at would leave the pointer
      // aimed at something withdrawn, and every new attempt would be generated
      // from an exam nobody meant to serve. Deactivating first is one deliberate
      // extra step and it is the one that stops that.
      if (current.simulator.activeExamVersionId === versionId) {
        throw new HttpError(
          409,
          COPY.adminSimulators.errors.retireBlockedByActive,
          'retire_blocked_by_active',
        );
      }
    }

    const after = await tx.examVersion.update({
      where: { id: versionId },
      data: {
        status: target,
        // Stamped on entry into `PUBLISHED` and never cleared: a retired version
        // was published, and the date it was published is part of the record
        // that the attempts sat on it are read against.
        ...(action === 'publish' ? { publishedAt: new Date() } : {}),
      },
      select: VERSION_DETAIL_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: TRANSITION_ACTIONS[action],
      targetType: 'ExamVersion',
      targetId: versionId,
      metadata: {
        simulatorId: detail.simulatorId,
        versionNumber: detail.versionNumber,
        from: detail.status,
        to: target,
        selectionMode: detail.selectionMode,
        totalQuestions: detail.totalQuestions,
        sectionCount: detail.sections.length,
      },
      requestId: context.requestId,
    });

    return { version: toDetail(after), changed: true };
  });

  if (result.changed) {
    logger.info('exam version transition', {
      versionId,
      action,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  return result;
}

// ──────────────────────────────── Sections ──────────────────────────────────

const AUDITED_SECTION_FIELDS = [
  'title',
  'durationSec',
  'questionCount',
  'calculatorEnabled',
  'scratchpadEnabled',
  'allowReviewWithinSection',
  'lockOnAdvance',
  'pauseEnabled',
] as const;

type AuditableSection = {
  title: string;
  durationSec: number;
  questionCount: number;
  calculatorEnabled: boolean;
  scratchpadEnabled: boolean;
  allowReviewWithinSection: boolean;
  lockOnAdvance: boolean;
  pauseEnabled: boolean;
};

/** Append a section to a draft version. Position is `MAX + 1`, never client-chosen. */
export async function createExamSection(
  versionId: string,
  input: CreateExamSectionInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    await loadEditableVersion(tx, versionId);

    const highest = await tx.examSection.aggregate({
      where: { examVersionId: versionId },
      _max: { position: true },
    });

    const section = await tx.examSection.create({
      data: {
        examVersionId: versionId,
        position: (highest._max.position ?? 0) + 1,
        title: input.title,
        durationSec: input.durationSec,
        questionCount: input.questionCount,
        calculatorEnabled: input.calculatorEnabled,
        scratchpadEnabled: input.scratchpadEnabled,
        allowReviewWithinSection: input.allowReviewWithinSection,
        lockOnAdvance: input.lockOnAdvance,
        pauseEnabled: input.pauseEnabled,
      },
      select: SECTION_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_CREATED,
      targetType: 'ExamSection',
      targetId: section.id,
      metadata: {
        examVersionId: versionId,
        position: section.position,
        ...auditChanges<AuditableSection>(null, section, AUDITED_SECTION_FIELDS),
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function updateExamSection(
  sectionId: string,
  input: ExamSectionSettingsInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { version } = await loadEditableSection(tx, sectionId);

    const before = await tx.examSection.findUniqueOrThrow({
      where: { id: sectionId },
      select: SECTION_SELECT,
    });

    const after = await tx.examSection.update({
      where: { id: sectionId },
      data: {
        title: input.title,
        durationSec: input.durationSec,
        questionCount: input.questionCount,
        calculatorEnabled: input.calculatorEnabled,
        scratchpadEnabled: input.scratchpadEnabled,
        allowReviewWithinSection: input.allowReviewWithinSection,
        lockOnAdvance: input.lockOnAdvance,
        pauseEnabled: input.pauseEnabled,
      },
      select: SECTION_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_UPDATED,
      targetType: 'ExamSection',
      targetId: sectionId,
      metadata: {
        examVersionId: version.id,
        ...auditChanges<AuditableSection>(before, after, AUDITED_SECTION_FIELDS),
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function deleteExamSection(
  sectionId: string,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { section, version } = await loadEditableSection(tx, sectionId);

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_DELETED,
      targetType: 'ExamSection',
      targetId: sectionId,
      metadata: { examVersionId: version.id, title: section.title },
      requestId: context.requestId,
    });

    await tx.examSection.delete({ where: { id: sectionId } });

    // Positions are closed up rather than left with a gap. A gap is harmless to
    // the database and confusing on screen — "القسم ١، القسم ٣" reads as a
    // missing section rather than as a deleted one.
    const remaining = await tx.examSection.findMany({
      where: { examVersionId: version.id },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await renumber(
      remaining.map((row) => row.id),
      (id, position) => tx.examSection.update({ where: { id }, data: { position } }),
    );

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

/**
 * Write a new order for a set of rows whose position is unique per parent.
 *
 * Two passes, and the first one is not optional: assigning final positions
 * directly means the moment a row takes position 2 while another still holds it,
 * the unique index rejects the statement. The first pass parks every row on a
 * negative position — a range no real ordering uses — so the second can assign
 * `1..n` without ever colliding.
 */
async function renumber(
  orderedIds: readonly string[],
  update: (id: string, position: number) => Promise<unknown>,
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await update(id, -(index + 1));
  }
  for (const [index, id] of orderedIds.entries()) {
    await update(id, index + 1);
  }
}

/**
 * Apply a complete new order.
 *
 * The submitted list has to name exactly the rows the server holds. A list that
 * is missing one or names an extra describes a page that has moved on, and
 * applying it would silently drop or duplicate a position; refusing whole is the
 * only answer that leaves the order somebody can see on screen intact.
 */
function assertSameSet(submitted: readonly string[], stored: readonly string[]): void {
  if (submitted.length !== stored.length) {
    throw new HttpError(409, COPY.adminSimulators.errors.reorderStale, 'reorder_stale');
  }
  const storedSet = new Set(stored);
  for (const id of submitted) {
    if (!storedSet.delete(id)) {
      throw new HttpError(409, COPY.adminSimulators.errors.reorderStale, 'reorder_stale');
    }
  }
}

export async function reorderExamSections(
  versionId: string,
  ids: readonly string[],
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    await loadEditableVersion(tx, versionId);

    const stored = await tx.examSection.findMany({
      where: { examVersionId: versionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    assertSameSet(
      ids,
      stored.map((row) => row.id),
    );

    await renumber(ids, (id, position) =>
      tx.examSection.update({ where: { id }, data: { position } }),
    );

    // One row against the container, not one per section that moved: ten
    // sections shifting by one is one administrative decision.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_REORDERED,
      targetType: 'ExamVersion',
      targetId: versionId,
      metadata: { order: [...ids] },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

// ────────────────────────── Fixed section questions ─────────────────────────

/**
 * Attach a bank question to a `FIXED` section.
 *
 * Three refusals, and the first is the one that matters: a question with no
 * frozen version has nothing for an attempt to copy, so a paper built on it
 * would either fail at generation or serve an editable draft. The eligibility
 * rule is the same one `attempt-selection.service.ts` applies —
 * `currentVersion > 0` and not `RETIRED` — restated here so the refusal arrives
 * while somebody is looking at it.
 *
 * `questionVersion` is pinned from the bank's `currentVersion` at this moment,
 * never from the request.
 */
export async function addSectionQuestion(
  sectionId: string,
  questionId: string,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { section, version } = await loadEditableSection(tx, sectionId);

    const question = await tx.question.findUnique({
      where: { id: questionId },
      select: { id: true, currentVersion: true, workflow: true, track: true },
    });
    if (!question) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.questionNotPublished,
        'question_not_published',
      );
    }
    if (question.currentVersion <= 0 || question.workflow === 'RETIRED') {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.questionNotPublished,
        'question_not_published',
      );
    }

    /* Restore with the classification section in `question-form.tsx`.

       A question's track is no longer something a person chose — the editor does
       not ask, and every question written since carries the same placeholder. A
       refusal an administrator cannot act on is worse than no refusal: there is
       no field left on the question form for them to correct.

    const allowedTracks = tracksMatching(version.simulatorTrack);
    if (allowedTracks !== null && !allowedTracks.includes(question.track)) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.questionTrackMismatch,
        'question_track_mismatch',
      );
    }
    */

    const existing = await tx.examSectionQuestion.findUnique({
      where: { examSectionId_questionId: { examSectionId: sectionId, questionId } },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, COPY.adminSimulators.errors.questionDuplicate, 'question_duplicate');
    }

    const count = await tx.examSectionQuestion.count({ where: { examSectionId: sectionId } });
    if (count >= section.questionCount) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.fixedQuestionsExceedCount,
        'fixed_questions_exceed_count',
      );
    }

    await tx.examSectionQuestion.create({
      data: {
        examSectionId: sectionId,
        questionId,
        questionVersion: question.currentVersion,
        position: count + 1,
      },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_QUESTIONS_CHANGED,
      targetType: 'ExamSection',
      targetId: sectionId,
      // The direction is metadata rather than a second action: adding and
      // removing are the same decision seen twice.
      metadata: {
        examVersionId: version.id,
        direction: 'added',
        questionId,
        questionVersion: question.currentVersion,
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function removeSectionQuestion(
  sectionId: string,
  questionId: string,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { version } = await loadEditableSection(tx, sectionId);

    const entry = await tx.examSectionQuestion.findUnique({
      where: { examSectionId_questionId: { examSectionId: sectionId, questionId } },
      select: { id: true, questionVersion: true },
    });
    if (!entry) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.questionNotInSection,
        'section_question_not_found',
      );
    }

    await tx.examSectionQuestion.delete({ where: { id: entry.id } });

    const remaining = await tx.examSectionQuestion.findMany({
      where: { examSectionId: sectionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await renumber(
      remaining.map((row) => row.id),
      (id, position) => tx.examSectionQuestion.update({ where: { id }, data: { position } }),
    );

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.EXAM_SECTION_QUESTIONS_CHANGED,
      targetType: 'ExamSection',
      targetId: sectionId,
      metadata: {
        examVersionId: version.id,
        direction: 'removed',
        questionId,
        questionVersion: entry.questionVersion,
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

// ───────────────────────────── Blueprint rules ──────────────────────────────

const AUDITED_RULE_FIELDS = [
  'domain',
  'subskill',
  'difficulty',
  'track',
  'percentage',
  'questionCount',
] as const;

type AuditableRule = {
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty | null;
  track: $Enums.QuestionTrack | null;
  percentage: number | null;
  questionCount: number | null;
};

/**
 * The arithmetic a rule has to satisfy on its own and against its siblings.
 *
 * `allocateByLargestRemainder` would reject most of these at generation time
 * with an Arabic sentence of its own, and the exam engine does call it — but
 * that happens when a student presses "ابدأ". Checking here means the mistake is
 * a field message on the form that made it.
 *
 * The "one of percentage or count, never both" rule is the one that is not
 * merely arithmetic: a rule carrying both is ambiguous, the allocator silently
 * prefers the count, and an administrator who set 40٪ and 12 would get 12 with
 * nothing telling them their percentage was ignored.
 */
function assertRuleShare(
  input: { percentage: number | null; questionCount: number | null },
  sectionQuestionCount: number,
  siblings: readonly { id: string; percentage: number | null }[],
): void {
  const hasPercentage = input.percentage !== null;
  const hasCount = input.questionCount !== null;

  if (!hasPercentage && !hasCount) {
    throw new HttpError(400, COPY.adminSimulators.errors.ruleNeedsShare, 'rule_needs_share');
  }
  if (hasPercentage && hasCount) {
    throw new HttpError(400, COPY.adminSimulators.errors.ruleShareConflict, 'rule_share_conflict');
  }

  if (hasCount && input.questionCount! > sectionQuestionCount) {
    throw new HttpError(
      409,
      COPY.adminSimulators.errors.ruleCountExceedsSection,
      'rule_count_exceeds_section',
    );
  }

  if (hasPercentage) {
    const total =
      siblings.reduce((sum, rule) => sum + (rule.percentage ?? 0), 0) + input.percentage!;
    if (total > 100) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.percentageSumInvalid,
        'percentage_sum_invalid',
      );
    }
  }
}

export async function createBlueprintRule(
  sectionId: string,
  input: CreateBlueprintRuleInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { section, version } = await loadEditableSection(tx, sectionId);

    const siblings = await tx.examBlueprintRule.findMany({
      where: { examSectionId: sectionId },
      select: { id: true, percentage: true, position: true },
    });
    assertRuleShare(input, section.questionCount, siblings);

    const rule = await tx.examBlueprintRule.create({
      data: {
        examSectionId: sectionId,
        position: siblings.reduce((max, row) => Math.max(max, row.position), 0) + 1,
        domain: input.domain,
        subskill: input.subskill,
        difficulty: input.difficulty,
        track: input.track,
        percentage: input.percentage,
        questionCount: input.questionCount,
      },
      select: RULE_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.BLUEPRINT_RULE_CREATED,
      targetType: 'ExamBlueprintRule',
      targetId: rule.id,
      metadata: {
        examSectionId: sectionId,
        examVersionId: version.id,
        ...auditChanges<AuditableRule>(null, rule, AUDITED_RULE_FIELDS),
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function updateBlueprintRule(
  sectionId: string,
  ruleId: string,
  input: CreateBlueprintRuleInput,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { section, version } = await loadEditableSection(tx, sectionId);

    const before = await tx.examBlueprintRule.findUnique({
      where: { id: ruleId },
      select: { ...RULE_SELECT, examSectionId: true },
    });
    if (!before || before.examSectionId !== sectionId) ruleNotFound();

    const siblings = await tx.examBlueprintRule.findMany({
      where: { examSectionId: sectionId, id: { not: ruleId } },
      select: { id: true, percentage: true },
    });
    assertRuleShare(input, section.questionCount, siblings);

    const after = await tx.examBlueprintRule.update({
      where: { id: ruleId },
      data: {
        domain: input.domain,
        subskill: input.subskill,
        difficulty: input.difficulty,
        track: input.track,
        percentage: input.percentage,
        questionCount: input.questionCount,
      },
      select: RULE_SELECT,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.BLUEPRINT_RULE_UPDATED,
      targetType: 'ExamBlueprintRule',
      targetId: ruleId,
      metadata: {
        examSectionId: sectionId,
        examVersionId: version.id,
        ...auditChanges<AuditableRule>(before, after, AUDITED_RULE_FIELDS),
      },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function deleteBlueprintRule(
  sectionId: string,
  ruleId: string,
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { version } = await loadEditableSection(tx, sectionId);

    const rule = await tx.examBlueprintRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        examSectionId: true,
        domain: true,
        percentage: true,
        questionCount: true,
      },
    });
    if (!rule || rule.examSectionId !== sectionId) ruleNotFound();

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.BLUEPRINT_RULE_DELETED,
      targetType: 'ExamBlueprintRule',
      targetId: ruleId,
      metadata: {
        examSectionId: sectionId,
        examVersionId: version.id,
        domain: rule.domain,
        percentage: rule.percentage,
        questionCount: rule.questionCount,
      },
      requestId: context.requestId,
    });

    await tx.examBlueprintRule.delete({ where: { id: ruleId } });

    const remaining = await tx.examBlueprintRule.findMany({
      where: { examSectionId: sectionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await renumber(
      remaining.map((row) => row.id),
      (id, position) => tx.examBlueprintRule.update({ where: { id }, data: { position } }),
    );

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}

export async function reorderBlueprintRules(
  sectionId: string,
  ids: readonly string[],
  context: AdminSimulatorContext,
): Promise<AdminExamVersionDetail> {
  const updated = await prisma.$transaction(async (tx) => {
    const { version } = await loadEditableSection(tx, sectionId);

    const stored = await tx.examBlueprintRule.findMany({
      where: { examSectionId: sectionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    assertSameSet(
      ids,
      stored.map((row) => row.id),
    );

    await renumber(ids, (id, position) =>
      tx.examBlueprintRule.update({ where: { id }, data: { position } }),
    );

    // Against the section that owns the ordering, not against each rule.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.BLUEPRINT_RULE_REORDERED,
      targetType: 'ExamSection',
      targetId: sectionId,
      metadata: { examVersionId: version.id, order: [...ids] },
      requestId: context.requestId,
    });

    return tx.examVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: VERSION_DETAIL_SELECT,
    });
  });

  return toDetail(updated);
}
