import Link from 'next/link';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DetailPanel, type DetailItem } from '@/components/admin/detail-panel';
import { EntitlementStatusActions } from '@/components/admin/entitlement-grant-form';
import { Badge, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime } from '@/lib/format';
import type {
  AdminEntitlementDetail,
  AdminEntitlementEvent,
} from '@/services/access/entitlement-admin.service';

/**
 * One entitlement: the current access, and the whole chronology behind it.
 *
 * The screen exists to answer "لماذا يملك هذا الطالب وصولًا؟", and the list
 * cannot: it shows one `lastEvent` cell, which collapses a purchase, a refund
 * and a goodwill reinstatement into whichever happened most recently. The
 * narrative is the answer, and it is the reason `getEntitlementForAdmin` returns
 * the events oldest-first and untruncated — a trail with a "…and 40 more" in the
 * middle is not evidence of anything.
 *
 * A Server Component apart from the one transition control, which has to be a
 * client boundary because it collects a mandatory reason and posts it. There is
 * no edit form and no delete button anywhere on this page, and that is the
 * design rather than an omission: `grantedAt` and `revokedAt` are records of
 * things that happened, not fields, and the history is append-only. A mistake is
 * corrected by a further transition, which is itself recorded.
 */

const ENTITLEMENTS = COPY.adminEntitlements;

const eventColumns: readonly DataTableColumn<AdminEntitlementEvent>[] = [
  {
    key: 'createdAt',
    header: ENTITLEMENTS.history.columns.createdAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'type',
    header: ENTITLEMENTS.history.columns.type,
    cell: (row) => (
      <Badge variant={row.type === 'REVOKED' ? 'neutral' : 'success'}>
        {ENTITLEMENTS.eventTypeLabels[row.type]}
      </Badge>
    ),
  },
  {
    key: 'source',
    header: ENTITLEMENTS.history.columns.source,
    cell: (row) => ENTITLEMENTS.sourceLabels[row.source],
  },
  {
    key: 'reason',
    header: ENTITLEMENTS.history.columns.reason,
    // A purchase carries no reason and needs none; only a manual action is
    // required to state one. The absence is worded rather than left blank so it
    // cannot read as a reason the screen failed to load.
    cell: (row) =>
      row.reason ?? <span className="text-ink-600 text-xs">{ENTITLEMENTS.history.noReason}</span>,
  },
  {
    key: 'order',
    header: ENTITLEMENTS.history.columns.order,
    dir: 'ltr',
    cell: (row) =>
      row.orderId ? (
        <Link
          href={`/admin/orders/${row.orderId}`}
          className="text-brand-700 text-xs hover:underline"
        >
          {row.orderId}
        </Link>
      ) : (
        '—'
      ),
  },
  {
    key: 'actor',
    header: ENTITLEMENTS.history.columns.actor,
    dir: 'ltr',
    // `EntitlementEvent` has no `actorEmail` column and the relation is
    // `SetNull`, so an administrator whose account was removed genuinely reads
    // as the platform. The label says "المنصة" rather than leaving the cell
    // empty, because an empty cell would look like a rendering fault.
    cell: (row) =>
      row.actorEmail ? (
        <span className="text-ink-700 text-xs">{row.actorEmail}</span>
      ) : (
        <span className="text-ink-600 text-xs">{ENTITLEMENTS.history.systemActor}</span>
      ),
  },
];

export function EntitlementDetail({ entitlement }: { entitlement: AdminEntitlementDetail }) {
  const items: DetailItem[] = [
    {
      key: 'student',
      label: ENTITLEMENTS.fields.student.label,
      value: (
        <Link
          href={`/admin/students/${entitlement.userId}`}
          className="text-brand-700 hover:underline"
        >
          {entitlement.studentName}
        </Link>
      ),
      hint: ENTITLEMENTS.fields.student.hint,
    },
    {
      key: 'email',
      label: ENTITLEMENTS.columns.email,
      value: entitlement.studentEmail,
      dir: 'ltr',
    },
    {
      key: 'product',
      label: ENTITLEMENTS.fields.product.label,
      value: (
        <Link
          href={`/admin/products/${entitlement.productId}`}
          className="text-brand-700 hover:underline"
        >
          {entitlement.productTitle}
        </Link>
      ),
      hint: ENTITLEMENTS.fields.product.hint,
    },
    {
      key: 'productType',
      label: ENTITLEMENTS.columns.productType,
      value: COPY.statusLabels.productType[entitlement.productType],
    },
    {
      key: 'status',
      label: ENTITLEMENTS.fields.status.label,
      value: ENTITLEMENTS.statusLabels[entitlement.status],
      hint: ENTITLEMENTS.fields.status.hint,
    },
    {
      key: 'grantedAt',
      label: ENTITLEMENTS.fields.grantedAt.label,
      value: formatDateTime(entitlement.grantedAt),
      hint: ENTITLEMENTS.fields.grantedAt.hint,
    },
    {
      key: 'revokedAt',
      // Active access has never been withdrawn, which is a different fact from a
      // date the screen could not read — so the specific absence, not the
      // panel's generic "غير متاح".
      label: ENTITLEMENTS.fields.revokedAt.label,
      value: entitlement.revokedAt ? formatDateTime(entitlement.revokedAt) : COPY.common.no,
      hint: ENTITLEMENTS.fields.revokedAt.hint,
    },
    {
      key: 'source',
      label: ENTITLEMENTS.filters.source,
      value: ENTITLEMENTS.sourceLabels[entitlement.source],
      hint: ENTITLEMENTS.sourceHints[entitlement.source],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DetailPanel
        title={ENTITLEMENTS.sections.summary}
        badges={
          <>
            <Badge variant={entitlement.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {ENTITLEMENTS.statusLabels[entitlement.status]}
            </Badge>
            <Badge variant="outline" shape="square">
              {COPY.statusLabels.productType[entitlement.productType]}
            </Badge>
          </>
        }
        items={items}
        footer={
          <div className="flex flex-col gap-3">
            <EntitlementStatusActions entitlementId={entitlement.id} status={entitlement.status} />
            {/* Why there is one button here and not four. An administrator who
                cannot find "تعديل" needs to be told it does not exist and why,
                rather than left to conclude the screen is unfinished. */}
            <p className="text-ink-600 text-xs">{ENTITLEMENTS.errors.editUnavailable}</p>
            <p className="text-ink-600 text-xs">{ENTITLEMENTS.errors.deleteUnavailable}</p>
          </div>
        }
      />

      {entitlement.sourceOrderId ? (
        <DetailPanel
          title={ENTITLEMENTS.sections.order}
          items={[
            {
              key: 'sourceOrder',
              label: ENTITLEMENTS.fields.sourceOrder.label,
              value: (
                <Link
                  href={`/admin/orders/${entitlement.sourceOrderId}`}
                  className="text-brand-700 hover:underline"
                >
                  {entitlement.sourceOrderId}
                </Link>
              ),
              dir: 'ltr',
              hint: ENTITLEMENTS.fields.sourceOrder.hint,
            },
          ]}
          columns={1}
        />
      ) : null}

      {/* Stated beside the button that would otherwise be pressed on the
          assumption that withdrawing access is a refund, or that it deletes
          what the student has done. Neither is true. */}
      <Notice tone="neutral" role="note">
        {ENTITLEMENTS.notices.accessIsNotMoney} {ENTITLEMENTS.notices.revokeKeepsProgress}
      </Notice>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {ENTITLEMENTS.history.title}
          </h2>
          <p className="text-ink-700 max-w-prose text-sm">{ENTITLEMENTS.history.description}</p>
        </div>

        {/*
          No `failed` prop, and no need for one. This table's rows come from the
          same single read that produced the panel above: if it had thrown there
          would be no record to draw at all, and the page renders `ErrorState`
          instead of this component. An empty history is therefore genuinely
          empty — which for an entitlement means the row predates the event
          table, not that nothing ever happened.
        */}
        <DataTable
          caption={`${ENTITLEMENTS.history.title} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={eventColumns}
          rows={entitlement.events}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={ENTITLEMENTS.history.empty.nothingYetTitle}
              description={ENTITLEMENTS.history.empty.nothingYetBody}
            />
          }
        />

        <p className="text-ink-700 text-sm">{ENTITLEMENTS.errors.historyImmutable}</p>
        <p className="text-ink-700 text-sm">{ENTITLEMENTS.notices.auditedAction}</p>
      </section>
    </div>
  );
}
