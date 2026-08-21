'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DetailPanel, type DetailItem } from '@/components/admin/detail-panel';
import { OrderStatusBadge } from '@/components/admin/status-badge';
import { StudentStateBadge } from '@/components/admin/student-list';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldHint, Label, Textarea } from '@/components/ui/field';
import { Badge, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatDateTime, formatHalalas, formatNumber } from '@/lib/format';
import type {
  AdminStudentActivity,
  AdminStudentAttempt,
  AdminStudentConsent,
  AdminStudentDetail,
  AdminStudentEntitlement,
  AdminStudentOrder,
} from '@/services/students/student-admin.service';

/**
 * One account's record, and the three levers an administrator may pull on it.
 *
 * A client component because the levers are client controls — the established
 * pattern in this codebase is a form that `fetch`es a route handler, there are
 * no server actions anywhere, and introducing one here would mean two ways of
 * writing a mutation and two places to audit. Everything it draws arrives as
 * props from the page's single server-side read; this file queries nothing.
 *
 * What it shows is bounded by what an administrator answering a support message
 * genuinely needs: who the account belongs to, whether it can sign in, what was
 * bought, what can be opened, what has been attempted, and which document
 * versions were accepted. `passwordHash` is not selected by the service and is
 * not a field here; there is no reset control and no reveal, and the notice says
 * so rather than leaving somebody hunting for one.
 */

type ApiEnvelope = {
  ok: boolean;
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

const FIELDS = COPY.adminStudents.fields;

export function StudentDetail({ student }: { student: AdminStudentDetail }) {
  const accountItems: DetailItem[] = [
    { key: 'name', label: FIELDS.name.label, value: student.name },
    {
      key: 'email',
      label: FIELDS.email.label,
      // The sign-in identifier: Latin, and isolated so it cannot reorder against
      // the Arabic label above it.
      value: student.email,
      dir: 'ltr',
      hint: FIELDS.email.hint,
    },
    {
      key: 'phone',
      label: FIELDS.phone.label,
      // A specific absence rather than the panel's generic "غير متاح": nobody
      // entered one, which is different from the platform being unable to say.
      value: student.phone ?? COPY.adminStudents.notProvided,
      dir: 'ltr',
    },
    {
      key: 'role',
      label: FIELDS.role.label,
      value: COPY.adminStudents.roleLabels[student.role],
      hint: FIELDS.role.hint,
    },
    { key: 'createdAt', label: FIELDS.createdAt.label, value: formatDateTime(student.createdAt) },
    { key: 'updatedAt', label: FIELDS.updatedAt.label, value: formatDateTime(student.updatedAt) },
    {
      key: 'sessionVersion',
      label: FIELDS.sessionVersion.label,
      value: formatNumber(student.sessionVersion),
      hint: FIELDS.sessionVersion.hint,
    },
  ];

  if (student.isBlocked) {
    accountItems.push(
      {
        key: 'blockedAt',
        label: FIELDS.blockedAt.label,
        value: student.blockedAt ? formatDateTime(student.blockedAt) : null,
      },
      {
        key: 'blockedReason',
        label: FIELDS.blockedReason.label,
        value: student.blockedReason,
        hint: FIELDS.blockedReason.hint,
        span: 'full',
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailPanel
        title={COPY.adminStudents.sections.account}
        badges={
          <>
            <StudentStateBadge blocked={student.isBlocked} />
            <Badge variant="outline" shape="square">
              {COPY.adminStudents.roleLabels[student.role]}
            </Badge>
          </>
        }
        items={accountItems}
        footer={<StudentAccountActions student={student} />}
      />

      <Notice tone="neutral" role="note">
        {COPY.adminStudents.notices.readOnlyAccount} {COPY.adminStudents.notices.noPasswordTools}
      </Notice>

      <StudentEntitlements rows={student.entitlements} />
      <StudentOrders rows={student.orders} total={student.orderCount} />
      <StudentAttempts rows={student.attempts} total={student.attemptCount} />
      <StudentConsents rows={student.consents} />
      <StudentActivity rows={student.activity} />
    </div>
  );
}

// ── The audited levers ───────────────────────────────────────────────────

type PendingAction = {
  key: 'block' | 'unblock' | 'signOut';
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  /** Only blocking collects one, and the server requires it. */
  needsReason?: boolean;
};

/**
 * Block, unblock, and end every session.
 *
 * Each control states, before it acts, what changes and what does not. That is
 * not decoration: the two assumptions an administrator most plausibly arrives
 * with are that blocking refunds something and that it deletes something, and
 * both are wrong. The confirmation text says so while there is still time to
 * choose otherwise.
 *
 * Blocking and forcing a sign-out are separate buttons because they are separate
 * decisions, even though the second happens as part of the first. Presenting
 * them as one control with a checkbox would suggest a block that leaves sessions
 * running is available, and it is not — that combination is the bug
 * `sessionVersion` exists to make impossible.
 */
export function StudentAccountActions({ student }: { student: AdminStudentDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * An administrator's own account is not blockable and not sign-out-able
   * through this screen, and neither is any other administrator's. The server
   * refuses all three cases by name; the buttons are hidden here so the refusal
   * is visible before it is earned rather than instead of the server check.
   */
  const blockable = student.role !== 'ADMIN';

  async function send(action: PendingAction) {
    const isSignOut = action.key === 'signOut';
    const response = await fetch(
      isSignOut
        ? `/api/admin/students/${student.id}/sessions`
        : `/api/admin/students/${student.id}/block`,
      isSignOut
        ? { method: 'DELETE' }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocked: action.key === 'block', reason: reason.trim() }),
          },
    );
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      // A rejected reason belongs on the field the administrator is still
      // looking at, not only in a toast that vanishes while they read it.
      const fieldMessage = result.error?.details?.reason;
      if (fieldMessage) setReasonError(fieldMessage);

      toast.error(
        result.error?.message ??
          (action.key === 'block'
            ? COPY.adminStudents.toast.blockFailed
            : action.key === 'unblock'
              ? COPY.adminStudents.toast.unblockFailed
              : COPY.adminStudents.toast.signOutFailed),
      );
      return;
    }

    toast.success(
      action.key === 'block'
        ? COPY.adminStudents.toast.blocked
        : action.key === 'unblock'
          ? COPY.adminStudents.toast.unblocked
          : COPY.adminStudents.toast.signedOut,
    );
    setPending(null);
    setReason('');
    setReasonError(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {blockable && !student.isBlocked ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() =>
              setPending({
                key: 'block',
                title: COPY.adminStudents.block.confirmTitle,
                body: COPY.adminStudents.block.confirmBody,
                action: COPY.adminStudents.block.confirmAction,
                danger: true,
                needsReason: true,
              })
            }
          >
            {COPY.adminStudents.block.action}
          </Button>
        ) : null}

        {blockable && student.isBlocked ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() =>
              setPending({
                key: 'unblock',
                title: COPY.adminStudents.unblock.confirmTitle,
                body: COPY.adminStudents.unblock.confirmBody,
                action: COPY.adminStudents.unblock.confirmAction,
              })
            }
          >
            {COPY.adminStudents.unblock.action}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPending({
              key: 'signOut',
              title: COPY.adminStudents.forceSignOut.confirmTitle,
              body: COPY.adminStudents.forceSignOut.confirmBody,
              action: COPY.adminStudents.forceSignOut.confirmAction,
            })
          }
        >
          {COPY.adminStudents.forceSignOut.action}
        </Button>
      </div>

      <p className="text-ink-700 text-sm">{COPY.adminStudents.forceSignOut.hint}</p>

      {/* Said whether or not a button was pressed: an administrator looking for
          the "block" control on a colleague's account should learn why it is
          absent, not conclude the screen is broken. */}
      {blockable ? null : (
        <p className="text-ink-700 text-sm">{COPY.adminStudents.errors.cannotBlockAdmin}</p>
      )}

      <p className="text-ink-700 text-sm">{COPY.adminStudents.errors.deleteUnavailable}</p>

      {pending ? (
        <Notice tone="warning" role="status" className="flex flex-col gap-3">
          <span className="text-ink-900 block font-medium">{pending.title}</span>
          <span className="block text-sm">{pending.body}</span>

          {pending.needsReason ? (
            <Field className="w-full">
              <Label htmlFor="block-reason">{COPY.adminStudents.block.reason.label}</Label>
              <Textarea
                id="block-reason"
                rows={3}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
                placeholder={COPY.adminStudents.block.reason.placeholder}
                aria-describedby="block-reason-hint"
                aria-invalid={Boolean(reasonError)}
              />
              <FieldHint id="block-reason-hint">{COPY.adminStudents.block.reason.hint}</FieldHint>
              <FieldError message={reasonError ?? undefined} />
            </Field>
          ) : null}

          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={pending.danger ? 'danger' : 'primary'}
              loading={busy}
              onClick={async () => {
                // Checked here as well as on the server so an empty box does not
                // cost a round trip to be told what the field already said.
                if (pending.needsReason && reason.trim().length < 3) {
                  setReasonError(COPY.adminStudents.errors.reasonRequired);
                  return;
                }
                setBusy(true);
                try {
                  await send(pending);
                } catch {
                  toast.error(COPY.common.error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {pending.action}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPending(null);
                setReason('');
                setReasonError(null);
              }}
            >
              {COPY.adminCommon.confirmDelete.cancel}
            </Button>
          </span>
        </Notice>
      ) : null}

      <p className="text-ink-700 text-xs">{COPY.adminStudents.notices.blockingIsNotRefund}</p>
      <p className="text-ink-700 text-xs">{COPY.adminStudents.notices.auditedAction}</p>
    </div>
  );
}

// ── Related records ──────────────────────────────────────────────────────

/**
 * A heading, a sentence and a table, repeated five times.
 *
 * `failed` is deliberately absent from all five: every row on this screen came
 * from the one read that produced the record, so there is no state in which the
 * account rendered and its orders did not. If that read throws, the *page*
 * renders `ErrorState` instead of any of this.
 */
function RelatedSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">{title}</h2>
        <p className="text-ink-700 max-w-prose text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

const ACCESS = COPY.adminStudents.related.access;

const entitlementColumns: readonly DataTableColumn<AdminStudentEntitlement>[] = [
  {
    key: 'product',
    header: ACCESS.columns.product,
    isRowHeader: true,
    cell: (row) => (
      <Link href={`/admin/products/${row.productId}`} className="text-brand-700 hover:underline">
        {row.productTitle}
      </Link>
    ),
  },
  {
    key: 'status',
    header: ACCESS.columns.status,
    cell: (row) => (
      <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
        {COPY.adminEntitlements.statusLabels[row.status]}
      </Badge>
    ),
  },
  {
    key: 'grantedAt',
    header: ACCESS.columns.grantedAt,
    cell: (row) => formatDate(row.grantedAt),
  },
  {
    key: 'revokedAt',
    header: ACCESS.columns.revokedAt,
    cell: (row) => (row.revokedAt ? formatDate(row.revokedAt) : COPY.common.notAvailable),
  },
  {
    key: 'sourceOrder',
    header: ACCESS.columns.sourceOrder,
    dir: 'ltr',
    cell: (row) =>
      row.sourceOrderId ? (
        <Link
          href={`/admin/orders/${row.sourceOrderId}`}
          className="text-brand-700 text-xs hover:underline"
        >
          {row.sourceOrderId}
        </Link>
      ) : (
        // No order means an administrative or automatic grant, which the
        // entitlements screen explains in full.
        <span className="text-ink-700 text-xs">{COPY.adminEntitlements.sourceLabels.admin}</span>
      ),
  },
];

function StudentEntitlements({ rows }: { rows: readonly AdminStudentEntitlement[] }) {
  return (
    <RelatedSection title={ACCESS.title} description={ACCESS.description}>
      <DataTable
        caption={`${ACCESS.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={entitlementColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={ACCESS.empty.nothingYetTitle}
            description={ACCESS.empty.nothingYetBody}
          />
        }
      />
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/entitlements">{ACCESS.manageAction}</Link>
        </Button>
      </div>
    </RelatedSection>
  );
}

const ORDERS = COPY.adminStudents.related.orders;

const orderColumns: readonly DataTableColumn<AdminStudentOrder>[] = [
  {
    key: 'reference',
    header: ORDERS.columns.reference,
    isRowHeader: true,
    dir: 'ltr',
    cell: (row) => (
      <Link href={`/admin/orders/${row.id}`} className="text-brand-700 text-xs hover:underline">
        {row.id}
      </Link>
    ),
  },
  {
    key: 'product',
    header: ORDERS.columns.product,
    // The snapshot the order carries, not the product's current title.
    cell: (row) => row.productTitle,
  },
  {
    key: 'amount',
    header: ORDERS.columns.amount,
    align: 'end',
    cell: (row) => formatHalalas(row.amountHalalas),
  },
  {
    key: 'status',
    header: ORDERS.columns.status,
    cell: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'createdAt',
    header: ORDERS.columns.createdAt,
    cell: (row) => formatDate(row.createdAt),
  },
];

function StudentOrders({ rows, total }: { rows: readonly AdminStudentOrder[]; total: number }) {
  return (
    <RelatedSection title={ORDERS.title} description={ORDERS.description}>
      <DataTable
        caption={`${ORDERS.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={orderColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={ORDERS.empty.nothingYetTitle}
            description={ORDERS.empty.nothingYetBody}
          />
        }
      />
      {/* Offered only when the list is actually truncated, so the link never
          promises more rows than exist. */}
      {total > rows.length ? (
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/orders">{ORDERS.viewAllAction}</Link>
          </Button>
        </div>
      ) : null}
    </RelatedSection>
  );
}

const ATTEMPTS = COPY.adminStudents.related.attempts;

const attemptColumns: readonly DataTableColumn<AdminStudentAttempt>[] = [
  {
    key: 'simulator',
    header: ATTEMPTS.columns.simulator,
    isRowHeader: true,
    cell: (row) => row.simulatorTitle,
  },
  {
    key: 'mode',
    header: ATTEMPTS.columns.mode,
    cell: (row) => COPY.statusLabels.attemptMode[row.mode],
  },
  {
    key: 'status',
    header: ATTEMPTS.columns.status,
    cell: (row) => COPY.statusLabels.attemptStatus[row.status],
  },
  {
    key: 'startedAt',
    header: ATTEMPTS.columns.startedAt,
    cell: (row) => (row.startedAt ? formatDateTime(row.startedAt) : COPY.common.notAvailable),
  },
  {
    key: 'submittedAt',
    header: ATTEMPTS.columns.submittedAt,
    cell: (row) => (row.submittedAt ? formatDateTime(row.submittedAt) : COPY.common.notAvailable),
  },
  {
    key: 'correct',
    header: ATTEMPTS.columns.correct,
    align: 'end',
    // An unsubmitted attempt has no score, and a zero there would read as a
    // student who answered everything wrongly.
    cell: (row) =>
      row.correctCount === null
        ? COPY.common.notAvailable
        : `${formatNumber(row.correctCount)} / ${formatNumber(row.totalQuestions)}`,
  },
];

function StudentAttempts({ rows, total }: { rows: readonly AdminStudentAttempt[]; total: number }) {
  return (
    <RelatedSection title={ATTEMPTS.title} description={ATTEMPTS.description}>
      <DataTable
        caption={`${ATTEMPTS.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={attemptColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={ATTEMPTS.empty.nothingYetTitle}
            description={ATTEMPTS.empty.nothingYetBody}
          />
        }
      />
      {total > rows.length ? (
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/attempts">{ATTEMPTS.viewAllAction}</Link>
          </Button>
        </div>
      ) : null}
    </RelatedSection>
  );
}

const CONSENTS = COPY.adminStudents.related.consents;

const consentColumns: readonly DataTableColumn<AdminStudentConsent>[] = [
  {
    key: 'acceptedAt',
    header: CONSENTS.columns.acceptedAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.acceptedAt),
  },
  {
    key: 'termsVersion',
    header: CONSENTS.columns.termsVersion,
    // Version strings are Latin and dotted; isolated so they cannot reorder.
    dir: 'ltr',
    cell: (row) => <span className="text-xs">{row.termsVersion}</span>,
  },
  {
    key: 'privacyVersion',
    header: CONSENTS.columns.privacyVersion,
    dir: 'ltr',
    cell: (row) => <span className="text-xs">{row.privacyVersion}</span>,
  },
];

function StudentConsents({ rows }: { rows: readonly AdminStudentConsent[] }) {
  return (
    <RelatedSection title={CONSENTS.title} description={CONSENTS.description}>
      <DataTable
        caption={`${CONSENTS.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={consentColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={CONSENTS.empty.nothingYetTitle}
            description={CONSENTS.empty.nothingYetBody}
          />
        }
      />
    </RelatedSection>
  );
}

const ACTIVITY = COPY.adminStudents.related.activity;

const activityColumns: readonly DataTableColumn<AdminStudentActivity>[] = [
  {
    key: 'createdAt',
    header: COPY.adminCommon.table.createdAt,
    isRowHeader: true,
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'action',
    header: COPY.adminAudit.columns.action,
    /*
     * `AuditLog.action` is a `String` in Prisma, not the union, so the lookup is
     * guarded rather than cast. A row written by a future action with no label
     * yet renders as "إجراء غير معروف" — honest — instead of as `undefined`.
     */
    cell: (row) =>
      COPY.adminAudit.actionLabels[row.action as keyof typeof COPY.adminAudit.actionLabels] ??
      COPY.adminAudit.unknownAction,
  },
  {
    key: 'actor',
    header: COPY.adminAudit.columns.actorEmail,
    dir: 'ltr',
    cell: (row) => (
      <span className="text-ink-700 text-xs">{row.actorEmail ?? COPY.adminAudit.systemActor}</span>
    ),
  },
];

function StudentActivity({ rows }: { rows: readonly AdminStudentActivity[] }) {
  return (
    <RelatedSection title={ACTIVITY.title} description={ACTIVITY.description}>
      <DataTable
        caption={`${ACTIVITY.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={activityColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={ACTIVITY.empty.nothingYetTitle}
            description={ACTIVITY.empty.nothingYetBody}
          />
        }
      />
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/audit-log">{ACTIVITY.viewAllAction}</Link>
        </Button>
      </div>
    </RelatedSection>
  );
}
