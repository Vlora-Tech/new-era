'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { Card, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import {
  settingsFormSchema,
  settingsFormToInput,
  type SettingsFormOutput,
  type SettingsFormValues,
} from '@/validators/admin-settings';

/**
 * The platform settings editor.
 *
 * A form of named, typed controls — not a JSON textarea. `SiteSetting.value` is
 * a `Json` column, and the shortest path from that column to a screen is a box
 * an administrator pastes an object into; the shortest path from *that* to an
 * outage is one missing brace in the row the contact page reads. So every key
 * here has a label, a hint, its own validation and its own error message, and
 * the five keys this screen can write are fixed in `SETTING_KEYS`.
 *
 * The one interesting piece of behaviour is the legal-version confirmation.
 * `ConsentRecord` stores the version strings that were in force at the moment a
 * person accepted, so changing one says the document itself changed: every
 * consent from now on names the new text and every consent already taken keeps
 * naming the old one. That is a product decision, not a typo correction, and the
 * screen states the consequence *before* the change rather than reporting it
 * after — which is why the confirmation is a panel the administrator reads and
 * not a browser `confirm()` nobody can quote back later.
 *
 * The server refuses the same change without the acknowledgement, so this panel
 * is the explanation, never the enforcement.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: { changed?: string[] };
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

export type SettingsFormInitial = SettingsFormValues;

/** The "آخر تحديث" line under a field, already formatted on the server. */
export type SettingsFieldMeta = {
  /** A formatted timestamp, or `null` when no row has ever been written. */
  updatedAt: string | null;
  /** The editor's name or address; `null` when the platform wrote the row. */
  updatedBy: string | null;
};

export type SettingsMetaMap = {
  termsVersion: SettingsFieldMeta;
  privacyVersion: SettingsFieldMeta;
  contactEmail: SettingsFieldMeta;
  contactPhone: SettingsFieldMeta;
  examTrackMapping: SettingsFieldMeta;
};

const SETTINGS = COPY.adminSettings;

/**
 * Server field names → form field names.
 *
 * The endpoint validates a nested `examTrackMapping`, while the form edits three
 * flat controls. Without this map a rejected track list would show its message
 * on no field at all, which leaves the administrator with a red toast and
 * nothing to correct.
 */
const SERVER_FIELD_MAP: Record<string, keyof SettingsFormValues> = {
  termsVersion: 'termsVersion',
  privacyVersion: 'privacyVersion',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  'examTrackMapping.note': 'trackMappingNote',
  'examTrackMapping.scientific': 'trackMappingScientific',
  'examTrackMapping.theoretical': 'trackMappingTheoretical',
  examTrackMapping: 'trackMappingTheoretical',
};

function FieldMetaLine({ meta }: { meta: SettingsFieldMeta }) {
  if (!meta.updatedAt) {
    return <p className="text-ink-600 text-xs">{SETTINGS.neverUpdated}</p>;
  }
  return (
    <p className="text-ink-600 text-xs">
      {SETTINGS.lastUpdated}: {meta.updatedAt}
      {meta.updatedBy ? (
        <>
          {' — '}
          {SETTINGS.updatedBy}: <span dir="ltr">{meta.updatedBy}</span>
        </>
      ) : null}
    </p>
  );
}

export function SettingsForm({
  initial,
  meta,
  seeded,
}: {
  initial: SettingsFormInitial;
  meta: SettingsMetaMap;
  /** False when not one key has a row yet: the defaults are on screen. */
  seeded: boolean;
}) {
  const router = useRouter();
  const fields = SETTINGS.fields;

  /**
   * The values as the server last confirmed them.
   *
   * Kept separately from the form's own defaults because the legal comparison
   * has to be against what is *stored*, not against what the form started with.
   * After a save this moves forward, so pressing save twice does not ask for the
   * confirmation a second time for a change that already happened.
   */
  const [saved, setSaved] = useState<SettingsFormValues>(initial);
  /** Non-null while the legal-change confirmation is on screen. */
  const [pendingLegal, setPendingLegal] = useState<SettingsFormOutput | null>(null);
  const [confirming, setConfirming] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues, unknown, SettingsFormOutput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: initial,
  });

  function applyServerErrors(details: Record<string, string> | undefined) {
    for (const [field, message] of Object.entries(details ?? {})) {
      const target = SERVER_FIELD_MAP[field];
      if (target) setError(target, { message });
    }
  }

  async function save(values: SettingsFormOutput, acknowledgeLegalChange: boolean) {
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsFormToInput(values, acknowledgeLegalChange)),
    });
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      applyServerErrors(result.error?.details);
      toast.error(result.error?.message ?? SETTINGS.toast.saveFailed);
      return;
    }

    const changed = result.data?.changed ?? [];
    // The server reports a no-op honestly rather than claiming a save, so the
    // toast says so too — otherwise "حُفظت الإعدادات" would appear for a form
    // that wrote nothing, and the trail would disagree with the screen.
    if (changed.length === 0) {
      toast.success(SETTINGS.errors.noChanges);
    } else {
      toast.success(changed.length === 1 ? SETTINGS.toast.savedOne : SETTINGS.toast.saved);
    }

    setSaved(values);
    reset(values);
    router.refresh();
  }

  const submit = handleSubmit(async (values) => {
    const legalChanged =
      values.termsVersion !== saved.termsVersion || values.privacyVersion !== saved.privacyVersion;

    if (legalChanged) {
      // Shown, not sent. The confirmation below carries the acknowledgement.
      setPendingLegal(values);
      return;
    }

    await save(values, false);
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Notice tone="neutral" role="note">
        {SETTINGS.notices.noSecrets}
      </Notice>

      {seeded ? null : (
        <Notice tone="warning" role="note" className="flex flex-col gap-1">
          <span className="text-ink-900 block font-medium">{SETTINGS.empty.nothingYetTitle}</span>
          <span className="block text-sm">{SETTINGS.empty.nothingYetBody}</span>
        </Notice>
      )}

      {/* ── Legal documents ── */}
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 text-lg font-semibold">{SETTINGS.groups.legal.title}</h2>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.groups.legal.description}</p>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.notices.legalVersionMeaning}</p>
        </div>

        <Field>
          <Label htmlFor="termsVersion">{fields.termsVersion.label}</Label>
          {/* ASCII by schema, so the box is isolated from the RTL page. */}
          <Input
            id="termsVersion"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={fields.termsVersion.placeholder}
            aria-describedby="termsVersion-hint"
            aria-invalid={Boolean(errors.termsVersion)}
            {...register('termsVersion')}
          />
          <FieldHint id="termsVersion-hint">{fields.termsVersion.hint}</FieldHint>
          <FieldError message={errors.termsVersion?.message} />
          <FieldMetaLine meta={meta.termsVersion} />
        </Field>

        <Field>
          <Label htmlFor="privacyVersion">{fields.privacyVersion.label}</Label>
          <Input
            id="privacyVersion"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={fields.privacyVersion.placeholder}
            aria-describedby="privacyVersion-hint"
            aria-invalid={Boolean(errors.privacyVersion)}
            {...register('privacyVersion')}
          />
          <FieldHint id="privacyVersion-hint">{fields.privacyVersion.hint}</FieldHint>
          <FieldError message={errors.privacyVersion?.message} />
          <FieldMetaLine meta={meta.privacyVersion} />
        </Field>
      </Card>

      {/* ── Contact details ── */}
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 text-lg font-semibold">{SETTINGS.groups.contact.title}</h2>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.groups.contact.description}</p>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.notices.contactIsPublic}</p>
        </div>

        <Field>
          <Label htmlFor="contactEmail">{fields.contactEmail.label}</Label>
          <Input
            id="contactEmail"
            type="email"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={fields.contactEmail.placeholder}
            aria-describedby="contactEmail-hint"
            aria-invalid={Boolean(errors.contactEmail)}
            {...register('contactEmail')}
          />
          <FieldHint id="contactEmail-hint">{fields.contactEmail.hint}</FieldHint>
          <FieldError message={errors.contactEmail?.message} />
          <FieldMetaLine meta={meta.contactEmail} />
        </Field>

        <Field>
          <Label htmlFor="contactPhone">
            {fields.contactPhone.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.adminCommon.form.optionalMark})</span>
          </Label>
          <Input
            id="contactPhone"
            type="tel"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={fields.contactPhone.placeholder}
            aria-describedby="contactPhone-hint"
            aria-invalid={Boolean(errors.contactPhone)}
            {...register('contactPhone')}
          />
          <FieldHint id="contactPhone-hint">{fields.contactPhone.hint}</FieldHint>
          <FieldError message={errors.contactPhone?.message} />
          <FieldMetaLine meta={meta.contactPhone} />
        </Field>
      </Card>

      {/* ── Track mapping ── */}
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 text-lg font-semibold">{SETTINGS.groups.exam.title}</h2>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.groups.exam.description}</p>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.notices.trackMappingSource}</p>
        </div>

        <Field>
          <Label htmlFor="trackMappingNote">{fields.examTrackMapping.sourceLabel}</Label>
          <Textarea
            id="trackMappingNote"
            rows={3}
            aria-describedby="trackMappingNote-hint"
            aria-invalid={Boolean(errors.trackMappingNote)}
            {...register('trackMappingNote')}
          />
          <FieldHint id="trackMappingNote-hint">{fields.examTrackMapping.sourceHint}</FieldHint>
          <FieldError message={errors.trackMappingNote?.message} />
        </Field>

        <Field>
          <Label htmlFor="trackMappingScientific">{fields.examTrackMapping.scientificLabel}</Label>
          {/* One track per line. A structured list edited as lines rather than
              as JSON: the shape is fixed by the schema, so the administrator
              only has to get the names right. */}
          <Textarea
            id="trackMappingScientific"
            rows={5}
            aria-describedby="trackMappingScientific-hint"
            aria-invalid={Boolean(errors.trackMappingScientific)}
            {...register('trackMappingScientific')}
          />
          <FieldHint id="trackMappingScientific-hint">{fields.examTrackMapping.listHint}</FieldHint>
          <FieldError message={errors.trackMappingScientific?.message} />
        </Field>

        <Field>
          <Label htmlFor="trackMappingTheoretical">
            {fields.examTrackMapping.theoreticalLabel}
          </Label>
          <Textarea
            id="trackMappingTheoretical"
            rows={5}
            aria-describedby="trackMappingTheoretical-hint"
            aria-invalid={Boolean(errors.trackMappingTheoretical)}
            {...register('trackMappingTheoretical')}
          />
          <FieldHint id="trackMappingTheoretical-hint">
            {fields.examTrackMapping.listHint}
          </FieldHint>
          <FieldError message={errors.trackMappingTheoretical?.message} />
          <FieldMetaLine meta={meta.examTrackMapping} />
        </Field>
      </Card>

      {pendingLegal ? (
        <Notice tone="warning" role="status" className="flex flex-col gap-3">
          <span className="text-ink-900 block font-medium">
            {SETTINGS.confirmLegalChange.title}
          </span>
          <span className="block text-sm">{SETTINGS.confirmLegalChange.body}</span>
          <span className="block text-sm">{SETTINGS.confirmLegalChange.reminder}</span>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              loading={confirming}
              onClick={async () => {
                setConfirming(true);
                try {
                  await save(pendingLegal, true);
                  setPendingLegal(null);
                } catch {
                  toast.error(SETTINGS.toast.saveFailed);
                } finally {
                  setConfirming(false);
                }
              }}
            >
              {SETTINGS.confirmLegalChange.confirm}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingLegal(null)}
              disabled={confirming}
            >
              {SETTINGS.confirmLegalChange.cancel}
            </Button>
          </span>
        </Notice>
      ) : null}

      <Notice tone="neutral" role="note" className="flex flex-col gap-1">
        <span className="block">{SETTINGS.notices.appliesImmediately}</span>
        <span className="block">{SETTINGS.notices.auditedAction}</span>
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? SETTINGS.saving : SETTINGS.saveAction}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset(saved);
            setPendingLegal(null);
          }}
        >
          {SETTINGS.resetAction}
        </Button>
      </div>
    </form>
  );
}
