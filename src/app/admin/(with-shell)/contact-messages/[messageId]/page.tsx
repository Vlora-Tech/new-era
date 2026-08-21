import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { DetailPanel } from '@/components/admin/detail-panel';
import { Button } from '@/components/ui/button';
import { ErrorState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime } from '@/lib/format';
import { logger } from '@/lib/logger';
import { getContactMessage } from '@/services/contact-message.service';
import { contactMessageIdSchema } from '@/validators/contact';

export const metadata: Metadata = { title: COPY.adminContact.detailTitle };

export default async function AdminContactMessagePage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const parsed = contactMessageIdSchema.safeParse((await params).messageId);
  if (!parsed.success) notFound();

  let message: Awaited<ReturnType<typeof getContactMessage>> | undefined;
  try {
    message = await getContactMessage(parsed.data);
  } catch (error) {
    logger.error('admin contact message detail failed', { error, messageId: parsed.data });
  }

  if (message === null) notFound();
  if (message === undefined) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminContact.detailTitle}
        action={
          <Button asChild variant="outline">
            <Link href="/admin/contact-messages">{COPY.adminCommon.actions.backToList}</Link>
          </Button>
        }
      />
      <Notice tone="neutral" role="note">
        {COPY.adminContact.readOnlyNote}
      </Notice>
      <DetailPanel
        columns={2}
        items={[
          { key: 'name', label: COPY.adminContact.fields.name, value: message.name },
          {
            key: 'email',
            label: COPY.adminContact.fields.email,
            value: (
              <a className="text-brand-700 hover:underline" href={`mailto:${message.email}`}>
                {message.email}
              </a>
            ),
            dir: 'ltr',
          },
          {
            key: 'subject',
            label: COPY.adminContact.fields.subject,
            value: message.subject ?? COPY.adminContact.noSubject,
          },
          {
            key: 'receivedAt',
            label: COPY.adminContact.fields.receivedAt,
            value: formatDateTime(message.createdAt),
          },
        ]}
      >
        <div className="border-line-200 border-t pt-5">
          <h2 className="text-ink-900 text-sm font-semibold">{COPY.adminContact.fields.message}</h2>
          <p className="text-ink-900 mt-3 leading-[1.9] whitespace-pre-wrap">{message.message}</p>
        </div>
      </DetailPanel>
    </div>
  );
}
