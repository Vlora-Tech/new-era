'use client';

import { useState, useTransition, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, Layers, ListChecks, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { ACCENT } from '@/lib/accent';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The screen between "an attempt exists" and "the clock is running".
 *
 * The start button is the only control on the page, and pressing it is the
 * moment time begins. Everything above it — the structure, the rules, the
 * independence statement — is there so nobody starts a timed exam without
 * having been told that closing the tab does not pause it and that advancing a
 * section cannot be undone.
 *
 * The disclaimer sits above the instructions rather than in a footer. It is a
 * statement about what this product is, and a student reading it after they
 * have already started has read it too late.
 */
export type InstructionsSection = {
  position: number;
  title: string;
  durationSec: number;
  questionCount: number;
};

export function ExamInstructions({
  attemptId,
  simulatorTitle,
  sections,
  totalQuestions,
  totalDurationSec,
  resultDisclaimer,
}: {
  attemptId: string;
  simulatorTitle: string;
  sections: InstructionsSection[];
  totalQuestions: number;
  totalDurationSec: number;
  resultDisclaimer: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/exam-attempts/${attemptId}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (!response.ok) {
        setError(COPY.exam.startFailed);
        setSubmitting(false);
        return;
      }
      // The server decided the start instant; re-rendering the page reads it
      // back rather than the browser assuming the clock began when it asked.
      startTransition(() => router.refresh());
    } catch {
      setError(COPY.exam.startFailed);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-brand-700 text-sm font-semibold">{simulatorTitle}</p>
        <h1 className="text-ink-900 text-h2">{COPY.exam.instructionsTitle}</h1>
        <p className="text-ink-700 text-lead measure-ar-lg">{COPY.exam.instructionsIntro}</p>
      </header>

      {/* The independence statement keeps its place above the instructions; only
          its framing changed. */}
      <Card className="flex gap-4 p-5 sm:p-6">
        <span
          aria-hidden="true"
          className="bg-brand-100 text-brand-700 rounded-control flex size-10 shrink-0 items-center justify-center"
        >
          <ShieldCheck className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-ink-900 text-base font-semibold">{COPY.exam.disclaimerTitle}</h2>
          <p className="text-ink-700 text-sm leading-relaxed">
            {resultDisclaimer || COPY.legal.independenceDisclaimer}
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-ink-900 text-h3">{COPY.exam.structureTitle}</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={COPY.exam.sectionsCount}
            value={formatNumber(sections.length)}
            icon={Layers}
            ground={ACCENT.blue.soft}
            hairline={ACCENT.blue.hairline}
            fill={ACCENT.blue.fill}
          />
          <Stat
            label={COPY.exam.questionsCount}
            value={formatNumber(totalQuestions)}
            icon={ListChecks}
            ground={ACCENT.teal.soft}
            hairline={ACCENT.teal.hairline}
            fill={ACCENT.teal.fill}
          />
          <Stat
            label={COPY.exam.totalDuration}
            value={formatDurationWords(totalDurationSec)}
            icon={Clock}
            ground={ACCENT.gold.soft}
            hairline={ACCENT.gold.hairline}
            fill={ACCENT.gold.fill}
          />
        </dl>

        <ol className="flex flex-col gap-2">
          {sections.map((section) => (
            <li
              key={section.position}
              className="rounded-panel border-line-200 bg-surface flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border px-4 py-3"
            >
              <span className="text-ink-900 flex items-center gap-3 font-semibold">
                {/* Hidden from the reading order: the list already carries the
                    position, and announcing it twice adds nothing. */}
                <span
                  aria-hidden="true"
                  className="bg-brand-100 text-brand-700 flex size-7 shrink-0 items-center justify-center rounded-[4px] text-xs font-semibold tabular-nums"
                >
                  {formatNumber(section.position)}
                </span>
                {section.title}
              </span>
              <span className="text-ink-700 text-sm">
                {COPY.exam.questionsCount}: {formatNumber(section.questionCount)} ·{' '}
                {COPY.exam.sectionDuration}: {formatDurationWords(section.durationSec)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-ink-900 text-h3">{COPY.exam.rulesTitle}</h2>
        <Card className="p-5 sm:p-6">
          <ul className="flex flex-col gap-3">
            {COPY.exam.rules.map((rule) => (
              <li key={rule} className="text-ink-700 flex gap-3 leading-relaxed">
                <span
                  aria-hidden="true"
                  className="bg-brand-500 mt-2.5 size-1.5 shrink-0 rounded-full"
                />
                {rule}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-control border-error/30 bg-error-soft text-error flex items-center gap-2 border px-4 py-3 text-sm font-medium"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="flex justify-start">
        <Button size="lg" onClick={start} loading={submitting || pending}>
          {submitting || pending ? (
            COPY.exam.starting
          ) : (
            <>
              {COPY.exam.startAction}
              {/* Forward is left in RTL. */}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * The identity's stat tile: soft accent ground, accent hairline, and the domain
 * glyph in a filled square. The fill carries a white *glyph*, never text — it is
 * audited to 3:1, not 4.5:1.
 */
function Stat({
  label,
  value,
  icon: Icon,
  ground,
  hairline,
  fill,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  ground: string;
  hairline: string;
  fill: string;
}) {
  return (
    <div className={cn('rounded-panel flex flex-col gap-3 border p-4', ground, hairline)}>
      <span
        aria-hidden="true"
        className={cn('rounded-control flex size-9 items-center justify-center text-white', fill)}
      >
        <Icon className="size-5" />
      </span>
      {/* ink-700 is the floor on a tinted ground; ink-600 is not allowed here. */}
      <dt className="text-ink-700 text-sm font-medium">{label}</dt>
      <dd className="text-ink-900 text-h3 tabular-nums">{value}</dd>
    </div>
  );
}
