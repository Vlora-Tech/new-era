import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  ContactMessageFilters,
  ContactMessagePagination,
  ContactMessageTable,
} from '@/components/admin/contact-message-list';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import { listContactMessages } from '@/services/contact-message.service';
import { contactMessageListQuerySchema } from '@/validators/contact';

export const metadata: Metadata = { title: COPY.adminContact.listTitle };

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = contactMessageListQuerySchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    ),
  );

  let result: Awaited<ReturnType<typeof listContactMessages>> | null = null;
  try {
    result = await listContactMessages(query);
  } catch (error) {
    logger.error('admin contact message list failed', { error });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminContact.listTitle}
        description={COPY.adminContact.listDescription}
      />
      <Notice tone="neutral" role="note">
        {COPY.adminContact.readOnlyNote}
      </Notice>
      <ContactMessageFilters query={query} />
      {query.q && result && result.total > 0 ? (
        <p className="text-ink-700 text-sm">{COPY.adminCommon.search.activeNote}</p>
      ) : null}
      <ContactMessageTable
        rows={result?.rows ?? []}
        failed={result === null}
        filtered={Boolean(query.q)}
      />
      {result ? <ContactMessagePagination result={result} query={query} /> : null}
    </div>
  );
}
