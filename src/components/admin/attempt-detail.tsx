import Link from 'next/link';

import { AttemptModeBadge, AttemptStatusBadge } from '@/components/admin/attempt-list';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DetailPanel, type DetailItem } from '@/components/admin/detail-panel';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import {
  formatDateTime,
  formatDuration,
  formatDurationWords,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import type {
  AdminAttemptDetail,
  AdminAttemptQuestionRow,
  AdminAttemptSectionRow,
  AttemptBreakdownRow,
} from '@/services/exams/attempt-admin.service';

/**
 * The attempt record: what was generated, what the student did with it, and how
 * it ended.
 *
 * A Server Component with no client JavaScript, because there is nothing here to
 * interact with. That is not an oversight — it is the screen's whole position.
 * There is no control that extends a clock, corrects an answer, re-marks a
 * question or reopens a locked section, and the notices say so rather than
 * leaving an administrator hunting for one. An attempt is evidence of what a
 * student was shown; an attempt somebody can edit is evidence of nothing.
 *
 * Two further rules govern what it prints:
 *
 *  - **Every question, option and answer comes from the attempt's snapshot.** The
 *    service never reads the live `Question`, so an item edited or retired since
 *    still appears exactly as it was delivered.
 *  - **The numbers are counts of this attempt and nothing more.** No band, no
 *    percentile, no prediction. The disclaimer frozen into the attempt is
 *    rendered beside the totals, so the administrator reads the same sentence the
 *    student did before repeating anything to a parent on the phone.
 */

const ATTEMPTS = COPY.adminAttempts;

const OUTCOME_LABELS: Record<AdminAttemptQuestionRow['outcome'], string> = {
  CORRECT: ATTEMPTS.questions.correct,
  INCORRECT: ATTEMPTS.questions.incorrect,
  UNANSWERED: ATTEMPTS.questions.noAnswer,
  NOT_GRADED: ATTEMPTS.questions.notGraded,
};

/**
 * `NOT_GRADED` is deliberately not an error colour. It means the attempt has not
 * been finalised yet, which is an ordinary state for a paper somebody is still
 * sitting rather than a fault in the answer.
 */
const OUTCOME_VARIANTS: Record<
  AdminAttemptQuestionRow['outcome'],
  'success' | 'error' | 'neutral' | 'outline'
> = {
  CORRECT: 'success',
  INCORRECT: 'error',
  UNANSWERED: 'neutral',
  NOT_GRADED: 'outline',
};

function dateOrNothing(value: Date | string | null): string | null {
  return value ? formatDateTime(value) : null;
}

// ── Per-section table ────────────────────────────────────────────────────

const sectionColumns: readonly DataTableColumn<AdminAttemptSectionRow>[] = [
  {
    key: 'position',
    header: ATTEMPTS.attemptSections.columns.position,
    align: 'end',
    cell: (row) => formatNumber(row.position),
  },
  {
    key: 'title',
    header: ATTEMPTS.attemptSections.columns.title,
    isRowHeader: true,
    // The title frozen into the attempt, not the section's title today.
    cell: (row) => row.title,
  },
  {
    key: 'status',
    header: ATTEMPTS.attemptSections.columns.status,
    cell: (row) => ATTEMPTS.sectionStatusLabels[row.status],
  },
  {
    key: 'allowed',
    header: ATTEMPTS.attemptSections.columns.allowed,
    cell: (row) =>
      row.allowedSec === null ? COPY.common.notAvailable : formatDurationWords(row.allowedSec),
  },
  {
    key: 'elapsed',
    header: ATTEMPTS.attemptSections.columns.elapsed,
    // Derived from the section's own timestamps, so a section that expired while
    // the student was offline reports the time it was open rather than the time
    // they were present for. Null while it is still open.
    cell: (row) =>
      row.elapsedSec === null ? COPY.common.notAvailable : formatDurationWords(row.elapsedSec),
  },
  {
    key: 'startedAt',
    header: ATTEMPTS.attemptSections.columns.startedAt,
    cell: (row) => dateOrNothing(row.startedAt) ?? COPY.common.notAvailable,
  },
  {
    key: 'deadlineAt',
    header: ATTEMPTS.attemptSections.columns.deadlineAt,
    cell: (row) => dateOrNothing(row.deadlineAt) ?? COPY.common.notAvailable,
  },
  {
    key: 'lockedAt',
    header: ATTEMPTS.attemptSections.columns.lockedAt,
    cell: (row) => dateOrNothing(row.lockedAt) ?? COPY.common.notAvailable,
  },
  {
    key: 'lockedReason',
    header: ATTEMPTS.attemptSections.columns.lockedReason,
    // The three reasons answer a support question the status alone cannot: a
    // student who says "أُغلق القسم فجأة" is describing EXPIRED, while ADVANCED
    // means they pressed the button themselves.
    cell: (row) => (row.lockedReason ? ATTEMPTS.lockReasonLabels[row.lockedReason] : '—'),
  },
  {
    key: 'questionCount',
    header: ATTEMPTS.attemptSections.columns.questionCount,
    align: 'end',
    cell: (row) => formatNumber(row.questionCount),
  },
  {
    key: 'answeredCount',
    header: ATTEMPTS.attemptSections.columns.answeredCount,
    align: 'end',
    cell: (row) => formatNumber(row.answeredCount),
  },
];

// ── Per-question table ───────────────────────────────────────────────────

const questionColumns: readonly DataTableColumn<AdminAttemptQuestionRow>[] = [
  {
    key: 'position',
    header: ATTEMPTS.questions.columns.position,
    align: 'end',
    cell: (row) => formatNumber(row.position),
  },
  {
    key: 'stem',
    header: ATTEMPTS.questions.columns.stem,
    isRowHeader: true,
    // The snapshot the student was shown, as plain text. The bank's current
    // wording is one click away and deliberately not what is printed here.
    cell: (row) => <span className="line-clamp-2 max-w-md">{row.stem}</span>,
  },
  {
    key: 'domain',
    header: ATTEMPTS.questions.columns.domain,
    cell: (row) => COPY.adminQuestions.domainLabels[row.domain],
  },
  {
    key: 'subskill',
    header: ATTEMPTS.questions.columns.subskill,
    cell: (row) => row.subskill ?? '—',
  },
  {
    key: 'difficulty',
    header: ATTEMPTS.questions.columns.difficulty,
    cell: (row) => COPY.adminQuestions.difficultyLabels[row.difficulty],
  },
  {
    key: 'questionVersion',
    header: ATTEMPTS.questions.columns.questionVersion,
    align: 'end',
    cell: (row) => formatNumber(row.questionVersion),
  },
  {
    key: 'studentAnswer',
    header: ATTEMPTS.questions.columns.studentAnswer,
    // The option's own text, resolved against the options frozen into the
    // attempt. Printing the stored key would be printing a uuid.
    cell: (row) =>
      row.selectedOptionLabel ?? (
        <span className="text-ink-600">{ATTEMPTS.questions.noAnswer}</span>
      ),
  },
  {
    key: 'correctAnswer',
    header: ATTEMPTS.questions.columns.correctAnswer,
    cell: (row) => row.correctOptionLabel ?? COPY.common.notAvailable,
  },
  {
    key: 'isCorrect',
    header: ATTEMPTS.questions.columns.isCorrect,
    cell: (row) => (
      <Badge variant={OUTCOME_VARIANTS[row.outcome]}>{OUTCOME_LABELS[row.outcome]}</Badge>
    ),
  },
  {
    key: 'flagged',
    header: ATTEMPTS.questions.columns.flagged,
    cell: (row) => (row.flagged ? ATTEMPTS.questions.flaggedYes : ATTEMPTS.questions.flaggedNo),
  },
  {
    key: 'timeSpent',
    header: ATTEMPTS.questions.columns.timeSpent,
    align: 'end',
    // Client-reported and server-clamped; indicative rather than authoritative,
    // which is why it is a duration and never a basis for anything.
    cell: (row) => formatDuration(row.timeSpentSeconds),
  },
  {
    key: 'revealedAt',
    header: ATTEMPTS.questions.columns.revealedAt,
    cell: (row) => dateOrNothing(row.revealedAt) ?? '—',
  },
  {
    key: 'openInBank',
    header: ATTEMPTS.questions.openInBank,
    headerHidden: true,
    align: 'end',
    cell: (row) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/questions/${row.questionId}`}>{ATTEMPTS.questions.openInBank}</Link>
      </Button>
    ),
  },
];

// ── Breakdown tables ─────────────────────────────────────────────────────

function breakdownColumns(
  headerLabel: string,
  label: (row: AttemptBreakdownRow) => string,
): readonly DataTableColumn<AttemptBreakdownRow>[] {
  return [
    { key: 'label', header: headerLabel, isRowHeader: true, cell: label },
    {
      key: 'total',
      header: ATTEMPTS.columns.totalQuestions,
      align: 'end',
      cell: (row) => formatNumber(row.total),
    },
    {
      key: 'correct',
      header: ATTEMPTS.columns.correctCount,
      align: 'end',
      cell: (row) => formatNumber(row.correct),
    },
    {
      key: 'incorrect',
      header: ATTEMPTS.columns.incorrectCount,
      align: 'end',
      cell: (row) => formatNumber(row.incorrect),
    },
    {
      key: 'unanswered',
      header: ATTEMPTS.columns.unansweredCount,
      align: 'end',
      cell: (row) => formatNumber(row.unanswered),
    },
    {
      key: 'accuracy',
      header: ATTEMPTS.columns.accuracy,
      align: 'end',
      cell: (row) => formatPercent(row.accuracy),
    },
  ];
}

// ── The record ───────────────────────────────────────────────────────────

export function AttemptDetail({ attempt }: { attempt: AdminAttemptDetail }) {
  const summaryItems: DetailItem[] = [
    { key: 'id', label: ATTEMPTS.fields.id.label, value: attempt.id, dir: 'ltr' },
    {
      key: 'student',
      label: ATTEMPTS.fields.student.label,
      value: attempt.student.name,
      hint: ATTEMPTS.fields.student.hint,
    },
    { key: 'email', label: ATTEMPTS.columns.email, value: attempt.student.email, dir: 'ltr' },
    { key: 'simulator', label: ATTEMPTS.fields.simulator.label, value: attempt.simulator.title },
    {
      key: 'examVersion',
      label: ATTEMPTS.fields.examVersion.label,
      value: formatNumber(attempt.examVersion.versionNumber),
      hint: ATTEMPTS.fields.examVersion.hint,
    },
    {
      key: 'mode',
      label: ATTEMPTS.fields.mode.label,
      value: ATTEMPTS.modeLabels[attempt.mode],
    },
    {
      key: 'status',
      label: ATTEMPTS.fields.status.label,
      value: ATTEMPTS.statusLabels[attempt.status],
      hint: ATTEMPTS.fields.status.hint,
    },
    {
      key: 'startedAt',
      label: ATTEMPTS.fields.startedAt.label,
      value: dateOrNothing(attempt.startedAt),
      hint: ATTEMPTS.fields.startedAt.hint,
    },
    {
      key: 'maxEndAt',
      label: ATTEMPTS.fields.maxEndAt.label,
      value: dateOrNothing(attempt.maxEndAt),
      hint: ATTEMPTS.fields.maxEndAt.hint,
    },
    {
      key: 'submittedAt',
      label: ATTEMPTS.fields.submittedAt.label,
      value: dateOrNothing(attempt.submittedAt),
    },
    {
      key: 'totalQuestions',
      label: ATTEMPTS.fields.totalQuestions.label,
      value: formatNumber(attempt.totalQuestions),
    },
    {
      key: 'correctCount',
      label: ATTEMPTS.fields.correctCount.label,
      // Rendered as an absence rather than a zero before scoring: "٠ صحيحة" is a
      // result, and an attempt that has not been submitted does not have one.
      value:
        attempt.correctCount === null
          ? ATTEMPTS.results.noScore
          : formatNumber(attempt.correctCount),
      hint: ATTEMPTS.fields.correctCount.hint,
    },
    {
      key: 'incorrectCount',
      label: ATTEMPTS.fields.incorrectCount.label,
      value:
        attempt.incorrectCount === null
          ? ATTEMPTS.results.noScore
          : formatNumber(attempt.incorrectCount),
    },
    {
      key: 'unansweredCount',
      label: ATTEMPTS.fields.unansweredCount.label,
      value:
        attempt.unansweredCount === null
          ? ATTEMPTS.results.noScore
          : formatNumber(attempt.unansweredCount),
    },
  ];

  const generationItems: DetailItem[] = [
    {
      key: 'seed',
      label: ATTEMPTS.fields.seed.label,
      value: String(attempt.seed),
      dir: 'ltr',
      hint: ATTEMPTS.fields.seed.hint,
    },
    {
      key: 'isDryRun',
      label: ATTEMPTS.fields.isDryRun.label,
      value: attempt.isDryRun ? COPY.common.yes : COPY.common.no,
      hint: ATTEMPTS.fields.isDryRun.hint,
    },
    {
      key: 'settingsSnapshot',
      label: ATTEMPTS.fields.settingsSnapshot.label,
      // The frozen name, which is the part of the snapshot a record screen can
      // actually use: it is what the student saw, and it does not move when the
      // product is renamed.
      value: attempt.settings.simulatorTitle,
      hint: ATTEMPTS.fields.settingsSnapshot.hint,
    },
    {
      key: 'trainingConfig',
      label: ATTEMPTS.fields.trainingConfig.label,
      value: attempt.hasTrainingConfig ? COPY.common.yes : null,
      hint: ATTEMPTS.fields.trainingConfig.hint,
    },
  ];

  const timePerQuestion =
    attempt.durationSec !== null && attempt.totalQuestions > 0
      ? Math.round(attempt.durationSec / attempt.totalQuestions)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Stated first, and unconditionally. Somebody who arrives looking for a
          way to fix an attempt should learn in the first line that there is not
          one, and why. */}
      <Notice tone="neutral" role="note">
        {ATTEMPTS.notices.readOnly}
      </Notice>

      {attempt.isDryRun ? (
        <Notice tone="neutral" role="note">
          {ATTEMPTS.notices.dryRunExcluded}
        </Notice>
      ) : null}

      {attempt.status === 'IN_PROGRESS' ? (
        <Notice tone="warning" role="note">
          {ATTEMPTS.notices.inProgressNote}
        </Notice>
      ) : null}

      {attempt.status === 'EXPIRED' ? (
        <Notice tone="warning" role="note">
          {ATTEMPTS.notices.expiredNote}
        </Notice>
      ) : null}

      <DetailPanel
        title={ATTEMPTS.sections.summary}
        badges={
          <>
            <AttemptStatusBadge status={attempt.status} />
            <AttemptModeBadge mode={attempt.mode} />
            {attempt.isDryRun ? (
              <Badge variant="outline" shape="square">
                {ATTEMPTS.columns.isDryRun}
              </Badge>
            ) : null}
          </>
        }
        items={summaryItems}
        columns={3}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/students/${attempt.student.id}`}>
                {COPY.adminOrders.actions.viewStudent}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/simulators/${attempt.simulator.id}`}>
                {ATTEMPTS.fields.simulator.label}
              </Link>
            </Button>
          </div>
        }
      />

      <DetailPanel
        title={ATTEMPTS.sections.generation}
        items={generationItems}
        columns={3}
        footer={<p className="text-ink-700 text-sm">{ATTEMPTS.notices.snapshotIsWhatStudentSaw}</p>}
      />

      {/* Results ------------------------------------------------------- */}
      <DetailPanel
        title={ATTEMPTS.results.title}
        items={
          attempt.result
            ? [
                {
                  key: 'accuracy',
                  label: ATTEMPTS.results.accuracyLabel,
                  value: formatPercent(attempt.result.totals.accuracy),
                },
                {
                  key: 'timePerQuestion',
                  label: ATTEMPTS.results.timePerQuestionLabel,
                  value: timePerQuestion === null ? null : formatDuration(timePerQuestion),
                },
              ]
            : []
        }
        columns={2}
      >
        {attempt.result ? (
          <div className="flex flex-col gap-5">
            {/* The stored label, so this screen and the student's own result use
                the same three words for the same thing. */}
            <div>
              <Badge variant="brand">{attempt.result.label}</Badge>
            </div>

            <Notice tone="neutral" role="note">
              {ATTEMPTS.notices.notAnOfficialScore}
            </Notice>

            {/* The disclaimer frozen into the attempt, shown verbatim: it is the
                sentence the student was given with this result, and the record
                is the wrong place to paraphrase it. */}
            {attempt.result.disclaimer ? (
              <Notice tone="neutral" role="note">
                {attempt.result.disclaimer}
              </Notice>
            ) : null}

            <div className="flex flex-col gap-3">
              <h3 className="text-ink-900 text-base font-semibold">
                {ATTEMPTS.results.domainsTitle}
              </h3>
              <DataTable
                caption={`${ATTEMPTS.results.domainsTitle} — ${COPY.adminCommon.table.captionSuffix}`}
                columns={breakdownColumns(
                  ATTEMPTS.questions.columns.domain,
                  (row) => COPY.adminQuestions.domainLabels[row.domain],
                )}
                rows={attempt.result.domains}
                getRowKey={(row) => row.domain}
                empty={
                  <EmptyState
                    title={ATTEMPTS.questions.empty.nothingYetTitle}
                    description={ATTEMPTS.questions.empty.nothingYetBody}
                  />
                }
              />
            </div>

            {attempt.result.subskills.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-ink-900 text-base font-semibold">
                  {ATTEMPTS.results.subskillsTitle}
                </h3>
                <DataTable
                  caption={`${ATTEMPTS.results.subskillsTitle} — ${COPY.adminCommon.table.captionSuffix}`}
                  columns={breakdownColumns(
                    ATTEMPTS.questions.columns.subskill,
                    (row) => row.subskill ?? '—',
                  )}
                  rows={attempt.result.subskills}
                  getRowKey={(row) => `${row.domain}::${row.subskill ?? ''}`}
                  empty={
                    <EmptyState
                      title={ATTEMPTS.questions.empty.nothingYetTitle}
                      description={ATTEMPTS.questions.empty.nothingYetBody}
                    />
                  }
                />
              </div>
            ) : null}
          </div>
        ) : (
          // Not an error and not a zero: the numbers are computed at submission
          // or at expiry, and there is no partial result before that.
          <EmptyState
            title={ATTEMPTS.results.pendingTitle}
            description={ATTEMPTS.results.pendingBody}
          />
        )}
      </DetailPanel>

      {/* Sections ------------------------------------------------------ */}
      <DetailPanel
        title={ATTEMPTS.attemptSections.title}
        description={ATTEMPTS.attemptSections.description}
        items={[]}
        footer={<p className="text-ink-700 text-sm">{ATTEMPTS.attemptSections.deadlineNote}</p>}
      >
        <DataTable
          caption={`${ATTEMPTS.attemptSections.title} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={sectionColumns}
          rows={attempt.sections}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={ATTEMPTS.attemptSections.empty.nothingYetTitle}
              description={ATTEMPTS.attemptSections.empty.nothingYetBody}
            />
          }
        />
      </DetailPanel>

      {/* Questions ----------------------------------------------------- */}
      <DetailPanel
        title={ATTEMPTS.questions.title}
        description={ATTEMPTS.questions.description}
        items={[]}
      >
        {attempt.sections.length === 0 ? (
          <EmptyState
            title={ATTEMPTS.questions.empty.nothingYetTitle}
            description={ATTEMPTS.questions.empty.nothingYetBody}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* One table per section rather than one flat list: `position` is
                unique within a section, so a single table would show the same
                number several times and read as a duplicate. */}
            {attempt.sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-3">
                <h3 className="text-ink-900 text-base font-semibold">
                  {formatNumber(section.position)} — {section.title}
                </h3>
                <DataTable
                  caption={`${section.title} — ${COPY.adminCommon.table.captionSuffix}`}
                  columns={questionColumns}
                  rows={section.questions}
                  getRowKey={(row) => row.id}
                  empty={
                    <EmptyState
                      title={ATTEMPTS.questions.empty.nothingYetTitle}
                      description={ATTEMPTS.questions.empty.nothingYetBody}
                    />
                  }
                />
              </div>
            ))}
          </div>
        )}
      </DetailPanel>

      <Notice tone="neutral" role="note">
        {ATTEMPTS.notices.supportNote}
      </Notice>
    </div>
  );
}
