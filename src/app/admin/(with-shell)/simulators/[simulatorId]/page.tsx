import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DetailPanel } from '@/components/admin/detail-panel';
import {
  ExamVersionStatusBadge,
  NewExamVersionForm,
  SimulatorSettingsForm,
} from '@/components/admin/exam-version-editor';
import { ProductStatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatDate, formatDurationWords, formatNumber } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  getSimulatorForAdmin,
  parseSimulatorId,
  type AdminSimulatorDetail,
  type AdminSimulatorVersionSummary,
} from '@/services/exams/simulator-admin.service';

export const metadata: Metadata = { title: COPY.adminSimulators.detailTitle };

/**
 * One simulator: its settings, and the versions it owns.
 *
 * Three outcomes, kept apart because collapsing any two of them misleads:
 *
 *  - the simulator does not exist, or the path segment is not an id at all —
 *    `notFound()`, the honest answer to a bad address;
 *  - the query threw — `ErrorState`, never an empty form. A settings form
 *    pre-filled with defaults because a read failed is an invitation to overwrite
 *    a live simulator with them;
 *  - it loaded — the summary, the settings and the versions table.
 */
export default async function AdminSimulatorPage({
  params,
}: {
  params: Promise<{ simulatorId: string }>;
}) {
  const { simulatorId } = await params;

  let simulator: AdminSimulatorDetail | null = null;
  let failed = false;
  try {
    simulator = await getSimulatorForAdmin(parseSimulatorId(simulatorId));
  } catch (error) {
    // The service reports a malformed id as "no such simulator" rather than as a
    // fault, and that distinction has to survive into the page.
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin simulator load failed', { simulatorId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminSimulators.detailTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/simulators">{COPY.adminSimulators.backToSimulators}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!simulator) notFound();

  const versionColumns: readonly DataTableColumn<AdminSimulatorVersionSummary>[] = [
    {
      key: 'versionNumber',
      header: COPY.adminSimulators.versions.columns.versionNumber,
      isRowHeader: true,
      cell: (row) => (
        <Link
          href={`/admin/simulators/${simulator.id}/versions/${row.id}`}
          className="text-brand-700 hover:underline"
        >
          {formatNumber(row.versionNumber)}
        </Link>
      ),
    },
    {
      key: 'status',
      header: COPY.adminSimulators.versions.columns.status,
      cell: (row) => <ExamVersionStatusBadge status={row.status} isActive={row.isActive} />,
    },
    {
      key: 'selectionMode',
      header: COPY.adminSimulators.versions.columns.selectionMode,
      cell: (row) => COPY.adminSimulators.selectionModeLabels[row.selectionMode],
    },
    {
      key: 'totalQuestions',
      header: COPY.adminSimulators.versions.columns.totalQuestions,
      align: 'end',
      cell: (row) => formatNumber(row.totalQuestions),
    },
    {
      key: 'totalDuration',
      header: COPY.adminSimulators.versions.columns.totalDuration,
      cell: (row) => formatDurationWords(row.totalDurationSec),
    },
    {
      key: 'sectionCount',
      header: COPY.adminSimulators.versions.columns.sectionCount,
      align: 'end',
      cell: (row) => formatNumber(row.sectionCount),
    },
    {
      key: 'attemptCount',
      header: COPY.adminSimulators.versions.columns.attemptCount,
      align: 'end',
      cell: (row) => formatNumber(row.attemptCount),
    },
    {
      key: 'publishedAt',
      header: COPY.adminSimulators.versions.columns.publishedAt,
      cell: (row) => (row.publishedAt ? formatDate(row.publishedAt) : COPY.common.notAvailable),
    },
    {
      key: 'actions',
      header: COPY.adminSimulators.versions.columns.actions,
      headerHidden: true,
      align: 'end',
      cell: (row) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/simulators/${simulator.id}/versions/${row.id}`}>
            {COPY.adminCommon.actions.edit}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={simulator.productTitle}
        description={COPY.adminSimulators.detailDescription}
        action={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/products/${simulator.productId}`}>
                {COPY.adminSimulators.openProduct}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/simulators">{COPY.adminSimulators.backToSimulators}</Link>
            </Button>
          </>
        }
      />

      <DetailPanel
        badges={<ProductStatusBadge status={simulator.productStatus} />}
        items={[
          {
            key: 'track',
            label: COPY.adminSimulators.columns.track,
            value: COPY.adminSimulators.trackLabels[simulator.track],
          },
          {
            key: 'activeVersion',
            label: COPY.adminSimulators.columns.activeVersion,
            value:
              simulator.activeVersionNumber === null
                ? COPY.adminSimulators.activeLabels.inactive
                : formatNumber(simulator.activeVersionNumber),
          },
          {
            key: 'versionCount',
            label: COPY.adminSimulators.columns.versionCount,
            value: formatNumber(simulator.versionCount),
          },
          {
            key: 'attemptCount',
            label: COPY.adminSimulators.columns.attemptCount,
            value: formatNumber(simulator.attemptCount),
          },
          {
            key: 'slug',
            label: COPY.adminSimulators.columns.product,
            // Latin, and part of a public URL: isolated so it cannot reorder
            // against the Arabic labels beside it.
            value: simulator.productSlug,
            dir: 'ltr',
          },
          {
            key: 'updatedAt',
            label: COPY.adminCommon.table.updatedAt,
            value: formatDate(simulator.updatedAt),
          },
        ]}
      />

      <SimulatorSettingsForm simulator={simulator} />

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
              {COPY.adminSimulators.versions.title}
            </h2>
            <p className="text-ink-700 max-w-prose text-sm">
              {COPY.adminSimulators.versions.description}
            </p>
          </div>
          <div className="ms-auto">
            <NewExamVersionForm simulatorId={simulator.id} versions={simulator.versions} />
          </div>
        </div>

        {/* No `failed` prop: these rows came from the same read that produced the
            page, so a failure there is the `ErrorState` above rather than an
            empty table here. */}
        <DataTable
          caption={`${COPY.adminSimulators.versions.title} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={versionColumns}
          rows={simulator.versions}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={COPY.adminSimulators.versions.empty.nothingYetTitle}
              description={COPY.adminSimulators.versions.empty.nothingYetBody}
            />
          }
        />
      </Card>
    </div>
  );
}
