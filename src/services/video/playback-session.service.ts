import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { hasActiveEntitlement } from '@/services/access/entitlement';
import { getVideoProvider, playbackTtlSeconds } from '@/services/video/video-provider';

/**
 * Issuing a playback grant.
 *
 * Every request re-checks entitlement against the database. A previously issued
 * session, a page the student still has open, or anything the browser reports
 * about itself is not evidence of access.
 *
 * The session row is also what bounds progress: heartbeats must quote a live
 * session id, which is what ties claimed watch time to a window the server
 * opened and can measure.
 */
export type PlaybackGrant = {
  sessionId: string;
  embedUrl: string;
  expiresAt: Date;
  durationSec: number | null;
  resume: {
    lastPositionSec: number;
    furthestPositionSec: number;
    watchedSec: number;
    completed: boolean;
  };
  watermarkText: string;
};

export async function createPlaybackSession(input: {
  userId: string;
  userName: string;
  userEmail: string;
  lessonId: string;
}): Promise<PlaybackGrant> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    select: {
      id: true,
      status: true,
      isPreview: true,
      durationSec: true,
      videoAsset: { select: { id: true, videoGuid: true, durationSec: true } },
      module: {
        select: {
          status: true,
          course: { select: { productId: true, product: { select: { status: true } } } },
        },
      },
    },
  });

  if (!lesson || lesson.status !== 'PUBLISHED' || lesson.module.status !== 'PUBLISHED') {
    throw new HttpError(404, 'الدرس غير متاح.', 'lesson_unavailable');
  }

  if (!lesson.videoAsset) {
    throw new HttpError(404, 'لا يوجد مقطع مرتبط بهذا الدرس.', 'lesson_has_no_video');
  }

  // A preview lesson is open by design. Everything else needs a live entitlement,
  // checked now rather than inferred from how the student arrived here.
  if (!lesson.isPreview) {
    const entitled = await hasActiveEntitlement(input.userId, lesson.module.course.productId);
    if (!entitled) {
      throw new HttpError(403, 'لا تملك صلاحية مشاهدة هذا الدرس.', 'not_entitled');
    }
  }

  const durationSec = lesson.videoAsset.durationSec ?? lesson.durationSec;
  const ttlSeconds = playbackTtlSeconds(durationSec);

  const provider = getVideoProvider();
  const signed = provider.signPlayback({
    videoGuid: lesson.videoAsset.videoGuid,
    ttlSeconds,
  });

  const session = await prisma.playbackSession.create({
    data: {
      userId: input.userId,
      videoAssetId: lesson.videoAsset.id,
      lessonId: lesson.id,
      expiresAt: signed.expiresAt,
    },
    select: { id: true },
  });

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: input.userId, lessonId: lesson.id } },
    select: {
      lastPositionSec: true,
      furthestPositionSec: true,
      watchedSec: true,
      completed: true,
    },
  });

  logger.info('playback session issued', {
    userId: input.userId,
    lessonId: lesson.id,
    sessionId: session.id,
  });

  return {
    sessionId: session.id,
    embedUrl: signed.embedUrl,
    expiresAt: signed.expiresAt,
    durationSec,
    resume: progress ?? {
      lastPositionSec: 0,
      furthestPositionSec: 0,
      watchedSec: 0,
      completed: false,
    },
    // A visible, moving mark carrying the viewer's identity discourages casual
    // sharing. It cannot prevent screen recording, and is not claimed to.
    watermarkText: buildWatermarkText(input.userName, input.userEmail, input.userId),
  };
}

export function buildWatermarkText(name: string, email: string, userId: string): string {
  return `${name} • ${email} • ${userId.slice(-8)}`;
}
