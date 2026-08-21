import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ContactMessageRecord } from '@/services/contact-message.service';
import type { ContactMessageListQuery } from '@/validators/contact';

const COLUMNS: readonly DataTableColumn<ContactMessageRecord>[] = [
  {
    key: 'sender',
    header: COPY.adminContact.columns.sender,
    isRowHeader: true,
    className: 'min-w-44',
    cell: (row) => (
      <Link
        href={`/admin/contact-messages/${row.id}`}
        className="text-brand-700 font-semibold hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    key: 'email',
    header: COPY.adminContact.columns.email,
    dir: 'ltr',
    className: 'min-w-52',
    cell: (row) => <span className="text-ink-700 text-xs">{row.email}</span>,
  },
  {
    key: 'subject',
    header: COPY.adminContact.columns.subject,
    className: 'min-w-48',
    cell: (row) => row.subject ?? COPY.adminContact.noSubject,
  },
  {
    key: 'message',
    header: COPY.adminContact.columns.message,
    className: 'min-w-72 max-w-md',
    cell: (row) => <span className="text-ink-700 line-clamp-2 leading-relaxed">{row.message}</span>,
  },
  {
    key: 'receivedAt',
    header: COPY.adminContact.columns.receivedAt,
    className: 'whitespace-nowrap',
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'actions',
    header: COPY.adminContact.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/contact-messages/${row.id}`}>{COPY.adminCommon.actions.view}</Link>
      </Button>
    ),
  },
];

export function ContactMessageFilters({ query }: { query: ContactMessageListQuery }) {
  return (
    <form
      method="get"
      action="/admin/contact-messages"
      className="rounded-card border-line-200 bg-surface shadow-card flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="contact-message-search">{COPY.adminCommon.search.label}</Label>
        <Input
          id="contact-message-search"
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder={COPY.adminContact.searchPlaceholder}
        />
      </div>
      <Button type="submit" variant="secondary">
        {COPY.adminCommon.search.submit}
      </Button>
      {query.q ? (
        <Button asChild variant="ghost">
          <Link href="/admin/contact-messages">{COPY.adminCommon.search.clear}</Link>
        </Button>
      ) : null}
    </form>
  );
}

export function ContactMessageTable({
  rows,
  failed,
  filtered,
}: {
  rows: readonly ContactMessageRecord[];
  failed: boolean;
  filtered: boolean;
}) {
  return (
    <DataTable
      caption={`${COPY.adminContact.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
      columns={COLUMNS}
      rows={rows}
      getRowKey={(row) => row.id}
      failed={failed}
      empty={
        filtered ? (
          <EmptyState
            title={COPY.adminContact.noResults.title}
            description={COPY.adminContact.noResults.body}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/contact-messages">{COPY.adminCommon.search.clear}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={COPY.adminContact.empty.title}
            description={COPY.adminContact.empty.body}
          />
        )
      }
    />
  );
}

function href(query: ContactMessageListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (page > 1) params.set('page', String(page));
  if (query.perPage !== 20) params.set('perPage', String(query.perPage));
  const value = params.toString();
  return value ? `/admin/contact-messages?${value}` : '/admin/contact-messages';
}

export function ContactMessagePagination({
  result,
  query,
}: {
  result: { total: number; page: number; perPage: number; pageCount: number };
  query: ContactMessageListQuery;
}) {
  if (result.total === 0) return null;
  const from = (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);
  return (
    <nav
      aria-label={COPY.adminCommon.pagination.label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-ink-700 text-sm">
        {COPY.adminCommon.pagination.rangeSummary
          .replace('{from}', formatNumber(from))
          .replace('{to}', formatNumber(to))
          .replace('{total}', formatNumber(result.total))}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-ink-700 text-sm">
          {COPY.adminCommon.pagination.pageOfTotal
            .replace('{current}', formatNumber(result.page))
            .replace('{total}', formatNumber(result.pageCount))}
        </span>
        {result.page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(query, result.page - 1)}>{COPY.adminCommon.pagination.previous}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {COPY.adminCommon.pagination.previous}
          </Button>
        )}
        {result.page < result.pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(query, result.page + 1)}>{COPY.adminCommon.pagination.next}</Link>
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
