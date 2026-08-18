import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  isStudentQueryFiltered,
  StudentFilters,
  StudentList,
  StudentPagination,
} from '@/components/admin/student-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listStudents, type AdminStudentPage } from '@/services/students/student-admin.service';
import { studentListQuerySchema } from '@/validators/admin-student';

export const metadata: Metadata = { title: COPY.admin.students };

/**
 * The accounts list.
 *
 * Filtering, searching and paging all happen in SQL and travel in the URL, so a
 * narrowed view is a real address that survives a reload. That is the ordinary
 * argument for server-side filtering; here there is a stronger one. These rows
 * hold the names, addresses and phone numbers of students, many of whom are
 * minors. A client-side filter would mean sending every one of those to the
 * browser in order to display twenty-five, which is not a page-weight question.
 *
 * The query is wrapped in try/catch and the result kept nullable. A thrown query
 * renders `ErrorState` through the table's `failed` prop; it must never render an
 * empty table, because "لا توجد حسابات بعد" is a claim about the business that a
 * database outage is not entitled to make.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // A repeated parameter (`?state=active&state=blocked`) arrives as an array.
  // The first value wins rather than the request being rejected: this is a
  // browsing surface, and every field in the schema already `.catch()`es.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const query = studentListQuerySchema.parse(flat);

  let result: AdminStudentPage | null = null;
  try {
    result = await listStudents(query);
  } catch (error) {
    logger.error('admin student list failed', { error });
  }

  const filtered = isStudentQueryFiltered(query);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminStudents.listTitle}
        description={COPY.adminStudents.listDescription}
      />

      {/* The two things this screen deliberately cannot do, said once at the
          top rather than discovered one missing button at a time. */}
      <Notice tone="neutral" role="note">
        {COPY.adminStudents.notices.readOnlyAccount} {COPY.adminStudents.notices.noPasswordTools}
      </Notice>

      <StudentFilters query={query} />

      {/* Stated plainly whenever the list is narrowed, so a filtered result is
          never read as the whole roll. */}
      {filtered && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}

      <StudentList rows={result?.rows ?? []} failed={result === null} filtered={filtered} />

      {result ? <StudentPagination result={result} query={query} /> : null}
    </div>
  );
}
