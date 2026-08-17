import 'server-only';

import { prisma } from '@/lib/db';
import { hasActiveEntitlement } from '@/services/access/entitlement';

/**
 * Public product detail.
 *
 * Figures such as lesson counts and total duration are computed from the rows
 * that actually exist. Where a value is genuinely unknown — a lesson whose
 * duration has not been set — it is reported as unknown rather than counted as
 * zero, so the page never quietly understates what a student is buying.
 */
export type CourseDetail = {
  productId: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  priceHalalas: number;
  category: string | null;
  level: string | null;
  lessonCount: number;
  /** Null when at least one published lesson has no recorded duration. */
  totalDurationSec: number | null;
  modules: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      durationSec: number | null;
      isPreview: boolean;
      hasVideo: boolean;
    }>;
  }>;
  hasAccess: boolean;
};

export async function getCourseDetail(
  slug: string,
  viewerId: string | null,
): Promise<CourseDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, type: 'COURSE', status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      longDescription: true,
      priceHalalas: true,
      course: {
        select: {
          category: true,
          level: true,
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
                  durationSec: true,
                  isPreview: true,
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

  const modules = product.course.modules.map((module) => ({
    id: module.id,
    title: module.title,
    lessons: module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      hasVideo: lesson.videoAssetId !== null,
    })),
  }));

  const allLessons = modules.flatMap((module) => module.lessons);
  const durationsKnown = allLessons.every((lesson) => lesson.durationSec !== null);
  const totalDurationSec = durationsKnown
    ? allLessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0)
    : null;

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    priceHalalas: product.priceHalalas,
    category: product.course.category,
    level: product.course.level,
    lessonCount: allLessons.length,
    totalDurationSec,
    modules,
    hasAccess: viewerId ? await hasActiveEntitlement(viewerId, product.id) : false,
  };
}

export type SimulatorDetail = {
  productId: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  priceHalalas: number;
  track: 'SCIENTIFIC' | 'THEORETICAL' | 'BOTH' | 'CUSTOM';
  trainingModeEnabled: boolean;
  fullSimulationEnabled: boolean;
  /** Null when no version is published, in which case no figures are shown. */
  activeVersion: {
    sectionCount: number;
    totalQuestions: number;
    totalDurationSec: number;
    resultDisclaimer: string;
    sourceLabel: string | null;
    sourceUrl: string | null;
    sourceRetrievedAt: Date | null;
    sourceNote: string | null;
    calculatorEnabled: boolean;
    scratchpadEnabled: boolean;
  } | null;
  hasAccess: boolean;
};

export async function getSimulatorDetail(
  slug: string,
  viewerId: string | null,
): Promise<SimulatorDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, type: 'EXAM_SIMULATOR', status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      longDescription: true,
      priceHalalas: true,
      examSimulator: {
        select: {
          track: true,
          trainingModeEnabled: true,
          fullSimulationEnabled: true,
          activeExamVersion: {
            select: {
              totalQuestions: true,
              totalDurationSec: true,
              resultDisclaimer: true,
              sourceLabel: true,
              sourceUrl: true,
              sourceRetrievedAt: true,
              sourceNote: true,
              sections: {
                orderBy: { position: 'asc' },
                select: { calculatorEnabled: true, scratchpadEnabled: true },
              },
            },
          },
        },
      },
    },
  });

  if (!product?.examSimulator) return null;

  const version = product.examSimulator.activeExamVersion;

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    priceHalalas: product.priceHalalas,
    track: product.examSimulator.track,
    trainingModeEnabled: product.examSimulator.trainingModeEnabled,
    fullSimulationEnabled: product.examSimulator.fullSimulationEnabled,
    activeVersion: version
      ? {
          sectionCount: version.sections.length,
          totalQuestions: version.totalQuestions,
          totalDurationSec: version.totalDurationSec,
          resultDisclaimer: version.resultDisclaimer,
          sourceLabel: version.sourceLabel,
          sourceUrl: version.sourceUrl,
          sourceRetrievedAt: version.sourceRetrievedAt,
          sourceNote: version.sourceNote,
          // Policies are uniform across the seeded sections; the first section
          // is representative of what the student will meet.
          calculatorEnabled: version.sections[0]?.calculatorEnabled ?? false,
          scratchpadEnabled: version.sections[0]?.scratchpadEnabled ?? false,
        }
      : null,
    hasAccess: viewerId ? await hasActiveEntitlement(viewerId, product.id) : false,
  };
}
