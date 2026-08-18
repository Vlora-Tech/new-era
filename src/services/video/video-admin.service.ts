import 'server-only';

import { Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { env, isVideoEnabled } from '@/lib/env';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { AUDIT_ACTIONS, writeAuditLog, type AuditActor } from '@/services/audit/audit.service';
import { getVideoProvider } from '@/services/video/video-provider';
import type { RegisterVideoInput, VideoListQuery } from '@/validators/admin-video';

/**
 * The video library.
 *
 * This screen closes a gap that made the lesson video picker unusable: the
 * picker could only ever *select* a `VideoAsset`, and nothing in the platform
 * could create one, so its list was permanently empty. The lesson copy already
 * told administrators to "upload at the provider then come back and attach it"
 * — this is the half of that sentence that did not exist.
 *
 * Three properties are deliberate and each one is a decision the schema does not
 * make on its own:
 *
 *  1. **This is registration, not upload.** The bytes live at Bunny and are
 *     uploaded in Bunny's own dashboard. What is stored here is the identifier
 *     pair that lets playback be signed per request. Deleting a row therefore
 *     un-registers a video; it does not delete anything at Bunny, and the copy
 *     says so rather than implying a destruction it cannot perform.
 *  2. **`libraryId` is server configuration, never client input.** It comes from
 *     `BUNNY_STREAM_LIBRARY_ID` and is identical for every video in an
 *     environment. Accepting it from a browser would let a request register an
 *     identifier pointing into a library this platform does not own — a row
 *     whose playback URL it would happily sign.
 *  3. **The identifier is confirmed against Bunny when it can be.** With a
 *     management key configured, a pasted GUID is resolved to its real title,
 *     duration and processing state, so "did I paste the right video?" is
 *     answered at registration rather than discovered by a student. Without the
 *     key the identifier is accepted on format alone and the administrator is
 *     told plainly that it was not confirmed — an unverified row is honest;
 *     refusing to work without an optional credential would not be.
 */

const LIBRARY = COPY.adminCourses.videoLibrary;

export type AdminVideoContext = {
  actor: AuditActor;
  requestId?: string;
};

export type AdminVideoRow = {
  id: string;
  videoGuid: string;
  libraryId: string;
  title: string | null;
  durationSec: number | null;
  processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  /** Where this video is used. Both are needed before it can be un-registered. */
  lessonCount: number;
  simulatorIntroCount: number;
  createdAt: Date;
};

export type RegisterVideoResult = {
  video: AdminVideoRow;
  /**
   * Whether Bunny actually confirmed the identifier. `false` means the row was
   * accepted on format alone because no management key is configured — the UI
   * says so rather than letting an unverified row look verified.
   */
  confirmed: boolean;
};

/**
 * The configured library, or a refusal.
 *
 * Every operation here needs it, and an environment without Bunny credentials
 * cannot register a video at all — so this is the one gate the whole module
 * passes through, rather than four separate checks that could drift.
 */
function requireLibraryId(): string {
  if (!isVideoEnabled()) {
    throw new HttpError(503, LIBRARY.errors.notConfigured, 'video_not_configured');
  }
  const libraryId = env().BUNNY_STREAM_LIBRARY_ID;
  if (!libraryId) {
    throw new HttpError(503, LIBRARY.errors.notConfigured, 'video_not_configured');
  }
  return libraryId;
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function listVideoAssets(query: VideoListQuery): Promise<{
  rows: AdminVideoRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}> {
  const where: Prisma.VideoAssetWhereInput = {};

  if (query.q) {
    // The GUID is matched too: an administrator chasing a specific video has the
    // identifier in front of them far more often than they have its title.
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { videoGuid: { contains: query.q.toLowerCase() } },
    ];
  }
  if (query.attached === 'attached') where.lessons = { some: {} };
  if (query.attached === 'unattached') where.lessons = { none: {} };

  const [total, assets] = await prisma.$transaction([
    prisma.videoAsset.count({ where }),
    prisma.videoAsset.findMany({
      where,
      // `id` breaks ties so a page cannot repeat or skip a row when several
      // videos are registered in the same second.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: {
        id: true,
        videoGuid: true,
        libraryId: true,
        title: true,
        durationSec: true,
        processingStatus: true,
        createdAt: true,
        _count: { select: { lessons: true, simulatorIntros: true } },
      },
    }),
  ]);

  return {
    rows: assets.map((asset) => ({
      id: asset.id,
      videoGuid: asset.videoGuid,
      libraryId: asset.libraryId,
      title: asset.title,
      durationSec: asset.durationSec,
      processingStatus: asset.processingStatus,
      lessonCount: asset._count.lessons,
      simulatorIntroCount: asset._count.simulatorIntros,
      createdAt: asset.createdAt,
    })),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

// ── Registration ─────────────────────────────────────────────────────────

/** A unique violation on the (libraryId, videoGuid) pair, and nothing else. */
function isDuplicateGuid(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return fields.includes('videoGuid') || fields.includes('libraryId');
}

export async function registerVideoAsset(
  input: RegisterVideoInput,
  context: AdminVideoContext,
): Promise<RegisterVideoResult> {
  const libraryId = requireLibraryId();
  /*
   * `input` is already parsed by the route, and re-parsing it here would be a
   * bug rather than defence in depth: the schema's output is not a valid input
   * to itself. `title` transforms an absent value to `null`, and feeding that
   * back through `z.string().optional()` fails — so a second parse rejects
   * exactly the ordinary request the first one accepted. Validation happens once,
   * at the boundary, which is also where the reference services put it.
   */
  const parsed = input;

  /*
   * Ask Bunny before writing, not after.
   *
   * `lookupVideo` returns null both when no management key is configured and
   * when the identifier does not resolve, and those two must not be conflated:
   * the first is an environment limitation the administrator cannot fix and the
   * row should still be created; the second is a typo and the row should not.
   * The key is checked separately so the difference is knowable.
   */
  const canConfirm = Boolean(env().BUNNY_STREAM_API_KEY);
  let lookup = null;

  if (canConfirm) {
    lookup = await getVideoProvider().lookupVideo(parsed.videoGuid);
    if (!lookup) {
      throw new HttpError(422, LIBRARY.errors.notFoundAtProvider, 'video_not_found_at_provider');
    }
  }

  const title = lookup?.title?.trim() ? lookup.title.trim() : parsed.title;
  const durationSec = lookup ? lookup.durationSec : parsed.durationSec;
  /*
   * An unconfirmed row is recorded READY rather than PENDING. PENDING would
   * disable it in the lesson picker, which would leave an administrator with no
   * way to attach a video they can see is fine — the state means "Bunny told us
   * it is still processing", and without a key Bunny told us nothing at all.
   */
  const processingStatus = lookup ? (lookup.ready ? 'READY' : 'PROCESSING') : 'READY';

  try {
    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.videoAsset.create({
        data: {
          provider: 'BUNNY',
          libraryId,
          videoGuid: parsed.videoGuid,
          title,
          durationSec,
          processingStatus,
        },
        select: {
          id: true,
          videoGuid: true,
          libraryId: true,
          title: true,
          durationSec: true,
          processingStatus: true,
          createdAt: true,
        },
      });

      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.VIDEO_REGISTERED,
        targetType: 'VideoAsset',
        targetId: asset.id,
        // The GUID is an opaque provider reference, not a secret, and it is the
        // one value that makes this row traceable back to a video at Bunny.
        metadata: { videoGuid: asset.videoGuid, confirmed: Boolean(lookup) },
        requestId: context.requestId,
      });

      return asset;
    });

    return {
      video: { ...created, lessonCount: 0, simulatorIntroCount: 0 },
      confirmed: Boolean(lookup),
    };
  } catch (error) {
    if (isDuplicateGuid(error)) {
      throw new HttpError(409, LIBRARY.errors.alreadyRegistered, 'video_already_registered');
    }
    throw error;
  }
}

// ── Un-registration ──────────────────────────────────────────────────────

export async function deleteVideoAsset(
  videoAssetId: string,
  context: AdminVideoContext,
): Promise<void> {
  const asset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
    select: {
      id: true,
      videoGuid: true,
      _count: { select: { lessons: true, simulatorIntros: true, playbackSessions: true } },
    },
  });

  if (!asset) {
    throw new HttpError(404, LIBRARY.errors.notFound, 'video_not_found');
  }

  /*
   * Refuse while anything points at it, and say which thing does.
   *
   * `Lesson.videoAssetId` and `ExamSimulator.introVideoAssetId` are both
   * `onDelete: Restrict`, so the database would refuse anyway — but as an opaque
   * P2003 the administrator cannot act on. Checking first turns it into a
   * sentence naming what to detach.
   */
  if (asset._count.lessons > 0 || asset._count.simulatorIntros > 0) {
    throw new HttpError(409, LIBRARY.errors.deleteBlockedInUse, 'video_delete_blocked');
  }

  await prisma.$transaction(async (tx) => {
    /*
     * Playback sessions cascade on the user but are Restrict on the asset, and
     * they are short-lived grants rather than records worth keeping. Clearing
     * them here is what makes un-registering an unused video possible at all
     * once somebody has previewed it.
     */
    if (asset._count.playbackSessions > 0) {
      await tx.playbackSession.deleteMany({ where: { videoAssetId: asset.id } });
    }

    await tx.videoAsset.delete({ where: { id: asset.id } });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.VIDEO_DELETED,
      targetType: 'VideoAsset',
      targetId: asset.id,
      metadata: { videoGuid: asset.videoGuid },
      requestId: context.requestId,
    });
  });

  logger.info('video asset un-registered', { videoAssetId: asset.id });
}
