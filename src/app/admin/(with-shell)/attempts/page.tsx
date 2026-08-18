import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  AttemptFilters,
  AttemptList,
  AttemptPagination,
  isAttemptQueryFiltered,
} from '@/components/admin/attempt-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  listAttemptFilterOptions,
  listAttempts,
  type AdminAttemptPage,
  type AttemptFilterOptions,
} from '@/services/exams/attempt-admin.service';
import { attemptListQuerySchema } from '@/validators/admin-attempt';

export const metadata: Metadata = { title: COPY.admin.attempts };

/** Nothing to choose from is a working filter bar, not a broken one. */
const NO_FILTER_OPTIONS: AttemptFilterOptions = { simulators: [], versions: [] };

/**
 * The attempts list.
 *
 * Everything is filtered and paged in SQL and carried in the URL. That is not
 * only a usability preference here: attempts will outnumber every other record
 * in the system, so a screen that dumped the table and filtered in the browser
 * would stop working at exactly the point the platform started succeeding.
 *
 * The two reads are caught separately. A failed *list* is `ErrorState` through
 * the table — never an empty table, because "لا توجد محاولات بعد" is a claim
 * about students, not about the database. A failed *filter-options* read is
 * softer: the list is still legible without a dropdown of simulators, so the bar
 * renders with empty selects rather than taking the page down with it.
 */
export default async function AdminAttemptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = attemptListQuerySchema.parse(flat);

  let result: AdminAttemptPage | null = null;
  try {
    result = await listAttempts(query);
  } catch (error) {
    logger.error('admin attempt list failed', { error });
  }

  let options: AttemptFilterOptions = NO_FILTER_OPTIONS;
  try {
    options = await listAttemptFilterOptions();
  } catch (error) {
    logger.error('admin attempt filter options failed', { error });
  }

  const filtered = isAttemptQueryFiltered(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminAttempts.listTitle}
        description={COPY.adminAttempts.listDescription}
      />

      {/* The legal position, stated where the numbers are, not only where they
          are broken down. An administrator quoting a figure from this table to a
          parent should have read this sentence first. */}
      <Notice tone="neutral" role="note">
        {COPY.adminAttempts.notices.notAnOfficialScore}
      </Notice>

      <AttemptFilters query={query} options={options} />

      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <AttemptList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <AttemptPagination result={result} query={query} /> : null}
    </div>
  );
}
