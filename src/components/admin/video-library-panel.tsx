'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { VideoRegisterForm } from '@/components/admin/video-register-form';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatNumber } from '@/lib/format';

const LIBRARY = COPY.adminCourses.videoLibrary;
const REGISTER = LIBRARY.register;

/**
 * The registered library: what exists, where each video is used, and a way to
 * register another.
 *
 * This panel exists because the lesson video picker could only ever *select* a
 * `VideoAsset` and nothing could create one, so its list was permanently empty
 * and no lesson could ever carry a video.
 *
 * Its relationship to the lesson form has since been inverted, and that is the
 * important part. Registration used to live *only* here, which meant writing a
 * lesson, discovering the picker was empty, scrolling past the builder's footer
 * to a card that looked like a different feature, registering, and scrolling
 * back with the half-written lesson still open. The lesson form now opens
 * `VideoRegisterForm` in a dialog and attaches the result, so that trip is gone.
 *
 * What is left here is the part that genuinely is a separate job: seeing the
 * whole library at once, reading where each video is attached, and
 * un-registering one. That is library housekeeping, not lesson authoring, and
 * it belongs in its own panel — which is now what it looks like.
 */
export type VideoLibraryRow = {
  id: string;
  videoGuid: string;
  title: string | null;
  durationSec: number | null;
  processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  lessonCount: number;
  simulatorIntroCount: number;
};

type Props = {
  rows: readonly VideoLibraryRow[];
  /** From `BUNNY_STREAM_LIBRARY_ID`; null when the environment has no provider. */
  libraryId: string | null;
  /** Whether a management key is configured, so a GUID can be confirmed. */
  canConfirm: boolean;
};

type Envelope = {
  ok: boolean;
  data?: { confirmed?: boolean };
  error?: { message?: string; details?: Record<string, string> };
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${formatNumber(minutes)}:${String(rest).padStart(2, '0')}`;
}

function usageLabel(row: VideoLibraryRow): string {
  const parts: string[] = [];
  if (row.lessonCount > 0) {
    parts.push(LIBRARY.usage.lessons.replace('{count}', formatNumber(row.lessonCount)));
  }
  if (row.simulatorIntroCount > 0) {
    parts.push(
      LIBRARY.usage.simulatorIntros.replace('{count}', formatNumber(row.simulatorIntroCount)),
    );
  }
  return parts.length > 0 ? parts.join(COPY.adminCommon.listSeparator) : LIBRARY.usage.unused;
}

export function VideoLibraryPanel({ rows, libraryId, canConfirm }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function unregister(row: VideoLibraryRow) {
    if (!window.confirm(`${LIBRARY.confirmDelete.title}\n\n${LIBRARY.confirmDelete.body}`)) return;

    setBusyId(row.id);
    try {
      const response = await fetch(`/api/admin/videos/${row.id}`, { method: 'DELETE' });
      const result = (await response.json()) as Envelope;
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.common.unexpectedError);
        return;
      }
      toast.success(LIBRARY.toast.deleted);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  // No provider configured: say so once, and render nothing that pretends to
  // work. An input that cannot succeed is worse than an honest absence.
  if (!libraryId) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-ink-900 text-lg font-semibold">{LIBRARY.title}</h2>
        <Notice tone="warning" className="mt-4">
          {LIBRARY.errors.notConfigured}
        </Notice>
      </Card>
    );
  }

  return (
    /*
     * The anchor lives on a wrapping section rather than on `Card`, which takes
     * no `id`. `scroll-mt` keeps the heading clear of the administration shell's
     * header when the lesson form's empty picker jumps here.
     */
    <section id="video-library" className="scroll-mt-24">
      <Card className="p-5 sm:p-6">
        <h2 className="text-ink-900 text-lg font-semibold">{LIBRARY.title}</h2>
        <p className="text-ink-700 mt-1 max-w-prose text-sm">{LIBRARY.description}</p>

        <div className="mt-5">
          <h3 className="text-ink-900 text-sm font-semibold">{REGISTER.heading}</h3>
          <p className="text-ink-700 mt-1 max-w-prose text-sm">{LIBRARY.alsoInLesson}</p>
          <div className="mt-4">
            <VideoRegisterForm
              libraryId={libraryId}
              canConfirm={canConfirm}
              onRegistered={() => router.refresh()}
            />
          </div>
        </div>

        <div className="mt-6">
          {rows.length === 0 ? (
            <EmptyState
              title={LIBRARY.empty.nothingYetTitle}
              description={LIBRARY.empty.nothingYetBody}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-line-200 text-ink-700 border-b">
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {LIBRARY.columns.title}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {LIBRARY.columns.guid}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {LIBRARY.columns.duration}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {LIBRARY.columns.usage}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      <span className="sr-only">{COPY.adminCommon.table.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const inUse = row.lessonCount > 0 || row.simulatorIntroCount > 0;
                    return (
                      <tr key={row.id} className="border-line-200 border-b last:border-0">
                        <td className="text-ink-900 px-3 py-2">
                          {row.title ?? LIBRARY.untitled}{' '}
                          {row.processingStatus !== 'READY' ? (
                            <Badge variant="warning">
                              {COPY.adminCourses.lessons.video.notReady}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="text-ink-700 px-3 py-2 font-mono text-xs" dir="ltr">
                          {row.videoGuid}
                        </td>
                        <td className="text-ink-700 px-3 py-2" dir="ltr">
                          {formatDuration(row.durationSec)}
                        </td>
                        <td className="text-ink-700 px-3 py-2">{usageLabel(row)}</td>
                        <td className="px-3 py-2 text-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            // Refused server-side too; disabling here explains why
                            // rather than making somebody discover it by failing.
                            disabled={inUse || busyId === row.id}
                            title={inUse ? LIBRARY.errors.deleteBlockedInUse : undefined}
                            loading={busyId === row.id}
                            onClick={() => void unregister(row)}
                          >
                            {LIBRARY.confirmDelete.confirm}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
