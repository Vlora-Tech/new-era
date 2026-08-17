import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { QuestionWorkflowBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Label, Select } from '@/components/ui/field';
import { Card, EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatNumber } from '@/lib/format';
import type {
  QuestionListItem,
  QuestionListResult,
} from '@/services/questions/question-admin.service';
import type { QuestionListQuery } from '@/validators/admin-question';

/**
 * The question bank list: filters, table, pagination.
 *
 * A Server Component with no client JavaScript at all. The filters are a plain
 * `GET` form pointed at this same route, so the current view is a URL — it can be
 * bookmarked, shared with a reviewer, and reloaded after a publish without the
 * screen forgetting what was being looked at. A controlled client filter panel
 * would have cost a bundle and taken that away.
 *
 * Filtering and paging happen in PostgreSQL, not here. 264 rows today; the query
 * has to stay the same shape at ten thousand.
 */

const DOMAINS = Object.keys(COPY.adminQuestions.domainLabels) as Array<
  keyof typeof COPY.adminQuestions.domainLabels
>;
const DIFFICULTIES = Object.keys(COPY.adminQuestions.difficultyLabels) as Array<
  keyof typeof COPY.adminQuestions.difficultyLabels
>;
const TRACKS = Object.keys(COPY.adminQuestions.trackLabels) as Array<
  keyof typeof COPY.adminQuestions.trackLabels
>;
const WORKFLOWS = Object.keys(COPY.adminQuestions.workflowLabels) as Array<
  keyof typeof COPY.adminQuestions.workflowLabels
>;

/** Rebuild the current query string with one value replaced, for the pager. */
function hrefWith(query: QuestionListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.domain) params.set('domain', query.domain);
  if (query.difficulty) params.set('difficulty', query.difficulty);
  if (query.track) params.set('track', query.track);
  if (query.workflow) params.set('workflow', query.workflow);
  if (query.perPage !== 25) params.set('perPage', String(query.perPage));
  if (page > 1) params.set('page', String(page));

  const search = params.toString();
  return search ? `/admin/questions?${search}` : '/admin/questions';
}

function activeFilterCount(query: QuestionListQuery): number {
  return [query.q, query.domain, query.difficulty, query.track, query.workflow].filter(Boolean)
    .length;
}

function FilterPanel({ query }: { query: QuestionListQuery }) {
  const active = activeFilterCount(query);

  return (
    <Card className="p-4 sm:p-5">
      <form method="get" action="/admin/questions" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field className="lg:col-span-3">
            <Label htmlFor="filter-q">{COPY.adminCommon.search.label}</Label>
            <Input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={query.q ?? ''}
              placeholder={COPY.adminQuestions.filters.searchPlaceholder}
            />
          </Field>

          <Field>
            <Label htmlFor="filter-domain">{COPY.adminQuestions.filters.domain}</Label>
            <Select id="filter-domain" name="domain" defaultValue={query.domain ?? ''}>
              <option value="">{COPY.adminCommon.filter.all}</option>
              {DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {COPY.adminQuestions.domainLabels[domain]}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="filter-difficulty">{COPY.adminQuestions.filters.difficulty}</Label>
            <Select id="filter-difficulty" name="difficulty" defaultValue={query.difficulty ?? ''}>
              <option value="">{COPY.adminCommon.filter.all}</option>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {COPY.adminQuestions.difficultyLabels[difficulty]}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="filter-track">{COPY.adminQuestions.filters.track}</Label>
            <Select id="filter-track" name="track" defaultValue={query.track ?? ''}>
              <option value="">{COPY.adminCommon.filter.all}</option>
              {TRACKS.map((track) => (
                <option key={track} value={track}>
                  {COPY.adminQuestions.trackLabels[track]}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="filter-workflow">{COPY.adminQuestions.filters.workflow}</Label>
            <Select id="filter-workflow" name="workflow" defaultValue={query.workflow ?? ''}>
              <option value="">{COPY.adminCommon.filter.all}</option>
              {WORKFLOWS.map((workflow) => (
                <option key={workflow} value={workflow}>
                  {COPY.adminQuestions.workflowLabels[workflow]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary">
            {COPY.adminCommon.filter.apply}
          </Button>
          {active > 0 ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/admin/questions">{COPY.adminCommon.filter.clear}</Link>
              </Button>
              <p className="text-ink-700 text-sm">
                {COPY.adminCommon.filter.activeCount.replace('{count}', formatNumber(active))}
              </p>
            </>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

/**
 * Page links.
 *
 * Rendered as links rather than buttons because each page genuinely is a
 * different address; that is also what makes the browser's back button behave.
 * The range summary is stated in full — "٢٦–٥٠ من ٢٦٤" — so a reader never has
 * to infer how much of the bank they are looking at.
 */
function Pagination({ query, result }: { query: QuestionListQuery; result: QuestionListResult }) {
  if (result.pageCount <= 1) return null;

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

      <div className="flex flex-wrap items-center gap-2">
        {result.page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWith(query, result.page - 1)} rel="prev">
              {COPY.adminCommon.pagination.previous}
            </Link>
          </Button>
        ) : null}

        <p className="text-ink-700 px-2 text-sm">
          {COPY.adminCommon.pagination.pageOfTotal
            .replace('{current}', formatNumber(result.page))
            .replace('{total}', formatNumber(result.pageCount))}
        </p>

        {result.page < result.pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWith(query, result.page + 1)} rel="next">
              {COPY.adminCommon.pagination.next}
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

const COLUMNS: readonly DataTableColumn<QuestionListItem>[] = [
  {
    key: 'stem',
    header: COPY.adminQuestions.columns.stem,
    isRowHeader: true,
    className: 'min-w-[22rem]',
    cell: (row) => (
      <Link href={`/admin/questions/${row.id}`} className="text-brand-700 hover:underline">
        {row.stemExcerpt}
      </Link>
    ),
  },
  {
    key: 'domain',
    header: COPY.adminQuestions.columns.domain,
    cell: (row) => COPY.adminQuestions.domainLabels[row.domain],
  },
  {
    key: 'difficulty',
    header: COPY.adminQuestions.columns.difficulty,
    cell: (row) => COPY.adminQuestions.difficultyLabels[row.difficulty],
  },
  {
    key: 'track',
    header: COPY.adminQuestions.columns.track,
    cell: (row) => COPY.adminQuestions.trackLabels[row.track],
  },
  {
    key: 'workflow',
    header: COPY.adminQuestions.columns.workflow,
    cell: (row) => <QuestionWorkflowBadge workflow={row.workflow} />,
  },
  {
    key: 'version',
    header: COPY.adminQuestions.columns.version,
    // Zero means no frozen version exists, which is not the number zero — it is
    // "nothing is being served". Printing `٠` would read as a version.
    cell: (row) =>
      row.currentVersion > 0 ? formatNumber(row.currentVersion) : COPY.common.notAvailable,
  },
  {
    key: 'author',
    header: COPY.adminQuestions.columns.author,
    cell: (row) => row.authorOrLicensor,
  },
  {
    key: 'updatedAt',
    header: COPY.adminQuestions.columns.updatedAt,
    className: 'whitespace-nowrap',
    cell: (row) => formatDateTime(row.updatedAt),
  },
  {
    key: 'actions',
    header: COPY.adminQuestions.columns.actions,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/questions/${row.id}`}>{COPY.adminCommon.actions.edit}</Link>
      </Button>
    ),
  },
];

export function QuestionList({
  query,
  result,
}: {
  query: QuestionListQuery;
  /** `null` means the query threw. It is never rendered as an empty bank. */
  result: QuestionListResult | null;
}) {
  const filtered = activeFilterCount(query) > 0;

  return (
    <div className="flex flex-col gap-5">
      <FilterPanel query={query} />

      {query.q ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <DataTable
        caption={`${COPY.adminQuestions.listTitle} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={COLUMNS}
        rows={result?.items ?? []}
        getRowKey={(row) => row.id}
        failed={result === null}
        // The two absences are different facts and get different words: an empty
        // bank invites the first question, a filter that matched nothing invites
        // widening it. A failed query is neither, and is handled by `failed`.
        empty={
          filtered ? (
            <EmptyState
              title={COPY.adminCommon.emptiness.noResultsTitle}
              description={COPY.adminCommon.emptiness.noResultsBody}
              action={
                <Button asChild variant="outline">
                  <Link href="/admin/questions">{COPY.adminCommon.emptiness.noResultsAction}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={COPY.adminQuestions.empty.nothingYetTitle}
              description={COPY.adminQuestions.empty.nothingYetBody}
              action={
                <Button asChild>
                  <Link href="/admin/questions/new">
                    {COPY.adminQuestions.empty.nothingYetAction}
                  </Link>
                </Button>
              }
            />
          )
        }
      />

      {result ? <Pagination query={query} result={result} /> : null}
    </div>
  );
}
