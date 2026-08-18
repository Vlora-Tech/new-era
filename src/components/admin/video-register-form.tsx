'use client';

import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import {
  registerVideoSchema,
  type RegisterVideoFormValues,
  type RegisterVideoInput,
} from '@/validators/admin-video';

const LIBRARY = COPY.adminCourses.videoLibrary;
const REGISTER = LIBRARY.register;

/**
 * Registering one Bunny video, as a form and nothing else.
 *
 * This was the top half of `VideoLibraryPanel` and was extracted for one reason:
 * an administrator meets the need for it while writing a lesson, not while
 * managing a library. The lesson form now opens it in a dialog and selects the
 * result, and the library panel still renders it inline — same component, same
 * validation, same two-outcome toast, so the two entry points cannot drift into
 * saying different things about the same operation.
 *
 * It reports the created row rather than only success: the caller in the lesson
 * form has to attach it, and returning nothing would force that caller to guess
 * which of the library's rows had just appeared.
 */

export type RegisteredVideo = {
  id: string;
  title: string | null;
  durationSec: number | null;
  processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
};

type Envelope = {
  ok: boolean;
  data?: { video?: RegisteredVideo; confirmed?: boolean };
  error?: { message?: string; details?: Record<string, string> };
};

export function VideoRegisterForm({
  libraryId,
  canConfirm,
  onRegistered,
}: {
  /** From `BUNNY_STREAM_LIBRARY_ID`. Callers handle the unconfigured case. */
  libraryId: string;
  /** Whether a management key is configured, so a GUID can be confirmed. */
  canConfirm: boolean;
  /** The created row, and whether Bunny actually confirmed the identifier. */
  onRegistered: (video: RegisteredVideo, confirmed: boolean) => void;
}) {
  /*
   * Ids per instance, not literals.
   *
   * The course screen renders this form twice — once in the lesson form's
   * dialog and once in the library panel — and hardcoded ids made both copies
   * claim `#video-guid`. Duplicate ids are not cosmetic here: `htmlFor` binds a
   * label to the *first* match in the document, so clicking the dialog's label
   * focused the panel's input behind it, and `aria-describedby` resolved to the
   * wrong hint. `useId()` costs nothing in a component that is already a client
   * component.
   */
  const uid = useId();
  const guidId = `${uid}-guid`;
  const libraryFieldId = `${uid}-library`;
  const titleId = `${uid}-title`;
  const durationId = `${uid}-duration`;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterVideoFormValues, unknown, RegisterVideoInput>({
    resolver: zodResolver(registerVideoSchema),
    defaultValues: { videoGuid: '', title: '', durationSec: null },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch('/api/admin/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as Envelope;

    if (!result.ok) {
      // Field-level messages land on their field, so a bad GUID is corrected
      // where it was typed rather than only announced in a toast that vanishes.
      for (const [field, message] of Object.entries(result.error?.details ?? {})) {
        if (field === 'videoGuid' || field === 'title' || field === 'durationSec') {
          setError(field, { message });
        }
      }
      toast.error(result.error?.message ?? COPY.common.unexpectedError);
      return;
    }

    // The two outcomes are reported differently on purpose: a row Bunny
    // confirmed is known to play, and one accepted on format alone is only
    // known to be well-formed. Showing one success message for both is how a
    // typo reaches a student.
    if (result.data?.confirmed) {
      toast.success(LIBRARY.toast.registered);
    } else {
      toast.warning(LIBRARY.confirmation.unconfirmed);
    }

    reset();
    if (result.data?.video) onRegistered(result.data.video, Boolean(result.data.confirmed));
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor={guidId}>{REGISTER.guid.label}</Label>
          {/* A UUID: isolated so it cannot reorder inside the RTL layout. */}
          <Input
            id={guidId}
            dir="ltr"
            placeholder={REGISTER.guid.placeholder}
            aria-describedby={`${guidId}-hint`}
            aria-invalid={Boolean(errors.videoGuid)}
            {...register('videoGuid')}
          />
          <FieldHint id={`${guidId}-hint`}>{REGISTER.guid.hint}</FieldHint>
          <FieldError message={errors.videoGuid?.message} />
        </Field>

        <Field>
          <Label htmlFor={libraryFieldId}>{REGISTER.libraryId.label}</Label>
          {/*
           * Read-only and disabled, and deliberately *shown*. Omitting it would
           * leave an administrator wondering which library the video was filed
           * under, or whether they forgot a field.
           */}
          <Input id={libraryFieldId} dir="ltr" value={libraryId} readOnly disabled />
          <FieldHint>{REGISTER.libraryId.hint}</FieldHint>
        </Field>
      </div>

      {/*
       * The fallback fields only appear when Bunny cannot be asked. With a
       * management key configured they would be overwritten on save, and a
       * control whose value is silently discarded is a lie about who decides.
       */}
      {!canConfirm ? (
        <>
          <Notice tone="warning">{LIBRARY.confirmation.unconfirmed}</Notice>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor={titleId}>{REGISTER.title.label}</Label>
              <Input
                id={titleId}
                aria-describedby={`${titleId}-hint`}
                aria-invalid={Boolean(errors.title)}
                {...register('title')}
              />
              <FieldHint id={`${titleId}-hint`}>{REGISTER.title.hint}</FieldHint>
              <FieldError message={errors.title?.message} />
            </Field>

            <Field>
              <Label htmlFor={durationId}>{REGISTER.durationSec.label}</Label>
              <Input
                id={durationId}
                type="number"
                inputMode="numeric"
                min={0}
                dir="ltr"
                aria-describedby={`${durationId}-hint`}
                aria-invalid={Boolean(errors.durationSec)}
                {...register('durationSec')}
              />
              <FieldHint id={`${durationId}-hint`}>{REGISTER.durationSec.hint}</FieldHint>
              <FieldError message={errors.durationSec?.message} />
            </Field>
          </div>
        </>
      ) : null}

      <div>
        <Button type="submit" size="sm" loading={isSubmitting}>
          {isSubmitting ? REGISTER.submitting : REGISTER.submit}
        </Button>
      </div>
    </form>
  );
}
