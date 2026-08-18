import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { CourseBuilder } from '@/components/admin/course-builder';
import { DetailPanel, type DetailItem } from '@/components/admin/detail-panel';
import { ProductStatusBadge } from '@/components/admin/status-badge';
import { VideoLibraryPanel, type VideoLibraryRow } from '@/components/admin/video-library-panel';
import type { LessonFormVideo } from '@/components/admin/lesson-form';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { env, isVideoEnabled } from '@/lib/env';
import { listVideoAssets } from '@/services/video/video-admin.service';
import { formatDurationWords, formatNumber, formatPercent } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  getCourseBuilder,
  listVideoOptions,
  parseCourseId,
  type AdminCourseDetail,
} from '@/services/courses/course-admin.service';

export const metadata: Metadata = { title: COPY.adminCourses.detailTitle };

/**
 * The course builder screen.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the course does not exist, or the path segment is not an id at all —
 *    `notFound()`, the honest answer to a bad address;
 *  - the query threw — `ErrorState`, never an empty builder. A tree drawn with
 *    no modules because a read failed reads as "this course has no content",
 *    which is an invitation to rebuild something that is already there;
 *  - the course loaded — the summary, then the builder.
 *
 * The video list is read separately and degrades to empty rather than taking the
 * page down: losing it should narrow one `<select>`, not hide a whole course.
 * `isVideoEnabled()` is read here, on the server, because it depends on secrets
 * the browser never sees — and the distinction it carries is the one the lesson
 * form needs: an unconfigured provider and an empty library look identical and
 * mean very different things.
 */
export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  let course: AdminCourseDetail | null = null;
  let failed = false;
  try {
    course = await getCourseBuilder(parseCourseId(courseId));
  } catch (error) {
    // The service reports a malformed id as "no such course" rather than as a
    // fault, and that distinction has to survive into the page.
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin course load failed', { courseId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminCourses.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/courses">{COPY.adminCourses.backToCourses}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!course) notFound();

  const videoEnabled = isVideoEnabled();
  /*
   * Read once and handed to both consumers. The lesson form's registration
   * dialog and the library panel take the same two values, and computing them
   * twice is how the two screens end up disagreeing about whether this
   * environment can confirm a GUID.
   */
  const libraryId = videoEnabled ? (env().BUNNY_STREAM_LIBRARY_ID ?? null) : null;
  const canConfirm = Boolean(env().BUNNY_STREAM_API_KEY);

  let videoOptions: LessonFormVideo[] = [];
  try {
    videoOptions = await listVideoOptions();
  } catch (error) {
    logger.error('admin video option list failed', { courseId, error });
  }

  /*
   * The registered library, for the panel below the builder.
   *
   * Read separately from `videoOptions` because the two answer different
   * questions: the picker wants what a lesson may be attached to, while the
   * library wants every registered video and where each is already used — a
   * video attached elsewhere is absent from the first and central to the second.
   */
  let videoLibrary: VideoLibraryRow[] = [];
  if (videoEnabled) {
    try {
      videoLibrary = (await listVideoAssets({ attached: 'all', page: 1, perPage: 100 })).rows;
    } catch (error) {
      logger.error('admin video library list failed', { courseId, error });
    }
  }

  const summary: DetailItem[] = [
    {
      key: 'product',
      label: COPY.adminCourses.columns.product,
      value: (
        <Link href={`/admin/products/${course.productId}`} className="text-brand-700 underline">
          {course.productSlug}
        </Link>
      ),
      // Latin and part of a public URL: isolated so it cannot reorder against
      // the Arabic label above it.
      dir: 'ltr',
    },
    {
      key: 'category',
      label: COPY.adminCourses.columns.category,
      value: course.category,
    },
    {
      key: 'level',
      label: COPY.adminCourses.columns.level,
      value: course.level,
    },
    {
      key: 'moduleCount',
      label: COPY.adminCourses.columns.moduleCount,
      value: formatNumber(course.totals.moduleCount),
    },
    {
      key: 'lessonCount',
      label: COPY.adminCourses.columns.lessonCount,
      value: formatNumber(course.totals.lessonCount),
    },
    {
      key: 'publishedLessonCount',
      label: COPY.adminCourses.columns.publishedLessonCount,
      value: formatNumber(course.totals.publishedLessonCount),
    },
    {
      key: 'duration',
      label: COPY.adminCourses.columns.duration,
      // Zero seconds is reported as an absence rather than as "أقل من دقيقة":
      // a course whose lessons carry no duration has no total, which is a
      // different claim from a course that is very short.
      value: course.totals.durationSec > 0 ? formatDurationWords(course.totals.durationSec) : null,
    },
    {
      key: 'threshold',
      // The course's own default, not an effective value: every lesson without
      // an override takes this number, and the builder's lesson table below says
      // which of them do.
      label: COPY.adminCourses.settings.fields.completionThresholdPercent.label,
      value: formatPercent(course.completionThresholdPercent / 100),
      dir: 'ltr',
      span: 'full',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={course.productTitle}
        description={COPY.adminCourses.detailDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/courses">{COPY.adminCourses.backToCourses}</Link>
          </Button>
        }
      />

      <DetailPanel
        title={COPY.adminCourses.sections.summary}
        items={summary}
        columns={3}
        badges={<ProductStatusBadge status={course.productStatus} />}
      />

      <CourseBuilder
        course={course}
        videoOptions={videoOptions}
        videoEnabled={videoEnabled}
        videoLibraryId={libraryId}
        videoCanConfirm={canConfirm}
      />

      {/*
       * Below the builder, and no longer the only way to register a video: the
       * lesson form opens the same registration form in a dialog and attaches
       * the result, so nobody has to arrive here mid-lesson. What is left is the
       * library seen whole — every registered video and where each is used —
       * which is housekeeping rather than authoring, and reads correctly as its
       * own section now that it is not also a missing step in another one.
       */}
      <VideoLibraryPanel rows={videoLibrary} libraryId={libraryId} canConfirm={canConfirm} />
    </div>
  );
}
