import Link from 'next/link';
import { Check, Minus, X } from 'lucide-react';

import { RichTextView } from '@/components/exam/question-content';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/surface';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { formatDuration, formatNumber, formatPercent } from '@/lib/format';
import type { AttemptResultSummary, ReviewSection } from '@/services/exams/attempt-scoring.service';
import { cn } from '@/lib/utils';

/**
 * The training review.
 *
 * Presented as description, never as assessment. There is no overall grade, no
 * band, no comparison with other students and no projection onto the official
 * test — the page reports counts, per-skill accuracy and how long each section
 * actually ran, and says plainly that this is what it is.
 *
 * The `نتيجة تدريبية` label sits at the top, before any number, so a screenshot
 * of this page cannot circulate as though it were a score report.
 */
export function ExamResults({
  simulatorTitle,
  summary,
  sections,
  totals,
  resultDisclaimer,
}: {
  simulatorTitle: string;
  summary: AttemptResultSummary | null;
  sections: ReviewSection[];
  totals: {
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
  };
  resultDisclaimer: string;
}) {
  const accuracy = totals.total === 0 ? 0 : totals.correct / totals.total;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="brand">{COPY.legal.trainingResultLabel}</Badge>
          {summary ? (
            <Badge variant="neutral">
              {summary.finalisedBy === 'EXPIRED'
                ? COPY.exam.finalisedByExpired
                : COPY.exam.finalisedBySubmitted}
            </Badge>
          ) : null}
        </div>
        <p className="text-brand-700 text-sm font-medium">{simulatorTitle}</p>
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.exam.resultsTitle}
        </h1>
        <p className="text-ink-700">{COPY.exam.resultsSubtitle}</p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label={COPY.exam.correctCount} value={formatNumber(totals.correct)} />
        <Stat label={COPY.exam.incorrectCount} value={formatNumber(totals.incorrect)} />
        <Stat label={COPY.exam.unansweredCount} value={formatNumber(totals.unanswered)} />
        <Stat label={COPY.exam.totalCount} value={formatNumber(totals.total)} />
      </dl>

      <Card className="flex flex-col gap-2 p-5">
        <p className="text-ink-600 text-sm">{COPY.exam.accuracyLabel}</p>
        <p className="text-ink-900 text-2xl font-semibold">{formatPercent(accuracy)}</p>
        <p className="text-ink-700 text-sm leading-relaxed">{COPY.exam.notAnOfficialScore}</p>
      </Card>

      {summary && summary.domains.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.domainsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.domains.map((domain) => (
              <li
                key={domain.domain}
                className="rounded-control border-line-200 flex flex-wrap items-baseline justify-between gap-2 border px-4 py-3"
              >
                <span className="text-ink-900 font-medium">{DOMAIN_LABELS[domain.domain]}</span>
                <span className="text-ink-700 text-sm">
                  {formatNumber(domain.correct)} / {formatNumber(domain.total)} ·{' '}
                  {formatPercent(domain.accuracy)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary && summary.subskills.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.subskillsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.subskills.map((subskill) => (
              <li
                key={`${subskill.domain}-${subskill.subskill}`}
                className="rounded-control border-line-200 flex flex-wrap items-baseline justify-between gap-2 border px-4 py-3"
              >
                <span className="text-ink-900">{subskill.subskill}</span>
                <span className="text-ink-700 text-sm">
                  {formatNumber(subskill.correct)} / {formatNumber(subskill.total)} ·{' '}
                  {formatPercent(subskill.accuracy)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary && summary.sections.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.sectionsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.sections.map((section) => (
              <li
                key={section.attemptSectionId}
                className="rounded-control border-line-200 flex flex-wrap items-baseline justify-between gap-2 border px-4 py-3"
              >
                <span className="text-ink-900 font-medium">{section.title}</span>
                <span className="text-ink-700 text-sm">
                  {COPY.exam.sectionElapsed}:{' '}
                  <bdi>
                    <span dir="ltr">
                      {section.elapsedSec === null ? '—' : formatDuration(section.elapsedSec)}
                    </span>
                  </bdi>{' '}
                  · {COPY.exam.sectionAllowed}:{' '}
                  <bdi>
                    <span dir="ltr">
                      {section.allowedSec === null ? '—' : formatDuration(section.allowedSec)}
                    </span>
                  </bdi>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.reviewTitle}</h2>
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-3">
            <h3 className="text-ink-700 text-sm font-medium">{section.title}</h3>
            {section.questions.map((question) => {
              const chosen = question.options.find(
                (option) => option.key === question.selectedOptionKey,
              );
              const correct = question.options.find(
                (option) => option.key === question.correctOptionKey,
              );

              return (
                <Card key={question.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-2">
                    <ResultMark
                      state={
                        question.selectedOptionKey === null
                          ? 'unanswered'
                          : question.isCorrect
                            ? 'correct'
                            : 'incorrect'
                      }
                    />
                    <span className="text-ink-600 text-sm">{formatNumber(question.position)}</span>
                  </div>

                  <RichTextView document={question.stem} />

                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex flex-col gap-1">
                      <dt className="text-ink-600">{COPY.exam.yourAnswer}</dt>
                      <dd
                        className={cn(
                          'font-medium',
                          question.selectedOptionKey === null
                            ? 'text-ink-600'
                            : question.isCorrect
                              ? 'text-success'
                              : 'text-error',
                        )}
                      >
                        {chosen ? (
                          <RichTextView document={chosen.content} className="gap-1" />
                        ) : (
                          COPY.exam.noAnswer
                        )}
                      </dd>
                    </div>
                    {!question.isCorrect && correct ? (
                      <div className="flex flex-col gap-1">
                        <dt className="text-ink-600">{COPY.exam.correctAnswer}</dt>
                        <dd className="text-success font-medium">
                          <RichTextView document={correct.content} className="gap-1" />
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {question.explanation ? (
                    <div className="rounded-control bg-surface-muted p-3">
                      <p className="text-ink-600 mb-1 text-xs font-medium">
                        {COPY.exam.explanationLabel}
                      </p>
                      <RichTextView document={question.explanation} paragraphClassName="text-sm" />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ))}
      </section>

      <p className="text-ink-600 max-w-prose text-xs leading-relaxed">
        {resultDisclaimer || COPY.legal.independenceDisclaimer}
      </p>

      <div>
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboardAttempts}>{COPY.exam.backToAttempts}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Arabic names for the publicly described skill areas. */
const DOMAIN_LABELS: Record<string, string> = {
  VERBAL_ANALOGY: 'التناظر اللفظي',
  SENTENCE_COMPLETION: 'إكمال الجمل',
  CONTEXTUAL_ERROR: 'الخطأ السياقي',
  READING_COMPREHENSION: 'استيعاب المقروء',
  ARITHMETIC: 'الحساب',
  GEOMETRY: 'الهندسة',
  ALGEBRA: 'الجبر',
  DATA_ANALYSIS: 'تفسير البيانات',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border-line-200 bg-surface flex flex-col gap-1 border px-4 py-3">
      <dt className="text-ink-600 text-sm">{label}</dt>
      <dd className="text-ink-900 text-xl font-semibold">{value}</dd>
    </div>
  );
}

/** Colour is never the only signal: each mark carries its own Arabic label. */
function ResultMark({ state }: { state: 'correct' | 'incorrect' | 'unanswered' }) {
  if (state === 'correct') {
    return (
      <Badge variant="success">
        <Check className="size-3.5" aria-hidden="true" />
        {COPY.exam.correctCount}
      </Badge>
    );
  }
  if (state === 'incorrect') {
    return (
      <Badge variant="error">
        <X className="size-3.5" aria-hidden="true" />
        {COPY.exam.incorrectCount}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <Minus className="size-3.5" aria-hidden="true" />
      {COPY.exam.noAnswer}
    </Badge>
  );
}
