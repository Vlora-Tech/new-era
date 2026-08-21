'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Flag,
  Info,
  Loader2,
  LogOut,
  Timer,
} from 'lucide-react';

import { RichTextView } from '@/components/exam/question-content';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { EXAM } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { formatDuration, formatNumber } from '@/lib/format';
import { fillTemplate } from '@/lib/exam/template';
import { richTextToPlain, type RichText } from '@/lib/exam/content';
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

/**
 * How large to set a question stem.
 *
 * A stem is not a headline of predictable length: «صفحة : كتاب ⟵ الأقرب في
 * العلاقة» is eight words, and a reading-comprehension stem can run to four
 * lines. Setting both at one size means either the short one looks like body
 * text or the long one arrives as a wall of display type — which is what the
 * mock did at clamp(26px…36px), and it is unreadable well before the longest
 * stem in the bank.
 *
 * So the size is chosen from the stem itself. Three steps, not a continuous
 * scale: a smooth function of length would make two adjacent questions differ
 * by a pixel for no reason a reader could name, and the jump between questions
 * would read as a rendering fault rather than as emphasis.
 *
 * `richTextToPlain` is documented as "never for display" — this only measures
 * it. The real document still renders through `RichTextView`, as before.
 */
const STEM_LONG_CHARS = 120;
const STEM_MEDIUM_CHARS = 60;

/**
 * The navigator's legend.
 *
 * The three grounds the question grid uses, named. It is a constant rather than
 * three hand-written rows so a swatch and the cell it describes cannot drift
 * apart — which is the failure mode of a legend, and a silent one.
 */
const LEGEND = [
  { key: 'answered', swatch: 'bg-brand-700', label: COPY.exam.navigatorAnswered },
  { key: 'blank', swatch: 'bg-line-200', label: COPY.exam.navigatorUnanswered },
  { key: 'flagged', swatch: 'bg-warning', label: COPY.exam.navigatorFlagged },
] as const;

function stemClass(stem: RichText): string {
  const length = richTextToPlain(stem).length;
  // Long: body-sized and airy. The stem is a paragraph to be read, not scanned.
  if (length > STEM_LONG_CHARS) return 'text-lead font-semibold';
  // Medium: one step up, still comfortably a sentence.
  if (length > STEM_MEDIUM_CHARS) return 'text-h3 font-semibold';
  // Short: the prominence the mock wanted, reachable only when it actually fits.
  return 'text-h2';
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
      {/*
        The command bar.
        ────────────────
        Dark, and deliberately: this is the one screen in the product with no
        site header, no rail and no footer, because a running clock makes every
        navigation control a trap (see the route's `layout.tsx`). The band is
        what separates the chrome the student must not touch from the paper they
        are working on — the same field `marketing/course-cover.tsx` draws, used
        here as a bounded strip rather than as a cover. Owner-authorised from the
        approved canvas «صفحة الاختبار»; recorded in docs/design-system.md
        § Exam workspace.

        Everything in it is state, and every piece of that state is one the
        previous bar already carried: section, save outcome, remaining time, way
        out. Nothing here is decoration except the drift.
      */}
      <header className="from-cover-900 via-cover-800 to-cover-700 sticky top-0 z-20 overflow-hidden bg-linear-150 via-55%">
        <span
          aria-hidden="true"
          className="cover-drift-a pointer-events-none absolute -top-40 -left-16 size-[460px] rounded-full"
        />

        <div className="relative mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-[clamp(16px,2.4vw,32px)] gap-y-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden="true"
              className="rounded-panel flex size-11 shrink-0 items-center justify-center border border-white/20 bg-white/10 text-white"
            >
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display truncate text-[16px] font-semibold text-white">
                {section.title}
              </p>
              <p className="mt-0.5 text-[12px] text-white/70">
                {fillTemplate(COPY.exam.sectionOfTotal, {
                  current: formatNumber(section.position),
                  total: formatNumber(state.sections.length),
                })}
                {' · '}
                {COPY.statusLabels.attemptMode[state.attempt.mode]}
              </p>
            </div>
          </div>

          {remainingSec === null ? null : (
            <p
              className={cn(
                // The warning threshold changes ground, border and glyph, and
                // never blinks: a flashing clock is pressure, not information.
                // The numerals stay white in both states — they are the
                // information, and tinting them would make the warning depend on
                // reading a colour.
                'flex items-center gap-2.5 rounded-full border px-4 py-2 transition-colors duration-150',
                remainingSec <= warningThreshold
                  ? 'border-cover-amber/60 bg-cover-amber/15'
                  : 'border-white/20 bg-white/10',
              )}
              // Announced on a slow cadence: a per-second live region would make
              // the timer unusable with a screen reader.
              aria-live="off"
            >
              <Timer
                className={cn(
                  'size-5 shrink-0',
                  remainingSec <= warningThreshold ? 'text-cover-amber' : 'text-brand-300',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[10.5px] leading-tight text-white/70">
                  {COPY.exam.timeRemaining}
                </span>
                <bdi className="font-display block text-[19px] leading-tight font-bold text-white tabular-nums">
                  <span dir="ltr">{formatDuration(remainingSec)}</span>
                </bdi>
              </span>
            </p>
          )}

          {/*
            A COUNT of answered questions, never a score, and that is why the
            line beside the bar reads «٧ من ٢٤» rather than a percentage. The bar
            is `aria-hidden` by contract, so the text is the accessible value.
          */}
          {/*
            The bar itself is dropped below `sm`, and the count is not. At 390px
            the bar forces a third row on a bar that is already sticky over the
            question — a quarter of the viewport spent on a picture of a number
            that is printed beside it. The figure rides along with the timer
            instead, so nothing is lost but the drawing.
          */}
          <div className="flex max-w-[360px] flex-1 basis-auto items-center gap-3.5 sm:min-w-[180px] sm:basis-[220px]">
            <ProgressBar
              value={questions.length > 0 ? (answered / questions.length) * 100 : 0}
              tone="bg-gradient-meter"
              track="bg-white/15"
              className="hidden flex-1 sm:block"
            />
            <span className="shrink-0 text-[12px] whitespace-nowrap text-white/75">
              <span className="sr-only">{COPY.exam.answeredMeterLabel}: </span>
              {fillTemplate(COPY.exam.answeredOfTotal, {
                answered: formatNumber(answered),
                total: formatNumber(questions.length),
              })}
            </span>
          </div>

          <div className="ms-auto flex items-center gap-3">
            <SaveIndicator status={saveStatus} />
            {/*
              Not `Button variant="ghost"`: every variant in the system is
              audited against a light ground, and the ghost's `ink-700` on navy
              is illegible. This is the one control on the bar, so it is written
              here rather than becoming a second on-cover button variant.
            */}
            <button
              type="button"
              onClick={() => setExitOpen(true)}
              className="focus-visible:outline-brand-300 flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-[13.5px] font-medium whitespace-nowrap text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {COPY.exam.exitAction}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 items-start gap-[clamp(18px,2.2vw,30px)] px-4 py-[clamp(18px,2.4vw,32px)] sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/*
          The map, at the inline start, sticky beside the paper. On a phone it
          moves below the question: a grid of 24 cells above the stem would push
          the thing being asked off the first screen.
        */}
        <div className="order-2 flex flex-col gap-3.5 lg:sticky lg:top-[104px] lg:order-1">
          <nav
            aria-label={COPY.exam.navigatorLabel}
            className="rounded-shell border-line-200 bg-surface shadow-card overflow-hidden border"
          >
            <div className="border-line-200 from-brand-50 to-surface flex items-center justify-between gap-2.5 border-b bg-linear-150 px-4 py-4">
              <h2 className="text-h4 text-ink-900">{COPY.exam.navigatorTitle}</h2>
              <span className="text-ink-600 shrink-0 text-[11.5px]">{COPY.exam.navigatorHint}</span>
            </div>

            {/*
              Auto-fill rather than the canvas's fixed five columns: the cell
              floor is the 44px touch target and the grid reflows instead of
              shrinking below it. The canvas draws 40px cells, which is under it.
            */}
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 px-4 py-4">
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
                        'rounded-control font-display relative flex h-11 w-full items-center justify-center border text-[13.5px] tabular-nums transition-colors duration-150',
                        'focus-visible:outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2',
                        // Answered carries a ground *and* a weight; current adds
                        // a ring; flagged adds the corner mark. No state here is
                        // carried by colour alone.
                        local?.selectedOptionKey
                          ? 'border-brand-200 bg-brand-100 text-brand-700 font-semibold'
                          : 'border-line-200 bg-canvas text-ink-700 hover:border-brand-500/50 hover:bg-brand-50',
                        isCurrent && 'outline-brand-500 outline-2 outline-offset-2',
                      )}
                    >
                      {formatNumber(questionIndex + 1)}
                      {local?.flagged ? (
                        <Flag
                          className="text-warning absolute end-1 top-1 size-3 fill-current"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>

            {/*
              The legend earns its swatches: the grid above encodes three states
              as grounds, and this is where those grounds are named. The count
              beside each one is what keeps the meaning off colour alone.
            */}
            <dl className="border-line-200 bg-canvas flex flex-col gap-3 border-t px-4 py-4 text-[13px]">
              {LEGEND.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2.5">
                  <dt className="text-ink-700 flex items-center gap-2">
                    <span aria-hidden="true" className={cn('size-3 rounded-[4px]', row.swatch)} />
                    {row.label}
                  </dt>
                  <dd className="font-display text-ink-900 font-semibold tabular-nums">
                    {formatNumber(
                      row.key === 'answered'
                        ? answered
                        : row.key === 'blank'
                          ? unanswered
                          : flaggedCount,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </nav>

          {/*
            The consequence, stated beside the control rather than only inside
            the dialog the control opens — the same sentence the confirmation
            shows, on purpose. A warning a student first meets in a modal is a
            warning they read while already committed.
          */}
          <p className="rounded-card border-line-200 bg-brand-50/70 text-ink-700 flex items-start gap-2.5 border border-dashed p-4 text-[12.5px] leading-[1.75]">
            <Info className="text-brand-700 mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {isLastSection ? COPY.exam.submitWarning : COPY.exam.advanceWarning}
          </p>
        </div>

        <main className="order-1 flex min-w-0 flex-col gap-[clamp(14px,1.8vw,22px)] lg:order-2">
          {/* The stimulus is a flat panel and the question is an elevated one:
              the reader can tell reference material from the thing being asked
              without reading either. */}
          {current.content.stimulus ? (
            <section className="rounded-shell border-line-200 bg-surface border p-5 sm:p-6">
              <h2 className="text-ink-600 border-line-200 mb-3 border-b pb-2 text-xs font-semibold">
                {current.content.stimulus.title ?? COPY.exam.passageLabel}
              </h2>
              <RichTextView document={current.content.stimulus.content} />
            </section>
          ) : null}

          <section className="rounded-plate border-line-200 bg-surface shadow-card-lg overflow-hidden border">
            <div className="border-line-200 flex flex-wrap items-center justify-between gap-3.5 border-b px-[clamp(18px,2.4vw,34px)] py-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="bg-brand-700 rounded-control font-display flex size-[34px] shrink-0 items-center justify-center text-[14px] font-bold text-white tabular-nums"
                >
                  {formatNumber(index + 1)}
                </span>
                {/* Position, not progress: the figure is stated in words beside
                    the chip, so the numeral is not the only way to find it. */}
                <p className="text-ink-700 text-[13px]">
                  {fillTemplate(COPY.exam.questionOfTotal, {
                    current: formatNumber(index + 1),
                    total: formatNumber(questions.length),
                  })}
                  {' · '}
                  {section.title}
                </p>
              </div>

              {/*
                The flag moved up here from under the options, which is where the
                canvas puts it and where it belongs: it marks the question, and
                putting it after the answers implied it was a step that followed
                answering. The label still names the ACTION rather than the state
                — «إزالة العلامة», not «معلّم» — because a toggle whose label
                becomes a statement leaves nobody sure what pressing it does.
                `aria-pressed` carries the state, the ochre ground repeats it.
              */}
              <button
                type="button"
                onClick={() => toggleFlag(current.id)}
                aria-pressed={currentAnswer?.flagged ?? false}
                className={cn(
                  'focus-visible:outline-brand-500 flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
                  currentAnswer?.flagged
                    ? 'border-warning/40 bg-warning-soft text-warning'
                    : 'border-line-200 bg-surface text-ink-700 hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700',
                )}
              >
                <Flag
                  className={cn('size-4', currentAnswer?.flagged && 'fill-current')}
                  aria-hidden="true"
                />
                {currentAnswer?.flagged ? COPY.exam.unflagAction : COPY.exam.flagAction}
              </button>
            </div>

            <div className="flex flex-col gap-6 px-[clamp(18px,2.4vw,34px)] py-[clamp(24px,3vw,40px)]">
              {/* Held to a readable measure as well as a size: a 36px line
                  running the full width of a 1320px column is two problems. */}
              <RichTextView
                document={current.content.stem}
                className="measure-ar-lg"
                paragraphClassName={stemClass(current.content.stem)}
              />

              {current.hint ? (
                <div className="rounded-card border-brand-700/20 bg-brand-50 measure-ar-lg border p-4">
                  <p className="text-brand-700 mb-1 text-xs font-semibold">{COPY.exam.hintLabel}</p>
                  <RichTextView document={current.hint} paragraphClassName="text-sm" />
                </div>
              ) : null}

              <fieldset className="measure-ar-lg flex flex-col gap-2.5">
                <legend className="sr-only">{COPY.exam.optionsLabel}</legend>
                {current.content.options.map((option, optionIndex) => {
                  const checked = currentAnswer?.selectedOptionKey === option.key;
                  return (
                    <label
                      key={option.key}
                      /*
                       * `relative` is load-bearing: the input below is `sr-only`,
                       * which is absolutely positioned, and an absolutely
                       * positioned box inside an unpositioned ancestor escapes to
                       * the nearest one that is — widening the page.
                       */
                      className={cn(
                        'rounded-card relative flex min-h-14 cursor-pointer items-center gap-3.5 border px-5 py-4 transition-[color,background-color,border-color,box-shadow] duration-150',
                        'has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                        checked
                          ? 'border-brand-700 bg-brand-50 shadow-xs'
                          : 'border-line-200 bg-surface hover:border-brand-500/50 hover:bg-brand-50/60',
                      )}
                    >
                      {/*
                        The radio is HIDDEN, not removed. The canvas draws each
                        option as a plain `div` with a click handler, which is
                        unreachable by keyboard and silent to a screen reader —
                        on the one screen in the product where a missed input
                        costs a mark. This keeps a real radio group: arrow keys
                        still move between options, `name` still groups them, and
                        the lettered chip is that radio's rendering.
                      */}
                      <input
                        type="radio"
                        name={`question-${current.id}`}
                        value={option.key}
                        checked={checked}
                        onChange={() => selectOption(current.id, option.key)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          'rounded-control font-display flex size-[34px] shrink-0 items-center justify-center border text-[13.5px] font-semibold transition-colors duration-150',
                          checked
                            ? 'border-brand-700 bg-brand-700 text-white'
                            : 'border-line-200 bg-canvas text-ink-700',
                        )}
                      >
                        {COPY.exam.optionLetters[optionIndex] ?? COPY.exam.optionKeyFallback}
                      </span>
                      <RichTextView
                        document={option.content}
                        className="min-w-0 flex-1 gap-1"
                        paragraphClassName={cn(
                          'text-[16px]',
                          checked && 'text-brand-900 font-semibold',
                        )}
                      />
                    </label>
                  );
                })}
              </fieldset>
            </div>
          </section>

          {saveStatus === 'error' ? (
            <p
              role="alert"
              className="rounded-card border-error/30 bg-error-soft text-error flex items-start gap-2 border p-4 text-sm font-medium"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {COPY.exam.saveFailedBody}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3.5">
            <div className="flex flex-wrap gap-2.5">
              {/* Forward is left in RTL, so back points right. */}
              <Button
                variant="outline"
                shape="pill"
                size="lg"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                disabled={index === 0}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                {COPY.exam.previousQuestion}
              </Button>
              <Button
                variant="outline"
                shape="pill"
                size="lg"
                onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
                disabled={index >= questions.length - 1}
              >
                {COPY.exam.nextQuestion}
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <Button variant="gradient" shape="pill" size="lg" onClick={() => setAdvanceOpen(true)}>
              {isLastSection ? COPY.exam.submitAction : COPY.exam.advanceAction}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
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
        <ul className="rounded-control bg-surface-muted text-ink-700 flex flex-col gap-1 p-3 text-sm">
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
        // A chip, so the three outcomes read as one control changing state
        // rather than three different pieces of text appearing in the bar.
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150',
        /*
         * These are the on-cover values, because the bar this sits in is navy.
         * The system's soft grounds are audited against white and would land
         * here as three pale stickers on a dark strip.
         *
         * The failure is the exception, and deliberately: it is SOLID `error`
         * with white text at 5.86:1, not a tinted glass like its neighbours,
         * because an unsaved answer does not count and this is the loudest the
         * screen can be without an interrupting announcement.
         */
        status === 'error'
          ? 'bg-error border-error text-white'
          : status === 'saved'
            ? 'border-cover-mint/40 bg-cover-mint/15 text-cover-mint'
            : 'border-white/20 bg-white/10 text-white/85',
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
          <Dialog.Title className="text-ink-900 text-h3">{title}</Dialog.Title>

          <div className="border-warning/30 bg-warning-soft rounded-control mt-4 flex gap-2 border p-3">
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
