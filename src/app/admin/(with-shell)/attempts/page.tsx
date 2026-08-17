import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.admin.attempts };

export default function AdminAttemptsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.admin.attempts}
        description={COPY.adminPages.attemptsDescription}
      />

      <EmptyState
        title={COPY.adminPages.notBuiltTitle}
        description={COPY.adminPages.notBuiltBody}
      />
    </div>
  );
}
