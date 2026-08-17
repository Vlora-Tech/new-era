'use client';

import { useId, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FieldError, FieldHint } from '@/components/ui/field';
import { COPY } from '@/lib/copy';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MEDIA_MIME_TYPES, MEDIA_PURPOSE_RULES, type MediaPurpose } from '@/validators/admin-media';

/**
 * Attach an image to a form.
 *
 * Mounted by both the product form (a cover) and the question form (a stimulus),
 * so it knows nothing about either. Three decisions shape the interface:
 *
 *  - **The prop is `purpose`, not `visibility`.** Visibility is a *consequence*
 *    of the purpose that the server derives from `MEDIA_PURPOSE_RULES`, and a
 *    prop named `visibility` would invite a caller to send one — the request
 *    schema deliberately has no such field, because a client able to ask for a
 *    paid question image to be stored publicly is the one mistake in this area
 *    that cannot be walked back.
 *  - **`value` is the whole asset, not an id.** The picker has to draw a
 *    preview, and an id alone would force it to fetch one — which means the
 *    caller either holds the asset already (an edit screen loads it server-side)
 *    or has just uploaded it here. The form keeps `value?.id ?? null` for its own
 *    field; nothing else about storage leaks into it.
 *  - **Nothing here destroys anything.** Choosing a different image or pressing
 *    remove edits a form value; the previously attached asset is untouched until
 *    the form is saved. A confirmation prompt would be theatre, so the
 *    `replaceConfirm*` and `removeConfirm*` sentences belong to the screen that
 *    actually deletes an asset, not to this component.
 */
export type MediaPickerValue = {
  id: string;
  /** Where to draw it. For a protected asset this is the authorising route. */
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

/** The envelope `POST /api/admin/media` answers with. */
type UploadResponse = {
  ok: boolean;
  data?: MediaPickerValue;
  error?: { message?: string };
};

const BYTES_PER_KILOBYTE = 1_024;
const BYTES_PER_MEGABYTE = 1_024 * 1_024;

/**
 * A byte count in Arabic words, e.g. `٣ ميغابايت`.
 *
 * Deliberately a second copy of the helper in `services/media/image-validation`
 * rather than an import: that module loads `sharp`, and pulling a native image
 * codec into the browser bundle to format four characters would be a poor trade.
 * The unit noun comes from ICU, so neither copy authors Arabic outside `COPY`.
 */
function formatByteSize(bytes: number): string {
  const useMegabytes = bytes >= BYTES_PER_MEGABYTE;
  return new Intl.NumberFormat('ar-SA', {
    style: 'unit',
    unit: useMegabytes ? 'megabyte' : 'kilobyte',
    unitDisplay: 'long',
    maximumFractionDigits: 1,
  }).format(bytes / (useMegabytes ? BYTES_PER_MEGABYTE : BYTES_PER_KILOBYTE));
}

export function MediaPicker({
  purpose,
  value,
  onChange,
  label = COPY.adminMedia.title,
  disabled = false,
  className,
}: {
  purpose: MediaPurpose;
  value: MediaPickerValue | null;
  onChange: (value: MediaPickerValue | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const rules = MEDIA_PURPOSE_RULES[purpose];
  const sizeLimitCopy =
    purpose === 'PRODUCT_COVER'
      ? COPY.adminMedia.limits.coverSize
      : COPY.adminMedia.limits.stimulusSize;

  function fail(message: string): void {
    setError(message);
    toast.error(message);
  }

  function upload(file: File): void {
    setError(null);

    /*
     * The same two rules the server applies, checked first so an obvious mistake
     * costs no upload at all. They are a courtesy, never the enforcement: the
     * server re-checks the size, ignores this declared type entirely and sniffs
     * the bytes, because everything in this file runs on the reader's machine.
     */
    if (file.size > rules.maxBytes) {
      fail(COPY.adminMedia.errors.tooLarge.replace('{limit}', formatByteSize(rules.maxBytes)));
      return;
    }
    if (!(MEDIA_MIME_TYPES as readonly string[]).includes(file.type)) {
      fail(COPY.adminMedia.errors.wrongType);
      return;
    }

    const body = new FormData();
    // Exactly two parts. No visibility, no type, no filename of our choosing.
    body.append('purpose', purpose);
    body.append('file', file);

    setUploading(true);
    setPercent(0);

    /*
     * `XMLHttpRequest` rather than `fetch`, for the one thing it still does
     * better: it reports upload progress. A three-megabyte file on a slow
     * connection is several seconds of a button that would otherwise say nothing
     * at all, and `COPY.adminMedia.progress` exists to be shown during them.
     */
    const request = new XMLHttpRequest();
    request.open('POST', '/api/admin/media');
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        setPercent(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      setUploading(false);
      const result = request.response as UploadResponse | null;
      if (!result?.ok || !result.data) {
        // The server's own Arabic sentence names which validation step refused
        // the file, which is the difference between "try a smaller one" and
        // "stop renaming a PDF to .png".
        fail(result?.error?.message ?? COPY.adminMedia.errors.uploadFailed);
        return;
      }
      onChange(result.data);
      toast.success(COPY.adminMedia.uploadSuccess);
    });

    request.addEventListener('error', () => {
      setUploading(false);
      fail(COPY.adminMedia.errors.uploadFailed);
    });

    request.addEventListener('abort', () => {
      setUploading(false);
    });

    request.send(body);
  }

  const busy = disabled || uploading;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hintId}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <span id={labelId} className="text-ink-900 block text-sm font-medium">
        {label}
      </span>

      <div
        onDragOver={(event) => {
          if (busy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) upload(dropped);
        }}
        className={cn(
          'rounded-panel border-line-200 bg-surface flex flex-col gap-4 border border-dashed p-4',
          'transition-colors duration-150 ease-out',
          dragging && 'border-brand-500 bg-brand-100',
        )}
      >
        {value ? (
          <div className="flex flex-wrap items-start gap-4">
            {/*
             * A plain `<img>`, and `next/image` is ruled out rather than merely
             * unused: the optimiser writes a copy of every image it processes
             * into a shared on-disk cache, which for a protected stimulus would
             * put paid bank content behind an unauthenticated `/_next/image`
             * URL — precisely what the serving route exists to prevent.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt={COPY.adminMedia.selectedFile}
              className="rounded-control border-line-200 max-h-32 w-auto border object-contain"
            />

            <dl className="text-ink-700 grid gap-1 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt>{COPY.adminMedia.fileType}</dt>
                {/* Latin; isolated so the surrounding RTL layout stays stable. */}
                <dd dir="ltr" className="text-ink-900">
                  {value.mimeType}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt>{COPY.adminMedia.fileSize}</dt>
                <dd className="text-ink-900">{formatByteSize(value.sizeBytes)}</dd>
              </div>
              {value.width && value.height ? (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt>{COPY.adminMedia.dimensions}</dt>
                  <dd className="text-ink-900">
                    {`${formatNumber(value.width)} × ${formatNumber(value.height)}`}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="text-ink-700 flex items-center gap-2 text-sm">
            <ImagePlus className="text-ink-600 size-5" aria-hidden="true" />
            {COPY.adminMedia.dropHint}
          </p>
        )}

        {uploading ? (
          // Announced rather than only drawn: a progress bar that a screen
          // reader never mentions leaves the reader with a button that has
          // simply stopped responding.
          <p role="status" aria-live="polite" className="text-ink-700 text-sm">
            {COPY.adminMedia.progress.replace('{percent}', formatNumber(percent))}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {!uploading ? <Upload aria-hidden="true" /> : null}
            {uploading
              ? COPY.adminMedia.uploading
              : value
                ? COPY.adminMedia.replace
                : COPY.adminMedia.pickFile}
          </Button>

          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              {COPY.adminMedia.remove}
            </Button>
          ) : null}
        </div>

        {/*
         * `hidden` rather than visually hidden: a file input clipped to a pixel
         * is still in the tab order, so it would be a second focus stop with no
         * visible ring. Hidden entirely, it is unreachable except through the
         * button above, and `.click()` still opens the picker.
         */}
        <input
          ref={inputRef}
          type="file"
          accept={MEDIA_MIME_TYPES.join(',')}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            // Cleared so choosing the same file again still fires `change`;
            // otherwise a refused upload could not be retried with the same file
            // after fixing it on disk.
            event.target.value = '';
            if (chosen) upload(chosen);
          }}
        />
      </div>

      <FieldHint id={hintId}>
        <span className="block">{COPY.adminMedia.limits.types}</span>
        <span className="block">{sizeLimitCopy}</span>
        <span className="block">{COPY.adminMedia.visibilityHints[rules.visibility]}</span>
        <span className="block">{COPY.adminMedia.limits.reencodeNote}</span>
      </FieldHint>

      <FieldError message={error ?? undefined} />
    </div>
  );
}
