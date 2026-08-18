import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  AuditLogFilters,
  AuditLogList,
  AuditLogPagination,
  isAuditLogFiltered,
} from '@/components/admin/audit-log-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listAuditLog, type AdminAuditLogPage } from '@/services/audit/audit-query.service';
import { auditLogQuerySchema } from '@/validators/admin-audit';

export const metadata: Metadata = { title: COPY.admin.auditLog };

/**
 * The activity log.
 *
 * Read-only, by design and permanently: every other administration screen writes
 * a row here inside the transaction of the change it makes, and this one shows
 * them. There is no control on this page that edits, deletes or clears a row,
 * and there is no endpoint behind one either — a trail somebody can tidy is not
 * a trail, and the notices at the top say so to the person reading rather than
 * only to the person maintaining the code.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL, so a
 * narrowed view is a real address: reloadable, bookmarkable, and pasteable into
 * a message when one person wants to show another exactly what they found.
 *
 * The query is wrapped in try/catch and the result kept nullable. A thrown query
 * renders `ErrorState` through the table's `failed` prop and must never render
 * an empty table — "لا توجد إجراءات مسجّلة" is a claim that nobody has done
 * anything, which on this screen of all screens a database outage is not
 * entitled to make.
 */
export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter (`?targetType=Order&targetType=Product`) arrives as an
  // array. The first value wins rather than the request being rejected: this is
  // a browsing surface, and every field in the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = auditLogQuerySchema.parse(flat);

  let result: AdminAuditLogPage | null = null;
  try {
    result = await listAuditLog(query);
  } catch (error) {
    logger.error('admin audit log list failed', { error });
  }

  const filtered = isAuditLogFiltered(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminAudit.listTitle}
        description={COPY.adminAudit.listDescription}
      />

      <Notice tone="neutral" role="note" className="flex flex-col gap-1">
        <span className="block">{COPY.adminAudit.notices.appendOnly}</span>
        <span className="block">{COPY.adminAudit.notices.writtenWithChange}</span>
        <span className="block">{COPY.adminAudit.notices.noSecrets}</span>
        <span className="block">{COPY.adminAudit.notices.notEveryRead}</span>
        <span className="block">{COPY.adminAudit.notices.targetMayBeGone}</span>
      </Notice>

      <AuditLogFilters query={query} />

      {/* Stated plainly whenever the list is narrowed, so a filtered view is
          never read as the whole trail. */}
      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <AuditLogList
        rows={result?.rows ?? []}
        query={query}
        failed={result === null}
        filtered={filtered}
      />

      {result ? <AuditLogPagination result={result} query={query} /> : null}
    </div>
  );
}
