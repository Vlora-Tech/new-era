import 'server-only';

import { prisma } from '@/lib/db';
import { hasActiveEntitlement } from '@/services/access/entitlement';

/**
 * The data one lesson page needs: the lesson itself, its place in the
 * curriculum, and where the student left off.
 *
 * Access is decided here, on the server, for every request. The curriculum is
 * returned regardless so a student can see what they own and navigate it, but a
 * lesson body is only reachable when access holds or the lesson is a preview.
 */
export type LearningView = {
  courseSlug: string;
  courseTitle: string;
  productId: string;
  hasAccess: boolean;
  lesson: {
    id: string;
    title: string;
    content: string | null;
    hasVideo: boolean;
    isPreview: boolean;
    durationSec: number | null;
    completed: boolean;
  };
  curriculum: Array<{
    moduleId: string;
    moduleTitle: string;
    lessons: Array<{
      id: string;
      title: string;
      isPreview: boolean;
      completed: boolean;
      isCurrent: boolean;
    }>;
  }>;
  previousLessonId: string | null;
  nextLessonId: string | null;
};

export async function getLearningView(
  courseSlug: string,
  lessonId: string,
  userId: string,
): Promise<LearningView | null> {
  const product = await prisma.product.findFirst({
    where: { slug: courseSlug, type: 'COURSE', status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      course: {
        select: {
          modules: {
            where: { status: 'PUBLISHED' },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              lessons: {
                where: { status: 'PUBLISHED' },
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  title: true,
                  content: true,
                  isPreview: true,
                  durationSec: true,
                  videoAssetId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product?.course) return null;

  const modules = product.course.modules;
  const flatLessons = modules.flatMap((module) => module.lessons);
  const current = flatLessons.find((lesson) => lesson.id === lessonId);
  if (!current) return null;

  const hasAccess = await hasActiveEntitlement(userId, product.id);

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: flatLessons.map((lesson) => lesson.id) } },
    select: { lessonId: true, completed: true },
  });
  const completedIds = new Set(
    progressRows.filter((row) => row.completed).map((row) => row.lessonId),
  );

  const currentIndex = flatLessons.findIndex((lesson) => lesson.id === lessonId);

  return {
    courseSlug: product.slug,
    courseTitle: product.title,
    productId: product.id,
    hasAccess,
    lesson: {
      id: current.id,
      title: current.title,
      content: current.content,
      hasVideo: current.videoAssetId !== null,
      isPreview: current.isPreview,
      durationSec: current.durationSec,
      completed: completedIds.has(current.id),
    },
    curriculum: modules.map((module) => ({
      moduleId: module.id,
      moduleTitle: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        isPreview: lesson.isPreview,
        completed: completedIds.has(lesson.id),
        isCurrent: lesson.id === lessonId,
      })),
    })),
    previousLessonId: currentIndex > 0 ? (flatLessons[currentIndex - 1]?.id ?? null) : null,
    nextLessonId:
      currentIndex < flatLessons.length - 1 ? (flatLessons[currentIndex + 1]?.id ?? null) : null,
  };
}
