'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import type { $Enums } from '@prisma/client';

import { VideoRegisterForm } from '@/components/admin/video-register-form';
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
import { Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  createLessonSchema,
  type CreateLessonInput,
  type LessonFormValues,
} from '@/validators/admin-course';

/**
 * The lesson editor.
 *
 * Follows the established pattern: a client form that `fetch`es a route handler.
 * There are no server actions anywhere in this codebase, and introducing one
 * here would mean two ways of writing a mutation and two places to audit.
 *
 * Three things this form deliberately does not do:
 *
 *  - **It does not publish.** `createLessonSchema` has no `status` field, and the
 *    PATCH it sends carries `intent: 'update'`, whose server-side variant has no
 *    `status` key either. Publication checks that the lesson has a video or some
 *    text; a save that could skip that check is a save that publishes empty
 *    pages.
 *  - **It does not pretend to upload.** When Bunny is unconfigured there is no
 *    picker at all, only a sentence saying so — a disabled control that looks
 *    like a control is worse than no control, and a fake upload button is worse
 *    than both. Registering an identifier is not uploading, which is why the
 *    dialog below is offered even though an upload button is not.
 *  - **It does not show two unexplained percentages.** The lesson threshold is
 *    nullable and null means "take the course's", so the panel below the field
 *    always states the number that will actually apply and where it came from.
 *
 * Editing fetches the lesson body on open rather than receiving it as a prop:
 * the builder screen carries a whole course's structure, and putting every
 * lesson's text in that payload would ship the course to the browser to draw a
 * list of titles.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

export type LessonFormModule = { id: string; title: string };

export type LessonFormVideo = {
  id: string;
  title: string | null;
  durationSec: number | null;
  processingStatus: $Enums.VideoProcessingStatus;
  /** The lesson currently holding this asset, when there is one. */
  attachedLessonId: string | null;
};

const FIELDS = COPY.adminCourses.lessons.fields;
const VIDEO = COPY.adminCourses.lessons.video;

/** Blank values, used for a create and as the shape a fetched lesson resets into. */
const EMPTY: LessonFormValues = {
  title: '',
  content: '',
  videoAssetId: null,
  durationSec: null,
  isPreview: false,
  completionThresholdPercent: null,
};

/** `""` from a `<select>` or a number box means "nothing chosen", never `0` or `""`. */
const blankToNull = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : value;

const numberOrNull = (value: unknown) => {
  const blanked = blankToNull(value);
  return blanked === null ? null : Number(blanked);
};

export function LessonForm({
  moduleId,
  lessonId,
  modules,
  videoOptions,
  videoEnabled,
  videoLibraryId,
  videoCanConfirm,
  courseThresholdPercent,
  onSaved,
  onCancel,
}: {
  /** The module the lesson is in, or the one a new lesson is being added to. */
  moduleId: string;
  /** Undefined creates; a value edits. */
  lessonId?: string;
  /** Every module of this course, so a misfiled lesson can be moved. */
  modules: readonly LessonFormModule[];
  videoOptions: readonly LessonFormVideo[];
  /** False when no video provider is configured for this environment. */
  videoEnabled: boolean;
  /** From `BUNNY_STREAM_LIBRARY_ID`; null when the environment has no provider. */
  videoLibraryId: string | null;
  /** Whether a management key is configured, so a GUID can be confirmed. */
  videoCanConfirm: boolean;
  courseThresholdPercent: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = lessonId !== undefined;
  const router = useRouter();
  const [targetModuleId, setTargetModuleId] = useState(moduleId);
  const [loading, setLoading] = useState(isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  /*
   * Videos registered from the dialog, held locally until the server re-renders.
   *
   * `router.refresh()` is what genuinely reloads `videoOptions`, but it is not
   * synchronous — and selecting an id that is not yet an `<option>` makes React
   * drop the value, so the administrator would register a video and watch the
   * picker stay on "بلا مقطع". Appending here means the option exists in the
   * same commit that selects it; the refresh then supersedes this list, and the
   * dedupe below stops the row appearing twice in between.
   */
  const [justRegistered, setJustRegistered] = useState<readonly LessonFormVideo[]>([]);
  const availableVideos = [
    ...videoOptions,
    ...justRegistered.filter((added) => !videoOptions.some((option) => option.id === added.id)),
  ];

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LessonFormValues, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: EMPTY,
  });

  /**
   * Load the lesson being edited.
   *
   * `cancelled` guards the state writes: the panel can be closed while the
   * request is in flight, and resetting a form that has been unmounted is a
   * React warning that hides real ones.
   */
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/admin/lessons/${lessonId}`);
        const result = (await response.json()) as ApiEnvelope;
        if (cancelled) return;

        if (!result.ok || !result.data) {
          setLoadFailed(true);
          return;
        }

        const lesson = result.data as {
          moduleId: string;
          title: string;
          content: string | null;
          videoAssetId: string | null;
          durationSec: number | null;
          isPreview: boolean;
          completionThresholdPercent: number | null;
        };

        setTargetModuleId(lesson.moduleId);
        reset({
          title: lesson.title,
          content: lesson.content ?? '',
          videoAssetId: lesson.videoAssetId,
          durationSec: lesson.durationSec,
          isPreview: lesson.isPreview,
          completionThresholdPercent: lesson.completionThresholdPercent,
        });
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, lessonId, reset]);

  // `useWatch` rather than the form's `watch`: the latter returns a function the
  // React compiler cannot memoise, and the whole component then opts out of
  // compilation. This subscribes to two fields and nothing else.
  const override = useWatch({ control, name: 'completionThresholdPercent' });
  const duration = useWatch({ control, name: 'durationSec' });
  const overrideValue = typeof override === 'number' ? override : null;
  const effectiveThreshold = overrideValue ?? courseThresholdPercent;

  const openRegister = () => setRegisterOpen(true);

  /**
   * A newly registered video becomes this lesson's video.
   *
   * Selecting it is the whole point of opening the dialog here rather than
   * sending the administrator to the library panel — registering and then having
   * to find the row in a `<select>` is the trip this replaces. `shouldDirty`
   * marks the form changed, so the unsaved lesson is treated as unsaved.
   */
  const onVideoRegistered = (video: {
    id: string;
    title: string | null;
    durationSec: number | null;
    processingStatus: $Enums.VideoProcessingStatus;
  }) => {
    setJustRegistered((current) => [...current, { ...video, attachedLessonId: null }]);
    setValue('videoAssetId', video.id, { shouldDirty: true, shouldValidate: true });

    // Only fills the duration box when it is still empty: a number already typed
    // by an administrator outranks the provider's, and overwriting it would
    // discard work without saying so.
    const durationEmpty = typeof duration !== 'number' || duration <= 0;
    if (durationEmpty && typeof video.durationSec === 'number' && video.durationSec > 0) {
      setValue('durationSec', video.durationSec, { shouldDirty: true });
    }

    setRegisterOpen(false);
    // Reconciles the server's own list — `justRegistered` is the bridge until
    // this lands, not a replacement for it.
    router.refresh();
  };

  const submit = handleSubmit(async (values) => {
    const response = await fetch(
      isEdit ? `/api/admin/lessons/${lessonId}` : `/api/admin/modules/${targetModuleId}/lessons`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `intent` is what tells the server this is an edit and not a
        // publication. The update variant of the schema has no `status` key, so
        // a status smuggled into this body is stripped before the service runs.
        body: JSON.stringify(
          isEdit ? { intent: 'update', moduleId: targetModuleId, ...values } : values,
        ),
      },
    );
    const result = (await response.json()) as ApiEnvelope;

    if (!result.ok) {
      for (const [field, message] of Object.entries(result.error?.details ?? {})) {
        if (field in values) setError(field as keyof LessonFormValues, { message });
      }
      toast.error(
        result.error?.message ??
          (isEdit ? COPY.adminCommon.toast.updateFailed : COPY.adminCommon.toast.createFailed),
      );
      return;
    }

    toast.success(
      isEdit ? COPY.adminCourses.lessons.toast.updated : COPY.adminCourses.lessons.toast.created,
    );
    onSaved();
  });

  if (loadFailed) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-900 font-medium">{COPY.adminCourses.errors.lessonNotFound}</p>
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {COPY.adminCommon.actions.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {loading ? (
        <p className="text-ink-700 text-sm">{COPY.common.loading}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field>
            <Label htmlFor="lesson-title">{FIELDS.title.label}</Label>
            <Input
              id="lesson-title"
              aria-describedby="lesson-title-hint"
              aria-invalid={Boolean(errors.title)}
              {...register('title')}
            />
            <FieldHint id="lesson-title-hint">{FIELDS.title.hint}</FieldHint>
            <FieldError message={errors.title?.message} />
          </Field>

          {/* Only on an edit. On a create the module is the one whose "درس جديد"
              button was pressed, and offering a choice would invite the lesson to
              be filed somewhere the administrator was not looking. */}
          {isEdit ? (
            <Field>
              <Label htmlFor="lesson-module">{FIELDS.module.label}</Label>
              <Select
                id="lesson-module"
                value={targetModuleId}
                onChange={(event) => setTargetModuleId(event.target.value)}
                aria-describedby="lesson-module-hint"
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </Select>
              <FieldHint id="lesson-module-hint">{FIELDS.module.hint}</FieldHint>
            </Field>
          ) : null}

          <Field>
            <Label htmlFor="lesson-content">
              {FIELDS.content.label}{' '}
              <span className="text-ink-600 font-normal">
                ({COPY.adminCommon.form.optionalMark})
              </span>
            </Label>
            <Textarea
              id="lesson-content"
              rows={8}
              aria-describedby="lesson-content-hint"
              aria-invalid={Boolean(errors.content)}
              {...register('content')}
            />
            <FieldHint id="lesson-content-hint">{FIELDS.content.hint}</FieldHint>
            <FieldError message={errors.content?.message} />
          </Field>

          <Field>
            <Label htmlFor="lesson-video">{FIELDS.videoAsset.label}</Label>
            {/*
              Three honest states rather than one picker that is sometimes a lie:
              no provider configured, a configured provider with an empty library,
              and a library with something in it. The first two produce a sentence
              and no control at all — a select with nothing selectable teaches an
              administrator that the feature is broken.
            */}
            {!videoEnabled || videoLibraryId === null ? (
              <Notice tone="neutral" role="note">
                {VIDEO.notConfigured}
              </Notice>
            ) : availableVideos.length === 0 ? (
              /*
                An empty library used to send the administrator down the page to
                a card that looked like a different feature, with a half-written
                lesson left open behind them. The registration form now comes to
                them instead — same component, same validation, and the result is
                selected here without the page moving.
              */
              <div className="flex flex-col items-start gap-3">
                <Notice tone="neutral" role="note">
                  {VIDEO.noAssets}
                </Notice>
                <Button type="button" variant="secondary" size="sm" onClick={openRegister}>
                  <Plus className="size-4" aria-hidden="true" />
                  {VIDEO.registerHere}
                </Button>
              </div>
            ) : (
              /*
                The picker and the way to add to it, on one row. The button is
                beside the control it fills rather than at the foot of the form:
                the need for it is discovered while reading the options, and a
                remedy placed anywhere else is a remedy nobody finds.
              */
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  id="lesson-video"
                  className="min-w-0 flex-1"
                  aria-describedby="lesson-video-hint"
                  aria-invalid={Boolean(errors.videoAssetId)}
                  {...register('videoAssetId', { setValueAs: blankToNull })}
                >
                  <option value="">{VIDEO.none}</option>
                  {availableVideos.map((video) => {
                    const attachedElsewhere =
                      video.attachedLessonId !== null && video.attachedLessonId !== lessonId;
                    const state =
                      video.processingStatus !== 'READY'
                        ? VIDEO.notReady
                        : attachedElsewhere
                          ? VIDEO.inUse
                          : video.attachedLessonId === lessonId && lessonId !== undefined
                            ? VIDEO.attached
                            : VIDEO.ready;

                    return (
                      <option
                        key={video.id}
                        value={video.id}
                        // Refused by the server anyway; disabled here so the
                        // refusal is visible before it is earned.
                        disabled={video.processingStatus !== 'READY' || attachedElsewhere}
                      >
                        {`${video.title ?? video.id} — ${state}`}
                      </option>
                    );
                  })}
                </Select>

                <Button type="button" variant="outline" size="md" onClick={openRegister}>
                  <Plus className="size-4" aria-hidden="true" />
                  {VIDEO.registerNew}
                </Button>
              </div>
            )}
            <FieldHint id="lesson-video-hint">{FIELDS.videoAsset.hint}</FieldHint>
            <FieldError message={errors.videoAssetId?.message} />
          </Field>

          <Field>
            <Label htmlFor="lesson-duration">
              {FIELDS.durationSec.label}{' '}
              <span className="text-ink-600 font-normal">
                ({COPY.adminCommon.form.optionalMark})
              </span>
            </Label>
            {/* `inputMode="numeric"` on a text box rather than `type="number"`:
                a number input silently discards what it cannot parse, so the
                value on screen and the value submitted can differ. */}
            <Input
              id="lesson-duration"
              type="text"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              aria-describedby="lesson-duration-hint"
              aria-invalid={Boolean(errors.durationSec)}
              {...register('durationSec', { setValueAs: numberOrNull })}
            />
            <FieldHint id="lesson-duration-hint">{FIELDS.durationSec.hint}</FieldHint>
            <FieldError message={errors.durationSec?.message} />
          </Field>

          <Field>
            <Label htmlFor="lesson-threshold">
              {FIELDS.completionThresholdPercent.label}{' '}
              <span className="text-ink-600 font-normal">
                ({COPY.adminCommon.form.optionalMark})
              </span>
            </Label>
            <Input
              id="lesson-threshold"
              type="text"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              aria-describedby="lesson-threshold-hint"
              aria-invalid={Boolean(errors.completionThresholdPercent)}
              {...register('completionThresholdPercent', { setValueAs: numberOrNull })}
            />
            <FieldHint id="lesson-threshold-hint">
              {FIELDS.completionThresholdPercent.hint}
            </FieldHint>
            <FieldError message={errors.completionThresholdPercent?.message} />

            {/* The number that will actually apply, and where it came from. Two
                bare percentages on two screens is how an administrator ends up
                unsure which one the platform uses. */}
            <dl className="border-line-200 text-ink-700 mt-1 flex flex-wrap items-baseline gap-x-2 border-t pt-2 text-xs">
              <dt>{COPY.adminCourses.threshold.effectiveLabel}</dt>
              <dd className="text-ink-900 font-medium" dir="ltr">
                <span dir="ltr">{formatPercent(effectiveThreshold / 100)}</span>
              </dd>
              <dd>
                {overrideValue === null
                  ? COPY.adminCourses.threshold.inherited
                  : COPY.adminCourses.threshold.overridden}
              </dd>
            </dl>
          </Field>

          <Field>
            <div className="flex items-start gap-3">
              <Checkbox id="lesson-preview" className="mt-1" {...register('isPreview')} />
              <Label htmlFor="lesson-preview" className="leading-relaxed font-normal">
                {FIELDS.isPreview.label}
              </Label>
            </div>
            <FieldHint id="lesson-preview-hint">{FIELDS.isPreview.hint}</FieldHint>
            <FieldError message={errors.isPreview?.message} />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {COPY.adminCommon.actions.cancel}
            </Button>
            {/* A duration already recorded, restated in words: the box holds
                seconds, and nobody reads 5400 as an hour and a half. */}
            {typeof duration === 'number' && duration > 0 ? (
              <span className="text-ink-700 text-xs">{formatDurationWords(duration)}</span>
            ) : null}
          </div>
        </form>
      )}

      {/*
        Registration, in a dialog over the lesson being written.

        Radix rather than a hand-rolled overlay: it already provides the focus
        trap, focus restoration to the button that opened it, Escape-to-close,
        `aria-modal` and the body scroll lock. It is deliberately NOT nested
        inside the `<form>` above — a form inside a form is invalid HTML, and the
        inner submit would post the lesson.
      */}
      {videoLibraryId !== null ? (
        <Dialog.Root open={registerOpen} onOpenChange={setRegisterOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-ink-900/40 fixed inset-0 z-40" />
            <Dialog.Content
              className={cn(
                /*
                 * Physical `left-1/2`, not logical `start-1/2`. `translate-x` is
                 * physical in both directions, so pairing it with `start` under
                 * `dir="rtl"` resolves to `right: 50%` and then shifts the panel
                 * a further half-width to the left — which is how this first
                 * rendered, hanging off the inline-start edge of the viewport.
                 * `left-1/2` + `-translate-x-1/2` centres in either direction.
                 */
                'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
                'max-h-[calc(100dvh-4rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto',
                'rounded-panel border-line-200 bg-surface shadow-overlay border p-5 sm:p-6',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Dialog.Title className="text-ink-900 text-base font-semibold">
                    {VIDEO.registerDialogTitle}
                  </Dialog.Title>
                  <Dialog.Description className="text-ink-700 text-sm">
                    {VIDEO.registerDialogBody}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label={COPY.adminCommon.actions.cancel}
                    className={cn(
                      'rounded-control inline-flex size-9 shrink-0 items-center justify-center',
                      'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
                      'transition-colors duration-150',
                    )}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="mt-5">
                <VideoRegisterForm
                  libraryId={videoLibraryId}
                  canConfirm={videoCanConfirm}
                  onRegistered={onVideoRegistered}
                />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </div>
  );
}
