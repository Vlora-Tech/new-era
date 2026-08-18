import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { StudentDetail } from '@/components/admin/student-detail';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  getStudentForAdmin,
  parseStudentId,
  type AdminStudentDetail,
} from '@/services/students/student-admin.service';

export const metadata: Metadata = { title: COPY.adminStudents.detailTitle };

/**
 * One account's record.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the account does not exist, or the path segment is not an id at all —
 *    `notFound()`, the honest answer to a bad address;
 *  - the query threw — `ErrorState`, never a record drawn with blanks. A page
 *    that showed "غير موقوف" because a read failed would be an invitation to
 *    press a button on an account whose real state nobody knows;
 *  - the account loaded — the record, its related lists and the audited levers.
 *
 * `DetailPanel` has no `failed` prop for exactly this reason: every field on the
 * screen comes from the one read below, so there is no half-failed state for it
 * to draw, and the decision belongs here.
 */
export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  let student: AdminStudentDetail | null = null;
  let failed = false;
  try {
    student = await getStudentForAdmin(parseStudentId(studentId));
  } catch (error) {
    // The service reports a malformed id as "no such account" rather than as a
    // fault, and that distinction has to survive into the page.
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin student load failed', { studentId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminStudents.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/students">{COPY.adminStudents.backToList}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!student) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={student.name}
        description={COPY.adminStudents.detailDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/students">{COPY.adminStudents.backToList}</Link>
          </Button>
        }
      />

      <StudentDetail student={student} />
    </div>
  );
}
