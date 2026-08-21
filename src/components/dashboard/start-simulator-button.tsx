'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

/**
 * The control that actually begins a simulation.
 *
 * Until this existed the student journey was a loop: the public simulator page
 * offered «ابدأ المحاكاة» which linked to the dashboard, and the dashboard's own
 * card linked back to the public page. `POST /api/exams/[simulatorId]/attempts`
 * was built, guarded, rate-limited and integration-tested — and nothing in the
 * interface ever called it, so an entitled student could not sit an exam at all.
 *
 * Two properties are worth stating:
 *
 *  - **Creating an attempt is not starting one.** The endpoint's own comment
 *    says so: it mints the attempt and the client then navigates to the
 *    instructions screen, where the student reads the rules and presses the
 *    button that starts the clock. This component therefore never begins timing,
 *    which is why its label is not `COPY.exam.startAction`.
 *  - **A double-press cannot produce two attempts.** The service is idempotent
 *    behind a partial unique index — one live full-simulation attempt per
 *    student per exam version — and answers 200 with the existing id rather than
 *    201 with a new one. The button still disables itself while in flight, but
 *    that is for the student's benefit, not the data's.
 */
export function StartSimulatorButton({ simulatorId }: { simulatorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch(`/api/exams/${simulatorId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'FULL_SIMULATION' }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { attemptId?: string };
        error?: { message?: string };
      };

      if (!result.ok || !result.data?.attemptId) {
        // The server's own Arabic sentence when it has one — it knows why it
        // refused (no entitlement, a blueprint the bank cannot satisfy, a rate
        // limit) far better than this component can guess.
        toast.error(result.error?.message ?? COPY.dashboard.startSimulatorFailed);
        return;
      }

      router.push(`/exam/${result.data.attemptId}`);
    } catch {
      toast.error(COPY.dashboard.startSimulatorFailed);
    } finally {
      // Deliberately not left disabled on success: the push above is a client
      // navigation, and a button frozen behind a slow route transition looks
      // like the press was swallowed.
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" loading={busy} onClick={() => void start()}>
      {/*
        A play glyph, from the design. It survives the rest of that mock being
        declined: an arrow genuinely carries "start" without having to be taught,
        which is the test this codebase applies before an icon joins a label.
        The `loading` prop swaps in its own spinner, so the two never coexist.
      */}
      {busy ? null : <Play className="size-4" aria-hidden="true" />}
      {busy ? COPY.dashboard.startingSimulator : COPY.dashboard.startSimulator}
    </Button>
  );
}
