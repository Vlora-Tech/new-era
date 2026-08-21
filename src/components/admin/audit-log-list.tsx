import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { AdminAuditLogPage, AdminAuditRow } from '@/services/audit/audit-query.service';
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_TARGET_TYPES,
  auditActionGroup,
  auditLogQuerySchema,
  type AuditActionGroup,
  type AuditLogQuery,
  type AuditTargetTypeName,
} from '@/validators/admin-audit';

/**
 * The audit trail's list, filter bar and pager.
 *
 * All Server Components, no client JavaScript. The filter bar is a plain
 * `<form method="get">` and the pager is a set of links, so a narrowed view is a
 * real address that reloads, bookmarks and can be pasted into a message — which
 * matters more here than on any other administration screen, because the reason
 * somebody opens this one is usually to show a colleague what they found.
 *
 * The row details expand with `<details>` rather than with state, for the same
 * reason: no hydration, it works before JavaScript arrives, and opening one row
 * never costs the reader the position they had in the table.
 *
 * Nothing in this file mutates. There is no edit control, no delete control and
 * no bulk action, because the table behind it is append-only.
 */

const AUDIT = COPY.adminAudit;

/** The schema's own defaults, read from it rather than restated. */
const QUERY_DEFAULTS = auditLogQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** `Date` back to the `YYYY-MM-DD` the date input and the URL both speak. */
function toDayValue(date: Date | undefined): string {
  if (!date) return '';
  // Formatted in Riyadh, because that is the day the schema parsed it as. Taking
  // the UTC date here would move the value the administrator typed by three
  // hours and, for anything after 21:00, by a whole day.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across: somebody who has narrowed the log to one
 * administrator's actions last week and then turns the page means the next page
 * *of those*.
 */
function queryString(current: AuditLogQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    action: current.action || undefined,
    actionGroup: current.actionGroup,
    targetType: current.targetType,
    from: toDayValue(current.from) || undefined,
    to: toDayValue(current.to) || undefined,
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/audit-log` and
    // `/admin/audit-log?page=1` remain one address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/audit-log?${query}` : '/admin/audit-log';
}

/** True when any filter is narrowing the list. */
export function isAuditLogFiltered(query: AuditLogQuery): boolean {
  return Boolean(
    query.q || query.action || query.actionGroup || query.targetType || query.from || query.to,
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

/**
 * The action `<select>`, grouped.
 *
 * The options come from `COPY.adminAudit.actionLabels`, whose keys are the exact
 * strings stored in `AuditLog.action`. That is the whole coupling: no import of
 * `AUDIT_ACTIONS`, which is a `server-only` module, and no second list to keep in
 * step. An action added to the vocabulary without a label here is invisible in
 * this control — which is the same omission that would render it as
 * "إجراء غير معروف" in the table, and therefore noticed once rather than twice.
 */
function ActionOptions() {
  const entries = Object.entries(AUDIT.actionLabels) as Array<[string, string]>;
  const grouped = new Map<AuditActionGroup | 'other', Array<[string, string]>>();

  for (const entry of entries) {
    const group = auditActionGroup(entry[0]) ?? 'other';
    const bucket = grouped.get(group);
    if (bucket) bucket.push(entry);
    else grouped.set(group, [entry]);
  }

  return (
    <>
      {AUDIT_ACTION_GROUPS.map((group) => {
        const bucket = grouped.get(group);
        if (!bucket || bucket.length === 0) return null;
        return (
          <optgroup key={group} label={AUDIT.actionGroupLabels[group]}>
            {bucket.map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </optgroup>
        );
      })}
      {/* An action no prefix claims is still a real, listable action. */}
      {(grouped.get('other') ?? []).map(([action, label]) => (
        <option key={action} value={action}>
          {label}
        </option>
      ))}
    </>
  );
}

/**
 * Search, action, target type and a date window, submitted as a GET form.
 *
 * `page` is deliberately absent: applying a new filter must return to page one,
 * because page four of the old result set is usually past the end of the new
 * one, and an empty page reads as "nothing matched" when there are matches on
 * page one.
 */
export function AuditLogFilters({ query }: { query: AuditLogQuery }) {
  const labels = AUDIT.filters;

  return (
    <form
      method="get"
      action="/admin/audit-log"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-col gap-3 border p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="audit-search">{COPY.adminCommon.search.label}</Label>
          <Input
            id="audit-search"
            type="search"
            name="q"
            defaultValue={query.q ?? ''}
            placeholder={labels.searchPlaceholder}
            aria-describedby="audit-search-note"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action-group">{labels.actionGroup}</Label>
          <Select id="audit-action-group" name="actionGroup" defaultValue={query.actionGroup ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {AUDIT_ACTION_GROUPS.map((group) => (
              <option key={group} value={group}>
                {AUDIT.actionGroupLabels[group]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">{labels.action}</Label>
          <Select id="audit-action" name="action" defaultValue={query.action ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            <ActionOptions />
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-target-type">{labels.targetType}</Label>
          <Select id="audit-target-type" name="targetType" defaultValue={query.targetType ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {AUDIT_TARGET_TYPES.map((targetType) => (
              <option key={targetType} value={targetType}>
                {AUDIT.targetTypeLabels[targetType]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">{labels.from}</Label>
          {/* Latin digits in a fixed order, so the control is isolated from the
              RTL page — a date input otherwise renders its segments reversed. */}
          <Input
            id="audit-from"
            type="date"
            name="from"
            dir="ltr"
            defaultValue={toDayValue(query.from)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">{labels.to}</Label>
          <Input
            id="audit-to"
            type="date"
            name="to"
            dir="ltr"
            defaultValue={toDayValue(query.to)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary">
            {COPY.adminCommon.filter.apply}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/audit-log">{COPY.adminCommon.filter.clear}</Link>
          </Button>
        </div>
      </div>

      <p id="audit-search-note" className="text-ink-700 text-xs">
        {labels.searchNote}
      </p>
    </form>
  );
}

// ── Metadata viewer ──────────────────────────────────────────────────────

/**
 * `AuditLog.metadata` is `Json`, so this is arbitrary data.
 *
 * Three rules hold everywhere below, and each one is load-bearing:
 *
 *  1. **No shape is assumed.** `auditChanges` produces `{ before, after }`, but
 *     plenty of rows carry flat facts instead (`{ from, to, slug }`), and a row
 *     written by a future service may carry something else again. Every branch
 *     narrows before it reads, and anything unrecognised is still displayed
 *     rather than dropped — a viewer that silently hides what it does not
 *     understand is a viewer that cannot be trusted to show what happened.
 *  2. **Nothing is ever interpreted as markup.** Values reach the DOM as text
 *     nodes; there is no `dangerouslySetInnerHTML` in this file and there must
 *     never be one. The trail records values an administrator typed, and those
 *     values are read by other administrators.
 *  3. **A long value is truncated with a way to see all of it.** A pasted
 *     description would otherwise stretch its column past the width of the page.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const INLINE_VALUE_LIMIT = 120;
const LATIN_ONLY = /^[\x20-\x7E]*$/;

/** Marks the sanitiser leaves behind, so the panel can explain them. */
const REDACTION_MARKER = '[redacted]';
const TRUNCATION_MARKER = '[truncated]';

function scanMetadata(
  value: unknown,
  found = { redacted: false, truncated: false },
  depth = 0,
): { redacted: boolean; truncated: boolean } {
  if (depth > 6) return found;

  if (typeof value === 'string') {
    if (value === REDACTION_MARKER) found.redacted = true;
    if (value === TRUNCATION_MARKER || value.endsWith('…') || /^\[\+\d+\]$/.test(value)) {
      found.truncated = true;
    }
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanMetadata(item, found, depth + 1);
    return found;
  }
  if (isPlainObject(value)) {
    for (const item of Object.values(value)) scanMetadata(item, found, depth + 1);
  }
  return found;
}

function MetadataValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-ink-600">{AUDIT.metadata.emptyValue}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? COPY.common.yes : COPY.common.no}</span>;
  }
  if (typeof value === 'number') {
    return <span dir="ltr">{formatNumber(value)}</span>;
  }

  if (typeof value === 'string') {
    if (value.length === 0) {
      return <span className="text-ink-600">{AUDIT.metadata.emptyValue}</span>;
    }
    if (value.length <= INLINE_VALUE_LIMIT) {
      // A run of Latin — a slug, an address, an ISO date, an id — is isolated so
      // it cannot reorder against the Arabic beside it.
      return LATIN_ONLY.test(value) ? <span dir="ltr">{value}</span> : <span>{value}</span>;
    }
    return (
      <details className="min-w-0">
        <summary className="text-brand-700 cursor-pointer text-xs">
          {AUDIT.metadata.showValue}
        </summary>
        <p className="text-ink-900 mt-1 text-xs break-words whitespace-pre-wrap">{value}</p>
      </details>
    );
  }

  // An array or an object. Rendered as formatted JSON rather than as a nested
  // grid: the structure is not known, and a grid that guessed at it would be
  // presenting an interpretation as though it were the record.
  return (
    <details className="min-w-0">
      <summary className="text-brand-700 cursor-pointer text-xs">
        {AUDIT.metadata.showValue}
      </summary>
      <pre
        dir="ltr"
        className="bg-surface-muted text-ink-900 rounded-control mt-1 max-h-64 overflow-auto p-2 text-start text-[11px] break-words whitespace-pre-wrap"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

const CELL = 'border-line-200 border-b px-2 py-1.5 align-top text-xs';

function DiffTable({
  keys,
  before,
  after,
}: {
  keys: readonly string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th scope="col" className={`${CELL} text-ink-600 text-start font-semibold`}>
            {AUDIT.metadata.fieldColumn}
          </th>
          <th scope="col" className={`${CELL} text-ink-600 text-start font-semibold`}>
            {AUDIT.metadata.beforeColumn}
          </th>
          <th scope="col" className={`${CELL} text-ink-600 text-start font-semibold`}>
            {AUDIT.metadata.afterColumn}
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key}>
            <th scope="row" className={`${CELL} text-ink-700 text-start font-medium`}>
              <span dir="ltr">{key}</span>
            </th>
            <td className={CELL}>
              <MetadataValue value={before ? before[key] : undefined} />
            </td>
            <td className={CELL}>
              <MetadataValue value={after ? after[key] : undefined} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValueTable({ entries }: { entries: Array<[string, unknown]> }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th scope="col" className={`${CELL} text-ink-600 text-start font-semibold`}>
            {AUDIT.metadata.fieldColumn}
          </th>
          <th scope="col" className={`${CELL} text-ink-600 text-start font-semibold`}>
            {AUDIT.metadata.valueColumn}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <th scope="row" className={`${CELL} text-ink-700 text-start font-medium`}>
              <span dir="ltr">{key}</span>
            </th>
            <td className={CELL}>
              <MetadataValue value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetadataPanel({ row }: { row: AdminAuditRow }) {
  const metadata = row.metadata as unknown;

  const before = isPlainObject(metadata) && isPlainObject(metadata.before) ? metadata.before : null;
  const after = isPlainObject(metadata) && isPlainObject(metadata.after) ? metadata.after : null;
  const diffKeys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];

  const flat: Array<[string, unknown]> = isPlainObject(metadata)
    ? Object.entries(metadata).filter(
        ([key]) => !(key === 'before' && before) && !(key === 'after' && after),
      )
    : // Not an object at all: an array, a string, a number. Shown under a single
      // heading rather than discarded.
      [[AUDIT.metadata.valueColumn, metadata]];

  const marks = scanMetadata(metadata);
  const isCreate = row.action.endsWith('.created');
  const isDelete = row.action.endsWith('.deleted');

  return (
    <div className="flex flex-col gap-3 pt-2">
      {diffKeys.length > 0 ? <DiffTable keys={diffKeys} before={before} after={after} /> : null}

      {flat.length > 0 ? <ValueTable entries={flat} /> : null}

      {diffKeys.length === 0 && flat.length === 0 ? (
        <p className="text-ink-700 text-xs">{AUDIT.metadata.empty.nothingYetBody}</p>
      ) : null}

      <div className="text-ink-600 flex flex-col gap-1 text-[11px]">
        {isCreate ? <p>{AUDIT.metadata.createdNote}</p> : null}
        {isDelete ? <p>{AUDIT.metadata.deletedNote}</p> : null}
        {marks.redacted ? <p>{AUDIT.metadata.redactedNote}</p> : null}
        {marks.truncated ? <p>{AUDIT.metadata.truncatedNote}</p> : null}
        {row.requestId ? (
          <p>
            {AUDIT.fields.requestId.label}: <span dir="ltr">{row.requestId}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** How many fields a row records a change to, for the collapsed summary. */
function changedFieldCount(metadata: unknown): number {
  if (!isPlainObject(metadata)) return 0;
  const after = isPlainObject(metadata.after) ? metadata.after : null;
  const before = isPlainObject(metadata.before) ? metadata.before : null;
  if (after || before) {
    return new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]).size;
  }
  return Object.keys(metadata).length;
}

// ── Table ────────────────────────────────────────────────────────────────

/**
 * Target types with a record screen of their own.
 *
 * Two rules decide what is listed, and both are about not offering a link that
 * lands nowhere:
 *
 *  - **The id has to be a route parameter.** A `Lesson`, an `ExamSection` or a
 *    `PaymentAttempt` is edited inside its parent's screen, so a URL built from
 *    its id would be a guess. `Course` qualifies because `courses/[courseId]` is
 *    keyed by `Course.id`, which is exactly what `course.updated` targets.
 *  - **The route has to exist.** An entry added here for a screen that has not
 *    been built yet is a 404 in the middle of an investigation, which is worse
 *    than no link. `ExamSimulator` earned its entry once
 *    `simulators/[simulatorId]` landed — that segment is keyed by
 *    `ExamSimulator.id`, which is exactly what `simulator.updated` targets.
 *    `Entitlement` is still absent: the detail API exists but no record page
 *    renders it yet, so it belongs here the day that page lands.
 *
 * `ExamVersion` stays out for the first rule rather than the second. Its screen
 * exists, but the URL is `simulators/[simulatorId]/versions/[versionId]` and an
 * audit row carries one id, so the parent could only be guessed at.
 *
 * A row with no entry still shows its id, which is what a person needs to find
 * the record by hand — and the id is always a link into *this* log, which cannot
 * 404 and answers "what else happened to that record".
 */
const TARGET_RECORD_PATHS: Partial<Record<AuditTargetTypeName, (id: string) => string>> = {
  Product: (id) => `/admin/products/${id}`,
  Question: (id) => `/admin/questions/${id}`,
  Course: (id) => `/admin/courses/${id}`,
  User: (id) => `/admin/students/${id}`,
  Order: (id) => `/admin/orders/${id}`,
  ExamAttempt: (id) => `/admin/attempts/${id}`,
  ExamSimulator: (id) => `/admin/simulators/${id}`,
  SiteSetting: () => '/admin/settings',
};

function targetRecordHref(targetType: string, targetId: string | null): string | null {
  if (!targetId) return null;
  const build = TARGET_RECORD_PATHS[targetType as AuditTargetTypeName];
  return build ? build(targetId) : null;
}

/**
 * Who acted, in the three states the two actor columns can express.
 *
 * The address is the snapshot written at the time of the action, not a join, so
 * a deleted account still names the person who took the decision. That is the
 * point of `actorEmail` existing at all, and the reason the trail does not
 * quietly rewrite itself when somebody leaves.
 */
function ActorCell({ row, query }: { row: AdminAuditRow; query: AuditLogQuery }) {
  if (!row.actorEmail) {
    return (
      <span className="text-ink-700" title={AUDIT.systemActorHint}>
        {AUDIT.systemActor}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Link
        href={queryString(query, { q: row.actorEmail, page: undefined })}
        aria-label={`${AUDIT.filters.actor}: ${row.actorEmail}`}
        className="text-brand-700 text-xs hover:underline"
        dir="ltr"
      >
        {row.actorEmail}
      </Link>
      {row.actorId === null ? (
        <span className="text-ink-600 text-[11px]">{AUDIT.deletedActor}</span>
      ) : null}
    </div>
  );
}

function TargetCell({ row, query }: { row: AdminAuditRow; query: AuditLogQuery }) {
  if (!row.targetId) {
    return <span className="text-ink-600 text-xs">{AUDIT.noTarget}</span>;
  }

  const recordHref = targetRecordHref(row.targetType, row.targetId);

  return (
    <div className="flex flex-col gap-0.5">
      <Link
        href={queryString(query, { q: row.targetId, page: undefined })}
        aria-label={`${AUDIT.filters.targetId}: ${row.targetId}`}
        className="text-brand-700 text-[11px] break-all hover:underline"
        dir="ltr"
      >
        {row.targetId}
      </Link>
      {recordHref ? (
        <Link href={recordHref} className="text-ink-700 text-[11px] hover:underline">
          {AUDIT.actions.openTarget}
        </Link>
      ) : null}
    </div>
  );
}

function buildColumns(query: AuditLogQuery): readonly DataTableColumn<AdminAuditRow>[] {
  return [
    {
      key: 'createdAt',
      header: AUDIT.columns.createdAt,
      isRowHeader: true,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: AUDIT.columns.actor,
      cell: (row) => <ActorCell row={row} query={query} />,
    },
    {
      key: 'action',
      header: AUDIT.columns.action,
      cell: (row) => {
        const label = AUDIT.actionLabels[row.action as keyof typeof AUDIT.actionLabels];
        // `AuditLog.action` is `String`, not an enum, so the fallback is not
        // defensive padding: a service can write a value this copy bank has no
        // label for, and the row is still a true record of something that
        // happened. It is shown as unknown rather than hidden.
        return label ? (
          <span className="text-xs">{label}</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <Badge variant="outline" shape="square">
              {AUDIT.unknownAction}
            </Badge>
            <span dir="ltr" className="text-ink-600 text-[11px]">
              {row.action}
            </span>
          </span>
        );
      },
    },
    {
      key: 'targetType',
      header: AUDIT.columns.targetType,
      cell: (row) => (
        <span className="text-xs">
          {AUDIT.targetTypeLabels[row.targetType as AuditTargetTypeName] ?? AUDIT.unknownTargetType}
        </span>
      ),
    },
    {
      key: 'targetId',
      header: AUDIT.columns.targetId,
      className: 'max-w-56',
      cell: (row) => <TargetCell row={row} query={query} />,
    },
    {
      key: 'summary',
      header: AUDIT.columns.summary,
      className: 'min-w-72',
      cell: (row) => {
        const count = changedFieldCount(row.metadata as unknown);
        if (row.metadata === null || count === 0) {
          return <span className="text-ink-600 text-xs">{AUDIT.metadata.noneShort}</span>;
        }
        return (
          <details className="min-w-0">
            <summary className="text-brand-700 cursor-pointer text-xs">
              {AUDIT.metadata.showChanges} —{' '}
              {fill(AUDIT.metadata.fieldsChanged, { count: formatNumber(count) })}
            </summary>
            <MetadataPanel row={row} />
          </details>
        );
      },
    },
  ];
}

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`. A query that threw renders
 * `ErrorState`, never a table with nothing in it: "no administrative actions
 * have been recorded" is a claim about who has been doing what, and a database
 * outage is not entitled to make it — least of all on the screen whose job is
 * accountability.
 *
 * `filtered` picks between the two kinds of emptiness. With a date window or an
 * action filter active, "nothing has happened yet" is simply false.
 */
export function AuditLogList({
  rows,
  query,
  failed = false,
  filtered,
}: {
  rows: readonly AdminAuditRow[];
  query: AuditLogQuery;
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${AUDIT.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
      columns={buildColumns(query)}
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
                <Link href="/admin/audit-log">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={AUDIT.empty.nothingYetTitle}
            description={AUDIT.empty.nothingYetBody}
          />
        )
      }
    />
  );
}

// ── Pager ────────────────────────────────────────────────────────────────

export function AuditLogPagination({
  result,
  query,
}: {
  result: AdminAuditLogPage;
  query: AuditLogQuery;
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
