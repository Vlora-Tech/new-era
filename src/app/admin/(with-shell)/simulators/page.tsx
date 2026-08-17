import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.admin.simulators };

export default function AdminSimulatorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-semibold">{COPY.admin.simulators}</h1>
        <p className="text-ink-700 max-w-prose">{COPY.adminPages.simulatorsDescription}</p>
      </header>

      <EmptyState
        title={COPY.adminPages.notBuiltTitle}
        description={COPY.adminPages.notBuiltBody}
      />
    </div>
  );
}
