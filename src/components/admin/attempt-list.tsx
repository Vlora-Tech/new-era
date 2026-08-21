import type { ComponentProps } from 'react';
import Link from 'next/link';
import type { $Enums } from '@prisma/client';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatDurationWords, formatNumber, formatPercent } from '@/lib/format';
import { riyadhDateInput } from '@/lib/riyadh-day';
import type {
  AdminAttemptPage,
  AdminAttemptRow,
  AttemptFilterOptions,
} from '@/services/exams/attempt-admin.service';
import { attemptListQuerySchema, type AttemptListQuery } from '@/validators/admin-attempt';

/**
 * The attempts list, its filter bar and its pager.
 *
 * Server Components with no client JavaScript: the filter bar is a
 * `<form method="get">` and the pager is a set of links, so a narrowed view is a
 * real address. That matters more here than on any other administration list —
 * this is the table people paste into support threads — and it matters
 * technically too, because attempts will outnumber every other record in the
 * system and a client-side filter would mean shipping the lot to a browser.
 *
 * The badges live here rather than in `status-badge.tsx` because they are used
 * by this screen and its record view and nowhere else; `attempt-detail.tsx`
 * imports them from here so the two draw one pill, not two.
 */

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * `Record<$Enums.X, …>` rather than a lookup with a fallback: adding a member to
 * the enum in `schema.prisma` then fails this type check instead of shipping a
 * pill that renders `undefined`.
 *
 * `IN_PROGRESS` is the only warning, because it is the only state where the
 * clock is still running and what the screen shows will change. `EXPIRED` is
 * neutral rather than an error: running out of time is an ordinary way for an
 * exam to end, and the attempt was still scored on what was answered.
 */
const ATTEMPT_STATUS_VARIANTS: Record<$Enums.AttemptStatus, BadgeVariant> = {
  CREATED: 'outline',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'success',
  EXPIRED: 'neutral',
  ABANDONED: 'neutral',
};

export function AttemptStatusBadge({ status }: { status: $Enums.AttemptStatus }) {
  return (
    <Badge variant={ATTEMPT_STATUS_VARIANTS[status]}>
      {COPY.adminAttempts.statusLabels[status]}
    </Badge>
  );
}

/** A taxonomy label rather than a live state, so it takes the square shape. */
export function AttemptModeBadge({ mode }: { mode: $Enums.AttemptMode }) {
  return (
    <Badge variant="outline" shape="square">
      {COPY.adminAttempts.modeLabels[mode]}
    </Badge>
  );
}

const QUERY_DEFAULTS = attemptListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function attemptQueryString(
  current: AttemptListQuery,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    mode: current.mode,
    status: current.status,
    simulatorId: current.simulatorId,
    examVersionId: current.examVersionId,
    dryRun: current.dryRun === QUERY_DEFAULTS.dryRun ? undefined : current.dryRun,
    from: current.from ? riyadhDateInput(current.from) : undefined,
    to: current.to ? riyadhDateInput(current.to) : undefined,
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/attempts?${query}` : '/admin/attempts';
}

/**
 * True when anything is narrowing the list.
 *
 * `dryRun` counts only when it is not the default. Excluding rehearsals is the
 * screen's ordinary view, and treating it as an active filter would show "no
 * results match your filters" on a platform where genuinely no student has sat
 * an exam yet.
 */
export function isAttemptQueryFiltered(query: AttemptListQuery): boolean {
  return (
    Boolean(query.q) ||
    query.mode !== undefined ||
    query.status !== undefined ||
    query.simulatorId !== undefined ||
    query.examVersionId !== undefined ||
    query.dryRun !== QUERY_DEFAULTS.dryRun ||
    query.from !== undefined ||
    query.to !== undefined
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

const MODES = ['FULL_SIMULATION', 'TRAINING'] as const;
const STATUSES = ['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'] as const;
const DRY_RUN_VALUES = ['exclude', 'include', 'only'] as const;

export function AttemptFilters({
  query,
  options,
}: {
  query: AttemptListQuery;
  options: AttemptFilterOptions;
}) {
  const labels = COPY.adminAttempts.filters;

  return (
    <form
      method="get"
      action="/admin/attempts"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="attempt-search">{COPY.adminCommon.search.label}</Label>
        <Input
          id="attempt-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder={labels.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-simulator">{labels.simulator}</Label>
        <Select id="attempt-simulator" name="simulatorId" defaultValue={query.simulatorId ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {options.simulators.map((simulator) => (
            <option key={simulator.id} value={simulator.id}>
              {simulator.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-version">{labels.examVersion}</Label>
        <Select id="attempt-version" name="examVersionId" defaultValue={query.examVersionId ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {options.versions.map((version) => (
            <option key={version.id} value={version.id}>
              {formatNumber(version.versionNumber)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-mode">{labels.mode}</Label>
        <Select id="attempt-mode" name="mode" defaultValue={query.mode ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {MODES.map((mode) => (
            <option key={mode} value={mode}>
              {COPY.adminAttempts.modeLabels[mode]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-status">{labels.status}</Label>
        <Select id="attempt-status" name="status" defaultValue={query.status ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {COPY.adminAttempts.statusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-dry-run">{labels.isDryRun}</Label>
        <Select id="attempt-dry-run" name="dryRun" defaultValue={query.dryRun}>
          {DRY_RUN_VALUES.map((value) => (
            <option key={value} value={value}>
              {labels.dryRunOptions[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-from">{labels.from}</Label>
        <Input
          id="attempt-from"
          type="date"
          name="from"
          dir="ltr"
          defaultValue={query.from ? riyadhDateInput(query.from) : ''}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attempt-to">{labels.to}</Label>
        <Input
          id="attempt-to"
          type="date"
          name="to"
          dir="ltr"
          defaultValue={query.to ? riyadhDateInput(query.to) : ''}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary">
          {COPY.adminCommon.filter.apply}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/attempts">{COPY.adminCommon.filter.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminAttemptRow>[] = [
  {
    key: 'student',
    header: COPY.adminAttempts.columns.student,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/attempts/${row.id}`} className="text-brand-700 hover:underline">
        {row.student.name}
      </Link>
    ),
  },
  {
    key: 'email',
    header: COPY.adminAttempts.columns.email,
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.student.email}</span>,
  },
  {
    key: 'simulator',
    header: COPY.adminAttempts.columns.simulator,
    cell: (row) => row.simulator.title,
  },
  {
    key: 'examVersion',
    header: COPY.adminAttempts.columns.examVersion,
    align: 'end',
    cell: (row) => formatNumber(row.examVersion.versionNumber),
  },
  {
    key: 'mode',
    header: COPY.adminAttempts.columns.mode,
    cell: (row) => <AttemptModeBadge mode={row.mode} />,
  },
  {
    key: 'status',
    header: COPY.adminAttempts.columns.status,
    cell: (row) => <AttemptStatusBadge status={row.status} />,
  },
  {
    key: 'isDryRun',
    header: COPY.adminAttempts.columns.isDryRun,
    cell: (row) => (row.isDryRun ? COPY.common.yes : COPY.common.no),
  },
  {
    key: 'startedAt',
    header: COPY.adminAttempts.columns.startedAt,
    cell: (row) => (row.startedAt ? formatDate(row.startedAt) : COPY.common.notAvailable),
  },
  {
    key: 'submittedAt',
    header: COPY.adminAttempts.columns.submittedAt,
    cell: (row) => (row.submittedAt ? formatDate(row.submittedAt) : COPY.common.notAvailable),
  },
  {
    key: 'duration',
    header: COPY.adminAttempts.columns.duration,
    cell: (row) =>
      row.durationSec === null ? COPY.common.notAvailable : formatDurationWords(row.durationSec),
  },
  {
    key: 'totalQuestions',
    header: COPY.adminAttempts.columns.totalQuestions,
    align: 'end',
    cell: (row) => formatNumber(row.totalQuestions),
  },
  {
    key: 'correctCount',
    header: COPY.adminAttempts.columns.correctCount,
    align: 'end',
    // A count, not a mark. Null until the attempt is scored, and rendered as an
    // absence rather than as a zero: an unsubmitted attempt has no result, and
    // "٠ صحيحة" is a result.
    cell: (row) =>
      row.correctCount === null
        ? COPY.adminAttempts.results.noScore
        : formatNumber(row.correctCount),
  },
  {
    key: 'accuracy',
    header: COPY.adminAttempts.columns.accuracy,
    align: 'end',
    cell: (row) =>
      row.accuracy === null ? COPY.adminAttempts.results.noScore : formatPercent(row.accuracy),
  },
  {
    key: 'actions',
    header: COPY.adminAttempts.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/attempts/${row.id}`}>{COPY.adminCommon.actions.view}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` and an empty `rows` render differently, and on this screen the
 * distinction is the difference between "nobody has sat an exam" and "the
 * database did not answer". The first is a claim about the business; a query
 * that threw is not entitled to make it.
 */
export function AttemptList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminAttemptRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminAttempts.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/attempts">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          // No action: an attempt exists because a student started one, and there
          // is nothing an administrator can press to create the first.
          <EmptyState
            title={COPY.adminAttempts.empty.nothingYetTitle}
            description={COPY.adminAttempts.empty.nothingYetBody}
          />
        )
      }
    />
  );
}

// ── Pager ────────────────────────────────────────────────────────────────

export function AttemptPagination({
  result,
  query,
}: {
  result: AdminAttemptPage;
  query: AttemptListQuery;
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
            <Link href={attemptQueryString(query, { page: String(result.page - 1) })}>
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
            <Link href={attemptQueryString(query, { page: String(result.page + 1) })}>
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
