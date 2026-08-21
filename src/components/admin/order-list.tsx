import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { OrderStatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatHalalas, formatNumber } from '@/lib/format';
import { riyadhDateInput } from '@/lib/riyadh-day';
import type { AdminOrderPage, AdminOrderRow } from '@/services/payments/order-admin.service';
import { orderListQuerySchema, type OrderListQuery } from '@/validators/admin-order';

/**
 * The orders list, its filter bar and its pager.
 *
 * All three are Server Components with no client JavaScript. The filter bar is a
 * plain `<form method="get">` and the pager is a set of links, so filtering and
 * paging are ordinary navigations: a narrowed view is a real address that can be
 * reloaded, bookmarked and pasted into a support thread. A client-side filter
 * over a full table dump would have none of those properties, and on this table
 * it would also mean shipping every student's purchase history to every browser.
 *
 * The one column that earns its place regardless of width is `needsReview`. It
 * is the reason an administrator opens this screen at all: a flagged payment is
 * one the server refused to resolve on its own, and it stays unresolved until a
 * person looks at it.
 */

const QUERY_DEFAULTS = orderListQuerySchema.parse({});

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across: somebody who has narrowed the list to
 * flagged live payments in March and then turns the page means the next page *of
 * those*, and a pager that drops the filter appears to show rows the filter
 * excluded.
 */
export function orderQueryString(
  current: OrderListQuery,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    status: current.status,
    provider: current.provider,
    mode: current.mode,
    paymentStatus: current.paymentStatus,
    needsReview: current.needsReview ? 'true' : undefined,
    from: current.from ? riyadhDateInput(current.from) : undefined,
    to: current.to ? riyadhDateInput(current.to) : undefined,
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/orders` and
    // `/admin/orders?page=1` remain one address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/orders?${query}` : '/admin/orders';
}

/** True when anything is narrowing the list, which decides the emptiness wording. */
export function isOrderQueryFiltered(query: OrderListQuery): boolean {
  return (
    Boolean(query.q) ||
    query.status !== undefined ||
    query.provider !== undefined ||
    query.mode !== undefined ||
    query.paymentStatus !== undefined ||
    query.needsReview === true ||
    query.from !== undefined ||
    query.to !== undefined
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;
const PROVIDERS = ['MOCK', 'MOYASAR'] as const;
const MODES = ['TEST', 'LIVE'] as const;
const PAYMENT_STATUSES = [
  'CREATED',
  'INITIATED',
  'PAID',
  'FAILED',
  'AUTHORIZED',
  'CAPTURED',
  'VERIFIED',
  'REFUNDED',
  'VOIDED',
] as const;

/**
 * Search and filters, submitted as a GET form.
 *
 * `page` is deliberately absent from the form: applying a new filter returns to
 * page one, because page seven of the old result set is very often past the end
 * of the new one, and an empty page reads as "no matches" when there are plenty
 * on page one.
 */
export function OrderFilters({ query }: { query: OrderListQuery }) {
  const labels = COPY.adminOrders.filters;

  return (
    <form
      method="get"
      action="/admin/orders"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="order-search">{COPY.adminCommon.search.label}</Label>
        <Input
          id="order-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder={labels.searchPlaceholder}
          aria-describedby="order-search-note"
        />
        <p id="order-search-note" className="text-ink-600 text-xs">
          {labels.searchNote}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-status">{labels.status}</Label>
        <Select id="order-status" name="status" defaultValue={query.status ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {COPY.adminOrders.orderStatusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-provider">{labels.provider}</Label>
        <Select id="order-provider" name="provider" defaultValue={query.provider ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {COPY.adminOrders.providerLabels[provider]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-mode">{labels.mode}</Label>
        <Select id="order-mode" name="mode" defaultValue={query.mode ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {MODES.map((mode) => (
            <option key={mode} value={mode}>
              {COPY.adminOrders.modeLabels[mode]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-payment-status">{labels.paymentStatus}</Label>
        <Select
          id="order-payment-status"
          name="paymentStatus"
          defaultValue={query.paymentStatus ?? ''}
        >
          <option value="">{COPY.adminCommon.filter.all}</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {COPY.adminOrders.paymentStatusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      {/* Dates are Riyadh calendar days, resolved to instants by the schema. The
          value round-trips through `riyadhDateInput` so the box redraws the day
          that was chosen rather than the UTC day it happens to overlap. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-from">{labels.from}</Label>
        <Input
          id="order-from"
          type="date"
          name="from"
          dir="ltr"
          defaultValue={query.from ? riyadhDateInput(query.from) : ''}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-to">{labels.to}</Label>
        <Input
          id="order-to"
          type="date"
          name="to"
          dir="ltr"
          defaultValue={query.to ? riyadhDateInput(query.to) : ''}
        />
      </div>

      <div className="flex items-center gap-2 self-end pb-2.5">
        <Checkbox
          id="order-needs-review"
          name="needsReview"
          value="true"
          defaultChecked={query.needsReview === true}
        />
        <Label htmlFor="order-needs-review" className="font-normal">
          {labels.needsReview}
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary">
          {COPY.adminCommon.filter.apply}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/orders">{COPY.adminCommon.filter.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminOrderRow>[] = [
  {
    key: 'reference',
    header: COPY.adminOrders.columns.reference,
    isRowHeader: true,
    // The full id, not a prefix: it is what the student quotes and what the
    // search box matches, and a truncated reference is one nobody can paste back.
    dir: 'ltr',
    cell: (row) => (
      <Link href={`/admin/orders/${row.id}`} className="text-brand-700 text-xs hover:underline">
        {row.id}
      </Link>
    ),
  },
  {
    key: 'student',
    header: COPY.adminOrders.columns.student,
    cell: (row) => row.student.name,
  },
  {
    key: 'email',
    header: COPY.adminOrders.columns.email,
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.student.email}</span>,
  },
  {
    key: 'product',
    header: COPY.adminOrders.columns.product,
    // The snapshot taken at checkout, never the catalogue's title today.
    cell: (row) => row.productTitle,
  },
  {
    key: 'amount',
    header: COPY.adminOrders.columns.amount,
    align: 'end',
    // Integer halalas through the shared formatter. Nothing here divides by 100.
    cell: (row) => formatHalalas(row.amountHalalas),
  },
  {
    key: 'status',
    header: COPY.adminOrders.columns.status,
    cell: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'provider',
    header: COPY.adminOrders.columns.provider,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span>{COPY.adminOrders.providerLabels[row.provider]}</span>
        {/* The mode is spelled out rather than reduced to a colour: reading a
            test row as a live one is the mistake this label exists to prevent. */}
        {row.paymentMode ? (
          <Badge variant={row.paymentMode === 'LIVE' ? 'neutral' : 'outline'} shape="square">
            {COPY.adminOrders.modeLabels[row.paymentMode]}
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    key: 'paymentStatus',
    header: COPY.adminOrders.columns.paymentStatus,
    cell: (row) =>
      row.paymentStatus ? (
        COPY.adminOrders.paymentStatusLabels[row.paymentStatus]
      ) : (
        <span className="text-ink-600">{COPY.common.notAvailable}</span>
      ),
  },
  {
    key: 'needsReview',
    header: COPY.adminOrders.columns.needsReview,
    cell: (row) =>
      row.needsReview ? (
        <Badge variant="warning">{COPY.adminOrders.review.badge}</Badge>
      ) : (
        <span className="text-ink-600">{COPY.common.no}</span>
      ),
  },
  {
    key: 'createdAt',
    header: COPY.adminOrders.columns.createdAt,
    cell: (row) => formatDate(row.createdAt),
  },
  {
    key: 'actions',
    header: COPY.adminOrders.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/orders/${row.id}`}>{COPY.adminCommon.actions.view}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`, and the two render
 * differently on purpose: a query that threw becomes `ErrorState`, never a table
 * with nothing in it. "لا توجد طلبات بعد" is a claim about the business, and a
 * database outage is not entitled to make it — least of all on the screen where
 * that claim means "nobody bought anything".
 *
 * `filtered` picks between the two kinds of emptiness. With a filter active,
 * "no orders yet" is an answer to a question nobody asked.
 */
export function OrderList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminOrderRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminOrders.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/orders">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          // No action: an order is created by a student going through checkout,
          // and there is nothing an administrator can press to make the first one
          // exist.
          <EmptyState
            title={COPY.adminOrders.empty.nothingYetTitle}
            description={COPY.adminOrders.empty.nothingYetBody}
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
 * mistaken for the whole ledger. Both controls are links rather than buttons:
 * they navigate, and a screen reader should say so.
 */
export function OrderPagination({
  result,
  query,
}: {
  result: AdminOrderPage;
  query: OrderListQuery;
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
            <Link href={orderQueryString(query, { page: String(result.page - 1) })}>
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
            <Link href={orderQueryString(query, { page: String(result.page + 1) })}>
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
