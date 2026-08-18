import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  SimulatorFilters,
  SimulatorList,
  SimulatorPagination,
} from '@/components/admin/simulator-list';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listSimulators, type AdminSimulatorPage } from '@/services/exams/simulator-admin.service';
import { simulatorListQuerySchema } from '@/validators/admin-simulator';

export const metadata: Metadata = { title: COPY.admin.simulators };

/**
 * The simulators list.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL, so a
 * narrowed view is a real address that can be reloaded, bookmarked and sent to a
 * colleague.
 *
 * The query is wrapped in try/catch and the result kept nullable. A thrown query
 * renders `ErrorState` through the table's `failed` prop; it must never render
 * an empty table, because "لا توجد محاكيات" is a claim about the catalogue that
 * a database outage is not entitled to make.
 */
export default async function AdminSimulatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter arrives as an array. The first value wins rather than
  // the request being rejected: this is a browsing surface, and every field in
  // the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = simulatorListQuerySchema.parse(flat);

  let result: AdminSimulatorPage | null = null;
  try {
    result = await listSimulators(query);
  } catch (error) {
    logger.error('admin simulator list failed', { error });
  }

  const filtered =
    Boolean(query.q) ||
    query.track !== undefined ||
    query.versionStatus !== undefined ||
    query.hasActiveVersion !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminSimulators.listTitle}
        description={COPY.adminSimulators.listDescription}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/products">{COPY.adminSimulators.goToProducts}</Link>
          </Button>
        }
      />

      {/* Said before the administrator looks for a create button that is not
          there: a simulator is the exam half of a product and cannot exist
          without one. */}
      <Notice tone="neutral" role="note">
        {COPY.adminSimulators.listNote}
      </Notice>

      <SimulatorFilters query={query} />

      {/* Stated plainly whenever the list is narrowed, so a filtered result is
          never read as the whole catalogue. */}
      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <SimulatorList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <SimulatorPagination result={result} query={query} /> : null}
    </div>
  );
}
