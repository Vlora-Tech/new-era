import 'server-only';

import type { $Enums } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { scoreAttempt } from '@/services/exams/attempt-scoring.service';

/**
 * Lazy expiry: the attempt clock advances when someone looks at it.
 *
 * There is no background worker and no scheduled sweep. Every attempt-scoped
 * request calls this first, and it brings the attempt up to date before the
 * request is allowed to act on it. That is what makes "the section is over"
 * true at the moment it matters rather than at the moment a job happens to run,
 * and it means an attempt abandoned in a closed tab is still finalised
 * correctly — the next time anyone asks about it, including the results page.
 *
 * Two decisions carry the timing correctness:
 *
 *   1. A section is locked at its **stored deadline**, never at the wall-clock
 *      moment the server noticed. If a student closes their laptop with two
 *      minutes left and returns an hour later, the section ended when it was
 *      supposed to end, and the recorded section time reflects that.
 *
 *   2. The following section is chained from the previous section's deadline,
 *      not from now. Starting it at `now` would silently hand back every minute
 *      the student was away — offline time would become extra exam time, which
 *      is the one failure mode a timed simulation cannot have. Consequently a
 *      long enough absence can expire several sections in one pass, and the
 *      loop below is written to do exactly that.
 *
 * Concurrency: every write is a rowcount-guarded `updateMany` on the status it
 * expects to find. Two simultaneous requests both try; PostgreSQL serialises
 * them on the row lock, the loser matches zero rows, and it abandons its
 * transaction and re-reads instead of writing a second, conflicting timeline.
 */

export type AttemptClockState = {
  attemptId: string;
  status: $Enums.AttemptStatus;
  serverTime: Date;
  maxEndAt: Date | null;
  activeSection: {
    id: string;
    position: number;
    startedAt: Date | null;
    deadlineAt: Date | null;
  } | null;
  /** True when this call moved the attempt forward. Useful for logs and tests. */
  changed: boolean;
};

/** Internal sentinel: another request already applied this transition. */
class ClockRaceLost extends Error {
  constructor() {
    super('attempt clock resolved concurrently');
    this.name = 'ClockRaceLost';
  }
}

type SectionRow = {
  id: string;
  position: number;
  status: $Enums.AttemptSectionStatus;
  durationSecSnapshot: number | null;
  startedAt: Date | null;
  deadlineAt: Date | null;
};

const SECTION_SELECT = {
  id: true,
  position: true,
  status: true,
  durationSecSnapshot: true,
  startedAt: true,
  deadlineAt: true,
} as const;

function activeOf(sections: SectionRow[]): SectionRow | undefined {
  return sections.find((section) => section.status === 'IN_PROGRESS');
}

async function readState(attemptId: string, serverTime: Date, changed: boolean) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      maxEndAt: true,
      sections: { orderBy: { position: 'asc' }, select: SECTION_SELECT },
    },
  });
  if (!attempt) return null;

  const active = activeOf(attempt.sections);
  return {
    attemptId: attempt.id,
    status: attempt.status,
    serverTime,
    maxEndAt: attempt.maxEndAt,
    activeSection: active
      ? {
          id: active.id,
          position: active.position,
          startedAt: active.startedAt,
          deadlineAt: active.deadlineAt,
        }
      : null,
    changed,
  } satisfies AttemptClockState;
}

/**
 * Bring an attempt's clock up to the current instant.
 *
 * Call this at the top of every attempt-scoped request, before authorization
 * decisions that depend on section state. Safe to call repeatedly; when there is
 * nothing to do it costs one read.
 */
export async function resolveAttemptClock(
  attemptId: string,
  now: Date = new Date(),
): Promise<AttemptClockState | null> {
  const initial = await readState(attemptId, now, false);
  if (!initial) return null;

  const needsWork =
    initial.status === 'IN_PROGRESS' &&
    initial.activeSection?.deadlineAt != null &&
    initial.activeSection.deadlineAt.getTime() <= now.getTime();

  if (!needsWork) return initial;

  try {
    await prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
        select: {
          status: true,
          sections: { orderBy: { position: 'asc' }, select: SECTION_SELECT },
        },
      });
      if (!attempt || attempt.status !== 'IN_PROGRESS') throw new ClockRaceLost();

      const sections: SectionRow[] = [...attempt.sections];

      // Bounded by the number of sections: each pass locks one, so the loop
      // cannot spin even if the data is inconsistent.
      for (let pass = 0; pass <= sections.length; pass += 1) {
        const active = activeOf(sections);
        if (!active) break;

        const deadline = active.deadlineAt;
        if (!deadline || deadline.getTime() > now.getTime()) break;

        const locked = await tx.attemptSection.updateMany({
          where: { id: active.id, status: 'IN_PROGRESS' },
          // The stored deadline is the truth about when this section ended.
          data: { status: 'LOCKED', lockedAt: deadline, lockedReason: 'EXPIRED' },
        });
        if (locked.count === 0) throw new ClockRaceLost();
        active.status = 'LOCKED';

        const next = sections.find((section) => section.position === active.position + 1);

        if (!next) {
          const finalised = await tx.examAttempt.updateMany({
            where: { id: attemptId, status: 'IN_PROGRESS' },
            data: { status: 'EXPIRED', submittedAt: deadline },
          });
          if (finalised.count === 0) throw new ClockRaceLost();

          await scoreAttempt(tx, { attemptId, finalisedBy: 'EXPIRED', computedAt: now });
          logger.info('attempt expired', { attemptId, expiredAt: deadline.toISOString() });
          break;
        }

        const startedAt = deadline;
        const deadlineAt =
          next.durationSecSnapshot == null
            ? null
            : new Date(startedAt.getTime() + next.durationSecSnapshot * 1_000);

        const started = await tx.attemptSection.updateMany({
          where: { id: next.id, status: 'PENDING' },
          data: { status: 'IN_PROGRESS', startedAt, deadlineAt },
        });
        if (started.count === 0) throw new ClockRaceLost();

        next.status = 'IN_PROGRESS';
        next.startedAt = startedAt;
        next.deadlineAt = deadlineAt;
      }
    });
  } catch (error) {
    // A lost race is the expected outcome of two tabs refreshing at once: the
    // winner has already written the correct timeline, so re-reading it is the
    // right answer, not a retry.
    if (!(error instanceof ClockRaceLost)) throw error;
  }

  return readState(attemptId, now, true);
}
