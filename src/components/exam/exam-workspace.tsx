'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Check, Flag, Loader2, LogOut } from 'lucide-react';

import { RichTextView } from '@/components/exam/question-content';
import { Button } from '@/components/ui/button';
import { EXAM } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { formatDuration, formatNumber } from '@/lib/format';
import { fillTemplate } from '@/lib/exam/template';
import type { AttemptStateView } from '@/services/exams/attempt-snapshot.service';
import { cn } from '@/lib/utils';

/**
 * The timed workspace.
 *
 * Three rules shape this component, and all three exist because the server is
 * the only authority in an exam:
 *
 *   1. **The countdown never counts.** It recomputes `deadlineAt − now` on every
 *      tick, where `now` is the browser's clock corrected by the offset measured
 *      against `serverTime`. A local counter that decrements once a second
 *      drifts when the tab is backgrounded, and would end up showing time the
 *      student does not have.
 *
 *   2. **Zero triggers a refetch, not an advance.** When the countdown reaches
 *      zero this asks the server what happened. The server may have already
 *      chained to the next section, or expired the attempt entirely; either way
 *      the client renders what it is told. A client that advanced itself would
 *      be deciding the exam's state.
 *
 *   3. **Save state is always visible and always honest.** `يحفظ…` / `تم الحفظ`
 *      / `تعذّر الحفظ` reflect the last request's real outcome. An unsaved
 *      answer does not count, so a silent failure here is the most expensive
 *      bug the screen can have.
 *
 * Answers are held locally for responsiveness and reconciled against the
 * server's `saveVersion`. A 409 means another tab wrote first; the response
 * carries the current state and this component rebases onto it rather than
 * overwriting it.
 */

type LocalAnswer = {
  selectedOptionKey: string | null;
  flagged: boolean;
  saveVersion: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function toAnswerMap(state: AttemptStateView): Map<string, LocalAnswer> {
  return new Map(
    state.questions.map((question) => [
      question.id,
      {
        selectedOptionKey: question.answer.selectedOptionKey,
        flagged: question.answer.flagged,
        saveVersion: question.answer.saveVersion,
      },
    ]),
  );
}

export function ExamWorkspace({ initialState }: { initialState: AttemptStateView }) {
  const router = useRouter();

  const [state, setState] = useState(initialState);
  const [answers, setAnswers] = useState(() => toAnswerMap(initialState));
  const [index, setIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * The answer map also lives in a ref.
   *
   * `flushSave` runs from a timer and from a `finally` block, long after the
   * render that scheduled it; reading React state there would send whatever was
   * current when the closure was created. The ref is the value the network path
   * reads, and `applyAnswer` is the only writer, so the two never diverge.
   */
  const answersRef = useRef(answers);

  const applyAnswer = useCallback((questionId: string, next: LocalAnswer) => {
    const updated = new Map(answersRef.current).set(questionId, next);
    answersRef.current = updated;
    setAnswers(updated);
  }, []);

  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlightRef = useRef(new Set<string>());
  const dirtyRef = useRef(new Set<string>());

  /**
   * Offset between this browser's clock and the server's, measured once per
   * payload. Everything time-related is expressed through it, so a device with
   * a wrong system clock still sees the correct remaining time.
   */
  const [clockOffsetMs, setClockOffsetMs] = useState(
    () => new Date(initialState.serverTime).getTime() - Date.now(),
  );

  const questions = state.questions;
  const current = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const section = state.currentSection;

  const answered = useMemo(
    () => questions.filter((question) => answers.get(question.id)?.selectedOptionKey).length,
    [questions, answers],
  );
  const flaggedCount = useMemo(
    () => questions.filter((question) => answers.get(question.id)?.flagged).length,
    [questions, answers],
  );

  // ── Reloading from the server ────────────────────────────────────────

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/exam-attempts/${state.attempt.id}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { ok: boolean; data: AttemptStateView };
    if (!payload.ok) return;

    const next = payload.data;
    setClockOffsetMs(new Date(next.serverTime).getTime() - Date.now());

    if (next.attempt.status !== 'IN_PROGRESS') {
      router.replace(`/exam/${state.attempt.id}/results`);
      return;
    }

    // A different section means the server moved us on; start at its first
    // question rather than holding an index that no longer means anything.
    if (next.currentSection?.id !== state.currentSection?.id) setIndex(0);

    setState(next);
    answersRef.current = toAnswerMap(next);
    setAnswers(answersRef.current);
  }, [router, state.attempt.id, state.currentSection?.id]);

  // ── Autosave ─────────────────────────────────────────────────────────

  const flushSave = useCallback(
    async (questionId: string) => {
      if (inFlightRef.current.has(questionId)) {
        // A save for this question is already on the wire. Marking it dirty
        // makes the in-flight request re-run afterwards, so the last value the
        // student chose is the one that reaches the server.
        dirtyRef.current.add(questionId);
        return;
      }

      const local = answersRef.current.get(questionId);
      if (!local) return;

      inFlightRef.current.add(questionId);
      setSaveStatus('saving');

      try {
        const response = await fetch(
          `/api/exam-attempts/${state.attempt.id}/answers/${questionId}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              selectedOptionKey: local.selectedOptionKey,
              flagged: local.flagged,
              saveVersion: local.saveVersion,
            }),
          },
        );

        const payload = (await response.json()) as {
          ok: boolean;
          data?: { saveVersion: number; selectedOptionKey: string | null; flagged: boolean };
          error?: {
            code: string;
            details?: { saveVersion: number; selectedOptionKey: string | null; flagged: boolean };
          };
        };

        if (response.ok && payload.ok && payload.data) {
          const saved = payload.data;
          applyAnswer(questionId, {
            selectedOptionKey: saved.selectedOptionKey,
            flagged: saved.flagged,
            saveVersion: saved.saveVersion,
          });
          setSaveStatus('saved');
        } else if (response.status === 409 && payload.error?.details) {
          // Another tab is authoritative for this answer. Rebase; do not retry
          // with our stale version, which would only lose again.
          const server = payload.error.details;
          applyAnswer(questionId, {
            selectedOptionKey: server.selectedOptionKey,
            flagged: server.flagged,
            saveVersion: server.saveVersion,
          });
          dirtyRef.current.delete(questionId);
          setSaveStatus('saved');
        } else if (response.status === 409) {
          // The section closed underneath us. The server's view of the attempt
          // is the one that matters, so reload it.
          void refresh();
          setSaveStatus('error');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        inFlightRef.current.delete(questionId);
        if (dirtyRef.current.has(questionId)) {
          dirtyRef.current.delete(questionId);
          void flushSave(questionId);
        }
      }
    },
    [applyAnswer, refresh, state.attempt.id],
  );

  const scheduleSave = useCallback(
    (questionId: string, immediate = false) => {
      const timers = timersRef.current;
      const existing = timers.get(questionId);
      if (existing) clearTimeout(existing);

      if (immediate) {
        void flushSave(questionId);
        return;
      }

      timers.set(
        questionId,
        setTimeout(() => {
          timers.delete(questionId);
          void flushSave(questionId);
        }, EXAM.AUTOSAVE_DEBOUNCE_MS),
      );
    },
    [flushSave],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const selectOption = useCallback(
    (questionId: string, optionKey: string) => {
      const local = answersRef.current.get(questionId) ?? {
        selectedOptionKey: null,
        flagged: false,
        saveVersion: 0,
      };
      applyAnswer(questionId, { ...local, selectedOptionKey: optionKey });
      scheduleSave(questionId);
    },
    [applyAnswer, scheduleSave],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      const local = answersRef.current.get(questionId) ?? {
        selectedOptionKey: null,
        flagged: false,
        saveVersion: 0,
      };
      applyAnswer(questionId, { ...local, flagged: !local.flagged });
      // Flagging is a deliberate, low-frequency act; there is nothing to debounce.
      scheduleSave(questionId, true);
    },
    [applyAnswer, scheduleSave],
  );

  // ── Countdown ────────────────────────────────────────────────────────

  const deadlineMs = section?.deadlineAt ? new Date(section.deadlineAt).getTime() : null;
  /**
   * Starts empty rather than computed.
   *
   * The first value is produced by the effect below, on the client. Computing it
   * during render would run once on the server and again in the browser, and the
   * two clocks are never the same second — which is a hydration mismatch on the
   * one number the student is watching.
   */
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const expiryHandledRef = useRef(false);

  useEffect(() => {
    expiryHandledRef.current = false;

    const tick = () => {
      if (deadlineMs === null) {
        setRemainingSec(null);
        return;
      }
      const serverNow = Date.now() + clockOffsetMs;
      const remaining = Math.max(0, Math.round((deadlineMs - serverNow) / 1_000));
      setRemainingSec(remaining);

      if (remaining === 0 && !expiryHandledRef.current) {
        // The server owns what happens next. Ask it rather than advancing.
        expiryHandledRef.current = true;
        void refresh();
      }
    };

    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [deadlineMs, clockOffsetMs, refresh]);

  // ── Exit guard ───────────────────────────────────────────────────────

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // The browser shows its own wording; assigning `returnValue` is what asks
      // it to ask. The Arabic explanation lives in the in-page exit dialog.
      event.preventDefault();
      event.returnValue = COPY.exam.exitGuard;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ── Advancing and submitting ─────────────────────────────────────────

  const isLastSection = section?.isLastSection ?? false;

  async function confirmAdvance() {
    if (!section) return;
    setActionPending(true);
    setActionError(null);

    // Flush anything still waiting on the debounce: advancing locks the section,
    // and a pending save would then be refused.
    for (const [questionId, timer] of timersRef.current) {
      clearTimeout(timer);
      timersRef.current.delete(questionId);
      await flushSave(questionId);
    }

    try {
      const url = isLastSection
        ? `/api/exam-attempts/${state.attempt.id}/submit`
        : `/api/exam-attempts/${state.attempt.id}/sections/${section.id}/advance`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (!response.ok) {
        setActionError(isLastSection ? COPY.exam.submitFailed : COPY.exam.advanceFailed);
        setActionPending(false);
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        data?: { outcome?: 'advanced' | 'submitted' };
      };

      setAdvanceOpen(false);
      if (isLastSection || payload.data?.outcome === 'submitted') {
        router.replace(`/exam/${state.attempt.id}/results`);
        return;
      }
      await refresh();
    } catch {
      setActionError(isLastSection ? COPY.exam.submitFailed : COPY.exam.advanceFailed);
    } finally {
      setActionPending(false);
    }
  }

  if (!current || !section) {
    // The clock moved while this render was in flight; the refetch above will
    // replace the screen. Showing nothing is better than showing a stale paper.
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="text-brand-700 size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">{COPY.common.loading}</span>
      </div>
    );
  }

  const currentAnswer = answers.get(current.id);
  const unanswered = questions.length - answered;
  const warningThreshold = EXAM.TIMER_WARNING_SECONDS[0];

  return (
    <div className="bg-canvas flex min-h-dvh flex-col" aria-label={COPY.exam.workspaceLabel}>
      {/* Quiet status bar: state without decoration, so it never competes with
          the question for attention. */}
      <header className="border-line-200 bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col">
            <span className="text-ink-900 truncate text-sm font-medium">{section.title}</span>
            <span className="text-ink-600 text-xs">
              {fillTemplate(COPY.exam.sectionOfTotal, {
                current: formatNumber(section.position),
                total: formatNumber(state.sections.length),
              })}
            </span>
          </div>

          <p className="text-ink-700 text-sm">
            {fillTemplate(COPY.exam.questionOfTotal, {
              current: formatNumber(index + 1),
              total: formatNumber(questions.length),
            })}
          </p>

          <div className="ms-auto flex items-center gap-4">
            <SaveIndicator status={saveStatus} />
            {remainingSec === null ? null : (
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  remainingSec <= warningThreshold ? 'text-warning' : 'text-ink-900',
                )}
                // Announced on a slow cadence: a per-second live region would
                // make the timer unusable with a screen reader.
                aria-live="off"
              >
                <span className="text-ink-600 me-2 text-xs font-normal">
                  {COPY.exam.timeRemaining}
                </span>
                <bdi>
                  <span dir="ltr">{formatDuration(remainingSec)}</span>
                </bdi>
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExitOpen(true)}>
              <LogOut className="size-4" aria-hidden="true" />
              {COPY.exam.exitAction}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row-reverse lg:gap-8">
        {/* Navigator: the current section only. There is no control here that
            could reach a locked or a future section. */}
        <nav
          aria-label={COPY.exam.navigatorLabel}
          className="rounded-panel border-line-200 bg-surface h-fit border p-4 lg:w-64"
        >
          <p className="text-ink-600 mb-3 text-xs">{COPY.exam.navigatorHint}</p>
          <ol className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
            {questions.map((question, questionIndex) => {
              const local = answers.get(question.id);
              const isCurrent = questionIndex === index;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(questionIndex)}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={fillTemplate(COPY.exam.goToQuestion, {
                      number: formatNumber(questionIndex + 1),
                    })}
                    className={cn(
                      'rounded-control relative flex size-9 items-center justify-center border text-sm',
                      'focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2',
                      local?.selectedOptionKey
                        ? 'border-brand-700 bg-brand-100 text-brand-700 font-medium'
                        : 'border-line-200 text-ink-700 hover:bg-surface-muted',
                      isCurrent && 'outline-brand-500 outline-2 outline-offset-2',
                    )}
                  >
                    {formatNumber(questionIndex + 1)}
                    {local?.flagged ? (
                      <Flag
                        className="text-warning absolute -end-1 -top-1 size-3 fill-current"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <dl className="text-ink-700 mt-4 flex flex-col gap-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt>{COPY.exam.navigatorAnswered}</dt>
              <dd className="font-medium">{formatNumber(answered)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{COPY.exam.navigatorUnanswered}</dt>
              <dd className="font-medium">{formatNumber(unanswered)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{COPY.exam.navigatorFlagged}</dt>
              <dd className="font-medium">{formatNumber(flaggedCount)}</dd>
            </div>
          </dl>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {current.content.stimulus ? (
            <section className="rounded-panel border-line-200 bg-surface border p-5">
              <h2 className="text-ink-600 mb-2 text-xs font-medium">
                {current.content.stimulus.title ?? COPY.exam.passageLabel}
              </h2>
              <RichTextView document={current.content.stimulus.content} />
            </section>
          ) : null}

          <section className="rounded-panel border-line-200 bg-surface flex flex-col gap-5 border p-5 sm:p-6">
            <RichTextView document={current.content.stem} paragraphClassName="text-lg" />

            {current.hint ? (
              <div className="rounded-control bg-brand-100 p-3">
                <p className="text-brand-700 mb-1 text-xs font-medium">{COPY.exam.hintLabel}</p>
                <RichTextView document={current.hint} paragraphClassName="text-sm" />
              </div>
            ) : null}

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{COPY.exam.optionsLabel}</legend>
              {current.content.options.map((option) => {
                const checked = currentAnswer?.selectedOptionKey === option.key;
                return (
                  <label
                    key={option.key}
                    className={cn(
                      'rounded-control flex cursor-pointer items-start gap-3 border p-3 transition-colors',
                      checked
                        ? 'border-brand-700 bg-brand-100'
                        : 'border-line-200 hover:bg-surface-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${current.id}`}
                      value={option.key}
                      checked={checked}
                      onChange={() => selectOption(current.id, option.key)}
                      className="accent-brand-700 mt-1 size-4 shrink-0"
                    />
                    <RichTextView document={option.content} className="gap-1" />
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={currentAnswer?.flagged ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => toggleFlag(current.id)}
                aria-pressed={currentAnswer?.flagged ?? false}
              >
                <Flag
                  className={cn('size-4', currentAnswer?.flagged && 'fill-current')}
                  aria-hidden="true"
                />
                {currentAnswer?.flagged ? COPY.exam.unflagAction : COPY.exam.flagAction}
              </Button>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            >
              {COPY.exam.previousQuestion}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
              disabled={index >= questions.length - 1}
            >
              {COPY.exam.nextQuestion}
            </Button>

            <Button className="ms-auto" onClick={() => setAdvanceOpen(true)}>
              {isLastSection ? COPY.exam.submitAction : COPY.exam.advanceAction}
            </Button>
          </div>

          {saveStatus === 'error' ? (
            <p role="alert" className="text-error text-sm">
              {COPY.exam.saveFailedBody}
            </p>
          ) : null}
        </main>
      </div>

      <ConfirmDialog
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        title={isLastSection ? COPY.exam.submitTitle : COPY.exam.advanceTitle}
        warning={isLastSection ? COPY.exam.submitWarning : COPY.exam.advanceWarning}
        confirmLabel={isLastSection ? COPY.exam.confirmSubmit : COPY.exam.confirmAdvance}
        cancelLabel={COPY.exam.stayHere}
        pending={actionPending}
        error={actionError}
        onConfirm={confirmAdvance}
      >
        <ul className="text-ink-700 flex flex-col gap-1 text-sm">
          {unanswered > 0 ? (
            <li>{fillTemplate(COPY.exam.unansweredNotice, { count: formatNumber(unanswered) })}</li>
          ) : (
            <li>{COPY.exam.allAnswered}</li>
          )}
          {flaggedCount > 0 ? (
            <li>{fillTemplate(COPY.exam.flaggedNotice, { count: formatNumber(flaggedCount) })}</li>
          ) : null}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={COPY.exam.exitTitle}
        warning={COPY.exam.exitWarning}
        confirmLabel={COPY.exam.confirmExit}
        cancelLabel={COPY.exam.stayHere}
        pending={false}
        error={null}
        onConfirm={() => {
          setExitOpen(false);
          router.push('/dashboard/attempts');
        }}
      />
    </div>
  );
}

// ─────────────────────────── Pieces ───────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  const content =
    status === 'saving' ? (
      <>
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {COPY.exam.saving}
      </>
    ) : status === 'saved' ? (
      <>
        <Check className="size-3.5" aria-hidden="true" />
        {COPY.exam.saved}
      </>
    ) : (
      <>
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {COPY.exam.saveFailed}
      </>
    );

  return (
    <p
      // Polite rather than assertive: the student is reading a question, and an
      // interrupting announcement on every keystroke would be worse than useless.
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-xs',
        status === 'error' ? 'text-error font-medium' : 'text-ink-600',
      )}
    >
      {content}
    </p>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  warning,
  confirmLabel,
  cancelLabel,
  pending,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  warning: string;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[rgb(22_35_45/0.45)]" />
        <Dialog.Content
          dir="rtl"
          // Centred with auto margins rather than a translate, so the dialog does
          // not depend on which physical side `start` resolves to.
          className="rounded-panel bg-surface shadow-overlay fixed inset-0 m-auto h-fit w-[min(32rem,calc(100vw-2rem))] p-6"
        >
          <Dialog.Title className="text-ink-900 text-lg font-semibold">{title}</Dialog.Title>

          <div className="border-warning/30 bg-warning-soft rounded-control mt-3 flex gap-2 border p-3">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <Dialog.Description className="text-ink-900 text-sm leading-relaxed">
              {warning}
            </Dialog.Description>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          {error ? (
            <p role="alert" className="text-error mt-3 text-sm font-medium">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onConfirm} loading={pending}>
              {confirmLabel}
            </Button>
            <Dialog.Close asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
