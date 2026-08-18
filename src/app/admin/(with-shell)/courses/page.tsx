import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { CourseFilters, CourseList, CoursePagination } from '@/components/admin/course-list';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  listCourseCategories,
  listCourses,
  type AdminCoursePage,
} from '@/services/courses/course-admin.service';
import { courseListQuerySchema } from '@/validators/admin-course';

export const metadata: Metadata = { title: COPY.admin.courses };

/**
 * The course list.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL, so a
 * filtered view is a real address that can be reloaded, bookmarked and sent to a
 * colleague.
 *
 * Two reads, and they fail independently on purpose. The rows are the screen; if
 * that query throws the table renders `ErrorState` through its `failed` prop and
 * never an empty table, because "لا توجد دورات" is a claim about the business
 * that a database outage is not entitled to make. The category list is only the
 * contents of one `<select>`: losing it should narrow the filter bar, not take
 * the page down, so it degrades to an empty list of options.
 */
export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter (`?productStatus=DRAFT&productStatus=PUBLISHED`) arrives
  // as an array. The first value wins rather than the request being rejected:
  // this is a browsing surface, and every field in the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = courseListQuerySchema.parse(flat);

  let result: AdminCoursePage | null = null;
  try {
    result = await listCourses(query);
  } catch (error) {
    logger.error('admin course list failed', { error });
  }

  let categories: string[] = [];
  try {
    categories = await listCourseCategories();
  } catch (error) {
    logger.error('admin course category list failed', { error });
  }

  const filtered =
    Boolean(query.q) ||
    query.productStatus !== undefined ||
    Boolean(query.category) ||
    query.hasLessons !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminCourses.listTitle}
        description={COPY.adminCourses.listDescription}
        action={
          <Button asChild variant="secondary">
            <Link href="/admin/products">{COPY.adminCourses.goToProducts}</Link>
          </Button>
        }
      />

      {/* Said before anybody goes looking for a "new course" button: there is
          none, and there cannot be one, because a course is a product's content
          tree rather than a record of its own. */}
      <Notice tone="neutral" role="note">
        {COPY.adminCourses.listNote}
      </Notice>

      <CourseFilters query={query} categories={categories} />

      {/* Stated plainly whenever the list is narrowed, so a filtered result is
          never read as every course on the platform. */}
      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <CourseList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <CoursePagination result={result} query={query} /> : null}
    </div>
  );
}
