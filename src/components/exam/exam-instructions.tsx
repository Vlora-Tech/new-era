'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatNumber } from '@/lib/format';

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
      <header className="flex flex-col gap-2">
        <p className="text-brand-700 text-sm font-medium">{simulatorTitle}</p>
        <h1 className="text-ink-900 text-2xl font-semibold sm:text-3xl">
          {COPY.exam.instructionsTitle}
        </h1>
        <p className="text-ink-700">{COPY.exam.instructionsIntro}</p>
      </header>

      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-ink-900 text-base font-semibold">{COPY.exam.disclaimerTitle}</h2>
        <p className="text-ink-700 text-sm leading-relaxed">
          {resultDisclaimer || COPY.legal.independenceDisclaimer}
        </p>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.structureTitle}</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label={COPY.exam.sectionsCount} value={formatNumber(sections.length)} />
          <Stat label={COPY.exam.questionsCount} value={formatNumber(totalQuestions)} />
          <Stat label={COPY.exam.totalDuration} value={formatDurationWords(totalDurationSec)} />
        </dl>

        <ol className="flex flex-col gap-2">
          {sections.map((section) => (
            <li
              key={section.position}
              className="rounded-control border-line-200 flex flex-wrap items-baseline justify-between gap-2 border px-4 py-3"
            >
              <span className="text-ink-900 font-medium">{section.title}</span>
              <span className="text-ink-700 text-sm">
                {COPY.exam.questionsCount}: {formatNumber(section.questionCount)} ·{' '}
                {COPY.exam.sectionDuration}: {formatDurationWords(section.durationSec)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink-900 text-lg font-semibold">{COPY.exam.rulesTitle}</h2>
        <ul className="text-ink-700 flex list-inside list-disc flex-col gap-2 text-sm leading-relaxed">
          {COPY.exam.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="text-error flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="flex justify-start">
        <Button size="lg" onClick={start} loading={submitting || pending}>
          {submitting || pending ? COPY.exam.starting : COPY.exam.startAction}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border-line-200 flex flex-col gap-1 border px-4 py-3">
      <dt className="text-ink-600 text-sm">{label}</dt>
      <dd className="text-ink-900 text-lg font-semibold">{value}</dd>
    </div>
  );
}
