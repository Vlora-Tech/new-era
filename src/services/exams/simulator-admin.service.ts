import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  AUDIT_ACTIONS,
  auditChanges,
  writeAuditLog,
  type AuditActor,
} from '@/services/audit/audit.service';
import type { SimulatorListQuery, UpdateSimulatorInput } from '@/validators/admin-simulator';

/**
 * The `ExamSimulator` row: the settings that outlive every version of an exam.
 *
 * A simulator is never created or deleted here. It exists one-to-one with a
 * `Product` of type `EXAM_SIMULATOR` and is created alongside it by
 * `product-admin.service.ts`, which is why this file has an update and no
 * create: a simulator without a product has no price, no catalogue page and no
 * way to be bought, so it is not a state the administration area should be able
 * to reach.
 *
 * Three properties are the reason this is a service:
 *
 *  1. **The active version is a decision, not a field.** `activeExamVersionId`
 *     is what students receive. The settings form shows it, so the form has to
 *     be able to submit it — but a change to it is recorded as
 *     `exam_version.activated` with its own preconditions, not folded into the
 *     settings diff. Publishing a version and pointing the simulator at it are
 *     two different acts and the trail says so.
 *  2. **The track is frozen once attempts exist.** It decides which questions a
 *     blueprint rule may draw when the rule does not name a track itself.
 *     Changing it after the fact would mean two students who sat "the same
 *     simulator" drew from different banks with nothing recording why.
 *  3. **A simulator with both modes off is unreachable.** Neither the timed
 *     simulation nor the training mode would open, and the catalogue page would
 *     still sell it. The refusal is here rather than in Zod because it is a
 *     statement about the product, not about the shape of the request.
 */

export type AdminSimulatorContext = {
  actor: AuditActor;
  requestId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept a path segment as an id, or refuse it as "no such record".
 *
 * Every id in this schema is `uuid` in PostgreSQL, so handing Prisma
 * `/api/admin/simulators/hello` raises a driver-level cast error that the
 * envelope can only report as an unexpected 500. A malformed id is not a server
 * fault — it names something that does not exist, and that is what the caller is
 * told. Shared by the version, section and rule routes through the re-exports in
 * `exam-version-admin.service.ts`.
 */
export function parseUuidOr404(value: string, message: string, code: string): string {
  if (!UUID_PATTERN.test(value)) throw new HttpError(404, message, code);
  return value;
}

export function parseSimulatorId(value: string): string {
  return parseUuidOr404(
    value,
    COPY.adminSimulators.errors.simulatorNotFound,
    'simulator_not_found',
  );
}

function simulatorNotFound(): never {
  throw new HttpError(404, COPY.adminSimulators.errors.simulatorNotFound, 'simulator_not_found');
}

// ── Selects ──────────────────────────────────────────────────────────────

const SIMULATOR_ROW_SELECT = {
  id: true,
  track: true,
  activeExamVersionId: true,
  trainingModeEnabled: true,
  fullSimulationEnabled: true,
  product: { select: { id: true, title: true, slug: true, status: true, updatedAt: true } },
  activeExamVersion: { select: { id: true, versionNumber: true, status: true } },
  _count: { select: { versions: true, attempts: true } },
} satisfies Prisma.ExamSimulatorSelect;

type SimulatorRow = Prisma.ExamSimulatorGetPayload<{ select: typeof SIMULATOR_ROW_SELECT }>;

const SIMULATOR_DETAIL_SELECT = {
  ...SIMULATOR_ROW_SELECT,
  introVideoAssetId: true,
  introVideoAsset: { select: { id: true, title: true, processingStatus: true } },
  versions: {
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      versionNumber: true,
      status: true,
      selectionMode: true,
      totalQuestions: true,
      totalDurationSec: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { sections: true, attempts: true } },
    },
  },
} satisfies Prisma.ExamSimulatorSelect;

type SimulatorDetailRow = Prisma.ExamSimulatorGetPayload<{
  select: typeof SIMULATOR_DETAIL_SELECT;
}>;

/** One row of the simulators list, flattened so the table does not walk relations. */
export type AdminSimulatorRow = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: $Enums.ProductStatus;
  track: $Enums.QuestionTrack;
  fullSimulationEnabled: boolean;
  trainingModeEnabled: boolean;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  versionCount: number;
  attemptCount: number;
  updatedAt: Date;
};

export type AdminSimulatorVersionSummary = {
  id: string;
  versionNumber: number;
  status: $Enums.ExamVersionStatus;
  selectionMode: $Enums.SelectionMode;
  totalQuestions: number;
  totalDurationSec: number;
  sectionCount: number;
  attemptCount: number;
  isActive: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type AdminSimulatorDetail = AdminSimulatorRow & {
  introVideoAssetId: string | null;
  introVideoTitle: string | null;
  versions: AdminSimulatorVersionSummary[];
};

export type AdminSimulatorPage = {
  rows: AdminSimulatorRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

function toRow(row: SimulatorRow): AdminSimulatorRow {
  return {
    id: row.id,
    productId: row.product.id,
    productTitle: row.product.title,
    productSlug: row.product.slug,
    productStatus: row.product.status,
    track: row.track,
    fullSimulationEnabled: row.fullSimulationEnabled,
    trainingModeEnabled: row.trainingModeEnabled,
    activeVersionId: row.activeExamVersion?.id ?? null,
    activeVersionNumber: row.activeExamVersion?.versionNumber ?? null,
    versionCount: row._count.versions,
    attemptCount: row._count.attempts,
    updatedAt: row.product.updatedAt,
  };
}

function toDetail(row: SimulatorDetailRow): AdminSimulatorDetail {
  return {
    ...toRow(row),
    introVideoAssetId: row.introVideoAssetId,
    introVideoTitle: row.introVideoAsset?.title ?? null,
    versions: row.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      selectionMode: version.selectionMode,
      totalQuestions: version.totalQuestions,
      totalDurationSec: version.totalDurationSec,
      sectionCount: version._count.sections,
      attemptCount: version._count.attempts,
      isActive: version.id === row.activeExamVersionId,
      publishedAt: version.publishedAt,
      updatedAt: version.updatedAt,
    })),
  };
}

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * One page of simulators, filtered on the server.
 *
 * There is no "create simulator" here and the empty state says so: the list is
 * a projection of the catalogue's `EXAM_SIMULATOR` products, so the way to add
 * one is to add the product. `q` matches the product's title or slug, which are
 * the two things an administrator remembers; the simulator row itself has no
 * name of its own.
 *
 * The count and the page are read in one transaction so the pagination summary
 * describes the same moment as the rows beneath it.
 */
export async function listSimulators(query: SimulatorListQuery): Promise<AdminSimulatorPage> {
  const where: Prisma.ExamSimulatorWhereInput = {};

  if (query.track) where.track = query.track;
  // "Has an active version" is a property of the simulator; "has a version in
  // this state" is a property of its versions. They are different filters and
  // combining them into one control would make neither answerable.
  if (query.hasActiveVersion !== undefined) {
    where.activeExamVersionId = query.hasActiveVersion ? { not: null } : null;
  }
  if (query.versionStatus) where.versions = { some: { status: query.versionStatus } };

  if (query.q) {
    const term = query.q.normalize('NFKC');
    where.product = {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term.toLowerCase(), mode: 'insensitive' } },
      ],
    };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.examSimulator.count({ where }),
    prisma.examSimulator.findMany({
      where,
      // `id` breaks ties: two products saved in the same millisecond otherwise
      // have no defined order, and an undefined order across two pages is how a
      // row appears twice while another is never shown at all.
      orderBy: [{ product: { updatedAt: 'desc' } }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: SIMULATOR_ROW_SELECT,
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

/** One simulator, its settings and every version it owns. */
export async function getSimulatorForAdmin(
  simulatorId: string,
): Promise<AdminSimulatorDetail | null> {
  const simulator = await prisma.examSimulator.findUnique({
    where: { id: simulatorId },
    select: SIMULATOR_DETAIL_SELECT,
  });

  return simulator ? toDetail(simulator) : null;
}

/**
 * The simulator that owns a product, for the "open the exam settings" link on a
 * product page. Answers `null` for a course rather than throwing: the caller is
 * asking a question, not asserting the product is a simulator.
 */
export async function getSimulatorIdForProduct(productId: string): Promise<string | null> {
  const simulator = await prisma.examSimulator.findUnique({
    where: { productId },
    select: { id: true },
  });
  return simulator?.id ?? null;
}

// ── The active version ───────────────────────────────────────────────────

/**
 * Point a simulator at a version, or at nothing, and record the decision.
 *
 * Shared by the settings form and by the version screen's activate/deactivate
 * buttons so there is exactly one place where the preconditions live:
 *
 *  - the version has to belong to *this* simulator. `activeExamVersionId` is a
 *    plain foreign key with no such constraint, so without this check a
 *    simulator could be pointed at another product's exam and every attempt
 *    generated afterwards would be the wrong paper;
 *  - the version has to be `PUBLISHED`. A draft's structure is still being
 *    edited, and generating live attempts from something that can change under
 *    them is the failure the whole publish/activate split exists to prevent.
 *
 * Returns `false` when the simulator already points where it was asked to
 * point, so the caller can say "nothing changed" instead of claiming a second
 * activation and leaving a second audit row for one decision.
 */
export async function applyActiveVersionChange(
  tx: PrismaTransaction,
  simulator: { id: string; activeExamVersionId: string | null },
  nextVersionId: string | null,
  context: AdminSimulatorContext,
): Promise<boolean> {
  const current = simulator.activeExamVersionId;
  if (current === nextVersionId) return false;

  let versionNumber: number | null = null;

  if (nextVersionId !== null) {
    const version = await tx.examVersion.findUnique({
      where: { id: nextVersionId },
      select: { id: true, simulatorId: true, status: true, versionNumber: true },
    });

    // Reported as "no such version" rather than as a mismatch: from this
    // simulator's point of view a version belonging to another one does not
    // exist, and naming it would confirm an id the caller had no business
    // holding.
    if (!version || version.simulatorId !== simulator.id) {
      throw new HttpError(
        404,
        COPY.adminSimulators.errors.versionNotFound,
        'exam_version_not_found',
      );
    }
    if (version.status !== 'PUBLISHED') {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.activateRequiresPublished,
        'activate_requires_published',
      );
    }

    versionNumber = version.versionNumber;
  }

  await tx.examSimulator.update({
    where: { id: simulator.id },
    data: { activeExamVersionId: nextVersionId },
  });

  await writeAuditLog(tx, {
    actor: context.actor,
    action:
      nextVersionId === null
        ? AUDIT_ACTIONS.EXAM_VERSION_DEACTIVATED
        : AUDIT_ACTIONS.EXAM_VERSION_ACTIVATED,
    targetType: 'ExamVersion',
    // The version is the subject even when it is being switched off, because
    // "which version stopped serving students" is the question the trail is
    // read to answer.
    targetId: nextVersionId ?? current,
    metadata: {
      simulatorId: simulator.id,
      from: current,
      to: nextVersionId,
      versionNumber,
    },
    requestId: context.requestId,
  });

  return true;
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * The fields an audit row is allowed to carry for a simulator.
 *
 * An explicit allowlist rather than a spread of the row: a column added to
 * `ExamSimulator` later must be named here before it appears in the trail.
 * `activeExamVersionId` is deliberately absent — it has its own action.
 */
const AUDITED_SIMULATOR_FIELDS = [
  'track',
  'fullSimulationEnabled',
  'trainingModeEnabled',
  'introVideoAssetId',
] as const;

type AuditableSimulator = {
  track: $Enums.QuestionTrack;
  fullSimulationEnabled: boolean;
  trainingModeEnabled: boolean;
  introVideoAssetId: string | null;
};

/**
 * An intro video has to exist and be playable.
 *
 * `VideoAsset.processingStatus` is checked as well as existence: an asset still
 * encoding plays as an error for the student, and the moment it is attached is
 * the only moment anybody is looking.
 */
async function assertUsableIntroVideo(tx: PrismaTransaction, assetId: string): Promise<void> {
  const asset = await tx.videoAsset.findUnique({
    where: { id: assetId },
    select: { id: true, processingStatus: true },
  });

  if (!asset || asset.processingStatus !== 'READY') {
    throw new HttpError(
      404,
      COPY.adminSimulators.errors.videoAssetNotFound,
      'video_asset_not_found',
    );
  }
}

export type UpdateSimulatorResult = {
  simulator: AdminSimulatorDetail;
  /** True when the active version moved, so the caller can say which thing changed. */
  activeVersionChanged: boolean;
};

/**
 * Save the simulator's settings.
 *
 * The active version is handled first and separately. Everything else is one
 * diff against an allowlist, audited as `simulator.updated`; a change of active
 * version leaves its own `exam_version.activated` row in the same transaction.
 * Two rows because two decisions were taken — not because two tables were
 * written.
 */
export async function updateSimulatorSettings(
  simulatorId: string,
  input: UpdateSimulatorInput,
  context: AdminSimulatorContext,
): Promise<UpdateSimulatorResult> {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.examSimulator.findUnique({
      where: { id: simulatorId },
      select: {
        id: true,
        track: true,
        activeExamVersionId: true,
        introVideoAssetId: true,
        fullSimulationEnabled: true,
        trainingModeEnabled: true,
        _count: { select: { attempts: true } },
      },
    });
    if (!before) simulatorNotFound();

    // An absent key means "leave this alone" — the schema no longer defaults one
    // into existence — so every rule below is checked against the state the save
    // will actually produce, not against the half of it the body happened to
    // name.
    const nextFullSimulation = input.fullSimulationEnabled ?? before.fullSimulationEnabled;
    const nextTrainingMode = input.trainingModeEnabled ?? before.trainingModeEnabled;
    const nextActiveVersionId =
      input.activeExamVersionId !== undefined
        ? input.activeExamVersionId
        : before.activeExamVersionId;

    if (!nextFullSimulation && !nextTrainingMode) {
      throw new HttpError(
        409,
        COPY.adminSimulators.errors.modesAllDisabled,
        'simulator_modes_all_disabled',
      );
    }

    if (input.track !== before.track) {
      // The track qualifies every blueprint rule that does not name one itself.
      // Once attempts exist, changing it would silently redefine what "the same
      // simulator" drew from, with nothing in the attempt recording the change.
      if (before._count.attempts > 0) {
        throw new HttpError(
          409,
          COPY.adminSimulators.errors.trackImmutableAfterAttempts,
          'simulator_track_frozen',
        );
      }

      // The attempt count is not the whole freeze, and treating it as one was a
      // real hole. A version is published against a coverage report computed
      // with `rule.track ?? version.simulatorTrack`; narrowing the simulator's
      // track afterwards shrinks the eligible pool for every rule that named no
      // track of its own, and the published version stays marked active and
      // covered while the first student to press ابدأ gets a shortage. Nobody
      // has sat it yet — attempts are zero — which is precisely the pre-launch
      // moment an administrator is most likely to adjust the track.
      //
      // Measured against the *resulting* active version, so deactivating and
      // retracking in one save is still allowed: that sequence re-validates on
      // the next activation.
      if (nextActiveVersionId !== null) {
        throw new HttpError(
          409,
          COPY.adminSimulators.errors.trackFrozenWhileActive,
          'simulator_track_frozen_while_active',
        );
      }
    }

    // Re-checked on every save that names the asset rather than only when the id
    // changed: an asset can fail encoding between two edits of the simulator
    // that points at it.
    if (input.introVideoAssetId) await assertUsableIntroVideo(tx, input.introVideoAssetId);

    // Only a body that named the field decides anything about the active
    // version. Omission is not a deactivation.
    const activeVersionChanged =
      input.activeExamVersionId === undefined
        ? false
        : await applyActiveVersionChange(tx, before, input.activeExamVersionId, context);

    const after = await tx.examSimulator.update({
      where: { id: simulatorId },
      data: {
        track: input.track,
        ...(input.fullSimulationEnabled !== undefined
          ? { fullSimulationEnabled: input.fullSimulationEnabled }
          : {}),
        ...(input.trainingModeEnabled !== undefined
          ? { trainingModeEnabled: input.trainingModeEnabled }
          : {}),
        ...(input.introVideoAssetId !== undefined
          ? { introVideoAssetId: input.introVideoAssetId }
          : {}),
      },
      select: SIMULATOR_DETAIL_SELECT,
    });

    const changes = auditChanges<AuditableSimulator>(before, after, AUDITED_SIMULATOR_FIELDS);
    // Written unconditionally, even for a save that changed nothing but the
    // active version: the row records that somebody opened the settings and
    // pressed save, and an empty diff says exactly that.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.SIMULATOR_UPDATED,
      targetType: 'ExamSimulator',
      targetId: simulatorId,
      metadata: changes,
      requestId: context.requestId,
    });

    return { simulator: after, activeVersionChanged };
  });

  logger.info('simulator settings updated', {
    simulatorId,
    activeVersionChanged: result.activeVersionChanged,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return {
    simulator: toDetail(result.simulator),
    activeVersionChanged: result.activeVersionChanged,
  };
}
