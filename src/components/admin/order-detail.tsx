'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DetailPanel, type DetailItem } from '@/components/admin/detail-panel';
import { OrderStatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatHalalas, formatNumber } from '@/lib/format';
import type {
  AdminEntitlementEventRow,
  AdminOrderActivityRow,
  AdminOrderDetail,
  AdminPaymentRow,
  AdminWebhookRow,
} from '@/services/payments/order-admin.service';

/**
 * The order record: the order, every payment attempt on it, the provider notices
 * behind them, and what the whole thing did to the student's access.
 *
 * **Why this file crosses the client boundary at all.** Everything on it is
 * read-only except one control — "ask the provider again" — and that control has
 * to be a client component, because the established pattern in this codebase is
 * a client `fetch` against a route handler and there are no server actions
 * anywhere. The panels are plain markup with no state, so the cost is bundle
 * size rather than behaviour; splitting them into a second module would have
 * meant a third file for one button.
 *
 * What the screen deliberately cannot do:
 *
 *  - **Edit anything.** The amount, the currency and the product snapshot are
 *    what was agreed at checkout. There is no form here, and the notice says so.
 *  - **Move money.** No refund control, no "mark as paid", no status select.
 *    Refunds happen at the provider, and this application reconciles against the
 *    provider's record. A refund button here would be a second, weaker path to
 *    the same money, outside the provider's own controls.
 *  - **Clear a review flag.** `needsReview` means the server met something it
 *    would have had to guess about — a partial refund, an amount that did not
 *    match — and stopped. It is surfaced at the top of the record because it is
 *    the reason this screen gets opened.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: { outcome?: string; orderStatus?: string; changed?: boolean };
  error?: { code?: string; message?: string };
};

const ORDERS = COPY.adminOrders;

/** A value that is genuinely absent, rendered as such rather than as a blank. */
function dateOrNothing(value: Date | string | null): string | null {
  return value ? formatDateTime(value) : null;
}

// ── Payments ─────────────────────────────────────────────────────────────

const paymentColumns: readonly DataTableColumn<AdminPaymentRow>[] = [
  {
    key: 'providerPaymentId',
    header: ORDERS.payments.columns.providerPaymentId,
    isRowHeader: true,
    dir: 'ltr',
    cell: (row) => (
      <span className="text-ink-700 text-xs">
        {row.providerPaymentId ?? COPY.common.notAvailable}
      </span>
    ),
  },
  {
    key: 'status',
    header: ORDERS.payments.columns.status,
    cell: (row) => ORDERS.paymentStatusLabels[row.status],
  },
  {
    key: 'amount',
    header: ORDERS.payments.columns.amount,
    align: 'end',
    cell: (row) => formatHalalas(row.amountHalalas),
  },
  {
    key: 'refunded',
    header: ORDERS.payments.columns.refunded,
    align: 'end',
    // Zero is a real answer here and is shown as an amount, not as a dash: "0.00
    // returned" and "we do not know" are different facts.
    cell: (row) => formatHalalas(row.refundedHalalas),
  },
  {
    key: 'mode',
    header: ORDERS.payments.columns.mode,
    cell: (row) => (
      <Badge variant={row.configuredMode === 'LIVE' ? 'neutral' : 'outline'} shape="square">
        {ORDERS.modeLabels[row.configuredMode]}
      </Badge>
    ),
  },
  {
    key: 'needsReview',
    header: ORDERS.payments.columns.needsReview,
    cell: (row) =>
      row.needsReview ? (
        <Badge variant="warning">{ORDERS.review.badge}</Badge>
      ) : (
        <span className="text-ink-600">{COPY.common.no}</span>
      ),
  },
  {
    key: 'failure',
    header: ORDERS.payments.columns.failure,
    dir: 'ltr',
    /*
     * The provider's failure *code* — a stable machine token an administrator can
     * quote to the gateway's support. The provider's own failure *message* is
     * never rendered: it is English prose written for a different audience, it is
     * kept server-side for diagnosis, and this screen reports payment outcomes in
     * Arabic. The service does not even select the column.
     */
    cell: (row) =>
      row.failureCode ? <span className="text-ink-700 text-xs">{row.failureCode}</span> : '—',
  },
  {
    key: 'reconcileCount',
    header: ORDERS.payments.columns.reconcileCount,
    align: 'end',
    cell: (row) => formatNumber(row.reconcileCount),
  },
  {
    key: 'lastReconciledAt',
    header: ORDERS.payments.columns.lastReconciledAt,
    cell: (row) => dateOrNothing(row.lastReconciledAt) ?? COPY.common.notAvailable,
  },
  {
    key: 'createdAt',
    header: ORDERS.payments.columns.createdAt,
    cell: (row) => formatDateTime(row.createdAt),
  },
];

// ── Webhooks ─────────────────────────────────────────────────────────────

const webhookColumns: readonly DataTableColumn<AdminWebhookRow>[] = [
  {
    key: 'receivedAt',
    header: ORDERS.webhooks.columns.receivedAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.receivedAt),
  },
  {
    key: 'eventType',
    header: ORDERS.webhooks.columns.eventType,
    // The gateway's own event name. Latin, and it is an identifier rather than a
    // sentence, so it is isolated instead of translated into something that would
    // no longer match what the provider's dashboard calls it.
    dir: 'ltr',
    cell: (row) => <span className="text-ink-700 text-xs">{row.eventType}</span>,
  },
  {
    key: 'status',
    header: ORDERS.webhooks.columns.status,
    cell: (row) => ORDERS.webhookStatusLabels[row.status],
  },
  {
    key: 'attemptCount',
    header: ORDERS.webhooks.columns.attemptCount,
    align: 'end',
    cell: (row) => formatNumber(row.attemptCount),
  },
  {
    key: 'liveMode',
    header: ORDERS.webhooks.columns.liveMode,
    cell: (row) =>
      row.liveMode === null
        ? COPY.common.notAvailable
        : row.liveMode
          ? COPY.common.yes
          : COPY.common.no,
  },
  {
    key: 'processedAt',
    header: ORDERS.webhooks.columns.processedAt,
    cell: (row) => dateOrNothing(row.processedAt) ?? COPY.common.notAvailable,
  },
  {
    key: 'hasError',
    header: ORDERS.webhooks.columns.hasError,
    /*
     * The stored message is never rendered. It is a raw `Error.message` from any
     * throw during processing — a driver failure puts the database host, port
     * and username into it — and this screen is not the place to publish that.
     * The service reduces it to a boolean for the same reason it omits
     * `PaymentAttempt.failureMessage` entirely.
     */
    cell: (row) =>
      row.hasError ? (
        <span className="text-ink-700 text-xs">{ORDERS.webhooks.errorRecorded}</span>
      ) : (
        '—'
      ),
  },
];

// ── Access history ───────────────────────────────────────────────────────

const entitlementEventColumns: readonly DataTableColumn<AdminEntitlementEventRow>[] = [
  {
    key: 'createdAt',
    header: COPY.adminCommon.table.createdAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'type',
    header: COPY.adminCommon.table.status,
    cell: (row) => COPY.adminEntitlements.eventTypeLabels[row.type],
  },
  {
    key: 'reason',
    header: ORDERS.review.reason.label,
    cell: (row) => row.reason ?? COPY.adminEntitlements.history.noReason,
  },
];

const activityColumns: readonly DataTableColumn<AdminOrderActivityRow>[] = [
  {
    key: 'createdAt',
    header: COPY.adminAudit.columns.createdAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'action',
    header: COPY.adminAudit.columns.action,
    /*
     * `AuditLog.action` is a `String` column, so the lookup is guarded rather
     * than cast: a row written by a newer deployment than this one must render
     * as "an action we do not recognise" instead of as an empty cell.
     */
    cell: (row) =>
      COPY.adminAudit.actionLabels[row.action as keyof typeof COPY.adminAudit.actionLabels] ??
      COPY.adminAudit.unknownAction,
  },
  {
    key: 'actor',
    header: COPY.adminAudit.columns.actorEmail,
    dir: 'ltr',
    cell: (row) =>
      row.actorEmail ? (
        <span className="text-ink-700 text-xs">{row.actorEmail}</span>
      ) : (
        <span className="text-ink-600 text-xs">{COPY.adminAudit.systemActor}</span>
      ),
  },
];

// ── The reconcile control ────────────────────────────────────────────────

/**
 * The one action on this screen.
 *
 * It sends no body: the endpoint takes the order id from its path and derives
 * the gateway payment from the order's own attempts. Pressing it twice is safe
 * by construction — reconciliation locks the order row and answers
 * `ALREADY_FULFILLED` for an order that is already paid — and the confirmation
 * says so, because "are you sure?" without a consequence is a prompt people
 * learn to click through.
 *
 * The outcome is reported with the service's own vocabulary rather than a
 * blanket "done". Nine outcomes exist and four of them mean nothing changed;
 * collapsing them into one success message is how somebody walks away believing
 * a student now has access they do not have.
 */
function ReconcileAction({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = (await response.json()) as ApiEnvelope;

      if (!result.ok) {
        toast.error(result.error?.message ?? ORDERS.toast.reconcileFailed);
        return;
      }

      const outcome = result.data?.outcome as
        keyof typeof ORDERS.reconcileOutcomeLabels | undefined;
      const description = outcome ? ORDERS.reconcileOutcomeLabels[outcome] : undefined;

      if (result.data?.changed) {
        toast.success(ORDERS.toast.reconciled, { description });
      } else {
        // Neutral rather than a success tick: "the provider had nothing new" is
        // a true answer, not an achievement.
        toast(ORDERS.toast.reconcileUnchanged, { description });
      }
      router.refresh();
    } catch {
      toast.error(ORDERS.toast.reconcileFailed);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={() => setConfirming(true)}>
          {ORDERS.reconcile.action}
        </Button>
        <p className="text-ink-700 text-sm">{ORDERS.reconcile.hint}</p>
      </div>

      {/* Said before the button is pressed rather than after: a refusal that only
          arrives on click is a refusal the administrator had to earn. */}
      {disabled ? <p className="text-ink-700 text-sm">{ORDERS.errors.noPaymentAttempt}</p> : null}

      {confirming ? (
        <Notice tone="warning" role="status" className="flex flex-col gap-3">
          <span className="text-ink-900 block font-medium">{ORDERS.reconcile.confirmTitle}</span>
          <span className="block text-sm">{ORDERS.reconcile.confirmBody}</span>
          <span className="flex flex-wrap gap-2">
            <Button type="button" size="sm" loading={busy} onClick={run}>
              {busy ? ORDERS.reconcile.running : ORDERS.reconcile.confirmAction}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              {COPY.adminCommon.confirmDelete.cancel}
            </Button>
          </span>
        </Notice>
      ) : null}
    </div>
  );
}

// ── The record ───────────────────────────────────────────────────────────

export function OrderDetail({ order }: { order: AdminOrderDetail }) {
  const isTestMode = order.payments.some((payment) => payment.configuredMode === 'TEST');

  const orderItems: DetailItem[] = [
    {
      key: 'id',
      label: ORDERS.fields.id.label,
      value: order.id,
      dir: 'ltr',
      hint: ORDERS.fields.id.hint,
    },
    {
      key: 'productTitle',
      label: ORDERS.fields.productTitle.label,
      value: order.productTitle,
      hint: ORDERS.fields.productTitle.hint,
    },
    {
      key: 'productType',
      label: ORDERS.fields.productType.label,
      value: COPY.statusLabels.productType[order.productType],
      hint: ORDERS.fields.productType.hint,
    },
    {
      key: 'amount',
      label: ORDERS.fields.amount.label,
      value: formatHalalas(order.amountHalalas),
      hint: ORDERS.fields.amount.hint,
    },
    {
      key: 'currency',
      label: ORDERS.fields.currency.label,
      value: order.currency,
      dir: 'ltr',
      hint: ORDERS.fields.currency.hint,
    },
    {
      key: 'provider',
      label: ORDERS.fields.provider.label,
      value: ORDERS.providerLabels[order.provider],
      hint: ORDERS.fields.provider.hint,
    },
    {
      key: 'checkoutRequestKey',
      label: ORDERS.fields.checkoutRequestKey.label,
      value: order.checkoutRequestKey,
      dir: 'ltr',
      hint: ORDERS.fields.checkoutRequestKey.hint,
    },
    {
      key: 'createdAt',
      label: ORDERS.fields.createdAt.label,
      value: formatDateTime(order.createdAt),
    },
    {
      key: 'paidAt',
      label: ORDERS.fields.paidAt.label,
      value: dateOrNothing(order.paidAt),
      hint: ORDERS.fields.paidAt.hint,
    },
    { key: 'failedAt', label: ORDERS.fields.failedAt.label, value: dateOrNothing(order.failedAt) },
    {
      key: 'cancelledAt',
      label: ORDERS.fields.cancelledAt.label,
      value: dateOrNothing(order.cancelledAt),
    },
    {
      key: 'refundedAt',
      label: ORDERS.fields.refundedAt.label,
      value: dateOrNothing(order.refundedAt),
    },
  ];

  const studentItems: DetailItem[] = [
    {
      key: 'student',
      label: ORDERS.fields.student.label,
      value: order.student.name,
      hint: ORDERS.fields.student.hint,
    },
    { key: 'email', label: ORDERS.columns.email, value: order.student.email, dir: 'ltr' },
    {
      key: 'product',
      label: ORDERS.fields.product.label,
      value: order.product.title,
      hint: ORDERS.fields.product.hint,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* The flag comes first because it is the reason the screen was opened. */}
      {order.needsReview ? (
        <Notice tone="warning" role="note">
          {ORDERS.notices.needsReviewNote}
        </Notice>
      ) : null}

      {isTestMode ? (
        <Notice tone="neutral" role="note">
          {ORDERS.notices.testModeNote}
        </Notice>
      ) : null}

      <DetailPanel
        title={ORDERS.sections.order}
        badges={
          <>
            <OrderStatusBadge status={order.status} />
            {order.needsReview ? <Badge variant="warning">{ORDERS.review.badge}</Badge> : null}
          </>
        }
        items={orderItems}
        columns={3}
        footer={
          <div className="text-ink-700 flex flex-col gap-2 text-sm">
            <p>{ORDERS.notices.immutableSnapshot}</p>
            <p>{ORDERS.notices.amountsInSar}</p>
            {/* Stated rather than left to be discovered by looking for an edit
                button that is not there. */}
            <p>{ORDERS.errors.editUnavailable}</p>
          </div>
        }
      />

      <DetailPanel
        title={ORDERS.sections.student}
        items={studentItems}
        columns={3}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/students/${order.student.id}`}>{ORDERS.actions.viewStudent}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/products/${order.productId}`}>{ORDERS.actions.viewProduct}</Link>
            </Button>
          </div>
        }
      />

      <DetailPanel
        title={ORDERS.sections.payments}
        description={ORDERS.payments.description}
        items={[]}
        footer={
          <ReconcileAction orderId={order.id} disabled={order.latestProviderPaymentId === null} />
        }
      >
        <div className="flex flex-col gap-4">
          <Notice tone="neutral" role="note">
            {ORDERS.notices.providerIsAuthority}
          </Notice>

          <DataTable
            caption={`${ORDERS.payments.title} — ${COPY.adminCommon.table.captionSuffix}`}
            columns={paymentColumns}
            rows={order.payments}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                title={ORDERS.payments.empty.nothingYetTitle}
                description={ORDERS.payments.empty.nothingYetBody}
              />
            }
          />

          {/* The local references a payment carries, named but never printed:
              the values are ids this server generated and already shows above,
              and a column fed by a third party is not a column to render. */}
          {order.payments.some((payment) => payment.safeMetadataKeys.length > 0) ? (
            <p className="text-ink-700 text-sm">
              {ORDERS.payments.fields.safeMetadata.label}:{' '}
              <span dir="ltr" className="text-xs">
                {[...new Set(order.payments.flatMap((payment) => payment.safeMetadataKeys))]
                  .sort()
                  .join(' · ')}
              </span>
              <br />
              <span className="text-ink-600 text-xs">
                {ORDERS.payments.fields.safeMetadata.hint}
              </span>
            </p>
          ) : null}
        </div>
      </DetailPanel>

      <DetailPanel
        title={ORDERS.access.title}
        description={ORDERS.access.description}
        items={[
          {
            key: 'status',
            label: COPY.adminEntitlements.fields.status.label,
            value: order.entitlement
              ? COPY.adminEntitlements.statusLabels[order.entitlement.status]
              : null,
          },
          {
            key: 'grantedAt',
            label: COPY.adminEntitlements.fields.grantedAt.label,
            value: dateOrNothing(order.entitlement?.grantedAt ?? null),
          },
          {
            key: 'revokedAt',
            label: COPY.adminEntitlements.fields.revokedAt.label,
            value: dateOrNothing(order.entitlement?.revokedAt ?? null),
          },
        ]}
        columns={3}
        footer={
          <div className="flex flex-col gap-3">
            <p className="text-ink-700 text-sm">
              {order.entitlement === null
                ? ORDERS.access.noneNote
                : order.entitlement.status === 'REVOKED'
                  ? ORDERS.access.revokedNote
                  : // Only claimed when the entitlement actually names this order
                    // as its source; access can exist for another reason.
                    order.entitlement.fromThisOrder
                    ? ORDERS.access.grantedNote
                    : ORDERS.access.noneNote}
            </p>
            <p className="text-ink-700 text-sm">{ORDERS.notices.refundWithdrawsAccess}</p>
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/entitlements?q=${encodeURIComponent(order.student.email)}`}>
                  {ORDERS.access.manageAction}
                </Link>
              </Button>
            </div>
          </div>
        }
      >
        <DataTable
          caption={`${ORDERS.access.title} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={entitlementEventColumns}
          rows={order.entitlementEvents}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={COPY.adminEntitlements.history.empty.nothingYetTitle}
              description={COPY.adminEntitlements.history.empty.nothingYetBody}
            />
          }
        />
      </DetailPanel>

      <DetailPanel
        title={ORDERS.webhooks.title}
        description={ORDERS.webhooks.description}
        items={[]}
      >
        <DataTable
          caption={`${ORDERS.webhooks.title} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={webhookColumns}
          rows={order.webhooks}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={ORDERS.webhooks.empty.nothingYetTitle}
              description={ORDERS.webhooks.empty.nothingYetBody}
            />
          }
        />
      </DetailPanel>

      <DetailPanel
        title={ORDERS.sections.activity}
        description={ORDERS.notices.auditedAction}
        items={[]}
      >
        <DataTable
          caption={`${ORDERS.sections.activity} — ${COPY.adminCommon.table.captionSuffix}`}
          columns={activityColumns}
          rows={order.activity}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={COPY.adminAudit.empty.nothingYetTitle}
              description={COPY.adminAudit.empty.nothingYetBody}
            />
          }
        />
      </DetailPanel>

      <Notice tone="neutral" role="note">
        {ORDERS.errors.deleteUnavailable}
      </Notice>
    </div>
  );
}
