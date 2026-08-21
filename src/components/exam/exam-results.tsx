import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight, Check, ListChecks, Minus, X } from 'lucide-react';

import { RichTextView } from '@/components/exam/question-content';
import { Button } from '@/components/ui/button';
// `ProgressBar` returns with the commented-out skill breakdowns below.
import { ProgressRing } from '@/components/ui/progress';
import { Badge, Card, Notice } from '@/components/ui/surface';
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
 * test — the page reports counts, accuracy and how long each section actually
 * ran, and says plainly that this is what it is.
 *
 * The `نتيجة تدريبية` label sits at the top, before any number, so a screenshot
 * of this page cannot circulate as though it were a score report.
 *
 * The per-skill and per-sub-skill breakdowns are commented out below, with the
 * classification editor in `src/components/admin/question-form.tsx`. A student
 * reviewing an attempt gets the four counts, the accuracy ring, the section
 * times and — question by question — what they answered, what was correct, and
 * why. Two tables of skill percentages on top of that were reading as a
 * diagnostic the platform is careful never to claim to be.
 *
 * `AttemptResultSummary` still carries `domains` and `subskills`: they are
 * computed at submission and frozen into the attempt, so uncommenting the two
 * sections brings them back for attempts already sitting in the database.
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
        <p className="text-brand-700 text-sm font-semibold">{simulatorTitle}</p>
        <h1 className="text-ink-900 text-h2">{COPY.exam.resultsTitle}</h1>
        <p className="text-ink-700 text-lead measure-ar-lg">{COPY.exam.resultsSubtitle}</p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={COPY.exam.correctCount}
          value={formatNumber(totals.correct)}
          tone="success"
          icon={Check}
        />
        <Stat
          label={COPY.exam.incorrectCount}
          value={formatNumber(totals.incorrect)}
          tone="error"
          icon={X}
        />
        <Stat
          label={COPY.exam.unansweredCount}
          value={formatNumber(totals.unanswered)}
          tone="neutral"
          icon={Minus}
        />
        <Stat
          label={COPY.exam.totalCount}
          value={formatNumber(totals.total)}
          tone="brand"
          icon={ListChecks}
        />
      </dl>

      <Card className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-ink-900 text-base font-semibold">{COPY.exam.accuracyLabel}</p>
          <p className="text-ink-700 measure-ar-lg text-sm leading-relaxed">
            {COPY.exam.notAnOfficialScore}
          </p>
        </div>
        {/* The ring draws a ratio the data already carries. Its svg is
            aria-hidden by contract; the numeral inside it is not, so the figure
            is still read once, in words. */}
        <ProgressRing value={accuracy * 100} size={96} strokeWidth={8} className="text-brand-600">
          <span className="text-ink-900 font-display text-lg font-bold tabular-nums">
            {formatPercent(accuracy)}
          </span>
        </ProgressRing>
      </Card>

      {/* Restore with the classification section in `admin/question-form.tsx`.

        Both bars draw a ratio that is already in the payload — nothing here
        computes a figure — and the sub-skill bar is the thinner of the two
        because a sub-skill is a detail of a skill. Their inline notes were
        lifted up here rather than left below: a `*` followed by a `/` inside
        this block would end it early, and half a section would render.

      {summary && summary.domains.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-h3">{COPY.exam.domainsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.domains.map((domain) => (
              <li
                key={domain.domain}
                className="rounded-panel border-line-200 bg-surface flex flex-col gap-2 border px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-900 font-semibold">{DOMAIN_LABELS[domain.domain]}</span>
                  <span className="text-ink-700 text-sm tabular-nums">
                    {formatNumber(domain.correct)} / {formatNumber(domain.total)} ·{' '}
                    {formatPercent(domain.accuracy)}
                  </span>
                </div>
                <ProgressBar value={domain.accuracy * 100} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary && summary.subskills.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-h3">{COPY.exam.subskillsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.subskills.map((subskill) => (
              <li
                key={`${subskill.domain}-${subskill.subskill}`}
                className="rounded-panel border-line-200 bg-surface flex flex-col gap-2 border px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-900">{subskill.subskill}</span>
                  <span className="text-ink-700 text-sm tabular-nums">
                    {formatNumber(subskill.correct)} / {formatNumber(subskill.total)} ·{' '}
                    {formatPercent(subskill.accuracy)}
                  </span>
                </div>
                <ProgressBar value={subskill.accuracy * 100} className="h-1.5" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      */}

      {summary && summary.sections.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-ink-900 text-h3">{COPY.exam.sectionsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {summary.sections.map((section) => (
              <li
                key={section.attemptSectionId}
                className="rounded-panel border-line-200 bg-surface flex flex-wrap items-baseline justify-between gap-2 border px-4 py-3"
              >
                <span className="text-ink-900 font-semibold">{section.title}</span>
                <span className="text-ink-700 text-sm tabular-nums">
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
        <h2 className="text-ink-900 text-h3">{COPY.exam.reviewTitle}</h2>
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-3">
            <h3 className="text-ink-900 border-s-brand-700 border-s-2 ps-3 text-base font-semibold">
              {section.title}
            </h3>
            {section.questions.map((question) => {
              const chosen = question.options.find(
                (option) => option.key === question.selectedOptionKey,
              );
              const correct = question.options.find(
                (option) => option.key === question.correctOptionKey,
              );

              return (
                <Card key={question.id} className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="bg-surface-muted text-ink-700 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
                      {formatNumber(question.position)}
                    </span>
                    <ResultMark
                      state={
                        question.selectedOptionKey === null
                          ? 'unanswered'
                          : question.isCorrect
                            ? 'correct'
                            : 'incorrect'
                      }
                    />
                  </div>

                  <RichTextView document={question.stem} paragraphClassName="font-medium" />

                  {/* The ground states the verdict a second time, after the mark
                      above; the `dt` states it in words, so neither row depends
                      on its colour being seen. */}
                  <dl className="flex flex-col gap-2 text-sm">
                    <div
                      className={cn(
                        'rounded-control flex flex-col gap-1 border p-3',
                        question.selectedOptionKey === null
                          ? 'border-line-200 bg-surface-muted'
                          : question.isCorrect
                            ? 'border-success/25 bg-success-soft'
                            : 'border-error/25 bg-error-soft',
                      )}
                    >
                      <dt className="text-ink-700 font-medium">{COPY.exam.yourAnswer}</dt>
                      <dd className="text-ink-900 font-medium">
                        {chosen ? (
                          <RichTextView document={chosen.content} className="gap-1" />
                        ) : (
                          COPY.exam.noAnswer
                        )}
                      </dd>
                    </div>
                    {!question.isCorrect && correct ? (
                      <div className="rounded-control border-success/25 bg-success-soft flex flex-col gap-1 border p-3">
                        <dt className="text-ink-700 font-medium">{COPY.exam.correctAnswer}</dt>
                        <dd className="text-ink-900 font-medium">
                          <RichTextView document={correct.content} className="gap-1" />
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {question.explanation ? (
                    <div className="rounded-control bg-surface-muted p-4">
                      {/* ink-700, not ink-600: surface-muted is a tinted ground. */}
                      <p className="text-ink-700 mb-1 text-xs font-semibold">
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

      {/* The standing disclosure, in the system's own figure: a ground and an
          inline-start rule. Not an alert — nothing here has gone wrong. */}
      <Notice tone="neutral">{resultDisclaimer || COPY.legal.independenceDisclaimer}</Notice>

      <div>
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboardAttempts}>
            {/* Backwards, so the arrow points right in RTL. */}
            <ArrowRight className="size-4" aria-hidden="true" />
            {COPY.exam.backToAttempts}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* Restore with the skill breakdowns above.
/** Arabic names for the publicly described skill areas. *
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
*/

/**
 * Grounds and glyphs for the four totals. Every tile still carries its Arabic
 * label, so the tone is a second signal and never the only one.
 */
const STAT_TONES = {
  success: { ground: 'border-success/25 bg-success-soft', glyph: 'bg-success' },
  error: { ground: 'border-error/25 bg-error-soft', glyph: 'bg-error' },
  neutral: { ground: 'border-line-200 bg-surface-muted', glyph: 'bg-ink-600' },
  brand: { ground: 'border-brand-700/25 bg-brand-100', glyph: 'bg-brand-600' },
} as const;

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
  icon: ComponentType<{ className?: string }>;
}) {
  const { ground, glyph } = STAT_TONES[tone];
  return (
    <div className={cn('rounded-panel flex flex-col gap-3 border p-4', ground)}>
      {/* A filled square carrying a white GLYPH — never white text. */}
      <span
        aria-hidden="true"
        className={cn('rounded-control flex size-9 items-center justify-center text-white', glyph)}
      >
        <Icon className="size-5" />
      </span>
      {/* ink-700 is the floor on a tinted ground. */}
      <dt className="text-ink-700 text-sm font-medium">{label}</dt>
      <dd className="text-ink-900 text-h3 tabular-nums">{value}</dd>
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
