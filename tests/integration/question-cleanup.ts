import { prisma } from '@/lib/db';

/**
 * Give up a fixture's questions at the end of a file.
 *
 * Teardown used to be a delete, and every suite could assume its own questions
 * were its own: a blueprint section drew through rules scoped to the fixture's
 * subskill, so nothing else could reach them.
 *
 * That assumption is gone. A blueprint section now draws its count from the
 * whole eligible bank (see the head of `attempt-selection.service.ts`), so while
 * one worker is publishing questions another can be drawing them into an attempt
 * — and `AttemptQuestion.questionId` is `onDelete: Restrict`, on purpose: an
 * attempt is a record of what a student was given, and a question cannot be
 * deleted out from under it.
 *
 * So the deletion is split. Anything nobody holds is deleted as before. Anything
 * an attempt reached is **retired** instead: it leaves the eligible pool, so it
 * cannot be drawn again or leak into the next run's counts, and the attempt that
 * holds it stays readable. Deleting it would either fail — taking the whole file
 * down with a teardown error that names nothing useful — or corrupt another
 * worker's assertion mid-run.
 */
export async function releaseFixtureQuestions(questionIds: readonly string[]): Promise<void> {
  if (questionIds.length === 0) return;

  const ids = [...questionIds];

  const [inAttempts, inSections, inQuizzes] = await Promise.all([
    prisma.attemptQuestion.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true },
      distinct: ['questionId'],
    }),
    prisma.examSectionQuestion.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true },
      distinct: ['questionId'],
    }),
    prisma.lessonQuizQuestion.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true },
      distinct: ['questionId'],
    }),
  ]);

  const held = new Set([
    ...inAttempts.map((row) => row.questionId),
    ...inSections.map((row) => row.questionId),
    ...inQuizzes.map((row) => row.questionId),
  ]);

  if (held.size > 0) {
    await prisma.question.updateMany({
      where: { id: { in: [...held] } },
      data: { workflow: 'RETIRED', retiredAt: new Date() },
    });
  }

  const deletable = ids.filter((id) => !held.has(id));
  if (deletable.length === 0) return;

  // Deepest edge first: a frozen version is `Restrict` against its question, so
  // it has to go before the question can.
  await prisma.questionVersion.deleteMany({ where: { questionId: { in: deletable } } });
  await prisma.questionOption.deleteMany({ where: { questionId: { in: deletable } } });
  await prisma.question.deleteMany({ where: { id: { in: deletable } } });
}
