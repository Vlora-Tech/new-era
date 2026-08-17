import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { QuestionForm, QuestionWorkflowPanel } from '@/components/admin/question-form';
import { QuestionWorkflowBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card, ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatNumber } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  getQuestionDetail,
  listStimulusOptions,
  type QuestionDetail,
} from '@/services/questions/question-admin.service';

export const metadata: Metadata = { title: COPY.adminQuestions.editTitle };

/** One labelled fact in the summary strip. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-panel border-line-200 bg-surface-muted border px-4 py-3">
      <dt className="text-ink-700 text-sm">{label}</dt>
      <dd className="text-ink-900 mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * The question editor.
 *
 * The form edits the draft; the panel beside it moves the question through
 * review and publication. They are separate endpoints on purpose — an edit can
 * never publish, and a publication never silently saves unreviewed text.
 */
export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;

  let question: QuestionDetail | null = null;
  let missing = false;

  try {
    question = await getQuestionDetail(questionId);
  } catch (error) {
    // A question that does not exist is a 404 page, not an error panel: nothing
    // went wrong with the platform, the address is simply not a question.
    if (error instanceof HttpError && error.status === 404) {
      missing = true;
    } else {
      logger.error('admin question detail failed', { error, questionId });
    }
  }

  // Outside the `catch`, because `notFound()` works by throwing and would
  // otherwise be swallowed by the handler that called it.
  if (missing) notFound();

  let stimuli: Awaited<ReturnType<typeof listStimulusOptions>> | null = null;
  if (question) {
    try {
      stimuli = await listStimulusOptions();
    } catch (error) {
      logger.error('admin question stimulus options failed', { error });
    }
  }

  // Reachable only when a query threw — the missing case has already redirected.
  // An editor is shown the failure rather than a form whose stimulus list would
  // silently claim no passages exist.
  if (!question || !stimuli) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead
          title={COPY.adminQuestions.editTitle}
          description={COPY.adminQuestions.editDescription}
        />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminQuestions.editTitle}
        description={COPY.adminQuestions.editDescription}
        action={
          <Button asChild variant="ghost">
            <Link href="/admin/questions">{COPY.adminCommon.actions.backToList}</Link>
          </Button>
        }
      />

      <Card className="p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label={COPY.adminCommon.table.status}>
            <QuestionWorkflowBadge workflow={question.workflow} />
          </Fact>
          <Fact label={COPY.adminQuestions.columns.version}>
            {question.currentVersion > 0
              ? formatNumber(question.currentVersion)
              : COPY.common.notAvailable}
          </Fact>
          <Fact label={COPY.adminCommon.table.createdBy}>
            {question.createdByName ?? COPY.common.notAvailable}
          </Fact>
          <Fact label={COPY.adminCommon.table.updatedAt}>{formatDateTime(question.updatedAt)}</Fact>
        </dl>

        {question.reviewNote ? (
          <div className="border-line-200 mt-4 border-t pt-4">
            <p className="text-ink-700 text-sm">{COPY.adminQuestions.fields.reviewNote.label}</p>
            <p className="text-ink-900 mt-1 max-w-prose text-sm">{question.reviewNote}</p>
            {question.reviewedByName && question.reviewedAt ? (
              <p className="text-ink-600 mt-1 text-sm">
                {question.reviewedByName} — {formatDateTime(question.reviewedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <QuestionWorkflowPanel
        questionId={question.id}
        workflow={question.workflow}
        deleteBlock={question.deleteBlock}
      />

      <QuestionForm
        mode="edit"
        questionId={question.id}
        workflow={question.workflow}
        stimuli={stimuli}
        initial={{
          stem: question.stem,
          options: question.options.map((option) => ({
            content: option.content,
            isCorrect: option.isCorrect,
          })),
          domain: question.domain,
          difficulty: question.difficulty,
          track: question.track,
          subskill: question.subskill,
          explanation: question.explanation,
          hint: question.hint,
          tags: question.tags,
          estimatedSeconds: question.estimatedSeconds,
          shuffleOptions: question.shuffleOptions,
          stimulusId: question.stimulusId,
          authorOrLicensor: question.authorOrLicensor,
          provenanceNote: question.provenanceNote,
          rightsDeclaration: question.rightsDeclaration,
        }}
      />
    </div>
  );
}
