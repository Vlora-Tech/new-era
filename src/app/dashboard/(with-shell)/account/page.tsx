import type { Metadata } from 'next';

import { Card, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.myAccount };
export const dynamic = 'force-dynamic';

type AccountDetails = {
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
};

export default async function DashboardAccountPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  // `CurrentUser` deliberately carries only what the guards need, so the phone
  // number and the creation date are read here rather than widened into it.
  let account: AccountDetails | null = null;
  try {
    account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, createdAt: true },
    });
  } catch (error) {
    logger.error('dashboard account query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">{COPY.dashboard.myAccount}</h1>
        <p className="text-ink-700">{COPY.dashboard.accountSubtitle}</p>
      </header>

      {account === null ? (
        <ErrorState />
      ) : (
        <Card className="p-6">
          <dl className="divide-line-200 flex flex-col divide-y">
            <Row label={COPY.dashboard.accountName}>{account.name}</Row>

            {/*
              The address is Latin inside an Arabic paragraph; isolating it stops
              a leading digit or a trailing dot from reordering the line.
            */}
            <Row label={COPY.dashboard.accountEmail}>
              <bdi dir="ltr">{account.email}</bdi>
            </Row>

            <Row label={COPY.dashboard.accountPhone}>
              {account.phone ? (
                <bdi dir="ltr">{account.phone}</bdi>
              ) : (
                <span className="text-ink-600 font-normal">
                  {COPY.dashboard.accountNotProvided}
                </span>
              )}
            </Row>

            <Row label={COPY.dashboard.accountCreatedAt}>{formatDate(account.createdAt)}</Row>
          </dl>
        </Card>
      )}

      {/* Saying that editing does not exist yet is honest; an inert form is not. */}
      <p className="text-ink-700 max-w-prose text-sm">{COPY.dashboard.accountReadOnlyNote}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-600 text-sm">{label}</dt>
      <dd className="text-ink-900 text-sm font-medium">{children}</dd>
    </div>
  );
}
