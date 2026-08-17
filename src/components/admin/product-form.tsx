'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { $Enums } from '@prisma/client';

import { MediaPicker, type MediaPickerValue } from '@/components/admin/media-picker';
import { ProductTypeBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import {
  Checkbox,
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
  createProductSchema,
  halalasToRiyals,
  riyalsToHalalas,
  type CreateProductFormValues,
  type CreateProductInput,
} from '@/validators/admin-product';

/**
 * The product editor, and the audited controls that sit beside it.
 *
 * The established pattern in this codebase is a client form that `fetch`es a
 * route handler — there are no server actions anywhere, and introducing one
 * here would mean two ways of writing a mutation and two places to audit.
 *
 * `createProductSchema` resolves the form in both modes even though the server
 * validates an edit with `updateProductSchema`. The two differ only in `type`,
 * which the edit screen renders as a read-only badge; using one schema keeps a
 * single set of Arabic field messages rather than a second copy that drifts.
 * The PATCH payload still drops `type` before it is sent — see `submit` below.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: { id?: string };
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

export type ProductFormProduct = {
  id: string;
  type: $Enums.ProductType;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  coverAssetId: string | null;
  /** The resolved asset, so the picker can draw the current cover immediately. */
  coverAsset: MediaPickerValue | null;
  priceHalalas: number;
  featured: boolean;
};

const FIELDS = COPY.adminProducts.fields;

export function ProductForm({ product }: { product?: ProductFormProduct }) {
  const router = useRouter();
  const isEdit = product !== undefined;

  /**
   * Money is typed in riyals and stored in halalas, and the conversion is the
   * one piece of arithmetic in this file that is allowed to be wrong only in
   * one direction. `riyalsToHalalas` splits the string and combines the halves
   * with integer arithmetic; `parseFloat(x) * 100` would make `19.99` into
   * `1998.999…` and charge a riyal less than the price on screen.
   */
  const [priceText, setPriceText] = useState(product ? halalasToRiyals(product.priceHalalas) : '');
  const [priceTouched, setPriceTouched] = useState(false);
  /**
   * The picker holds the whole asset so it can draw a preview; the form field it
   * feeds is only the id, which is all the server accepts. Choosing or clearing
   * an image edits this form value and destroys nothing — the previously
   * attached asset is untouched until the save goes through.
   */
  const [cover, setCover] = useState<MediaPickerValue | null>(product?.coverAsset ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<CreateProductFormValues, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      type: product?.type ?? 'COURSE',
      slug: product?.slug ?? '',
      title: product?.title ?? '',
      shortDescription: product?.shortDescription ?? '',
      longDescription: product?.longDescription ?? '',
      coverAssetId: product?.coverAssetId ?? null,
      priceHalalas: product?.priceHalalas ?? 0,
      featured: product?.featured ?? false,
    },
  });

  const priceHalalas = riyalsToHalalas(priceText);
  const priceInvalid = priceHalalas === null;
  // Held back until the field is left or the form is submitted: the regexp
  // rejects "19." as well as "19.999", and flagging a half-typed amount on
  // every keystroke turns ordinary typing into a stream of errors.
  const showPriceError = priceInvalid && (priceTouched || isSubmitted);

  function onPriceChange(value: string) {
    setPriceText(value);
    const halalas = riyalsToHalalas(value);
    // Only a parseable amount reaches the form state. Writing `NaN` would trip
    // the schema's "السعر مطلوب", which is the wrong sentence to show beside a
    // box that visibly contains digits; the hint below states the format, and
    // `showPriceError` renders it as the correction.
    if (halalas !== null) setValue('priceHalalas', halalas, { shouldDirty: true });
  }

  function onCoverChange(next: MediaPickerValue | null) {
    setCover(next);
    setValue('coverAssetId', next?.id ?? null, { shouldDirty: true });
  }

  const submit = handleSubmit(async (values) => {
    if (priceInvalid) {
      setPriceTouched(true);
      return;
    }

    // `type` is stripped from an edit rather than sent: the server refuses a
    // `type` that disagrees with the stored one, and there is no reason for a
    // save to carry a field it is not allowed to change.
    const { type, ...rest } = values;
    const payload = isEdit ? rest : { ...rest, type };

    const response = await fetch(
      isEdit ? `/api/admin/products/${product.id}` : '/api/admin/products',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      // A taken slug belongs on the slug field, not in a toast that disappears
      // while the administrator is still looking for what to change.
      if (result.error?.code === 'product_slug_taken' && result.error.message) {
        setError('slug', { message: result.error.message });
      }
      for (const [field, message] of Object.entries(result.error?.details ?? {})) {
        if (field in values) setError(field as keyof CreateProductFormValues, { message });
      }
      toast.error(
        result.error?.message ??
          (isEdit ? COPY.adminCommon.toast.updateFailed : COPY.adminCommon.toast.createFailed),
      );
      return;
    }

    if (isEdit) {
      toast.success(COPY.adminProducts.toast.updated);
      router.refresh();
      return;
    }

    toast.success(COPY.adminProducts.toast.created);
    router.push(`/admin/products/${result.data?.id}`);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <Field>
          <Label htmlFor="type">{FIELDS.type.label}</Label>
          {isEdit ? (
            <>
              {/* Read-only rather than a disabled select: a control that looks
                  like a control and never works is worse than a plain label. */}
              <div>
                <ProductTypeBadge type={product.type} />
              </div>
              <FieldHint id="type-hint">{FIELDS.type.hint}</FieldHint>
            </>
          ) : (
            <>
              <Select
                id="type"
                aria-describedby="type-hint"
                aria-invalid={Boolean(errors.type)}
                {...register('type')}
              >
                {(['COURSE', 'EXAM_SIMULATOR'] as const).map((type) => (
                  <option key={type} value={type}>
                    {COPY.adminProducts.typeLabels[type]}
                  </option>
                ))}
              </Select>
              <FieldHint id="type-hint">{FIELDS.type.hint}</FieldHint>
              <FieldError message={errors.type?.message} />
            </>
          )}
        </Field>

        <Field>
          <Label htmlFor="title">{FIELDS.title.label}</Label>
          <Input
            id="title"
            aria-describedby="title-hint"
            aria-invalid={Boolean(errors.title)}
            {...register('title')}
          />
          <FieldHint id="title-hint">{FIELDS.title.hint}</FieldHint>
          <FieldError message={errors.title?.message} />
        </Field>

        <Field>
          <Label htmlFor="slug">{FIELDS.slug.label}</Label>
          {/* Latin-only by schema, so the box is isolated from the RTL page. */}
          <Input
            id="slug"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="slug-hint"
            aria-invalid={Boolean(errors.slug)}
            {...register('slug')}
          />
          <FieldHint id="slug-hint">{FIELDS.slug.hint}</FieldHint>
          <FieldError message={errors.slug?.message} />
        </Field>

        <Field>
          <Label htmlFor="shortDescription">{FIELDS.shortDescription.label}</Label>
          <Textarea
            id="shortDescription"
            rows={3}
            aria-describedby="shortDescription-hint"
            aria-invalid={Boolean(errors.shortDescription)}
            {...register('shortDescription')}
          />
          <FieldHint id="shortDescription-hint">{FIELDS.shortDescription.hint}</FieldHint>
          <FieldError message={errors.shortDescription?.message} />
        </Field>

        <Field>
          <Label htmlFor="longDescription">
            {FIELDS.longDescription.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.adminCommon.form.optionalMark})</span>
          </Label>
          <Textarea
            id="longDescription"
            rows={8}
            aria-describedby="longDescription-hint"
            aria-invalid={Boolean(errors.longDescription)}
            {...register('longDescription')}
          />
          <FieldHint id="longDescription-hint">{FIELDS.longDescription.hint}</FieldHint>
          <FieldError message={errors.longDescription?.message} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <Field>
          <Label htmlFor="priceHalalas">{FIELDS.priceHalalas.label}</Label>
          {/* `inputMode="decimal"` rather than `type="number"`: a number input
              silently discards what it cannot parse, which for money means the
              amount on screen and the amount submitted can differ. */}
          <Input
            id="priceHalalas"
            type="text"
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={priceText}
            onChange={(event) => onPriceChange(event.target.value)}
            onBlur={() => setPriceTouched(true)}
            aria-describedby="price-hint"
            aria-invalid={showPriceError || Boolean(errors.priceHalalas)}
          />
          {/* The hint and the error carry the same sentence, so it is shown
              once and only ever in one of the two roles: while the amount reads
              cleanly it is guidance, and the moment it does not it becomes the
              correction, with the alert role and the error rule that go with
              that. Printing it twice would just be the page repeating itself. */}
          {showPriceError ? (
            <FieldError id="price-hint" message={FIELDS.priceHalalas.hint} />
          ) : (
            <>
              <FieldHint id="price-hint">{FIELDS.priceHalalas.hint}</FieldHint>
              <FieldError message={errors.priceHalalas?.message} />
            </>
          )}
        </Field>

        <Field>
          {/* `purpose` rather than a visibility: the picker's own note explains
              that the server derives PUBLIC from `PRODUCT_COVER`, and a cover is
              drawn by the catalogue with no access check, so a protected asset
              here would publish paid material. The service re-checks the asset
              is public before it will store the reference. */}
          <MediaPicker
            purpose="PRODUCT_COVER"
            value={cover}
            onChange={onCoverChange}
            label={FIELDS.coverAsset.label}
          />
          <FieldHint id="cover-hint">{FIELDS.coverAsset.hint}</FieldHint>
          <FieldError message={errors.coverAssetId?.message} />
        </Field>

        <Field>
          <div className="flex items-start gap-3">
            <Checkbox id="featured" className="mt-1" {...register('featured')} />
            <Label htmlFor="featured" className="leading-relaxed font-normal">
              {FIELDS.featured.label}
            </Label>
          </div>
          <FieldHint id="featured-hint">{FIELDS.featured.hint}</FieldHint>
        </Field>
      </Card>

      <Notice tone="neutral" role="note">
        {COPY.adminCommon.notices.auditedAction}
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/products">{COPY.adminCommon.actions.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Publication and deletion ─────────────────────────────────────────────

type PendingConfirm = {
  key: string;
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  run: () => Promise<void>;
};

/**
 * The audited transitions, kept out of the save form on purpose.
 *
 * Publishing is not a field. It has preconditions the server checks — a title, a
 * short description, a real price — and putting it in the edit form would mean
 * every save either re-checked them or quietly skipped them. Each control here
 * hits its own endpoint and states, before it acts, what changes for a student
 * and what does not.
 */
export function ProductStatusActions({
  productId,
  status,
  deletable,
}: {
  productId: string;
  status: $Enums.ProductStatus;
  /** False when an order or entitlement points at the product. */
  deletable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);

  const transitions = COPY.adminProducts.transitions;

  async function changeStatus(next: $Enums.ProductStatus, successMessage: string) {
    const response = await fetch(`/api/admin/products/${productId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const result = (await response.json()) as ApiEnvelope & { data?: { changed?: boolean } };

    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
      return;
    }
    // The server reports a no-op honestly rather than claiming a second
    // publication, so the toast says so too.
    toast.success(result.data?.changed ? successMessage : COPY.adminCommon.toast.noChanges);
    router.refresh();
  }

  async function remove() {
    const response = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.adminCommon.toast.deleteFailed);
      return;
    }
    toast.success(COPY.adminProducts.toast.deleted);
    router.push('/admin/products');
    router.refresh();
  }

  const options: PendingConfirm[] = [];

  if (status !== 'PUBLISHED') {
    options.push({
      key: 'publish',
      title: transitions.publishConfirmTitle,
      body: transitions.publishConfirmBody,
      action: transitions.publishConfirmAction,
      run: () => changeStatus('PUBLISHED', COPY.adminProducts.toast.published),
    });
  }
  if (status === 'PUBLISHED') {
    options.push({
      key: 'unpublish',
      title: transitions.unpublishConfirmTitle,
      body: transitions.unpublishConfirmBody,
      action: transitions.unpublishConfirmAction,
      run: () => changeStatus('DRAFT', COPY.adminProducts.toast.unpublished),
    });
  }
  if (status !== 'ARCHIVED') {
    options.push({
      key: 'archive',
      title: transitions.archiveConfirmTitle,
      body: transitions.archiveConfirmBody,
      action: transitions.archiveConfirmAction,
      run: () => changeStatus('ARCHIVED', COPY.adminProducts.toast.archived),
    });
  } else {
    options.push({
      key: 'restore',
      title: transitions.restoreConfirmTitle,
      body: transitions.restoreConfirmBody,
      action: transitions.restoreConfirmAction,
      run: () => changeStatus('DRAFT', COPY.adminProducts.toast.unpublished),
    });
  }

  const labels: Record<string, string> = {
    publish: transitions.publish,
    unpublish: transitions.unpublish,
    archive: transitions.archive,
    restore: transitions.restore,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant={option.key === 'publish' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPending(option)}
          >
            {labels[option.key]}
          </Button>
        ))}

        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={!deletable}
          onClick={() =>
            setPending({
              key: 'delete',
              title: COPY.adminCommon.confirmDelete.title,
              body: COPY.adminCommon.confirmDelete.body,
              action: COPY.adminCommon.confirmDelete.confirm,
              danger: true,
              run: remove,
            })
          }
        >
          {COPY.adminCommon.actions.delete}
        </Button>
      </div>

      {/* Said before the button is pressed rather than after: a refusal that
          only arrives on click is a refusal the administrator had to earn. */}
      {deletable ? null : (
        <p className="text-ink-700 text-sm">{COPY.adminProducts.errors.deleteBlockedByOrders}</p>
      )}

      {pending ? (
        <Notice tone="warning" role="status" className="flex flex-col gap-3">
          <span className="text-ink-900 block font-medium">{pending.title}</span>
          <span className="block text-sm">{pending.body}</span>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={pending.danger ? 'danger' : 'primary'}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await pending.run();
                } catch {
                  toast.error(COPY.common.error);
                } finally {
                  setBusy(false);
                  setPending(null);
                }
              }}
            >
              {pending.action}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
              {COPY.adminCommon.confirmDelete.cancel}
            </Button>
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
