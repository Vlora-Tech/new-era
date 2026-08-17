import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { QuestionForm } from '@/components/admin/question-form';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listStimulusOptions } from '@/services/questions/question-admin.service';

export const metadata: Metadata = { title: COPY.adminQuestions.createTitle };

/**
 * Add a question.
 *
 * It is created as a draft and cannot be anything else: `createQuestionSchema`
 * has no `workflow` field, so nothing the browser sends can put an unreviewed
 * item in front of a student.
 */
export default async function NewQuestionPage() {
  // The stimulus picker is the only thing on this screen that needs data. If it
  // cannot be loaded the form is not shown at all: rendering it with an empty
  // list would look exactly like "no passages exist", and an editor would attach
  // nothing to a reading-comprehension item without ever knowing why.
  let stimuli: Awaited<ReturnType<typeof listStimulusOptions>> | null = null;
  try {
    stimuli = await listStimulusOptions();
  } catch (error) {
    logger.error('admin question stimulus options failed', { error });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminQuestions.createTitle}
        description={COPY.adminQuestions.createDescription}
        action={
          <Button asChild variant="ghost">
            <Link href="/admin/questions">{COPY.adminCommon.actions.backToList}</Link>
          </Button>
        }
      />

      {stimuli ? <QuestionForm mode="create" stimuli={stimuli} /> : <ErrorState />}
    </div>
  );
}
