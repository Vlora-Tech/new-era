import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { AttemptDetail } from '@/components/admin/attempt-detail';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  getAttemptForAdmin,
  parseAttemptId,
  type AdminAttemptDetail,
} from '@/services/exams/attempt-admin.service';

export const metadata: Metadata = { title: COPY.adminAttempts.detailTitle };

/**
 * One attempt: the diagnostic screen.
 *
 * Three outcomes, kept apart:
 *
 *  - no such attempt, or a path segment that is not an id — `notFound()`;
 *  - the query threw — `ErrorState`, never a half-drawn record. Every number on
 *    this page comes from the one read; a page that rendered "٠ إجابات صحيحة"
 *    after a failed read would be describing a student's exam;
 *  - it loaded — the record.
 */
export default async function AdminAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  let attempt: AdminAttemptDetail | null = null;
  let failed = false;
  try {
    attempt = await getAttemptForAdmin(parseAttemptId(attemptId));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin attempt load failed', { attemptId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminAttempts.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/attempts">{COPY.adminAttempts.backToList}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!attempt) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={attempt.simulator.title}
        description={COPY.adminAttempts.detailDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/attempts">{COPY.adminAttempts.backToList}</Link>
          </Button>
        }
      />

      <AttemptDetail attempt={attempt} />
    </div>
  );
}
