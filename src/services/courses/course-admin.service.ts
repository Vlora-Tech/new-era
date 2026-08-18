import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { parseRichText, richTextToPlain } from '@/lib/exam/content';
import { logger } from '@/lib/logger';
import {
  AUDIT_ACTIONS,
  writeAuditLog,
  auditChanges,
  type AuditAction,
  type AuditActor,
} from '@/services/audit/audit.service';
import type {
  CourseListQuery,
  CreateLessonInput,
  CreateModuleInput,
  LessonUpdateInput,
  SaveLessonQuizInput,
  UpdateCourseSettingsInput,
} from '@/validators/admin-course';

/**
 * Course content administration: modules, lessons, and the short quiz that can
 * hang off a lesson.
 *
 * Five properties are the reason this is a service rather than Prisma calls
 * inside route handlers, and each of them is a rule that no single call site
 * could be trusted to remember:
 *
 *  1. **A `Course` is never created or destroyed here.** It exists one-to-one
 *     with a `Product` of type `COURSE` and is written by `createProduct`. This
 *     file owns *structure* — the tree beneath the course — plus the three
 *     course-level settings that are not catalogue fields. Nothing here writes a
 *     title, a price or a `ProductStatus`; those belong to the catalogue screen,
 *     and duplicating them would create two places that both appear to own one
 *     value.
 *  2. **Ordering is a property of the container, applied whole.** `position` is
 *     deliberately not unique on `CourseModule` or `Lesson` — the schema comment
 *     says a unique index would deadlock against the swap a reorder performs —
 *     so the list is only ever consistent as a set. `reorderModules` and
 *     `reorderLessons` therefore take the complete ordered array and rewrite
 *     every position in one transaction, and refuse a list that no longer
 *     describes the rows that exist rather than applying half of it.
 *  3. **A student's record is not deletable content.** `LessonProgress.lessonId`
 *     is `Restrict` and `LessonQuizAttempt.quizId` is too, so the database would
 *     already decline. The counts are read first anyway, because a foreign key
 *     violation surfaces as an unexplained failure while these paths name the
 *     obstacle and point at archiving — which is the action that was actually
 *     wanted. A module deletion cascades to its lessons, so it has to answer for
 *     every descendant before it starts.
 *  4. **Publication has preconditions and is not a field.** A lesson with
 *     neither a video nor any text is a lesson a student opens onto nothing; a
 *     module with no published lesson is an empty heading. Both refusals name
 *     what is missing.
 *  5. **Every mutation is audited inside its own transaction**, so the trail can
 *     never record a change that rolled back. A reorder writes one row against
 *     the parent rather than one per row that moved: ten lessons shifting by one
 *     position is one administrative decision.
 */

export type AdminCourseContext = {
  actor: AuditActor;
  requestId?: string;
};

// ── Identifiers ──────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function courseNotFound(): never {
  throw new HttpError(404, COPY.adminCourses.errors.courseNotFound, 'course_not_found');
}
function moduleNotFound(): never {
  throw new HttpError(404, COPY.adminCourses.errors.moduleNotFound, 'module_not_found');
}
function lessonNotFound(): never {
  throw new HttpError(404, COPY.adminCourses.errors.lessonNotFound, 'lesson_not_found');
}
function quizNotFound(): never {
  throw new HttpError(404, COPY.adminCourses.errors.quizNotFound, 'quiz_not_found');
}

/**
 * Accept a path segment as an id, or refuse it as "no such record".
 *
 * Every id column here is `uuid` in PostgreSQL, so handing Prisma
 * `/api/admin/lessons/hello` raises a driver-level cast error that the envelope
 * can only report as an unexpected 500. A malformed id is not a server fault —
 * it names a record that does not exist, and that is what the caller is told.
 */
function parseUuid(value: string, onInvalid: () => never): string {
  if (!UUID_PATTERN.test(value)) onInvalid();
  return value;
}

export const parseCourseId = (value: string) => parseUuid(value, courseNotFound);
export const parseModuleId = (value: string) => parseUuid(value, moduleNotFound);
export const parseLessonId = (value: string) => parseUuid(value, lessonNotFound);

// ── Shapes the screens consume ───────────────────────────────────────────

export type AdminCourseRow = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: $Enums.ProductStatus;
  category: string | null;
  level: string | null;
  moduleCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  /** Sum of the lesson durations that have one. Zero when none do. */
  durationSec: number;
  updatedAt: Date;
};

export type AdminCoursePage = {
  rows: AdminCourseRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export type AdminLessonNode = {
  id: string;
  title: string;
  position: number;
  status: $Enums.ContentStatus;
  durationSec: number | null;
  isPreview: boolean;
  /**
   * Whether the lesson has any supporting text. The text itself is deliberately
   * not carried into the builder: a course with fifty lessons would otherwise
   * ship every word of every one of them to the browser to render a tick. The
   * editor fetches the body it is about to edit, and nothing else does.
   */
  hasContent: boolean;
  videoAssetId: string | null;
  videoTitle: string | null;
  /** False when the attached asset is still processing or failed to process. */
  videoReady: boolean;
  /** Null means "inherit the course default", which is what the screen says. */
  completionThresholdPercent: number | null;
  /** Null when the lesson has no quiz at all — distinct from a quiz with no questions. */
  quizQuestionCount: number | null;
  quizAttemptCount: number;
  /**
   * Why the builder needs this: a lesson students have watched cannot be
   * deleted, and a control that only discovers that on click is a refusal the
   * administrator had to earn.
   */
  progressCount: number;
  updatedAt: Date;
};

export type AdminModuleNode = {
  id: string;
  title: string;
  position: number;
  status: $Enums.ContentStatus;
  lessons: AdminLessonNode[];
  publishedLessonCount: number;
  durationSec: number;
  /** Summed across every descendant lesson: a module delete cascades to all of them. */
  progressCount: number;
  quizAttemptCount: number;
  updatedAt: Date;
};

export type AdminCourseDetail = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: $Enums.ProductStatus;
  category: string | null;
  level: string | null;
  completionThresholdPercent: number;
  modules: AdminModuleNode[];
  totals: {
    moduleCount: number;
    lessonCount: number;
    publishedLessonCount: number;
    durationSec: number;
  };
};

export type AdminLessonDetail = {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  content: string | null;
  position: number;
  status: $Enums.ContentStatus;
  videoAssetId: string | null;
  durationSec: number | null;
  isPreview: boolean;
  completionThresholdPercent: number | null;
  progressCount: number;
  updatedAt: Date;
};

export type AdminQuizQuestionRow = {
  id: string;
  questionId: string;
  position: number;
  points: number;
  stemExcerpt: string;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  workflow: $Enums.QuestionWorkflow;
};

export type AdminLessonQuizDetail = {
  id: string;
  lessonId: string;
  feedbackMode: $Enums.FeedbackMode;
  maxAttempts: number | null;
  attemptCount: number;
  questions: AdminQuizQuestionRow[];
};

/** A video that could be attached to a lesson, and whether something already has it. */
export type AdminVideoOption = {
  id: string;
  title: string | null;
  durationSec: number | null;
  processingStatus: $Enums.VideoProcessingStatus;
  /** The lesson currently holding this asset, when there is one. */
  attachedLessonId: string | null;
};

const STEM_EXCERPT_LENGTH = 120;

/** One line of a question's stem, for a picker row. Never the whole document. */
function excerpt(stem: Prisma.JsonValue): string {
  const plain = richTextToPlain(parseRichText(stem)).replace(/\s+/g, ' ').trim();
  return plain.length > STEM_EXCERPT_LENGTH ? `${plain.slice(0, STEM_EXCERPT_LENGTH)}…` : plain;
}

// ── Reads: the list ──────────────────────────────────────────────────────

/**
 * One page of course products, filtered on the server.
 *
 * The list is a list of `Course` rows, which is the same thing as a list of
 * products of type `COURSE` — the relation is one-to-one and mandatory. Ordering
 * follows the product's `updatedAt` because that is the timestamp an
 * administrator recognises, with `id` breaking ties: two courses saved in the
 * same millisecond otherwise have no defined order, and an undefined order
 * across two pages is how a row appears twice while another is never shown.
 *
 * The count and the page are read in one transaction so the pagination summary
 * describes the same moment as the rows beneath it.
 */
export async function listCourses(query: CourseListQuery): Promise<AdminCoursePage> {
  const product: Prisma.ProductWhereInput = { type: 'COURSE' };
  if (query.productStatus) product.status = query.productStatus;

  const where: Prisma.CourseWhereInput = { product };

  if (query.category) where.category = query.category;
  // "Only courses that have at least one lesson" — a module with no lessons does
  // not count, because an empty module is exactly the state this filter hides.
  if (query.hasLessons === true) where.modules = { some: { lessons: { some: {} } } };
  if (query.hasLessons === false) where.modules = { every: { lessons: { none: {} } } };

  if (query.q) {
    // Normalised the way the stored slug was, so a slug pasted from a URL finds
    // the row it came from.
    const term = query.q.normalize('NFKC');
    where.OR = [
      { product: { title: { contains: term, mode: 'insensitive' } } },
      { product: { slug: { contains: term.toLowerCase(), mode: 'insensitive' } } },
      { category: { contains: term, mode: 'insensitive' } },
      { level: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ product: { updatedAt: 'desc' } }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: {
        id: true,
        productId: true,
        category: true,
        level: true,
        product: { select: { title: true, slug: true, status: true, updatedAt: true } },
        // Narrow on purpose: two scalars per lesson, which is what the three
        // counts and the total duration are computed from. Selecting the lesson
        // bodies to count them is how a list screen starts shipping a course.
        modules: {
          select: { id: true, lessons: { select: { status: true, durationSec: true } } },
        },
      },
    }),
  ]);

  return {
    rows: rows.map((course) => {
      const lessons = course.modules.flatMap((module) => module.lessons);
      return {
        id: course.id,
        productId: course.productId,
        productTitle: course.product.title,
        productSlug: course.product.slug,
        productStatus: course.product.status,
        category: course.category,
        level: course.level,
        moduleCount: course.modules.length,
        lessonCount: lessons.length,
        publishedLessonCount: lessons.filter((lesson) => lesson.status === 'PUBLISHED').length,
        durationSec: lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0),
        updatedAt: course.product.updatedAt,
      };
    }),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/**
 * The categories actually in use, for the filter bar.
 *
 * Read from the data rather than from a fixed list: `Course.category` is free
 * text for internal organisation, so a hard-coded set would go stale the first
 * time somebody invented a new one and would then hide their courses.
 */
export async function listCourseCategories(): Promise<string[]> {
  const rows = await prisma.course.findMany({
    where: { category: { not: null } },
    distinct: ['category'],
    orderBy: { category: 'asc' },
    select: { category: true },
  });
  return rows.map((row) => row.category).filter((value): value is string => value !== null);
}

// ── Reads: the builder ───────────────────────────────────────────────────

const BUILDER_SELECT = {
  id: true,
  productId: true,
  category: true,
  level: true,
  completionThresholdPercent: true,
  product: { select: { title: true, slug: true, status: true, type: true } },
  modules: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      position: true,
      status: true,
      updatedAt: true,
      lessons: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          position: true,
          status: true,
          content: true,
          durationSec: true,
          isPreview: true,
          videoAssetId: true,
          completionThresholdPercent: true,
          updatedAt: true,
          videoAsset: { select: { title: true, processingStatus: true } },
          _count: { select: { progress: true } },
          quiz: { select: { _count: { select: { questions: true, attempts: true } } } },
        },
      },
    },
  },
} satisfies Prisma.CourseSelect;

/**
 * The whole tree one builder screen draws.
 *
 * One query, because the screen is one thing: a course whose modules loaded and
 * whose lessons did not is not a partially useful page, it is a page that lies
 * about an empty module. `content` is read to decide `hasContent` and then
 * dropped — see the comment on `AdminLessonNode.hasContent`.
 */
export async function getCourseBuilder(courseId: string): Promise<AdminCourseDetail | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: BUILDER_SELECT,
  });
  if (!course) return null;

  // Defensive: `Course` only ever hangs off a `COURSE` product, but a row edited
  // straight in the database should produce a sentence rather than a screen that
  // silently offers lesson tools for a simulator.
  if (course.product.type !== 'COURSE') {
    throw new HttpError(409, COPY.adminCourses.errors.productNotCourse, 'product_not_course');
  }

  const modules: AdminModuleNode[] = course.modules.map((module) => {
    const lessons: AdminLessonNode[] = module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      status: lesson.status,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      hasContent: (lesson.content ?? '').trim().length > 0,
      videoAssetId: lesson.videoAssetId,
      videoTitle: lesson.videoAsset?.title ?? null,
      videoReady: lesson.videoAsset?.processingStatus === 'READY',
      completionThresholdPercent: lesson.completionThresholdPercent,
      quizQuestionCount: lesson.quiz ? lesson.quiz._count.questions : null,
      quizAttemptCount: lesson.quiz?._count.attempts ?? 0,
      progressCount: lesson._count.progress,
      updatedAt: lesson.updatedAt,
    }));

    return {
      id: module.id,
      title: module.title,
      position: module.position,
      status: module.status,
      lessons,
      publishedLessonCount: lessons.filter((lesson) => lesson.status === 'PUBLISHED').length,
      durationSec: lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0),
      progressCount: lessons.reduce((total, lesson) => total + lesson.progressCount, 0),
      quizAttemptCount: lessons.reduce((total, lesson) => total + lesson.quizAttemptCount, 0),
      updatedAt: module.updatedAt,
    };
  });

  const allLessons = modules.flatMap((module) => module.lessons);

  return {
    id: course.id,
    productId: course.productId,
    productTitle: course.product.title,
    productSlug: course.product.slug,
    productStatus: course.product.status,
    category: course.category,
    level: course.level,
    completionThresholdPercent: course.completionThresholdPercent,
    modules,
    totals: {
      moduleCount: modules.length,
      lessonCount: allLessons.length,
      publishedLessonCount: allLessons.filter((lesson) => lesson.status === 'PUBLISHED').length,
      durationSec: allLessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0),
    },
  };
}

/** One lesson with its body, for the editor that is about to change it. */
export async function getLessonForAdmin(lessonId: string): Promise<AdminLessonDetail | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      moduleId: true,
      title: true,
      content: true,
      position: true,
      status: true,
      videoAssetId: true,
      durationSec: true,
      isPreview: true,
      completionThresholdPercent: true,
      updatedAt: true,
      module: { select: { courseId: true } },
      _count: { select: { progress: true } },
    },
  });
  if (!lesson) return null;

  const { module, _count, ...rest } = lesson;
  return { ...rest, courseId: module.courseId, progressCount: _count.progress };
}

/**
 * Video assets an administrator could attach.
 *
 * The list is returned even when Bunny is unconfigured, and it is then simply
 * empty, because there are no rows. The screen states that video is not
 * configured rather than drawing a picker over nothing — an empty picker and an
 * unconfigured provider look identical and mean very different things.
 */
export async function listVideoOptions(): Promise<AdminVideoOption[]> {
  const assets = await prisma.videoAsset.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      durationSec: true,
      processingStatus: true,
      lessons: { select: { id: true }, take: 1 },
    },
  });

  return assets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    durationSec: asset.durationSec,
    processingStatus: asset.processingStatus,
    attachedLessonId: asset.lessons[0]?.id ?? null,
  }));
}

// ── Course settings ──────────────────────────────────────────────────────

const AUDITED_COURSE_FIELDS = ['category', 'level', 'completionThresholdPercent'] as const;

type AuditableCourse = {
  category: string | null;
  level: string | null;
  completionThresholdPercent: number;
};

/**
 * Save the three course-level settings.
 *
 * Changing the threshold does not recompute anything. `LessonProgress.completed`
 * is a stored boolean stamped when the student crossed the line that applied at
 * the time; recomputing it here would un-complete lessons people finished, which
 * is a change to their record made by an edit to a setting. The field hint says
 * so, and this function's silence on `lesson_progress` is what makes it true.
 */
export async function updateCourseSettings(
  courseId: string,
  input: UpdateCourseSettingsInput,
  context: AdminCourseContext,
): Promise<AdminCourseDetail> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, category: true, level: true, completionThresholdPercent: true },
    });
    if (!before) courseNotFound();

    const after = await tx.course.update({
      where: { id: courseId },
      data: {
        category: input.category,
        level: input.level,
        completionThresholdPercent: input.completionThresholdPercent,
      },
      select: { category: true, level: true, completionThresholdPercent: true },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.COURSE_UPDATED,
      targetType: 'Course',
      targetId: courseId,
      metadata: auditChanges<AuditableCourse>(before, after, AUDITED_COURSE_FIELDS),
      requestId: context.requestId,
    });
  });

  logger.info('course settings updated', {
    courseId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  const detail = await getCourseBuilder(courseId);
  if (!detail) courseNotFound();
  return detail;
}

// ── Modules ──────────────────────────────────────────────────────────────

/** The next free slot at the end of a container's ordering. */
async function nextPosition(
  tx: PrismaTransaction,
  container: { courseId: string } | { moduleId: string },
): Promise<number> {
  if ('courseId' in container) {
    const result = await tx.courseModule.aggregate({
      where: { courseId: container.courseId },
      _max: { position: true },
    });
    return (result._max.position ?? -1) + 1;
  }
  const result = await tx.lesson.aggregate({
    where: { moduleId: container.moduleId },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

/**
 * Add a module at the end of the course, as a draft.
 *
 * Never published on creation, and the position is computed here rather than
 * accepted: a body that could carry one would let two administrators each claim
 * slot three, and the schema has no unique index to catch it — deliberately, see
 * the note at the top of this file.
 */
export async function createModule(
  courseId: string,
  input: CreateModuleInput,
  context: AdminCourseContext,
): Promise<{ id: string }> {
  const created = await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) courseNotFound();

    const created = await tx.courseModule.create({
      data: {
        courseId,
        title: input.title,
        position: await nextPosition(tx, { courseId }),
        status: 'DRAFT',
      },
      select: { id: true, title: true, position: true, status: true },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.MODULE_CREATED,
      targetType: 'CourseModule',
      targetId: created.id,
      metadata: { courseId, title: created.title, position: created.position },
      requestId: context.requestId,
    });

    return created;
  });

  logger.info('course module created', {
    courseId,
    moduleId: created.id,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return { id: created.id };
}

export async function updateModule(
  moduleId: string,
  input: { title: string },
  context: AdminCourseContext,
): Promise<{ id: string }> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true, title: true },
    });
    if (!before) moduleNotFound();

    const after = await tx.courseModule.update({
      where: { id: moduleId },
      data: { title: input.title },
      select: { title: true },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.MODULE_UPDATED,
      targetType: 'CourseModule',
      targetId: moduleId,
      metadata: {
        courseId: before.courseId,
        ...auditChanges<{ title: string }>(before, after, ['title']),
      },
      requestId: context.requestId,
    });
  });

  return { id: moduleId };
}

/**
 * The three transitions, mapped to the three actions.
 *
 * `DRAFT` is `unpublished` regardless of whether the module was published or
 * archived a moment earlier: both are a return to the editable state, and the
 * audit metadata carries the `from` so the trail can tell them apart without a
 * fourth action nobody would filter on.
 */
const MODULE_TRANSITION_ACTIONS: Record<$Enums.ContentStatus, AuditAction> = {
  PUBLISHED: AUDIT_ACTIONS.MODULE_PUBLISHED,
  ARCHIVED: AUDIT_ACTIONS.MODULE_ARCHIVED,
  DRAFT: AUDIT_ACTIONS.MODULE_UNPUBLISHED,
};

const LESSON_TRANSITION_ACTIONS: Record<$Enums.ContentStatus, AuditAction> = {
  PUBLISHED: AUDIT_ACTIONS.LESSON_PUBLISHED,
  ARCHIVED: AUDIT_ACTIONS.LESSON_ARCHIVED,
  DRAFT: AUDIT_ACTIONS.LESSON_UNPUBLISHED,
};

/**
 * Move a module between DRAFT, PUBLISHED and ARCHIVED.
 *
 * Publishing requires a published lesson inside. That order is deliberate and it
 * is what the copy describes: a lesson may be published inside a draft module —
 * it changes nothing a student sees, which is the point of the two gates — and
 * the module is then opened last. A module published over drafts would appear in
 * the curriculum as a heading with nothing under it.
 */
export async function transitionModuleStatus(
  moduleId: string,
  status: $Enums.ContentStatus,
  context: AdminCourseContext,
): Promise<{ changed: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.courseModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
        _count: { select: { lessons: true } },
      },
    });
    if (!before) moduleNotFound();

    // Answered honestly rather than re-stamped: a second audit row for a
    // publication that already happened is exactly the noise that makes a trail
    // unreadable.
    if (before.status === status) return { changed: false, courseId: before.courseId };

    if (status === 'PUBLISHED') {
      const publishedLessons = await tx.lesson.count({
        where: { moduleId, status: 'PUBLISHED' },
      });
      if (publishedLessons === 0) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.moduleNeedsLessonToPublish,
          'module_incomplete',
        );
      }
    }

    await tx.courseModule.update({ where: { id: moduleId }, data: { status } });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: MODULE_TRANSITION_ACTIONS[status],
      targetType: 'CourseModule',
      targetId: moduleId,
      metadata: {
        courseId: before.courseId,
        title: before.title,
        from: before.status,
        to: status,
        lessonCount: before._count.lessons,
      },
      requestId: context.requestId,
    });

    return { changed: true, courseId: before.courseId };
  });

  if (result.changed) {
    logger.info('course module status changed', {
      moduleId,
      status,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  return { changed: result.changed };
}

/**
 * Delete a module, and refuse whenever that would erase a student's record.
 *
 * `CourseModule.lessons` cascades, so this statement removes every lesson under
 * it. The question is therefore not "does this module have progress" — a module
 * has none — but "does anything beneath it". Both obstacles are named
 * separately, because watching a lesson and sitting its quiz are two different
 * records and the administrator's next move differs: archive the module, or
 * detach the quiz first.
 */
export async function deleteModule(
  moduleId: string,
  context: AdminCourseContext,
): Promise<{ courseId: string }> {
  try {
    return await deleteModuleUnguarded(moduleId, context);
  } catch (error) {
    // The counts above are read at READ COMMITTED, so a student can finish a
    // lesson between the check and the delete and the `Restrict` edge on
    // `lesson_progress` fires anyway. `deleteLesson` catches exactly this;
    // without the same arm here the administrator gets an unexplained 500 and no
    // hint that archiving is the action they wanted.
    if (isRestrictViolation(error)) {
      logger.warn('module deletion refused by a database constraint', {
        moduleId,
        requestId: context.requestId,
      });
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByProgress,
        'lesson_delete_blocked',
      );
    }
    throw error;
  }
}

/**
 * A foreign-key or required-relation violation, whichever way Prisma reports it.
 *
 * Shared by the three delete paths under a course so they cannot drift apart
 * about which codes mean "something still points at this".
 */
function isRestrictViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2003' || error.code === 'P2014')
  );
}

async function deleteModuleUnguarded(
  moduleId: string,
  context: AdminCourseContext,
): Promise<{ courseId: string }> {
  const courseId = await prisma.$transaction(async (tx) => {
    const target = await tx.courseModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
        position: true,
        lessons: {
          select: {
            id: true,
            _count: { select: { progress: true } },
            quiz: { select: { _count: { select: { attempts: true } } } },
          },
        },
      },
    });
    if (!target) moduleNotFound();

    const progress = target.lessons.reduce((total, lesson) => total + lesson._count.progress, 0);
    if (progress > 0) {
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByProgress,
        'lesson_delete_blocked',
      );
    }

    const quizAttempts = target.lessons.reduce(
      (total, lesson) => total + (lesson.quiz?._count.attempts ?? 0),
      0,
    );
    if (quizAttempts > 0) {
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByQuizAttempts,
        'quiz_delete_blocked',
      );
    }

    // Written before the row disappears, and inside the transaction, so the
    // trail records the deletion only if the deletion actually commits.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.MODULE_DELETED,
      targetType: 'CourseModule',
      targetId: moduleId,
      metadata: {
        courseId: target.courseId,
        title: target.title,
        status: target.status,
        position: target.position,
        lessonCount: target.lessons.length,
      },
      requestId: context.requestId,
    });

    await tx.courseModule.delete({ where: { id: moduleId } });
    return target.courseId;
  });

  logger.info('course module deleted', {
    moduleId,
    courseId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return { courseId };
}

// ── Ordering ─────────────────────────────────────────────────────────────

function reorderStale(): never {
  throw new HttpError(409, COPY.adminCourses.errors.reorderStale, 'reorder_stale');
}

/**
 * Apply a complete ordering, or apply none of it.
 *
 * The submitted list has to be a permutation of exactly the ids that exist right
 * now. Anything else means somebody added, deleted or moved a row between the
 * page rendering and the button being pressed, and writing the positions anyway
 * would silently drop the new row to the end or renumber around a hole. The
 * whole point of sending the list rather than a stream of swaps is that this
 * check is possible at all.
 *
 * Positions are assigned as a dense `0..n-1` rather than swapped pairwise: with
 * no unique index there is nothing to collide with, and a dense sequence means a
 * later insert at the end is always `max + 1` with no gaps to reason about.
 */
function assertPermutation(currentIds: readonly string[], submitted: readonly string[]): void {
  if (currentIds.length !== submitted.length) reorderStale();
  const known = new Set(currentIds);
  // Duplicates are already rejected by the schema, so equal length plus full
  // membership is set equality.
  if (!submitted.every((id) => known.has(id))) reorderStale();
}

export async function reorderModules(
  courseId: string,
  ids: readonly string[],
  context: AdminCourseContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) courseNotFound();

    const current = await tx.courseModule.findMany({
      where: { courseId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const currentIds = current.map((module) => module.id);
    assertPermutation(currentIds, ids);

    for (const [index, id] of ids.entries()) {
      await tx.courseModule.update({ where: { id }, data: { position: index } });
    }

    // One row against the course, not one per module that moved: ten modules
    // shifting by one position is one administrative decision.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.MODULE_REORDERED,
      targetType: 'Course',
      targetId: courseId,
      metadata: { before: currentIds, after: [...ids] },
      requestId: context.requestId,
    });
  });

  logger.info('course modules reordered', {
    courseId,
    count: ids.length,
    actorId: context.actor.id,
    requestId: context.requestId,
  });
}

export async function reorderLessons(
  moduleId: string,
  ids: readonly string[],
  context: AdminCourseContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const parent = await tx.courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    });
    if (!parent) moduleNotFound();

    const current = await tx.lesson.findMany({
      where: { moduleId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const currentIds = current.map((lesson) => lesson.id);

    // A lesson that exists but lives somewhere else is a different mistake from
    // a list that has gone stale, and the two need different sentences: one says
    // "reload", the other says "that lesson is not in this module".
    const known = new Set(currentIds);
    const foreign = ids.filter((id) => !known.has(id));
    if (foreign.length > 0) {
      const elsewhere = await tx.lesson.count({ where: { id: { in: foreign } } });
      if (elsewhere > 0) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.moveModuleMismatch,
          'lesson_module_mismatch',
        );
      }
    }
    assertPermutation(currentIds, ids);

    for (const [index, id] of ids.entries()) {
      await tx.lesson.update({ where: { id }, data: { position: index } });
    }

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.LESSON_REORDERED,
      targetType: 'CourseModule',
      targetId: moduleId,
      metadata: { courseId: parent.courseId, before: currentIds, after: [...ids] },
      requestId: context.requestId,
    });
  });

  logger.info('course lessons reordered', {
    moduleId,
    count: ids.length,
    actorId: context.actor.id,
    requestId: context.requestId,
  });
}

// ── Lessons ──────────────────────────────────────────────────────────────

/**
 * A video has to exist, be finished processing, and not already be on another
 * lesson.
 *
 * The last check is the one that matters. `Lesson.videoAssetId` has no unique
 * index — nothing in the schema stops two lessons pointing at one asset — and
 * two lessons sharing a video means a student who completes one has, as far as
 * the playback session is concerned, watched the other. The uniqueness is a
 * product rule, so it is enforced where product rules live.
 */
async function assertUsableVideo(
  tx: PrismaTransaction,
  videoAssetId: string,
  lessonId: string | null,
): Promise<void> {
  const asset = await tx.videoAsset.findUnique({
    where: { id: videoAssetId },
    select: {
      id: true,
      processingStatus: true,
      lessons: { select: { id: true }, take: 2 },
    },
  });

  if (!asset) {
    throw new HttpError(404, COPY.adminCourses.errors.videoAssetNotFound, 'video_asset_not_found');
  }
  if (asset.processingStatus !== 'READY') {
    throw new HttpError(409, COPY.adminCourses.errors.videoAssetNotReady, 'video_asset_not_ready');
  }
  if (asset.lessons.some((lesson) => lesson.id !== lessonId)) {
    throw new HttpError(409, COPY.adminCourses.errors.videoAssetInUse, 'video_asset_in_use');
  }
}

/**
 * A lesson marked as a free preview must have something to preview.
 *
 * The refusal is about honesty rather than security: an empty preview lesson is
 * a public page that opens onto nothing, which reads to a visitor as a broken
 * course rather than as a lesson still being written.
 */
function assertPreviewable(lesson: {
  isPreview: boolean;
  content: string | null;
  videoAssetId: string | null;
}): void {
  if (!lesson.isPreview) return;
  if (lesson.videoAssetId === null && (lesson.content ?? '').trim().length === 0) {
    throw new HttpError(409, COPY.adminCourses.errors.previewRequiresVideo, 'preview_empty');
  }
}

const AUDITED_LESSON_FIELDS = [
  'title',
  'content',
  'videoAssetId',
  'durationSec',
  'isPreview',
  'completionThresholdPercent',
  'moduleId',
] as const;

type AuditableLesson = {
  title: string;
  content: string | null;
  videoAssetId: string | null;
  durationSec: number | null;
  isPreview: boolean;
  completionThresholdPercent: number | null;
  moduleId: string;
};

export async function createLesson(
  moduleId: string,
  input: CreateLessonInput,
  context: AdminCourseContext,
): Promise<{ id: string }> {
  const created = await prisma.$transaction(async (tx) => {
    const parent = await tx.courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    });
    if (!parent) moduleNotFound();

    if (input.videoAssetId) await assertUsableVideo(tx, input.videoAssetId, null);
    assertPreviewable(input);

    const lesson = await tx.lesson.create({
      data: {
        moduleId,
        title: input.title,
        content: input.content,
        videoAssetId: input.videoAssetId,
        durationSec: input.durationSec,
        isPreview: input.isPreview,
        completionThresholdPercent: input.completionThresholdPercent,
        position: await nextPosition(tx, { moduleId }),
        // Never accepted from the request: a lesson that could be created
        // already published would bypass the precondition below.
        status: 'DRAFT',
      },
      select: {
        id: true,
        title: true,
        content: true,
        videoAssetId: true,
        durationSec: true,
        isPreview: true,
        completionThresholdPercent: true,
        moduleId: true,
        position: true,
      },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.LESSON_CREATED,
      targetType: 'Lesson',
      targetId: lesson.id,
      metadata: {
        courseId: parent.courseId,
        moduleId,
        position: lesson.position,
        ...auditChanges<AuditableLesson>(null, lesson, AUDITED_LESSON_FIELDS),
      },
      requestId: context.requestId,
    });

    return lesson;
  });

  logger.info('lesson created', {
    lessonId: created.id,
    moduleId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return { id: created.id };
}

/**
 * Save an edit, including a move to a sibling module.
 *
 * A move only ever goes to a module of the same course. Allowing it across
 * courses would move paid material between two products people bought
 * separately, and the entitlement that granted access to one says nothing about
 * the other — so the lesson would become visible to a set of students who never
 * bought it. The lesson lands at the end of the target module's ordering rather
 * than at its old index, because its old index means nothing in a list it has
 * never been part of.
 */
export async function updateLesson(
  lessonId: string,
  input: LessonUpdateInput,
  context: AdminCourseContext,
): Promise<{ id: string }> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        moduleId: true,
        title: true,
        content: true,
        videoAssetId: true,
        durationSec: true,
        isPreview: true,
        completionThresholdPercent: true,
        position: true,
        module: { select: { courseId: true } },
      },
    });
    if (!before) lessonNotFound();

    let position = before.position;
    if (input.moduleId !== before.moduleId) {
      const target = await tx.courseModule.findUnique({
        where: { id: input.moduleId },
        select: { id: true, courseId: true },
      });
      if (!target) moduleNotFound();
      if (target.courseId !== before.module.courseId) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.moveModuleMismatch,
          'lesson_module_mismatch',
        );
      }
      position = await nextPosition(tx, { moduleId: input.moduleId });
    }

    // Re-checked on every save rather than only when the id changed: an asset
    // can be attached to another lesson, or fail processing, between two edits
    // of the lesson that points at it.
    if (input.videoAssetId) await assertUsableVideo(tx, input.videoAssetId, lessonId);
    assertPreviewable(input);

    const after = await tx.lesson.update({
      where: { id: lessonId },
      data: {
        moduleId: input.moduleId,
        position,
        title: input.title,
        content: input.content,
        videoAssetId: input.videoAssetId,
        durationSec: input.durationSec,
        isPreview: input.isPreview,
        completionThresholdPercent: input.completionThresholdPercent,
      },
      select: {
        title: true,
        content: true,
        videoAssetId: true,
        durationSec: true,
        isPreview: true,
        completionThresholdPercent: true,
        moduleId: true,
      },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.LESSON_UPDATED,
      targetType: 'Lesson',
      targetId: lessonId,
      metadata: {
        courseId: before.module.courseId,
        ...auditChanges<AuditableLesson>(before, after, AUDITED_LESSON_FIELDS),
      },
      requestId: context.requestId,
    });
  });

  logger.info('lesson updated', {
    lessonId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return { id: lessonId };
}

/**
 * Move a lesson between DRAFT, PUBLISHED and ARCHIVED.
 *
 * Publishing requires a video or some text. A lesson with neither is a title in
 * a list that opens onto an empty page, and the student has no way to tell that
 * from a page that failed to load.
 *
 * Nothing here touches `LessonProgress`. Un-publishing hides a lesson; the
 * people who already watched it keep their record, which is exactly what the
 * confirmation text promises.
 */
export async function transitionLessonStatus(
  lessonId: string,
  status: $Enums.ContentStatus,
  context: AdminCourseContext,
): Promise<{ changed: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        moduleId: true,
        title: true,
        status: true,
        content: true,
        videoAssetId: true,
        module: { select: { courseId: true, status: true } },
      },
    });
    if (!before) lessonNotFound();

    if (before.status === status) return { changed: false };

    if (status === 'PUBLISHED') {
      if (before.videoAssetId === null && (before.content ?? '').trim().length === 0) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.lessonNeedsContentToPublish,
          'lesson_incomplete',
        );
      }
    }

    await tx.lesson.update({ where: { id: lessonId }, data: { status } });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: LESSON_TRANSITION_ACTIONS[status],
      targetType: 'Lesson',
      targetId: lessonId,
      metadata: {
        courseId: before.module.courseId,
        moduleId: before.moduleId,
        title: before.title,
        from: before.status,
        to: status,
        // Recorded because it decides whether this publication changed anything
        // a student can see. A published lesson in a draft module is invisible,
        // and six months later that is the question the trail is asked.
        moduleStatus: before.module.status,
      },
      requestId: context.requestId,
    });

    return { changed: true };
  });

  if (result.changed) {
    logger.info('lesson status changed', {
      lessonId,
      status,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  return result;
}

/**
 * Delete a lesson, and refuse whenever a student has a record against it.
 *
 * `LessonProgress.lessonId` is `Restrict`, so the database would already
 * decline; the count is read first so the answer names the obstacle and offers
 * archiving instead of surfacing a foreign-key violation as an unexplained
 * failure. The `P2003` arm below stays as the backstop for the case where this
 * check is wrong.
 */
export async function deleteLesson(
  lessonId: string,
  context: AdminCourseContext,
): Promise<{ moduleId: string; courseId: string }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          moduleId: true,
          title: true,
          status: true,
          position: true,
          module: { select: { courseId: true } },
          _count: { select: { progress: true } },
          quiz: { select: { id: true, _count: { select: { attempts: true } } } },
        },
      });
      if (!lesson) lessonNotFound();

      if (lesson._count.progress > 0) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.deleteBlockedByProgress,
          'lesson_delete_blocked',
        );
      }
      if ((lesson.quiz?._count.attempts ?? 0) > 0) {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.deleteBlockedByQuizAttempts,
          'quiz_delete_blocked',
        );
      }

      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.LESSON_DELETED,
        targetType: 'Lesson',
        targetId: lessonId,
        metadata: {
          courseId: lesson.module.courseId,
          moduleId: lesson.moduleId,
          title: lesson.title,
          status: lesson.status,
          position: lesson.position,
          hadQuiz: lesson.quiz !== null,
        },
        requestId: context.requestId,
      });

      // The quiz and its question links cascade from the lesson; playback
      // sessions cascade too. Only progress and quiz attempts restrict, and both
      // were refused above.
      await tx.lesson.delete({ where: { id: lessonId } });

      return { moduleId: lesson.moduleId, courseId: lesson.module.courseId };
    });

    logger.info('lesson deleted', {
      lessonId,
      actorId: context.actor.id,
      requestId: context.requestId,
    });

    return result;
  } catch (error) {
    if (isRestrictViolation(error)) {
      logger.warn('lesson deletion refused by a database constraint', {
        lessonId,
        requestId: context.requestId,
      });
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByProgress,
        'lesson_delete_blocked',
      );
    }
    throw error;
  }
}

// ── Lesson quiz ──────────────────────────────────────────────────────────

export async function getLessonQuiz(lessonId: string): Promise<AdminLessonQuizDetail | null> {
  const quiz = await prisma.lessonQuiz.findUnique({
    where: { lessonId },
    select: {
      id: true,
      lessonId: true,
      feedbackMode: true,
      maxAttempts: true,
      _count: { select: { attempts: true } },
      questions: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          questionId: true,
          position: true,
          points: true,
          question: {
            select: { stem: true, domain: true, difficulty: true, workflow: true },
          },
        },
      },
    },
  });
  if (!quiz) return null;

  return {
    id: quiz.id,
    lessonId: quiz.lessonId,
    feedbackMode: quiz.feedbackMode,
    maxAttempts: quiz.maxAttempts,
    attemptCount: quiz._count.attempts,
    questions: quiz.questions.map((row) => ({
      id: row.id,
      questionId: row.questionId,
      position: row.position,
      points: row.points,
      stemExcerpt: excerpt(row.question.stem),
      domain: row.question.domain,
      difficulty: row.question.difficulty,
      // Carried so the screen can say when a question that *was* published has
      // since been retired out from under a live quiz.
      workflow: row.question.workflow,
    })),
  };
}

/**
 * Save the whole quiz as one desired state: settings, questions, order, points.
 *
 * The question list is replaced rather than diffed row by row. `LessonQuizQuestion`
 * has no dependents — an attempt records answers against the `Question`, not
 * against this join row — so deleting and re-creating the links inside one
 * transaction destroys nothing, and it is the only formulation where the final
 * positions are `0..n-1` with no intermediate state that violates
 * `@@unique([quizId, questionId])`.
 *
 * Only published questions may be added. A draft or in-review question has not
 * been checked by anyone, and a lesson quiz is student-facing content: the
 * question bank's workflow exists precisely so that "not yet reviewed" is a
 * state that cannot reach a student, and a second door into the same content
 * would make that guarantee decorative.
 *
 * Up to three audit rows, because up to three separable decisions can be taken
 * in one save: the quiz existing at all, its settings, and its question set.
 * Writing one row for all of them would make "who added this question" a
 * question the trail cannot answer.
 */
export async function saveLessonQuiz(
  lessonId: string,
  input: SaveLessonQuizInput,
  context: AdminCourseContext,
): Promise<{ id: string; created: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, moduleId: true, module: { select: { courseId: true } } },
    });
    if (!lesson) lessonNotFound();

    const requestedIds = input.questions.map((item) => item.questionId);
    const questions = await tx.question.findMany({
      where: { id: { in: requestedIds } },
      select: { id: true, workflow: true },
    });
    const byId = new Map(questions.map((question) => [question.id, question]));

    for (const id of requestedIds) {
      const question = byId.get(id);
      // A question that does not exist and a question that is not published get
      // the same sentence on purpose: from the picker's point of view both mean
      // "this is not something you can put in front of a student", and naming
      // the difference would only tell a caller which ids exist.
      if (!question || question.workflow !== 'PUBLISHED') {
        throw new HttpError(
          409,
          COPY.adminCourses.errors.quizQuestionNotPublished,
          'quiz_question_not_publishable',
        );
      }
    }

    const existing = await tx.lessonQuiz.findUnique({
      where: { lessonId },
      select: {
        id: true,
        feedbackMode: true,
        maxAttempts: true,
        questions: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: { questionId: true, points: true, position: true },
        },
      },
    });

    const quiz = existing
      ? await tx.lessonQuiz.update({
          where: { id: existing.id },
          data: { feedbackMode: input.feedbackMode, maxAttempts: input.maxAttempts },
          select: { id: true, feedbackMode: true, maxAttempts: true },
        })
      : await tx.lessonQuiz.create({
          data: {
            lessonId,
            feedbackMode: input.feedbackMode,
            maxAttempts: input.maxAttempts,
          },
          select: { id: true, feedbackMode: true, maxAttempts: true },
        });

    await tx.lessonQuizQuestion.deleteMany({ where: { quizId: quiz.id } });
    await tx.lessonQuizQuestion.createMany({
      data: input.questions.map((item, index) => ({
        quizId: quiz.id,
        questionId: item.questionId,
        position: index,
        points: item.points,
      })),
    });

    const auditBase = {
      courseId: lesson.module.courseId,
      moduleId: lesson.moduleId,
      lessonId,
    };

    if (!existing) {
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.LESSON_QUIZ_CREATED,
        targetType: 'LessonQuiz',
        targetId: quiz.id,
        metadata: {
          ...auditBase,
          feedbackMode: quiz.feedbackMode,
          maxAttempts: quiz.maxAttempts,
          questionIds: requestedIds,
        },
        requestId: context.requestId,
      });
      return { id: quiz.id, created: true };
    }

    const settingsChanges = auditChanges<{
      feedbackMode: $Enums.FeedbackMode;
      maxAttempts: number | null;
    }>(existing, quiz, ['feedbackMode', 'maxAttempts']);
    if (Object.keys(settingsChanges.after).length > 0) {
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.LESSON_QUIZ_UPDATED,
        targetType: 'LessonQuiz',
        targetId: quiz.id,
        metadata: { ...auditBase, ...settingsChanges },
        requestId: context.requestId,
      });
    }

    const previousIds = existing.questions.map((row) => row.questionId);
    const previousSet = new Set(previousIds);
    const requestedSet = new Set(requestedIds);
    const added = requestedIds.filter((id) => !previousSet.has(id));
    const removed = previousIds.filter((id) => !requestedSet.has(id));

    if (added.length > 0 || removed.length > 0) {
      // One action for both directions, with the direction in the metadata:
      // they are the same decision seen twice.
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.LESSON_QUIZ_QUESTIONS_CHANGED,
        targetType: 'LessonQuiz',
        targetId: quiz.id,
        metadata: { ...auditBase, added, removed },
        requestId: context.requestId,
      });
    } else {
      const pointsByQuestion = new Map(
        existing.questions.map((row) => [row.questionId, row.points]),
      );
      const orderChanged = previousIds.join('\u0000') !== requestedIds.join('\u0000');
      const pointsChanged = input.questions.some(
        (item) => pointsByQuestion.get(item.questionId) !== item.points,
      );
      if (orderChanged || pointsChanged) {
        await writeAuditLog(tx, {
          actor: context.actor,
          action: AUDIT_ACTIONS.LESSON_QUIZ_REORDERED,
          targetType: 'LessonQuiz',
          targetId: quiz.id,
          metadata: { ...auditBase, before: previousIds, after: requestedIds },
          requestId: context.requestId,
        });
      }
    }

    return { id: quiz.id, created: false };
  });

  logger.info('lesson quiz saved', {
    lessonId,
    quizId: result.id,
    created: result.created,
    actorId: context.actor.id,
    requestId: context.requestId,
  });

  return result;
}

/**
 * Detach a quiz from its lesson.
 *
 * Refused once anybody has sat it: `LessonQuizAttempt.quizId` is `Restrict`, and
 * the attempt rows are a student's record of what they answered. The copy offers
 * the alternative — leave it attached and stop pointing at it — rather than
 * inviting a second attempt at the same button.
 */
export async function deleteLessonQuiz(
  lessonId: string,
  context: AdminCourseContext,
): Promise<void> {
  try {
    await deleteLessonQuizUnguarded(lessonId, context);
  } catch (error) {
    // Same race as the module path: a student can submit the quiz between the
    // attempt count and the delete, and `LessonQuizAttempt.quizId` is
    // `Restrict`. The refusal names the obstacle instead of reporting a fault.
    if (isRestrictViolation(error)) {
      logger.warn('lesson quiz deletion refused by a database constraint', {
        lessonId,
        requestId: context.requestId,
      });
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByQuizAttempts,
        'quiz_delete_blocked',
      );
    }
    throw error;
  }
}

async function deleteLessonQuizUnguarded(
  lessonId: string,
  context: AdminCourseContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const quiz = await tx.lessonQuiz.findUnique({
      where: { lessonId },
      select: {
        id: true,
        feedbackMode: true,
        maxAttempts: true,
        _count: { select: { attempts: true, questions: true } },
        lesson: { select: { moduleId: true, module: { select: { courseId: true } } } },
      },
    });
    if (!quiz) quizNotFound();

    if (quiz._count.attempts > 0) {
      throw new HttpError(
        409,
        COPY.adminCourses.errors.deleteBlockedByQuizAttempts,
        'quiz_delete_blocked',
      );
    }

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.LESSON_QUIZ_DELETED,
      targetType: 'LessonQuiz',
      targetId: quiz.id,
      metadata: {
        courseId: quiz.lesson.module.courseId,
        moduleId: quiz.lesson.moduleId,
        lessonId,
        feedbackMode: quiz.feedbackMode,
        maxAttempts: quiz.maxAttempts,
        questionCount: quiz._count.questions,
      },
      requestId: context.requestId,
    });

    await tx.lessonQuiz.delete({ where: { id: quiz.id } });
  });

  logger.info('lesson quiz deleted', {
    lessonId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });
}
