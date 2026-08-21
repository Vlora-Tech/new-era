import 'server-only';

import type { CoverImage } from '@/components/marketing/course-cover';
import { prisma } from '@/lib/db';
import { mediaAssetUrl } from '@/services/media/media.service';

/**
 * Public product detail.
 *
 * Figures such as lesson counts and total duration are computed from the rows
 * that actually exist. Where a value is genuinely unknown — a lesson whose
 * duration has not been set — it is reported as unknown rather than counted as
 * zero, so the page never quietly understates what a student is buying.
 */

/**
 * Where the viewer stands with respect to buying this product.
 *
 * A boolean `hasAccess` was not enough, and the page it fed showed why: it kept
 * the price, «شراء لمرة واحدة» and the purchase list in front of somebody who
 * had already paid, and merely relabelled the button. That reads as an invitation
 * to buy the same thing twice.
 *
 * Three states, because three different readers arrive at this page:
 *
 *  - `owned` — an ACTIVE entitlement. Nothing about price or purchase belongs on
 *    their screen; they want the way in.
 *  - `pending-order` — an order exists for this product and has not been paid.
 *    Offering a second «اشترِ» control here is how a student ends up with two
 *    orders, and possibly two payments, for one course. They are given their own
 *    order back instead.
 *  - `available` — anyone else, signed in or not. This is the only state that
 *    sees the buy panel.
 *
 * A revoked or refunded entitlement is deliberately `available`: access was
 * withdrawn, and buying again is a legitimate thing to want to do.
 */
export type PurchaseState =
  | { kind: 'owned'; grantedAt: Date | null }
  | { kind: 'pending-order'; orderId: string; createdAt: Date }
  | { kind: 'available' };

const AVAILABLE: PurchaseState = { kind: 'available' };

/**
 * Decide the viewer's purchase state in one place.
 *
 * The entitlement is read first and short-circuits: someone who owns the
 * product does not care that an old unpaid order is still lying about, and an
 * order left `PENDING_PAYMENT` after a successful reconciliation would otherwise
 * shadow the access they actually have.
 */
async function resolvePurchaseState(
  viewerId: string | null,
  productId: string,
): Promise<PurchaseState> {
  if (!viewerId) return AVAILABLE;

  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_productId: { userId: viewerId, productId } },
    select: { status: true, grantedAt: true },
  });
  if (entitlement?.status === 'ACTIVE') {
    return { kind: 'owned', grantedAt: entitlement.grantedAt };
  }

  // Only PENDING_PAYMENT. A FAILED order has nothing to resume — the honest
  // next step there is a fresh attempt, which is what the buy panel offers.
  const pending = await prisma.order.findFirst({
    where: { userId: viewerId, productId, status: 'PENDING_PAYMENT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });

  return pending
    ? { kind: 'pending-order', orderId: pending.id, createdAt: pending.createdAt }
    : AVAILABLE;
}

export type CourseDetail = {
  productId: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  priceHalalas: number;
  category: string | null;
  level: string | null;
  /**
   * The cover the administrator attached, or null for the composed brand field.
   *
   * The catalogue card and this page draw the same object at two sizes, so a
   * product that has a cover carries it through from the grid to the masthead
   * instead of the page inventing a second treatment.
   */
  cover: CoverImage | null;
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
  /** True exactly when `purchase.kind === 'owned'`; kept for the curriculum's lock. */
  hasAccess: boolean;
  purchase: PurchaseState;
  /**
   * Where an owner should be sent, and how far they have got.
   *
   * Null for anyone who does not own the course, and for an owner of a course
   * with no published lesson to open. `resumeLessonId` is the first lesson they
   * have not completed, falling back to the first lesson once they have
   * finished — a finished course still has to be re-openable.
   */
  ownerProgress: {
    completedCount: number;
    totalCount: number;
    resumeLessonId: string | null;
    /** False once every lesson is complete, so the panel can say «راجع» instead. */
    hasUnfinished: boolean;
  } | null;
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
      /*
       * The cover, and only what draws it. `visibility` is selected because
       * `mediaAssetUrl` needs it to decide between the public address and the
       * authorising route — the same four columns, and the same reason, as the
       * catalogue's own query in `(public)/courses/page.tsx`.
       */
      coverAsset: {
        select: { id: true, objectKey: true, visibility: true, width: true, height: true },
      },
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

  const purchase = await resolvePurchaseState(viewerId, product.id);

  // Progress is read only for an owner. The catalogue page is public and mostly
  // seen by people who do not own the course; querying their (empty) progress on
  // every view would be a join nobody reads.
  let ownerProgress: CourseDetail['ownerProgress'] = null;
  if (purchase.kind === 'owned' && viewerId) {
    const completedRows = await prisma.lessonProgress.findMany({
      where: {
        userId: viewerId,
        completed: true,
        lessonId: { in: allLessons.map((lesson) => lesson.id) },
      },
      select: { lessonId: true },
    });
    const completed = new Set(completedRows.map((row) => row.lessonId));
    const next = allLessons.find((lesson) => !completed.has(lesson.id)) ?? null;

    ownerProgress = {
      completedCount: completed.size,
      totalCount: allLessons.length,
      resumeLessonId: next?.id ?? allLessons[0]?.id ?? null,
      hasUnfinished: next !== null,
    };
  }

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    priceHalalas: product.priceHalalas,
    category: product.course.category,
    level: product.course.level,
    cover: product.coverAsset
      ? {
          url: mediaAssetUrl(product.coverAsset),
          width: product.coverAsset.width,
          height: product.coverAsset.height,
        }
      : null,
    lessonCount: allLessons.length,
    totalDurationSec,
    modules,
    hasAccess: purchase.kind === 'owned',
    purchase,
    ownerProgress,
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
  /** True exactly when `purchase.kind === 'owned'`. */
  hasAccess: boolean;
  purchase: PurchaseState;
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
  const purchase = await resolvePurchaseState(viewerId, product.id);

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
    hasAccess: purchase.kind === 'owned',
    purchase,
  };
}
