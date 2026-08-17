import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { QuestionList } from '@/components/admin/question-list';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  listQuestions,
  type QuestionListResult,
} from '@/services/questions/question-admin.service';
import { questionListQuerySchema } from '@/validators/admin-question';

export const metadata: Metadata = { title: COPY.admin.questionBank };

/**
 * The question bank.
 *
 * Filters, search and paging live in the URL and are resolved in PostgreSQL. The
 * schema behind `questionListQuerySchema` `.catch()`es every field, so a
 * hand-edited or stale query string degrades to the default view rather than
 * throwing at somebody who only followed a link.
 */
export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = questionListQuerySchema.parse(await searchParams);

  // A thrown query becomes an error panel, never an empty table. A bank drawn
  // with no rows because the database was unreachable reads as "there are no
  // questions", which is how somebody ends up believing the platform is empty.
  let result: QuestionListResult | null = null;
  try {
    result = await listQuestions(query);
  } catch (error) {
    logger.error('admin question list failed', { error });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminQuestions.listTitle}
        description={COPY.adminQuestions.listDescription}
        action={
          <Button asChild>
            <Link href="/admin/questions/new">{COPY.adminQuestions.createAction}</Link>
          </Button>
        }
      />

      <QuestionList query={query} result={result} />
    </div>
  );
}
