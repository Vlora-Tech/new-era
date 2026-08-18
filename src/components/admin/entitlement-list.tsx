import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { EntitlementStatusActions } from '@/components/admin/entitlement-grant-form';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatNumber } from '@/lib/format';
import type {
  AdminEntitlementPage,
  AdminEntitlementRow,
  GrantableProduct,
} from '@/services/access/entitlement-admin.service';
import {
  entitlementListQuerySchema,
  type EntitlementListQuery,
} from '@/validators/admin-entitlement';

/**
 * The access list, its filter bar and its pager.
 *
 * Server Components throughout, except the per-row transition button, which has
 * to be a client control because it collects a reason and posts it. The filter
 * bar is a plain `<form method="get">` and the pager is a set of links, so a
 * narrowed view is a real address: reloadable, bookmarkable, and shareable with
 * the colleague who asked why a particular student has access.
 */

/** The schema's own defaults, read from it rather than restated. */
const QUERY_DEFAULTS = entitlementListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function queryString(current: EntitlementListQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    status: current.status,
    productId: current.productId,
    productType: current.productType,
    source: current.source,
    from: current.from,
    to: current.to,
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
  return query ? `/admin/entitlements?${query}` : '/admin/entitlements';
}

/** True when any filter is narrowing the result set. */
export function isEntitlementQueryFiltered(query: EntitlementListQuery): boolean {
  return (
    Boolean(query.q) ||
    query.status !== undefined ||
    query.productId !== undefined ||
    query.productType !== undefined ||
    query.source !== undefined ||
    query.from !== undefined ||
    query.to !== undefined
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

/**
 * Search and filters, submitted as a GET form.
 *
 * `page` is absent from the form on purpose: a new filter returns to page one,
 * because page four of the previous result set is usually past the end of the
 * new one, and an empty page reads as "no matches" when there are plenty.
 */
export function EntitlementFilters({
  query,
  products,
}: {
  query: EntitlementListQuery;
  products: readonly GrantableProduct[];
}) {
  const labels = COPY.adminEntitlements.filters;

  return (
    <form
      method="get"
      action="/admin/entitlements"
      className="rounded-panel border-line-200 bg-surface flex flex-col gap-3 border p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="entitlement-search">{COPY.adminCommon.search.label}</Label>
          <Input
            id="entitlement-search"
            type="search"
            name="q"
            defaultValue={query.q ?? ''}
            placeholder={labels.searchPlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-status">{labels.status}</Label>
          <Select id="entitlement-status" name="status" defaultValue={query.status ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['ACTIVE', 'REVOKED'] as const).map((status) => (
              <option key={status} value={status}>
                {COPY.adminEntitlements.statusLabels[status]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-product">{labels.product}</Label>
          <Select id="entitlement-product" name="productId" defaultValue={query.productId ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-type">{labels.productType}</Label>
          <Select id="entitlement-type" name="productType" defaultValue={query.productType ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['COURSE', 'EXAM_SIMULATOR'] as const).map((type) => (
              <option key={type} value={type}>
                {COPY.statusLabels.productType[type]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-source">{labels.source}</Label>
          <Select id="entitlement-source" name="source" defaultValue={query.source ?? ''}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['order', 'admin', 'system'] as const).map((source) => (
              <option key={source} value={source}>
                {COPY.adminEntitlements.sourceLabels[source]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-from">{labels.from}</Label>
          {/* An ISO calendar day: Latin digits and hyphens, isolated so the
              control's own text cannot reorder inside the Arabic layout. */}
          <Input
            id="entitlement-from"
            type="date"
            name="from"
            dir="ltr"
            defaultValue={query.from ?? ''}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlement-to">{labels.to}</Label>
          <Input
            id="entitlement-to"
            type="date"
            name="to"
            dir="ltr"
            defaultValue={query.to ?? ''}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary">
            {COPY.adminCommon.filter.apply}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/entitlements">{COPY.adminCommon.filter.clear}</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminEntitlementRow>[] = [
  {
    key: 'student',
    header: COPY.adminEntitlements.columns.student,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/students/${row.userId}`} className="text-brand-700 hover:underline">
        {row.studentName}
      </Link>
    ),
  },
  {
    key: 'email',
    header: COPY.adminEntitlements.columns.email,
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.studentEmail}</span>,
  },
  {
    key: 'product',
    header: COPY.adminEntitlements.columns.product,
    cell: (row) => (
      <Link href={`/admin/products/${row.productId}`} className="text-brand-700 hover:underline">
        {row.productTitle}
      </Link>
    ),
  },
  {
    key: 'productType',
    header: COPY.adminEntitlements.columns.productType,
    cell: (row) => (
      <Badge variant="outline" shape="square">
        {COPY.statusLabels.productType[row.productType]}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: COPY.adminEntitlements.columns.status,
    cell: (row) => (
      <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
        {COPY.adminEntitlements.statusLabels[row.status]}
      </Badge>
    ),
  },
  {
    key: 'grantedAt',
    header: COPY.adminEntitlements.columns.grantedAt,
    cell: (row) => formatDate(row.grantedAt),
  },
  {
    key: 'revokedAt',
    header: COPY.adminEntitlements.columns.revokedAt,
    // Active access has never been withdrawn, which is a different fact from a
    // date the screen could not read.
    cell: (row) => (row.revokedAt ? formatDate(row.revokedAt) : COPY.common.notAvailable),
  },
  {
    key: 'sourceOrder',
    header: COPY.adminEntitlements.columns.sourceOrder,
    dir: 'ltr',
    cell: (row) =>
      row.sourceOrderId ? (
        <Link
          href={`/admin/orders/${row.sourceOrderId}`}
          className="text-brand-700 text-xs hover:underline"
        >
          {row.sourceOrderId}
        </Link>
      ) : (
        <span className="text-ink-700 text-xs">
          {COPY.adminEntitlements.sourceLabels[row.source]}
        </span>
      ),
  },
  {
    key: 'lastEvent',
    header: COPY.adminEntitlements.columns.lastEvent,
    // The whole chronology is one link away, because this cell cannot answer the
    // question the screen exists for: it shows only the most recent transition,
    // so a purchase, a refund and a goodwill reinstatement all read as whichever
    // happened last.
    cell: (row) =>
      row.lastEventType && row.lastEventAt ? (
        <Link
          href={`/admin/entitlements/${row.id}`}
          className="text-brand-700 flex flex-col hover:underline"
        >
          <span>{COPY.adminEntitlements.eventTypeLabels[row.lastEventType]}</span>
          <span className="text-ink-600 text-xs">{formatDate(row.lastEventAt)}</span>
        </Link>
      ) : (
        <Link href={`/admin/entitlements/${row.id}`} className="text-brand-700 hover:underline">
          {COPY.adminEntitlements.sections.history}
        </Link>
      ),
  },
  {
    key: 'actions',
    header: COPY.adminEntitlements.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <span className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/entitlements/${row.id}`}>{COPY.adminCommon.actions.view}</Link>
        </Button>
        <EntitlementStatusActions entitlementId={row.id} status={row.status} />
      </span>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`. A query that threw becomes
 * `ErrorState`, never a table with nothing in it: "nobody has access to
 * anything" is a claim about the business, and a database outage is not entitled
 * to make it — least of all on the screen an administrator opens to check
 * whether a paying student can still open what they bought.
 */
export function EntitlementList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminEntitlementRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminEntitlements.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/entitlements">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={COPY.adminEntitlements.empty.nothingYetTitle}
            description={COPY.adminEntitlements.empty.nothingYetBody}
          />
        )
      }
    />
  );
}

// ── Pager ────────────────────────────────────────────────────────────────

export function EntitlementPagination({
  result,
  query,
}: {
  result: AdminEntitlementPage;
  query: EntitlementListQuery;
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
