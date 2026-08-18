import type { Metadata } from 'next';
import Link from 'next/link';

import { OrderList, type StudentOrder } from '@/components/dashboard/student-records';
import { Button } from '@/components/ui/button';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: COPY.dashboard.myOrders };
export const dynamic = 'force-dynamic';

const ORDER_LIMIT = 50;

export default async function DashboardOrdersPage() {
  const user = await requireUserPage(ROUTES.dashboard);

  let orders: StudentOrder[] = [];
  let failed = false;

  try {
    // Every column read here is the order's own snapshot, so a later price or
    // title change on the product cannot rewrite what the student was charged.
    orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: ORDER_LIMIT,
      select: {
        id: true,
        productTitle: true,
        productType: true,
        amountHalalas: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    failed = true;
    logger.error('dashboard orders query failed', { userId: user.id, error });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">{COPY.dashboard.myOrders}</h1>
        <p className="text-ink-700">{COPY.dashboard.ordersSubtitle}</p>
      </header>

      <OrderList
        items={orders}
        failed={failed}
        emptyTitle={COPY.dashboard.noOrders}
        emptyDescription={COPY.dashboard.noOrdersBody}
        emptyAction={
          <Button asChild>
            <Link href={ROUTES.courses}>{COPY.dashboard.noOrdersAction}</Link>
          </Button>
        }
      />
    </div>
  );
}
