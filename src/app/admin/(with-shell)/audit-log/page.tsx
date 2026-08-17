import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { EmptyState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.admin.auditLog };

export default function AdminAuditLogPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.admin.auditLog}
        description={COPY.adminPages.auditLogDescription}
      />

      <EmptyState
        title={COPY.adminPages.notBuiltTitle}
        description={COPY.adminPages.notBuiltBody}
      />
    </div>
  );
}
