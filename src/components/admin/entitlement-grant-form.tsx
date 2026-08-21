'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { $Enums } from '@prisma/client';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/field';
import { Card, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import {
  grantEntitlementSchema,
  type GrantEntitlementFormValues,
  type GrantEntitlementInput,
} from '@/validators/admin-entitlement';
import type { GrantableProduct } from '@/services/access/entitlement-admin.service';

/**
 * The two client controls on the entitlements screen: the manual grant, and the
 * per-row change of state.
 *
 * They live together because they share the one thing that makes them different
 * from every other administrative form — a mandatory reason that is written into
 * an append-only history and read months later by somebody establishing whether
 * access was legitimate. Both send it, both refuse to submit without it, and
 * both say where it ends up.
 *
 * As everywhere else in this codebase, these are client forms that `fetch` a
 * route handler. There are no server actions in the project, and introducing one
 * here would mean two ways to write a mutation and two places to audit.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: { changed?: boolean };
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

const GRANT = COPY.adminEntitlements.grant;

/**
 * Grant access by hand.
 *
 * The student is named by address rather than chosen from a list, and that is a
 * privacy decision before it is a convenience one: a dropdown of every account
 * would put the whole roll of students — many of them minors — on the screen of
 * anybody who opened this page to help one of them.
 *
 * Every product is offered, including drafts and archived ones. A compensation
 * grant for a course that has been withdrawn from sale is a real case, and the
 * field's hint says plainly what that means for the student.
 */
export function EntitlementGrantForm({ products }: { products: readonly GrantableProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GrantEntitlementFormValues, unknown, GrantEntitlementInput>({
    resolver: zodResolver(grantEntitlementSchema),
    defaultValues: { email: '', productId: '', reason: '' },
  });

  const submit = handleSubmit(async (values) => {
    const response = await fetch('/api/admin/entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      // An unknown address belongs on the address field, not in a toast that
      // disappears while the administrator is still looking for the typo.
      if (result.error?.code === 'student_not_found' && result.error.message) {
        setError('email', { message: result.error.message });
      }
      if (result.error?.code === 'product_not_found' && result.error.message) {
        setError('productId', { message: result.error.message });
      }
      for (const [field, message] of Object.entries(result.error?.details ?? {})) {
        if (field in values) setError(field as keyof GrantEntitlementFormValues, { message });
      }
      toast.error(result.error?.message ?? COPY.adminEntitlements.toast.grantFailed);
      return;
    }

    // The server reports "already had it" honestly rather than claiming a second
    // grant, so the toast says so too — and the history gains no duplicate row.
    toast.success(
      result.data?.changed
        ? COPY.adminEntitlements.toast.granted
        : COPY.adminEntitlements.toast.grantUnchanged,
    );
    reset();
    setOpen(false);
    router.refresh();
  });

  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          {GRANT.action}
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
          {GRANT.title}
        </h2>
        <p className="text-ink-700 max-w-prose text-sm">{GRANT.description}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field>
          <Label htmlFor="grant-email">{GRANT.fields.student.label}</Label>
          {/* An address is Latin and often begins with a digit; isolated so it
              cannot reorder inside the RTL form. */}
          <Input
            id="grant-email"
            type="email"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="grant-email-hint"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldHint id="grant-email-hint">{GRANT.fields.student.hint}</FieldHint>
          <FieldError message={errors.email?.message} />
        </Field>

        <Field>
          <Label htmlFor="grant-product">{GRANT.fields.product.label}</Label>
          <Select
            id="grant-product"
            aria-describedby="grant-product-hint"
            aria-invalid={Boolean(errors.productId)}
            {...register('productId')}
          >
            {/* "Nothing chosen yet" rather than "الكل": inside a form the empty
                row means an unmade choice, not an unnarrowed list. */}
            <option value="">{COPY.adminCommon.form.unchosen}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {`${product.title} — ${COPY.statusLabels.productType[product.type]} — ${
                  COPY.adminProducts.statusLabels[product.status]
                }`}
              </option>
            ))}
          </Select>
          <FieldHint id="grant-product-hint">{GRANT.fields.product.hint}</FieldHint>
          <FieldError message={errors.productId?.message} />
        </Field>

        <Field>
          <Label htmlFor="grant-reason">{GRANT.fields.reason.label}</Label>
          <Textarea
            id="grant-reason"
            rows={3}
            placeholder={GRANT.fields.reason.placeholder}
            aria-describedby="grant-reason-hint"
            aria-invalid={Boolean(errors.reason)}
            {...register('reason')}
          />
          <FieldHint id="grant-reason-hint">{GRANT.fields.reason.hint}</FieldHint>
          <FieldError message={errors.reason?.message} />
        </Field>

        {/* Stated at the point of the decision, because "granting access" is the
            phrase an administrator most plausibly reads as "recording a sale". */}
        <Notice tone="warning" role="note">
          {GRANT.confirmBody}
        </Notice>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? COPY.adminCommon.actions.saving : GRANT.confirmAction}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            {COPY.adminCommon.actions.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Per-row transitions ──────────────────────────────────────────────────

/**
 * Withdraw access, or put it back.
 *
 * One button per row, whichever direction is available, plus the reason box the
 * server requires. Both confirmations say the thing the administrator is most
 * likely to have assumed wrongly: revoking refunds nothing, and reactivating
 * charges nothing. Neither deletes any of the student's progress.
 *
 * A no-op — revoking something already revoked — is reported as "nothing
 * changed" rather than as a success or an error, because that is what happened.
 * The alternative would be a second identical row in a history that nothing can
 * afterwards tidy up.
 */
export function EntitlementStatusActions({
  entitlementId,
  status,
}: {
  entitlementId: string;
  status: $Enums.EntitlementStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const revoking = status === 'ACTIVE';
  const labels = revoking ? COPY.adminEntitlements.revoke : COPY.adminEntitlements.reactivate;

  async function send() {
    if (reason.trim().length < 3) {
      setReasonError(COPY.adminEntitlements.errors.reasonRequired);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/entitlements/${entitlementId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: revoking ? 'REVOKED' : 'ACTIVE', reason: reason.trim() }),
      });
      const result = (await response.json()) as ApiEnvelope;

      if (!result.ok) {
        const fieldMessage = result.error?.details?.reason;
        if (fieldMessage) setReasonError(fieldMessage);
        toast.error(
          result.error?.message ??
            (revoking
              ? COPY.adminEntitlements.toast.revokeFailed
              : COPY.adminEntitlements.toast.reactivateFailed),
        );
        return;
      }

      if (revoking) {
        toast.success(
          result.data?.changed
            ? COPY.adminEntitlements.toast.revoked
            : COPY.adminEntitlements.toast.revokeUnchanged,
        );
      } else {
        toast.success(
          result.data?.changed
            ? COPY.adminEntitlements.toast.reactivated
            : COPY.adminEntitlements.toast.grantUnchanged,
        );
      }

      setOpen(false);
      setReason('');
      setReasonError(null);
      router.refresh();
    } catch {
      toast.error(COPY.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant={revoking ? 'outline' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {labels.action}
      </Button>
    );
  }

  return (
    <Notice tone="warning" role="status" className="flex min-w-64 flex-col gap-3 text-start">
      <span className="text-ink-900 block font-medium">{labels.confirmTitle}</span>
      <span className="block text-sm">{labels.confirmBody}</span>

      <Field className="w-full">
        <Label htmlFor={`entitlement-reason-${entitlementId}`}>{labels.fields.reason.label}</Label>
        <Textarea
          id={`entitlement-reason-${entitlementId}`}
          rows={3}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setReasonError(null);
          }}
          aria-describedby={`entitlement-reason-hint-${entitlementId}`}
          aria-invalid={Boolean(reasonError)}
        />
        <FieldHint id={`entitlement-reason-hint-${entitlementId}`}>
          {labels.fields.reason.hint}
        </FieldHint>
        <FieldError message={reasonError ?? undefined} />
      </Field>

      <span className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={revoking ? 'danger' : 'primary'}
          loading={busy}
          onClick={send}
        >
          {labels.confirmAction}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReason('');
            setReasonError(null);
          }}
        >
          {COPY.adminCommon.confirmDelete.cancel}
        </Button>
      </span>
    </Notice>
  );
}
