import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ProductStatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatNumber } from '@/lib/format';
import type {
  AdminSimulatorPage,
  AdminSimulatorRow,
} from '@/services/exams/simulator-admin.service';
import { simulatorListQuerySchema, type SimulatorListQuery } from '@/validators/admin-simulator';

/**
 * The simulators list, its filter bar and its pager.
 *
 * All three are Server Components with no client JavaScript. The filter bar is a
 * plain `<form method="get">` and the pager is a set of links, so filtering,
 * searching and paging are ordinary navigations: they survive a reload, they can
 * be bookmarked and shared, and the back button does what it looks like it does.
 *
 * There is no "new simulator" action anywhere on this screen, and that is the
 * point of the note above the table. An `ExamSimulator` exists one-to-one with
 * its `Product`; offering a create button here would either produce a row with
 * no catalogue entry or quietly create a product an administrator did not know
 * they were creating.
 */

/** The schema's own defaults, read from it rather than restated. */
const QUERY_DEFAULTS = simulatorListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across: somebody who has narrowed the list to
 * scientific simulators and then turns the page means the next page *of those*.
 */
function queryString(current: SimulatorListQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    track: current.track,
    versionStatus: current.versionStatus,
    hasActiveVersion:
      current.hasActiveVersion === undefined ? undefined : String(current.hasActiveVersion),
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/simulators` and
    // `/admin/simulators?page=1` remain the same address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/simulators?${query}` : '/admin/simulators';
}

// ── Filter bar ───────────────────────────────────────────────────────────

/**
 * Search and filters, submitted as a GET form.
 *
 * `page` is deliberately absent: applying a new filter must return to page one,
 * because page four of the old result set is very often past the end of the new
 * one, and an empty page reads as "no matches" when there are plenty on page one.
 */
export function SimulatorFilters({ query }: { query: SimulatorListQuery }) {
  const labels = COPY.adminSimulators.filters;

  return (
    <form
      method="get"
      action="/admin/simulators"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="simulator-search">{COPY.adminCommon.search.label}</Label>
        <Input
          id="simulator-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder={labels.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="simulator-track">{labels.track}</Label>
        <Select id="simulator-track" name="track" defaultValue={query.track ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {(['SCIENTIFIC', 'THEORETICAL', 'BOTH', 'CUSTOM'] as const).map((track) => (
            <option key={track} value={track}>
              {COPY.adminSimulators.trackLabels[track]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="simulator-version-status">{labels.versionStatus}</Label>
        <Select
          id="simulator-version-status"
          name="versionStatus"
          defaultValue={query.versionStatus ?? ''}
        >
          <option value="">{COPY.adminCommon.filter.all}</option>
          {(['DRAFT', 'PUBLISHED', 'RETIRED'] as const).map((status) => (
            <option key={status} value={status}>
              {COPY.adminSimulators.statusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="simulator-active">{labels.hasActiveVersion}</Label>
        <Select
          id="simulator-active"
          name="hasActiveVersion"
          defaultValue={query.hasActiveVersion === undefined ? '' : String(query.hasActiveVersion)}
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
          <Link href="/admin/simulators">{COPY.adminCommon.filter.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

/**
 * Which attempt modes a simulator offers, as words.
 *
 * A simulator with neither is refused by the service, so the third arm is the
 * state of a row edited straight in the database — reported honestly rather than
 * rendered as an empty cell that reads like a missing value.
 */
function modesLabel(row: AdminSimulatorRow): string {
  const parts: string[] = [];
  if (row.fullSimulationEnabled)
    parts.push(COPY.adminSimulators.settings.fields.fullSimulationEnabled.label);
  if (row.trainingModeEnabled)
    parts.push(COPY.adminSimulators.settings.fields.trainingModeEnabled.label);
  return parts.length > 0 ? parts.join(COPY.adminCommon.listSeparator) : COPY.common.notAvailable;
}

const columns: readonly DataTableColumn<AdminSimulatorRow>[] = [
  {
    key: 'title',
    header: COPY.adminSimulators.columns.title,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/simulators/${row.id}`} className="text-brand-700 hover:underline">
        {row.productTitle}
      </Link>
    ),
  },
  {
    key: 'productStatus',
    header: COPY.adminSimulators.columns.productStatus,
    cell: (row) => <ProductStatusBadge status={row.productStatus} />,
  },
  {
    key: 'track',
    header: COPY.adminSimulators.columns.track,
    cell: (row) => COPY.adminSimulators.trackLabels[row.track],
  },
  {
    key: 'activeVersion',
    header: COPY.adminSimulators.columns.activeVersion,
    cell: (row) =>
      row.activeVersionNumber === null ? (
        <Badge variant="warning">{COPY.adminSimulators.activeLabels.inactive}</Badge>
      ) : (
        <Badge variant="success">{formatNumber(row.activeVersionNumber)}</Badge>
      ),
  },
  {
    key: 'versionCount',
    header: COPY.adminSimulators.columns.versionCount,
    align: 'end',
    cell: (row) => formatNumber(row.versionCount),
  },
  {
    key: 'modes',
    header: COPY.adminSimulators.columns.modes,
    cell: (row) => <span className="text-ink-700 text-xs">{modesLabel(row)}</span>,
  },
  {
    key: 'attemptCount',
    header: COPY.adminSimulators.columns.attemptCount,
    align: 'end',
    cell: (row) => formatNumber(row.attemptCount),
  },
  {
    key: 'updatedAt',
    header: COPY.adminSimulators.columns.updatedAt,
    cell: (row) => formatDate(row.updatedAt),
  },
  {
    key: 'actions',
    header: COPY.adminSimulators.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/simulators/${row.id}`}>{COPY.adminCommon.actions.edit}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`, and the two render
 * differently on purpose: a query that threw becomes `ErrorState`, never a table
 * with nothing in it. "لا توجد محاكيات" is a claim about the catalogue, and a
 * database outage must not be allowed to make it.
 *
 * `filtered` picks between the two *kinds* of emptiness. With a filter active,
 * "create the product first" is advice for a problem the administrator does not
 * have.
 */
export function SimulatorList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminSimulatorRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminSimulators.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/simulators">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={COPY.adminSimulators.empty.nothingYetTitle}
            description={COPY.adminSimulators.empty.nothingYetBody}
            action={
              <Button asChild>
                <Link href="/admin/products/new">
                  {COPY.adminSimulators.empty.nothingYetAction}
                </Link>
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
 * mistaken for the whole list. Both controls are links rather than buttons: they
 * navigate, and a screen reader should say so.
 */
export function SimulatorPagination({
  result,
  query,
}: {
  result: AdminSimulatorPage;
  query: SimulatorListQuery;
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
