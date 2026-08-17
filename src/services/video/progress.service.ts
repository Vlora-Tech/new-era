import 'server-only';

import { HttpError } from '@/lib/auth/guards';
import { VIDEO } from '@/lib/constants';
import { prisma } from '@/lib/db';

/**
 * Lesson progress.
 *
 * The rule that matters here: **watched time may only grow as fast as real time
 * has passed.** Progress arrives from a browser, so a client is free to claim it
 * watched an hour in the last fifteen seconds. Rather than trusting the claim or
 * refusing to record anything, each heartbeat is clamped to the time genuinely
 * elapsed on the server since that session's previous heartbeat.
 *
 * Consequences worth stating:
 *   - `watchedSec` is what completion is measured against, so completion cannot
 *     be forged by seeking to the end;
 *   - `lastPositionSec` follows the player freely, because seeking backwards and
 *     forwards is legitimate and is what resume depends on;
 *   - `furthestPositionSec` only ever increases.
 */
export type ProgressInput = {
  sessionId: string;
  userId: string;
  lessonId: string;
  positionSec: number;
  /** Playback seconds observed since the last accepted heartbeat. */
  deltaSec: number;
};

export type ProgressResult = {
  lastPositionSec: number;
  furthestPositionSec: number;
  watchedSec: number;
  completed: boolean;
};

/** Extra seconds allowed per heartbeat to absorb scheduling jitter. */
const JITTER_ALLOWANCE_SEC = 5;

export async function recordProgress(input: ProgressInput): Promise<ProgressResult> {
  const now = new Date();

  const session = await prisma.playbackSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      userId: true,
      lessonId: true,
      expiresAt: true,
      lastHeartbeatAt: true,
      createdAt: true,
    },
  });

  // A heartbeat must belong to a live session that this user opened for this
  // lesson. Without that, progress could be written for any lesson id.
  if (
    !session ||
    session.userId !== input.userId ||
    session.lessonId !== input.lessonId ||
    session.expiresAt <= now
  ) {
    throw new HttpError(401, 'انتهت جلسة المشاهدة. أعد تحميل الدرس.', 'playback_session_invalid');
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    select: {
      durationSec: true,
      completionThresholdPercent: true,
      module: { select: { course: { select: { completionThresholdPercent: true } } } },
    },
  });

  if (!lesson) throw new HttpError(404, 'الدرس غير موجود.', 'lesson_not_found');

  const duration = lesson.durationSec && lesson.durationSec > 0 ? lesson.durationSec : null;

  const anchor = session.lastHeartbeatAt ?? session.createdAt;
  const elapsedSec = Math.max(0, (now.getTime() - anchor.getTime()) / 1_000);
  const ceiling = Math.ceil(elapsedSec * VIDEO.MAX_PLAYBACK_RATE) + JITTER_ALLOWANCE_SEC;

  const acceptedDelta = Math.min(
    Math.max(0, Math.floor(input.deltaSec)),
    ceiling,
    duration ?? Number.MAX_SAFE_INTEGER,
  );

  const position = Math.max(
    0,
    Math.min(Math.floor(input.positionSec), duration ?? Number.MAX_SAFE_INTEGER),
  );

  const thresholdPercent =
    lesson.completionThresholdPercent ??
    lesson.module.course.completionThresholdPercent ??
    VIDEO.DEFAULT_COMPLETION_THRESHOLD_PERCENT;

  const rows = await prisma.$queryRaw<
    Array<{
      lastPositionSec: number;
      furthestPositionSec: number;
      watchedSec: number;
      completed: boolean;
    }>
  >`
    INSERT INTO "lesson_progress" (
      "id", "userId", "lessonId", "lastPositionSec", "furthestPositionSec",
      "watchedSec", "completed", "version", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid(), ${input.userId}::uuid, ${input.lessonId}::uuid,
      ${position}, ${position}, ${acceptedDelta}, false, 1, now(), now()
    )
    ON CONFLICT ("userId", "lessonId") DO UPDATE SET
      "lastPositionSec"     = EXCLUDED."lastPositionSec",
      "furthestPositionSec" = GREATEST(
                                "lesson_progress"."furthestPositionSec",
                                EXCLUDED."lastPositionSec"
                              ),
      "watchedSec"          = LEAST(
                                "lesson_progress"."watchedSec" + ${acceptedDelta},
                                ${duration ?? 2_147_483_647}
                              ),
      "version"             = "lesson_progress"."version" + 1,
      "updatedAt"           = now()
    RETURNING "lastPositionSec", "furthestPositionSec", "watchedSec", "completed"
  `;

  const progress = rows[0]!;

  // Completion is derived from bounded watched time, never from position, and is
  // written once so a later rewatch cannot un-complete a lesson.
  let completed = progress.completed;
  if (!completed && duration !== null) {
    const required = Math.floor((duration * thresholdPercent) / 100);
    if (progress.watchedSec >= required) {
      const updated = await prisma.lessonProgress.updateMany({
        where: { userId: input.userId, lessonId: input.lessonId, completed: false },
        data: { completed: true, completedAt: now },
      });
      completed = updated.count > 0 || completed;
    }
  }

  await prisma.playbackSession.update({
    where: { id: session.id },
    data: { lastHeartbeatAt: now },
  });

  return {
    lastPositionSec: progress.lastPositionSec,
    furthestPositionSec: progress.furthestPositionSec,
    watchedSec: progress.watchedSec,
    completed,
  };
}
