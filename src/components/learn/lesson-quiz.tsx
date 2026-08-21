'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Minus, X } from 'lucide-react';

import { RichTextView } from '@/components/exam/question-content';
import { Button } from '@/components/ui/button';
import { Badge, Card, Notice, Subhead } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { fillTemplate } from '@/lib/exam/template';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  LessonQuizAttemptView,
  LessonQuizQuestionView,
  LessonQuizView,
  SaveLessonQuizAnswerResult,
} from '@/services/courses/lesson-quiz.service';

/**
 * The short quiz, on the student's side of the lesson.
 *
 * Everything on one page rather than one question at a time. A lesson quiz is a
 * handful of items with no clock; the exam workspace's navigator, flags and
 * per-question paging exist to manage a hundred questions against a deadline,
 * and importing that machinery here would make three questions feel like a
 * sitting.
 *
 * Three rules shape the component:
 *
 *   1. **The server owns every verdict.** Nothing here compares an answer to a
 *      key, because nothing here has one: an option is marked correct only after
 *      the server has said so, either in the reply to that answer (immediate
 *      feedback) or in the submitted attempt. There is no branch that could show
 *      a mark the server did not send.
 *
 *   2. **A settled question is inert.** Once an outcome exists the fieldset is
 *      disabled, matching the server, which refuses to rewrite it. A control the
 *      server would reject is not offered.
 *
 *   3. **Save state is honest.** `يحفظ…` / `تم الحفظ` / `تعذّر الحفظ` report the
 *      last request's real outcome, and a failed answer stays visibly unsaved
 *      rather than looking recorded.
 */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

async function postJson(url: string, body?: unknown): Promise<unknown | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: unknown;
  } | null;
  if (!response.ok || !payload?.ok) return null;
  return payload.data ?? null;
}

export function LessonQuiz({
  lessonId,
  initialView,
}: {
  lessonId: string;
  initialView: LessonQuizView;
}) {
  const [view, setView] = useState(initialView);
  const [startPending, setStartPending] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const attempt = view.attempt;
  const running = attempt !== null && !attempt.submitted;

  const start = useCallback(async () => {
    setStartPending(true);
    setStartError(null);

    const data = await postJson(`/api/lessons/${lessonId}/quiz/attempts`);
    if (data === null) {
      setStartError(COPY.lessonQuiz.startFailed);
      setStartPending(false);
      return;
    }

    setView(data as LessonQuizView);
    setStartPending(false);
  }, [lessonId]);

  return (
    <section aria-labelledby="lesson-quiz-heading" className="flex flex-col gap-6">
      <Subhead id="lesson-quiz-heading" title={COPY.lessonQuiz.title} />

      {running && attempt ? (
        // Keyed by the attempt, so starting a fresh one replaces the local
        // answer state rather than carrying the previous paper's into it.
        <RunningAttempt
          key={attempt.id}
          attempt={attempt}
          feedbackMode={view.feedbackMode}
          onSubmitted={(next) => setView(next)}
        />
      ) : (
        <IdlePanel view={view} pending={startPending} error={startError} onStart={start} />
      )}
    </section>
  );
}

// ─────────────────────────── Between attempts ───────────────────────────

/**
 * What the student sees when no attempt is open: the quiz described, the last
 * result if there is one, and the way in.
 *
 * The description is read from the quiz's own settings rather than written as a
 * fixed sentence — an administrator who caps the retries or turns on immediate
 * feedback has changed what the student is about to experience, and the panel
 * has to say so before they start.
 */
function IdlePanel({
  view,
  pending,
  error,
  onStart,
}: {
  view: LessonQuizView;
  pending: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const exhausted = view.attemptsRemaining !== null && view.attemptsRemaining <= 0;
  const previous = view.attempt?.submitted ? view.attempt : null;

  const facts: Array<{ label: string; value: string }> = [
    {
      label: COPY.lessonQuiz.questionCountLabel,
      value: formatNumber(previous ? previous.totalCount : view.questionCount),
    },
    {
      label: COPY.lessonQuiz.attemptsLabel,
      value:
        view.maxAttempts === null
          ? COPY.lessonQuiz.attemptsUnlimited
          : formatNumber(view.maxAttempts),
    },
  ];
  if (view.attemptsUsed > 0) {
    facts.push({
      label: COPY.lessonQuiz.attemptsUsedLabel,
      value: formatNumber(view.attemptsUsed),
    });
  }
  // Only once there is more than one attempt to be best *of*. After a single
  // sitting it would restate the figure printed directly above it.
  if (view.attemptsUsed > 1 && view.bestScorePercent !== null) {
    facts.push({
      label: COPY.lessonQuiz.bestScoreLabel,
      value: formatPercent(view.bestScorePercent / 100),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {previous ? <AttemptResult attempt={previous} /> : null}

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        {previous ? null : (
          <p className="text-ink-700 measure-ar text-[15px] leading-[1.85]">
            {COPY.lessonQuiz.description}
          </p>
        )}

        <dl className="border-line-200 divide-line-200 measure-ar divide-y border-y">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-700 text-sm">{fact.label}</dt>
              <dd className="text-ink-900 font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-ink-700 text-sm leading-[1.8]">
          {view.feedbackMode === 'IMMEDIATE'
            ? COPY.lessonQuiz.feedbackImmediate
            : COPY.lessonQuiz.feedbackAfterSubmission}
        </p>

        {exhausted ? (
          <Notice tone="neutral" role="note">
            {COPY.lessonQuiz.attemptsExhausted}
          </Notice>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onStart} loading={pending} disabled={!view.canStart}>
              {pending
                ? COPY.lessonQuiz.starting
                : previous
                  ? COPY.lessonQuiz.retakeAction
                  : COPY.lessonQuiz.startAction}
            </Button>
            {view.attemptsRemaining !== null ? (
              <span className="text-ink-600 text-sm tabular-nums">
                {fillTemplate(COPY.lessonQuiz.attemptsRemaining, {
                  count: formatNumber(view.attemptsRemaining),
                })}
              </span>
            ) : null}
          </div>
        )}

        {/* Nothing to start and nothing sat: every question was withdrawn from
            the bank after the quiz was built. Said plainly rather than shown as
            a dead button. */}
        {!view.canStart && !exhausted && view.questionCount === 0 ? (
          <p className="text-ink-700 text-sm">{COPY.lessonQuiz.errors.noQuestions}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-error text-sm font-medium">
            {error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

// ─────────────────────────── The open attempt ───────────────────────────

function RunningAttempt({
  attempt,
  feedbackMode,
  onSubmitted,
}: {
  attempt: LessonQuizAttemptView;
  feedbackMode: LessonQuizView['feedbackMode'];
  onSubmitted: (view: LessonQuizView) => void;
}) {
  const [questions, setQuestions] = useState(attempt.questions);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [confirming, setConfirming] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * The questions also live in a ref.
   *
   * `select` reads the current answer inside an async callback that outlives the
   * render which created it; reading state there would see whatever was current
   * when the closure was made. The ref is what the network path reads, and
   * `apply` is the only writer, so the two never diverge.
   */
  const questionsRef = useRef(questions);
  const apply = useCallback((next: LessonQuizQuestionView[]) => {
    questionsRef.current = next;
    setQuestions(next);
  }, []);

  const unanswered = useMemo(
    () => questions.filter((question) => question.selectedOptionKey === null).length,
    [questions],
  );

  const select = useCallback(
    async (questionId: string, optionKey: string) => {
      const before = questionsRef.current;
      const target = before.find((question) => question.questionId === questionId);
      // A settled question is inert; the server would refuse the write anyway.
      if (!target || target.outcome !== null) return;

      apply(
        before.map((question) =>
          question.questionId === questionId
            ? { ...question, selectedOptionKey: optionKey }
            : question,
        ),
      );
      setSaveStatus('saving');

      const response = await fetch(
        `/api/lesson-quiz-attempts/${attempt.id}/answers/${questionId}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ selectedOptionKey: optionKey }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: SaveLessonQuizAnswerResult;
      } | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        // Roll back to what the server still holds. An answer that looks saved
        // and is not is the most expensive lie this screen can tell.
        apply(
          questionsRef.current.map((question) =>
            question.questionId === questionId
              ? { ...question, selectedOptionKey: target.selectedOptionKey }
              : question,
          ),
        );
        setSaveStatus('error');
        return;
      }

      const saved = payload.data;
      apply(
        questionsRef.current.map((question) =>
          question.questionId === questionId
            ? {
                ...question,
                selectedOptionKey: saved.selectedOptionKey,
                outcome: saved.outcome,
              }
            : question,
        ),
      );
      setSaveStatus('saved');
    },
    [apply, attempt.id],
  );

  const submit = useCallback(async () => {
    setSubmitPending(true);
    setSubmitError(null);

    const data = await postJson(`/api/lesson-quiz-attempts/${attempt.id}/submit`);
    if (data === null) {
      setSubmitError(COPY.lessonQuiz.submitFailed);
      setSubmitPending(false);
      return;
    }

    setSubmitPending(false);
    setConfirming(false);
    onSubmitted(data as LessonQuizView);
  }, [attempt.id, onSubmitted]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-700 text-sm tabular-nums">
          {fillTemplate(COPY.lessonQuiz.answeredOfTotal, {
            current: formatNumber(questions.length - unanswered),
            total: formatNumber(questions.length),
          })}
        </p>
        <SaveIndicator status={saveStatus} />
      </div>

      {feedbackMode === 'IMMEDIATE' ? (
        <Notice tone="neutral" role="note">
          {COPY.lessonQuiz.immediateLockNotice}
        </Notice>
      ) : null}

      <ol className="flex flex-col gap-5">
        {questions.map((question, index) => (
          <li key={question.questionId}>
            <QuestionCard
              question={question}
              index={index}
              total={questions.length}
              onSelect={(optionKey) => void select(question.questionId, optionKey)}
            />
          </li>
        ))}
      </ol>

      {saveStatus === 'error' ? (
        <p
          role="alert"
          className="rounded-control border-error/30 bg-error-soft text-error flex items-start gap-2 border p-3 text-sm font-medium"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {COPY.lessonQuiz.saveFailedBody}
        </p>
      ) : null}

      {/*
       * An inline confirmation rather than a modal. Submitting a lesson quiz is
       * final only for this attempt, which can be sat again — the exam's dialog
       * exists because a locked section is gone for good, and reusing it here
       * would dress a small step as a large one. The consequence is still stated
       * in words before the press.
       */}
      {confirming ? (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-ink-900 font-semibold">{COPY.lessonQuiz.submitTitle}</p>
            <p className="text-ink-700 mt-1.5 text-sm leading-[1.8]">
              {COPY.lessonQuiz.submitWarning}
            </p>
          </div>

          <p className="text-ink-700 text-sm tabular-nums">
            {unanswered > 0
              ? fillTemplate(COPY.lessonQuiz.unansweredNotice, {
                  count: formatNumber(unanswered),
                })
              : COPY.lessonQuiz.allAnswered}
          </p>

          {submitError ? (
            <p role="alert" className="text-error text-sm font-medium">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void submit()} loading={submitPending}>
              {submitPending ? COPY.lessonQuiz.submitting : COPY.lessonQuiz.confirmSubmit}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitPending}>
              {COPY.lessonQuiz.cancelSubmit}
            </Button>
          </div>
        </Card>
      ) : (
        <div>
          <Button onClick={() => setConfirming(true)}>{COPY.lessonQuiz.submitAction}</Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── One question ───────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  onSelect,
}: {
  question: LessonQuizQuestionView;
  index: number;
  total: number;
  onSelect?: (optionKey: string) => void;
}) {
  const settled = question.outcome !== null;
  const groupName = `lesson-quiz-${question.questionId}`;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-600 text-xs font-medium tabular-nums">
          {fillTemplate(COPY.lessonQuiz.questionOfTotal, {
            current: formatNumber(index + 1),
            total: formatNumber(total),
          })}
        </p>
        {question.outcome ? (
          <ResultMark
            state={
              question.outcome.isCorrect
                ? 'correct'
                : question.selectedOptionKey === null
                  ? 'unanswered'
                  : 'incorrect'
            }
          />
        ) : null}
      </div>

      {/* Reference material is a flat panel; the question itself is the card. */}
      {question.stimulus ? (
        <div className="rounded-control border-line-200 bg-surface-muted border p-4">
          <p className="text-ink-700 border-line-200 mb-2 border-b pb-2 text-xs font-semibold">
            {question.stimulus.title ?? COPY.lessonQuiz.passageLabel}
          </p>
          <RichTextView document={question.stimulus.content} paragraphClassName="text-sm" />
        </div>
      ) : null}

      <RichTextView
        document={question.stem}
        className="measure-ar-lg"
        paragraphClassName="text-[17px] leading-[1.75] font-semibold"
      />

      <fieldset className="flex flex-col gap-2" disabled={settled}>
        <legend className="sr-only">{COPY.lessonQuiz.optionsLabel}</legend>

        {question.options.map((option) => {
          const chosen = question.selectedOptionKey === option.key;
          const isKey = question.outcome?.correctOptionKey === option.key;

          return (
            <label
              key={option.key}
              className={cn(
                // rest → hover → selected, one 150ms colour step apart, on a
                // 52px target. Selection is border, ground and weight together.
                'rounded-control flex min-h-13 items-start gap-3 border p-3.5 transition-colors duration-150',
                'has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                settled ? 'cursor-default' : 'cursor-pointer',
                isKey
                  ? 'border-success/40 bg-success-soft'
                  : settled && chosen
                    ? 'border-error/40 bg-error-soft'
                    : chosen
                      ? 'border-brand-700 bg-brand-100 font-semibold'
                      : 'border-line-200 bg-surface hover:border-brand-500/50 hover:bg-brand-50',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.key}
                checked={chosen}
                onChange={() => onSelect?.(option.key)}
                className="accent-brand-700 mt-1 size-4 shrink-0"
              />
              <RichTextView document={option.content} className="min-w-0 flex-1 gap-1" />

              {/*
               * The two grounds above say "this is the answer" and "this was
               * yours" in colour. Colour never carries meaning alone, so each
               * marked row says it in a word as well — and the words are what a
               * screen reader reads out inside the option's own label.
               */}
              {settled && isKey ? (
                <span className="text-success shrink-0 text-xs font-semibold">
                  {COPY.lessonQuiz.correctAnswer}
                </span>
              ) : null}
              {settled && chosen && !isKey ? (
                <span className="text-error shrink-0 text-xs font-semibold">
                  {COPY.lessonQuiz.yourAnswer}
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      {question.outcome?.explanation ? (
        <div className="rounded-control bg-surface-muted p-4">
          {/* ink-700, not ink-600: surface-muted is a tinted ground. */}
          <p className="text-ink-700 mb-1 text-xs font-semibold">
            {COPY.lessonQuiz.explanationLabel}
          </p>
          <RichTextView document={question.outcome.explanation} paragraphClassName="text-sm" />
        </div>
      ) : null}
    </Card>
  );
}

// ─────────────────────────────── The result ───────────────────────────────

function AttemptResult({ attempt }: { attempt: LessonQuizAttemptView }) {
  const correct = attempt.correctCount ?? 0;
  const incorrect = attempt.incorrectCount ?? 0;
  const unanswered = attempt.unansweredCount ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <h3 className="text-ink-900 text-[17px] font-semibold">{COPY.lessonQuiz.resultTitle}</h3>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-ink-700 text-sm font-medium">{COPY.lessonQuiz.scoreLabel}</p>
            {/* A stat numeral: display face, 700, tabular. */}
            <p className="text-ink-900 font-display mt-1 text-[30px] leading-none font-bold tabular-nums">
              {attempt.scorePercent === null
                ? COPY.common.notAvailable
                : formatPercent(attempt.scorePercent / 100)}
            </p>
          </div>
          <p className="text-ink-700 text-sm tabular-nums">
            {formatNumber(correct)}{' '}
            {fillTemplate(COPY.lessonQuiz.outOfTotal, {
              total: formatNumber(attempt.totalCount),
            })}
          </p>
        </div>

        <dl className="border-line-200 divide-line-200 divide-y border-y">
          {[
            { label: COPY.lessonQuiz.correctCount, value: correct },
            { label: COPY.lessonQuiz.incorrectCount, value: incorrect },
            { label: COPY.lessonQuiz.unansweredCount, value: unanswered },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-700 text-sm">{row.label}</dt>
              <dd className="text-ink-900 font-medium tabular-nums">{formatNumber(row.value)}</dd>
            </div>
          ))}
        </dl>

        {/* A standing disclosure, not an alert: nothing has gone wrong. */}
        <Notice tone="neutral" role="note">
          {COPY.lessonQuiz.notAGrade}
        </Notice>
      </Card>

      <ol className="flex flex-col gap-5">
        {attempt.questions.map((question, index) => (
          <li key={question.questionId}>
            <QuestionCard question={question} index={index} total={attempt.questions.length} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Colour is never the only signal: each mark carries its own Arabic label. */
function ResultMark({ state }: { state: 'correct' | 'incorrect' | 'unanswered' }) {
  if (state === 'correct') {
    return (
      <Badge variant="success">
        <Check className="size-3.5" aria-hidden="true" />
        {COPY.lessonQuiz.correctMark}
      </Badge>
    );
  }
  if (state === 'incorrect') {
    return (
      <Badge variant="error">
        <X className="size-3.5" aria-hidden="true" />
        {COPY.lessonQuiz.incorrectMark}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <Minus className="size-3.5" aria-hidden="true" />
      {COPY.lessonQuiz.noAnswer}
    </Badge>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  const label =
    status === 'saving'
      ? COPY.lessonQuiz.saving
      : status === 'saved'
        ? COPY.lessonQuiz.saved
        : COPY.lessonQuiz.saveFailedLabel;

  return (
    // Polite, and one region rather than three: a reader hears the state change
    // instead of three separate strings arriving.
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150',
        status === 'error'
          ? 'bg-error-soft text-error'
          : status === 'saved'
            ? 'bg-success-soft text-success'
            : 'bg-surface-muted text-ink-700',
      )}
    >
      {status === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : null}
      {status === 'saved' ? <Check className="size-3.5" aria-hidden="true" /> : null}
      {status === 'error' ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : null}
      {label}
    </p>
  );
}
