import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatNumber } from '@/lib/format';
import type { AdminStudentPage, AdminStudentRow } from '@/services/students/student-admin.service';
import { studentListQuerySchema, type StudentListQuery } from '@/validators/admin-student';

/**
 * The accounts list, its filter bar and its pager.
 *
 * All three are Server Components with no client JavaScript. The filter bar is a
 * plain `<form method="get">` and the pager is a set of links, so filtering,
 * searching and paging are ordinary navigations: they survive a reload, they can
 * be bookmarked, and the back button does what it looks like it does.
 *
 * The rows carry names, addresses and phone numbers belonging in many cases to
 * minors, and every one of them arrived because the *server* selected it. There
 * is no version of this screen that ships the table and filters it in the
 * browser, which is why the filters here are inputs on a GET form rather than
 * state in a component.
 */

/** The schema's own defaults, read from it rather than restated. */
const QUERY_DEFAULTS = studentListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across: somebody who has narrowed the list to
 * blocked accounts and then turns the page means the next page *of those*.
 */
function queryString(current: StudentListQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    role: current.role,
    state: current.state,
    hasEntitlements:
      current.hasEntitlements === undefined ? undefined : String(current.hasEntitlements),
    registeredFrom: current.registeredFrom,
    registeredTo: current.registeredTo,
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/students` and
    // `/admin/students?page=1` remain the same address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/students?${query}` : '/admin/students';
}

/** True when any filter is narrowing the result set. */
export function isStudentQueryFiltered(query: StudentListQuery): boolean {
  return (
    Boolean(query.q) ||
    query.role !== undefined ||
    query.state !== undefined ||
    query.hasEntitlements !== undefined ||
    query.registeredFrom !== undefined ||
    query.registeredTo !== undefined
  );
}

// ── State pill ───────────────────────────────────────────────────────────

/**
 * Active or blocked.
 *
 * Not in `status-badge.tsx` with the others because it is not an enum: it is
 * derived from `isBlocked`, and a `Record<$Enums.X, …>` — the pattern that file
 * exists to enforce — has nothing to key on. The label is always rendered, so
 * the state survives greyscale and colour-blindness exactly as the badges there
 * do.
 */
export function StudentStateBadge({ blocked }: { blocked: boolean }) {
  return (
    <Badge variant={blocked ? 'error' : 'success'}>
      {blocked ? COPY.adminStudents.stateLabels.blocked : COPY.adminStudents.stateLabels.active}
    </Badge>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

/**
 * Search and filters, submitted as a GET form.
 *
 * `page` is deliberately absent from the form: applying a new filter must return
 * to page one, because page seven of the old result set is very often past the
 * end of the new one, and an empty page reads as "no matches" when there are
 * plenty on page one.
 */
export function StudentFilters({ query }: { query: StudentListQuery }) {
  const labels = COPY.adminStudents.filters;

  return (
    <form
      method="get"
      action="/admin/students"
      className="rounded-panel border-line-200 bg-surface flex flex-col gap-3 border p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="student-search">{COPY.adminCommon.search.label}</Label>
          <Input
            id="student-search"
            type="search"
            name="q"
            defaultValue={query.q ?? ''}
            placeholder={labels.searchPlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-role">{labels.role}</Label>
          <Select id="student-role" name="role" defaultValue={query.role ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['STUDENT', 'ADMIN'] as const).map((role) => (
              <option key={role} value={role}>
                {COPY.adminStudents.roleLabels[role]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-state">{labels.state}</Label>
          <Select id="student-state" name="state" defaultValue={query.state ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            <option value="active">{COPY.adminStudents.stateLabels.active}</option>
            <option value="blocked">{COPY.adminStudents.stateLabels.blocked}</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-entitlements">{labels.hasEntitlements}</Label>
          <Select
            id="student-entitlements"
            name="hasEntitlements"
            defaultValue={query.hasEntitlements === undefined ? '' : String(query.hasEntitlements)}
          >
            <option value="">{COPY.adminCommon.filter.all}</option>
            <option value="true">{COPY.common.yes}</option>
            <option value="false">{COPY.common.no}</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-from">{labels.registeredFrom}</Label>
          {/* An ISO calendar day: Latin digits and hyphens, isolated so the
              control's own text cannot reorder inside the Arabic layout. */}
          <Input
            id="student-from"
            type="date"
            name="registeredFrom"
            dir="ltr"
            defaultValue={query.registeredFrom ?? ''}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="student-to">{labels.registeredTo}</Label>
          <Input
            id="student-to"
            type="date"
            name="registeredTo"
            dir="ltr"
            defaultValue={query.registeredTo ?? ''}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary">
            {COPY.adminCommon.filter.apply}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/students">{COPY.adminCommon.filter.clear}</Link>
          </Button>
        </div>
      </div>

      <p className="text-ink-700 text-xs">{labels.searchNote}</p>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminStudentRow>[] = [
  {
    key: 'name',
    header: COPY.adminStudents.columns.name,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/students/${row.id}`} className="text-brand-700 hover:underline">
        {row.name}
      </Link>
    ),
  },
  {
    key: 'email',
    header: COPY.adminStudents.columns.email,
    // Latin and often starting with a digit: isolated so it cannot reorder
    // against the Arabic cells beside it.
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.email}</span>,
  },
  {
    key: 'phone',
    header: COPY.adminStudents.columns.phone,
    dir: 'ltr',
    cell: (row) => (
      <span className="text-ink-700 text-xs">{row.phone ?? COPY.adminStudents.notProvided}</span>
    ),
  },
  {
    key: 'role',
    header: COPY.adminStudents.columns.role,
    cell: (row) => COPY.adminStudents.roleLabels[row.role],
  },
  {
    key: 'state',
    header: COPY.adminStudents.columns.state,
    cell: (row) => <StudentStateBadge blocked={row.isBlocked} />,
  },
  {
    key: 'entitlements',
    header: COPY.adminStudents.columns.entitlementCount,
    align: 'end',
    cell: (row) => formatNumber(row.activeEntitlementCount),
  },
  {
    key: 'orders',
    header: COPY.adminStudents.columns.orderCount,
    align: 'end',
    cell: (row) => formatNumber(row.orderCount),
  },
  {
    key: 'attempts',
    header: COPY.adminStudents.columns.attemptCount,
    align: 'end',
    cell: (row) => formatNumber(row.attemptCount),
  },
  {
    key: 'createdAt',
    header: COPY.adminStudents.columns.createdAt,
    cell: (row) => formatDate(row.createdAt),
  },
  {
    key: 'lastActivityAt',
    header: COPY.adminStudents.columns.lastActivityAt,
    // An account that has never ordered or attempted anything has no activity to
    // report, and a dash there would read as a date that failed to render.
    cell: (row) =>
      row.lastActivityAt ? formatDate(row.lastActivityAt) : COPY.adminStudents.notProvided,
  },
  {
    key: 'actions',
    header: COPY.adminStudents.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/students/${row.id}`}>{COPY.adminCommon.actions.view}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`, and the two render
 * differently on purpose: a query that threw becomes `ErrorState`, never a table
 * with nothing in it. "لا توجد حسابات بعد" is a claim about the business, and a
 * database outage must not be allowed to make it.
 *
 * `filtered` picks between the two kinds of emptiness. With a search or a filter
 * active, "nobody has registered yet" is not merely unhelpful — it is false.
 */
export function StudentList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminStudentRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminStudents.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/students">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          // No action: accounts are created by the people they belong to, so
          // there is no "add the first one" to offer here.
          <EmptyState
            title={COPY.adminStudents.empty.nothingYetTitle}
            description={COPY.adminStudents.empty.nothingYetBody}
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
 * mistaken for the whole roll. Both controls are links rather than buttons: they
 * navigate, and a screen reader should say so.
 */
export function StudentPagination({
  result,
  query,
}: {
  result: AdminStudentPage;
  query: StudentListQuery;
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
