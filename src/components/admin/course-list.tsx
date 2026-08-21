import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ProductStatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatDurationWords, formatNumber } from '@/lib/format';
import type { AdminCoursePage, AdminCourseRow } from '@/services/courses/course-admin.service';
import { courseListQuerySchema, type CourseListQuery } from '@/validators/admin-course';

/**
 * The course list, its filter bar and its pager.
 *
 * All three are Server Components with no client JavaScript, the same shape the
 * catalogue list uses: the filter bar is a plain `<form method="get">` and the
 * pager is a set of links, so filtering, searching and paging are ordinary
 * navigations that survive a reload, can be bookmarked and behave under the back
 * button. A client-side filter over a full table dump would have none of those
 * properties and would ship every course to every browser.
 *
 * There is no "new course" action anywhere in this file, and its absence is the
 * point. A `Course` exists one-to-one with a `Product` of type `COURSE`; the
 * only way to add one is to add the product. The empty state and the note above
 * the table both say so and link to the catalogue, because an administrator
 * hunting for a button that cannot exist is the failure this wording prevents.
 */

/** The schema's own defaults, read from it rather than restated. */
const QUERY_DEFAULTS = courseListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across: somebody who has narrowed the list to
 * published courses and then turns the page means the next page *of those*.
 */
function queryString(current: CourseListQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    productStatus: current.productStatus,
    category: current.category || undefined,
    hasLessons: current.hasLessons === undefined ? undefined : String(current.hasLessons),
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/courses` and
    // `/admin/courses?page=1` remain one address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/courses?${query}` : '/admin/courses';
}

// ── Filter bar ───────────────────────────────────────────────────────────

/**
 * Search and filters, submitted as a GET form.
 *
 * `page` is deliberately absent from the form: applying a new filter returns to
 * page one, because page four of the old result set is very often past the end
 * of the new one, and an empty page reads as "no matches" when there are plenty
 * on page one.
 */
export function CourseFilters({
  query,
  categories,
}: {
  query: CourseListQuery;
  /** The categories actually in use, read from the data rather than hard-coded. */
  categories: readonly string[];
}) {
  const labels = COPY.adminCourses.filters;

  return (
    <form
      method="get"
      action="/admin/courses"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="course-search">{COPY.adminCommon.search.label}</Label>
        <Input
          id="course-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder={labels.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-product-status">{labels.productStatus}</Label>
        <Select
          id="course-product-status"
          name="productStatus"
          defaultValue={query.productStatus ?? ''}
        >
          <option value="">{COPY.adminCommon.filter.all}</option>
          {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((status) => (
            <option key={status} value={status}>
              {COPY.adminProducts.statusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-category">{labels.category}</Label>
        <Select id="course-category" name="category" defaultValue={query.category ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-has-lessons">{labels.hasLessons}</Label>
        <Select
          id="course-has-lessons"
          name="hasLessons"
          defaultValue={query.hasLessons === undefined ? '' : String(query.hasLessons)}
        >
          <option value="">{COPY.adminCommon.filter.all}</option>
          <option value="true">{COPY.common.yes}</option>
          <option value="false">{COPY.common.no}</option>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary">
          {COPY.adminCommon.filter.apply}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/courses">{COPY.adminCommon.filter.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminCourseRow>[] = [
  {
    key: 'title',
    header: COPY.adminCourses.columns.title,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/courses/${row.id}`} className="text-brand-700 hover:underline">
        {row.productTitle}
      </Link>
    ),
  },
  {
    key: 'product',
    header: COPY.adminCourses.columns.product,
    // The slug is Latin and part of a public URL; isolated so it cannot reorder
    // against the Arabic cells beside it.
    dir: 'ltr',
    cell: (row) => (
      <Link
        href={`/admin/products/${row.productId}`}
        className="text-ink-700 hover:text-brand-700 text-xs hover:underline"
      >
        {row.productSlug}
      </Link>
    ),
  },
  {
    key: 'productStatus',
    header: COPY.adminCourses.columns.productStatus,
    cell: (row) => <ProductStatusBadge status={row.productStatus} />,
  },
  {
    key: 'category',
    header: COPY.adminCourses.columns.category,
    cell: (row) => row.category ?? COPY.common.notAvailable,
  },
  {
    key: 'level',
    header: COPY.adminCourses.columns.level,
    cell: (row) => row.level ?? COPY.common.notAvailable,
  },
  {
    key: 'moduleCount',
    header: COPY.adminCourses.columns.moduleCount,
    align: 'end',
    cell: (row) => formatNumber(row.moduleCount),
  },
  {
    key: 'lessonCount',
    header: COPY.adminCourses.columns.lessonCount,
    align: 'end',
    cell: (row) => formatNumber(row.lessonCount),
  },
  {
    key: 'publishedLessonCount',
    header: COPY.adminCourses.columns.publishedLessonCount,
    align: 'end',
    cell: (row) => formatNumber(row.publishedLessonCount),
  },
  {
    key: 'duration',
    header: COPY.adminCourses.columns.duration,
    // Zero is reported as "not available" rather than as "أقل من دقيقة": a
    // course whose lessons carry no duration has no total, which is a different
    // claim from a course that is very short.
    cell: (row) =>
      row.durationSec > 0 ? formatDurationWords(row.durationSec) : COPY.common.notAvailable,
  },
  {
    key: 'updatedAt',
    header: COPY.adminCourses.columns.updatedAt,
    cell: (row) => formatDate(row.updatedAt),
  },
  {
    key: 'actions',
    header: COPY.adminCourses.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/courses/${row.id}`}>{COPY.adminCommon.actions.edit}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`, and the two render
 * differently on purpose: a query that threw becomes `ErrorState`, never a table
 * with nothing in it. "لا توجد دورات بعد" is a claim about the business, and a
 * database outage must not be allowed to make it.
 *
 * `filtered` picks between the two *kinds* of emptiness. With a search or a
 * filter active, "create a course product first" is advice for a problem the
 * administrator does not have.
 */
export function CourseList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminCourseRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminCourses.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      failed={failed}
      empty={
        filtered ? (
          <EmptyState
            title={COPY.adminCommon.emptiness.noResultsTitle}
            description={COPY.adminCommon.emptiness.noResultsBody}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/courses">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={COPY.adminCourses.empty.nothingYetTitle}
            description={COPY.adminCourses.empty.nothingYetBody}
            action={
              <Button asChild>
                {/* The action leaves this screen, because the thing that has to
                    be created is a product and it is created there. */}
                <Link href="/admin/products/new">{COPY.adminCourses.empty.nothingYetAction}</Link>
              </Button>
            }
          />
        )
      }
    />
  );
}

// ── Pager ────────────────────────────────────────────────────────────────

/**
 * Previous/next links with the range spelled out.
 *
 * The summary states the range *and* the total, so a filtered view can never be
 * mistaken for the whole catalogue of courses. Both controls are links rather
 * than buttons: they navigate, and a screen reader should say so.
 */
export function CoursePagination({
  result,
  query,
}: {
  result: AdminCoursePage;
  query: CourseListQuery;
}) {
  if (result.total === 0) return null;

  const from = (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);
  const hasPrevious = result.page > 1;
  const hasNext = result.page < result.pageCount;

  return (
    <nav
      aria-label={COPY.adminCommon.pagination.label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-ink-700 text-sm">
        {fill(COPY.adminCommon.pagination.rangeSummary, {
          from: formatNumber(from),
          to: formatNumber(to),
          total: formatNumber(result.total),
        })}
      </p>

      <div className="flex items-center gap-2">
        <span className="text-ink-700 text-sm">
          {fill(COPY.adminCommon.pagination.pageOfTotal, {
            current: formatNumber(result.page),
            total: formatNumber(result.pageCount),
          })}
        </span>

        {hasPrevious ? (
          <Button asChild variant="outline" size="sm">
            <Link href={queryString(query, { page: String(result.page - 1) })}>
              {COPY.adminCommon.pagination.previous}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {COPY.adminCommon.pagination.previous}
          </Button>
        )}

        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={queryString(query, { page: String(result.page + 1) })}>
              {COPY.adminCommon.pagination.next}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {COPY.adminCommon.pagination.next}
          </Button>
        )}
      </div>
    </nav>
  );
}
