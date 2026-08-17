import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ProductStatusBadge, ProductTypeBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatHalalas, formatNumber } from '@/lib/format';
import type { AdminProductPage, AdminProductRow } from '@/services/catalog/product-admin.service';
import { productListQuerySchema, type ProductListQuery } from '@/validators/admin-product';

/**
 * The schema's own defaults, read from it rather than restated. A page size
 * changed in the validator would otherwise start appearing in every link here
 * as though the reader had chosen it.
 */
const QUERY_DEFAULTS = productListQuerySchema.parse({});

/**
 * The products list, its filter bar and its pager.
 *
 * All three are Server Components with no client JavaScript. The filter bar is a
 * plain `<form method="get">` and the pager is a set of links, so filtering,
 * searching and paging are ordinary navigations: they survive a reload, they can
 * be bookmarked and shared, and the back button does what it looks like it does.
 * A client-side filter over a full table dump would have none of those
 * properties and would also mean shipping every product to every browser.
 */

/** Fill `{name}` placeholders in a COPY template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Rebuild the query string with one parameter changed.
 *
 * Every other filter is carried across, because a person who has narrowed the
 * list to draft simulators and then turns the page means the next page *of
 * those* — dropping the filter on navigation is how a pager appears to show
 * results the filter excluded.
 */
function queryString(current: ProductListQuery, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q || undefined,
    type: current.type,
    status: current.status,
    featured: current.featured === undefined ? undefined : String(current.featured),
    page: String(current.page),
    perPage: current.perPage === QUERY_DEFAULTS.perPage ? undefined : String(current.perPage),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    // A default stays out of the URL, so `/admin/products` and
    // `/admin/products?page=1` remain the same address rather than two.
    if (value === undefined || value === '') continue;
    if (key === 'page' && value === String(QUERY_DEFAULTS.page)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/products?${query}` : '/admin/products';
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
export function ProductFilters({ query }: { query: ProductListQuery }) {
  const labels = COPY.adminProducts.filters;

  return (
    <form
      method="get"
      action="/admin/products"
      className="rounded-panel border-line-200 bg-surface flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="product-search">{COPY.adminCommon.search.label}</Label>
        {/* `type="search"` so the browser offers its own clear control; the
            design-system `Input` supplies the styling, uncontrolled because a
            GET form submits its own DOM values. */}
        <Input
          id="product-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          placeholder={labels.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-type">{labels.type}</Label>
        <Select id="product-type" name="type" defaultValue={query.type ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {(['COURSE', 'EXAM_SIMULATOR'] as const).map((type) => (
            <option key={type} value={type}>
              {COPY.adminProducts.typeLabels[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-status">{labels.status}</Label>
        <Select id="product-status" name="status" defaultValue={query.status ?? ''}>
          <option value="">{COPY.adminCommon.filter.all}</option>
          {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((status) => (
            <option key={status} value={status}>
              {COPY.adminProducts.statusLabels[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-featured">{labels.featured}</Label>
        <Select
          id="product-featured"
          name="featured"
          defaultValue={query.featured === undefined ? '' : String(query.featured)}
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
          <Link href="/admin/products">{COPY.adminCommon.filter.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Table ────────────────────────────────────────────────────────────────

const columns: readonly DataTableColumn<AdminProductRow>[] = [
  {
    key: 'title',
    header: COPY.adminProducts.columns.title,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/products/${row.id}`} className="text-brand-700 hover:underline">
        {row.title}
      </Link>
    ),
  },
  {
    key: 'type',
    header: COPY.adminProducts.columns.type,
    cell: (row) => <ProductTypeBadge type={row.type} />,
  },
  {
    key: 'slug',
    header: COPY.adminProducts.columns.slug,
    // Latin, and often starting with a digit or a hyphen: isolated so it cannot
    // reorder against the Arabic cells beside it.
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.slug}</span>,
  },
  {
    key: 'status',
    header: COPY.adminProducts.columns.status,
    cell: (row) => <ProductStatusBadge status={row.status} />,
  },
  {
    key: 'price',
    header: COPY.adminProducts.columns.price,
    align: 'end',
    cell: (row) => formatHalalas(row.priceHalalas),
  },
  {
    key: 'featured',
    header: COPY.adminProducts.columns.featured,
    cell: (row) => (row.featured ? COPY.common.yes : COPY.common.no),
  },
  {
    key: 'updatedAt',
    header: COPY.adminProducts.columns.updatedAt,
    cell: (row) => formatDate(row.updatedAt),
  },
  {
    key: 'actions',
    header: COPY.adminProducts.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/products/${row.id}`}>{COPY.adminCommon.actions.edit}</Link>
      </Button>
    ),
  },
];

/**
 * The table itself.
 *
 * `failed` is a separate signal from an empty `rows`, and the two render
 * differently on purpose: a query that threw becomes `ErrorState`, never a table
 * with nothing in it. "لا توجد منتجات" is a claim about the business, and a
 * database outage must not be allowed to make it.
 *
 * `filtered` picks between the two *kinds* of emptiness. With a search or a
 * filter active, "add your first product" is advice for a problem the
 * administrator does not have.
 */
export function ProductList({
  rows,
  failed = false,
  filtered,
}: {
  rows: readonly AdminProductRow[];
  failed?: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminProducts.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
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
                <Link href="/admin/products">{COPY.adminCommon.emptiness.noResultsAction}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={COPY.adminProducts.empty.nothingYetTitle}
            description={COPY.adminProducts.empty.nothingYetBody}
            action={
              <Button asChild>
                <Link href="/admin/products/new">{COPY.adminProducts.empty.nothingYetAction}</Link>
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
 * mistaken for the whole catalogue. Both controls are links rather than buttons:
 * they navigate, and a screen reader should say so.
 */
export function ProductPagination({
  result,
  query,
}: {
  result: AdminProductPage;
  query: ProductListQuery;
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
