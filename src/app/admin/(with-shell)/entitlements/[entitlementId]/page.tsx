import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { EntitlementDetail } from '@/components/admin/entitlement-detail';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { logger } from '@/lib/logger';
import {
  getEntitlementForAdmin,
  parseEntitlementId,
  type AdminEntitlementDetail,
} from '@/services/access/entitlement-admin.service';

export const metadata: Metadata = { title: COPY.adminEntitlements.detailTitle };

/**
 * One entitlement, and the history that explains it.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the entitlement does not exist, or the path segment is not an id at all —
 *    `notFound()`. The service reports a malformed id as "no such row" rather
 *    than as a fault, precisely so a bad address cannot arrive at the driver as
 *    an invalid `uuid` cast and be reported as a 500;
 *  - the query threw — `ErrorState`. A record screen has one read behind it, so
 *    there is no half-loaded entitlement to draw a panel around, and an empty
 *    history table would say "access was never withdrawn" — a claim about a
 *    paying student's account that a database outage is not entitled to make;
 *  - it loaded — the record.
 */
export default async function AdminEntitlementPage({
  params,
}: {
  params: Promise<{ entitlementId: string }>;
}) {
  const { entitlementId } = await params;

  let entitlement: AdminEntitlementDetail | null = null;
  let failed = false;
  try {
    entitlement = await getEntitlementForAdmin(parseEntitlementId(entitlementId));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin entitlement load failed', { entitlementId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminEntitlements.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/entitlements">{COPY.adminEntitlements.backToList}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!entitlement) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={entitlement.productTitle}
        description={COPY.adminEntitlements.detailDescription}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/entitlements">{COPY.adminEntitlements.backToList}</Link>
          </Button>
        }
      />

      <EntitlementDetail entitlement={entitlement} />
    </div>
  );
}
