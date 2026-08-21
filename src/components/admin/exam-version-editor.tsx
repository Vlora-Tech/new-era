'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { $Enums } from '@prisma/client';

import { AdminEditorDialog } from '@/components/admin/admin-editor-dialog';
// `BlueprintRuleEditor` returns with the commented-out block in `SectionPanel`.
// import { BlueprintRuleEditor } from '@/components/admin/blueprint-rule-editor';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
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
import { Badge, Card, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDate, formatDurationWords, formatNumber } from '@/lib/format';
import type {
  AdminExamFixedQuestionRow,
  AdminExamSectionRow,
  AdminExamVersionDetail,
} from '@/services/exams/exam-version-admin.service';
import type {
  AdminSimulatorDetail,
  AdminSimulatorVersionSummary,
} from '@/services/exams/simulator-admin.service';
import {
  createExamSectionSchema,
  createExamVersionSchema,
  updateExamVersionSchema,
  updateSimulatorSchema,
  type CreateExamSectionInput,
  type ExamSectionFormValues,
  type ExamVersionFormValues,
  type UpdateExamVersionInput,
  type UpdateSimulatorFormValues,
  type UpdateSimulatorInput,
} from '@/validators/admin-simulator';

/**
 * The client half of the simulator screens.
 *
 * The established pattern in this codebase is a client form that `fetch`es a
 * route handler — there are no server actions anywhere, and introducing one here
 * would mean two ways of writing a mutation and two places to audit.
 *
 * Every section, rule and fixed-question endpoint answers with the *whole*
 * version rather than with the row it touched, and this file holds that answer
 * in one piece of state. It is not laziness: a section's question count changes
 * what every rule in it is allocated, which changes the version's totals, which
 * changes whether the version can be published. Patching a single row into the
 * screen would leave a consistent fragment sitting inside an inconsistent page,
 * and the numbers that disagree are exactly the ones publication refuses on.
 */

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

/**
 * Send a mutation and return what came back, or `null` if it was refused.
 *
 * The failure path shows the server's own Arabic sentence. Those sentences name
 * the obstacle — "لا يمكن تعديل بنية إصدار منشور…" — and replacing them with a
 * generic "تعذّر الحفظ" would leave an administrator pressing the same button.
 */
async function send<T>(url: string, method: string, body?: unknown): Promise<T | null> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as Envelope<T>;

  if (!result.ok) {
    toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
    return null;
  }
  return result.data ?? null;
}

// ── A confirmation that says what changes before it happens ──────────────

type PendingConfirm = {
  key: string;
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  run: () => Promise<void>;
};

function ConfirmNotice({
  pending,
  onCancel,
}: {
  pending: PendingConfirm | null;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!pending) return null;

  return (
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
              onCancel();
            }
          }}
        >
          {pending.action}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {COPY.adminCommon.confirmDelete.cancel}
        </Button>
      </span>
    </Notice>
  );
}

/** The version status pill, in the one place both screens read it from. */
export function ExamVersionStatusBadge({
  status,
  isActive,
}: {
  status: $Enums.ExamVersionStatus;
  isActive?: boolean;
}) {
  const variant = status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'neutral' : 'outline';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={variant}>{COPY.adminSimulators.statusLabels[status]}</Badge>
      {isActive ? <Badge variant="brand">{COPY.adminSimulators.activeLabels.active}</Badge> : null}
    </span>
  );
}

// ── The simulator's own settings ─────────────────────────────────────────

const SETTINGS = COPY.adminSimulators.settings;

/**
 * Track, modes, intro video and the active version.
 *
 * The active version is a `<select>` limited to versions that are published,
 * plus whatever is currently active. Offering a draft would offer a choice the
 * server refuses, and a control that can be set to a value that never applies is
 * worse than one that cannot.
 */
export function SimulatorSettingsForm({ simulator }: { simulator: AdminSimulatorDetail }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSimulatorFormValues, unknown, UpdateSimulatorInput>({
    resolver: zodResolver(updateSimulatorSchema),
    defaultValues: {
      track: simulator.track,
      fullSimulationEnabled: simulator.fullSimulationEnabled,
      trainingModeEnabled: simulator.trainingModeEnabled,
      introVideoAssetId: simulator.introVideoAssetId,
      activeExamVersionId: simulator.activeVersionId,
    },
  });

  const activatable = simulator.versions.filter(
    (version) => version.status === 'PUBLISHED' || version.isActive,
  );

  const submit = handleSubmit(async (values) => {
    const data = await send<{ activeVersionChanged: boolean }>(
      `/api/admin/simulators/${simulator.id}`,
      'PATCH',
      {
        ...values,
        // An empty `<select>` means "no active version", which is `null` — the
        // empty string would be parsed as a malformed uuid and refused.
        introVideoAssetId: values.introVideoAssetId || null,
        activeExamVersionId: values.activeExamVersionId || null,
      },
    );
    if (!data) return;

    toast.success(
      data.activeVersionChanged
        ? COPY.adminSimulators.versions.toast.activated
        : SETTINGS.toast.updated,
    );
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {SETTINGS.title}
          </h2>
          <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.description}</p>
        </div>

        <Field>
          <Label htmlFor="track">{SETTINGS.fields.track.label}</Label>
          <Select
            id="track"
            aria-describedby="track-hint"
            aria-invalid={Boolean(errors.track)}
            {...register('track')}
          >
            {(['SCIENTIFIC', 'THEORETICAL', 'BOTH', 'CUSTOM'] as const).map((track) => (
              <option key={track} value={track}>
                {COPY.adminSimulators.trackLabels[track]}
              </option>
            ))}
          </Select>
          <FieldHint id="track-hint">{SETTINGS.fields.track.hint}</FieldHint>
          <FieldError message={errors.track?.message} />
        </Field>

        <Field>
          <div className="flex items-start gap-3">
            <Checkbox
              id="fullSimulationEnabled"
              className="mt-1"
              {...register('fullSimulationEnabled')}
            />
            <Label htmlFor="fullSimulationEnabled" className="leading-relaxed font-normal">
              {SETTINGS.fields.fullSimulationEnabled.label}
            </Label>
          </div>
          <FieldHint id="full-hint">{SETTINGS.fields.fullSimulationEnabled.hint}</FieldHint>
        </Field>

        <Field>
          <div className="flex items-start gap-3">
            <Checkbox
              id="trainingModeEnabled"
              className="mt-1"
              {...register('trainingModeEnabled')}
            />
            <Label htmlFor="trainingModeEnabled" className="leading-relaxed font-normal">
              {SETTINGS.fields.trainingModeEnabled.label}
            </Label>
          </div>
          <FieldHint id="training-hint">{SETTINGS.fields.trainingModeEnabled.hint}</FieldHint>
        </Field>

        <Field>
          <Label htmlFor="introVideoAssetId">
            {SETTINGS.fields.introVideoAsset.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.adminCommon.form.optionalMark})</span>
          </Label>
          {/* A uuid box rather than a picker: video assets are provisioned by the
              media pipeline and there is no browse surface for them yet. Latin
              content, so it is isolated from the RTL page. */}
          <Input
            id="introVideoAssetId"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="intro-hint"
            aria-invalid={Boolean(errors.introVideoAssetId)}
            {...register('introVideoAssetId')}
          />
          <FieldHint id="intro-hint">{SETTINGS.fields.introVideoAsset.hint}</FieldHint>
          <FieldError message={errors.introVideoAssetId?.message} />
        </Field>

        <Field>
          <Label htmlFor="activeExamVersionId">{SETTINGS.fields.activeExamVersion.label}</Label>
          <Select
            id="activeExamVersionId"
            aria-describedby="active-hint"
            aria-invalid={Boolean(errors.activeExamVersionId)}
            {...register('activeExamVersionId')}
          >
            <option value="">{COPY.adminCommon.form.unchosen}</option>
            {activatable.map((version) => (
              <option key={version.id} value={version.id}>
                {`${COPY.adminSimulators.versions.columns.versionNumber} ${formatNumber(version.versionNumber)}`}
              </option>
            ))}
          </Select>
          <FieldHint id="active-hint">{SETTINGS.fields.activeExamVersion.hint}</FieldHint>
          <FieldError message={errors.activeExamVersionId?.message} />
        </Field>

        {simulator.activeVersionId === null ? (
          <Notice tone="warning" role="note">
            {COPY.adminSimulators.notices.noActiveVersionNote}
          </Notice>
        ) : (
          <Notice tone="neutral" role="note">
            {COPY.adminSimulators.notices.activeVersionNote}
          </Notice>
        )}
      </Card>

      <Notice tone="neutral" role="note">
        {COPY.adminCommon.notices.auditedAction}
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/simulators">{COPY.adminCommon.actions.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Adding a version ─────────────────────────────────────────────────────

const VERSIONS = COPY.adminSimulators.versions;

/**
 * Create a version, blank or as a copy of an existing one.
 *
 * The clone is offered on the same control as the blank create because they are
 * the same decision seen from two sides — "I need another version" — and the
 * choice of source is what distinguishes them. Cloning is the only way to change
 * a published exam, so it is not hidden behind the version it copies.
 */
export function NewExamVersionForm({
  simulatorId,
  versions,
}: {
  simulatorId: string;
  versions: readonly AdminSimulatorVersionSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [open, setOpen] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const body = sourceId
        ? { mode: 'clone' as const, sourceVersionId: sourceId, changeSummary: null }
        : createExamVersionSchema.parse({
            mode: 'blank',
            // A blank version starts as one hour and forty questions rather than
            // as zeros: the columns are non-nullable, and zeros would make the
            // first save look like a mistake somebody had already made.
            selectionMode: 'BLUEPRINT',
            totalQuestions: 40,
            totalDurationSec: 3_600,
            resultDisclaimer: '',
            changeSummary: null,
            sourceLabel: null,
            sourceUrl: null,
            sourceRetrievedAt: null,
            sourceNote: null,
          });

      const version = await send<AdminExamVersionDetail>(
        `/api/admin/simulators/${simulatorId}/versions`,
        'POST',
        body,
      );
      if (!version) return;

      toast.success(sourceId ? VERSIONS.toast.duplicated : VERSIONS.toast.created);
      router.push(`/admin/simulators/${simulatorId}/versions/${version.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {VERSIONS.createAction}
      </Button>
      {open ? (
        <AdminEditorDialog
          title={VERSIONS.createTitle}
          description={VERSIONS.createDescription}
          size="sm"
          onClose={() => !busy && setOpen(false)}
        >
          <div className="flex flex-col gap-5">
            <Field>
              <Label htmlFor="clone-source">{VERSIONS.duplicateAction}</Label>
              <Select
                id="clone-source"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                aria-describedby="clone-hint"
              >
                <option value="">{COPY.adminCommon.form.unchosen}</option>
                {versions.map((version) => (
                  <option
                    key={version.id}
                    value={version.id}
                  >{`${VERSIONS.columns.versionNumber} ${formatNumber(version.versionNumber)} — ${COPY.adminSimulators.statusLabels[version.status]}`}</option>
                ))}
              </Select>
              <FieldHint id="clone-hint">{VERSIONS.duplicateHint}</FieldHint>
            </Field>
            <div className="border-line-200 flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="button" loading={busy} onClick={create}>
                {COPY.adminCommon.actions.create}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                {COPY.adminCommon.actions.cancel}
              </Button>
            </div>
          </div>
        </AdminEditorDialog>
      ) : null}
    </>
  );
}

// ── The version screen ───────────────────────────────────────────────────

/**
 * Everything on the version page that can change.
 *
 * One piece of state for the whole version, replaced wholesale by every
 * successful mutation — see the note at the top of the file for why a partial
 * update would be wrong rather than merely inconvenient.
 */
export function ExamVersionEditor({ version: initial }: { version: AdminExamVersionDetail }) {
  const [version, setVersion] = useState(initial);

  return (
    <div className="flex flex-col gap-6">
      {version.editable ? null : (
        <Notice tone="warning" role="note">
          {COPY.adminSimulators.notices.publishedIsFrozen}
        </Notice>
      )}

      <ExamVersionActions version={version} onChanged={setVersion} />
      <ExamVersionForm version={version} onChanged={setVersion} />
      <ExamSectionsEditor version={version} onChanged={setVersion} />
    </div>
  );
}

/**
 * Publish, retire, activate, deactivate, delete.
 *
 * Each control states, before it acts, what changes for a student and what does
 * not. Publication and activation stay two buttons with two confirmations: a
 * single "go live" would mean a version reviewed on Sunday reaches students the
 * instant it is frozen, which is the moment nobody has read it end to end yet.
 */
function ExamVersionActions({
  version,
  onChanged,
}: {
  version: AdminExamVersionDetail;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const transitions = COPY.adminSimulators.transitions;

  async function transition(
    action: 'publish' | 'retire' | 'activate' | 'deactivate',
    successMessage: string,
  ) {
    const data = await send<{ version: AdminExamVersionDetail; changed: boolean }>(
      `/api/admin/exam-versions/${version.id}/status`,
      'POST',
      { action },
    );
    if (!data) return;

    onChanged(data.version);
    // The server reports a no-op honestly rather than claiming a second
    // publication, so the toast says so too.
    toast.success(data.changed ? successMessage : COPY.adminCommon.toast.noChanges);
    router.refresh();
  }

  async function remove() {
    const data = await send<{ deleted: boolean }>(
      `/api/admin/exam-versions/${version.id}`,
      'DELETE',
    );
    if (!data) return;

    toast.success(VERSIONS.toast.deleted);
    router.push(`/admin/simulators/${version.simulatorId}`);
    router.refresh();
  }

  const options: PendingConfirm[] = [];

  if (version.status === 'DRAFT') {
    options.push({
      key: 'publish',
      title: transitions.publishConfirmTitle,
      body: transitions.publishConfirmBody,
      action: transitions.publishConfirmAction,
      run: () => transition('publish', VERSIONS.toast.published),
    });
  }

  if (version.status === 'PUBLISHED' && !version.isActive) {
    options.push({
      key: 'activate',
      title: transitions.activateConfirmTitle,
      body: transitions.activateConfirmBody,
      action: transitions.activateConfirmAction,
      run: () => transition('activate', VERSIONS.toast.activated),
    });
    options.push({
      key: 'retire',
      title: transitions.retireConfirmTitle,
      body: transitions.retireConfirmBody,
      action: transitions.retireConfirmAction,
      run: () => transition('retire', VERSIONS.toast.retired),
    });
  }

  if (version.isActive) {
    options.push({
      key: 'deactivate',
      title: transitions.deactivateConfirmTitle,
      body: transitions.deactivateConfirmBody,
      action: transitions.deactivateConfirmAction,
      run: () => transition('deactivate', VERSIONS.toast.deactivated),
    });
  }

  const labels: Record<string, string> = {
    publish: transitions.publish,
    retire: transitions.retire,
    activate: transitions.activate,
    deactivate: transitions.deactivate,
  };

  const deletable = version.status === 'DRAFT' && version.attemptCount === 0 && !version.isActive;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ExamVersionStatusBadge status={version.status} isActive={version.isActive} />
        <span className="text-ink-700 text-sm">
          {COPY.adminSimulators.selectionModeLabels[version.selectionMode]}
        </span>
        <span className="text-ink-700 text-sm">
          {`${VERSIONS.columns.attemptCount}: ${formatNumber(version.attemptCount)}`}
        </span>
        {version.publishedAt ? (
          <span className="text-ink-700 text-sm">
            {`${VERSIONS.columns.publishedAt}: ${formatDate(version.publishedAt)}`}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant={option.key === 'publish' || option.key === 'activate' ? 'primary' : 'outline'}
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
              title: VERSIONS.confirmDelete.title,
              body: VERSIONS.confirmDelete.body,
              action: VERSIONS.confirmDelete.confirm,
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
        <p className="text-ink-700 text-sm">
          {version.isActive
            ? COPY.adminSimulators.errors.versionDeleteBlockedByActive
            : version.attemptCount > 0
              ? COPY.adminSimulators.errors.versionDeleteBlockedByAttempts
              : COPY.adminSimulators.errors.versionDeleteBlockedByStatus}
        </p>
      )}

      <Notice tone="neutral" role="note">
        {COPY.adminSimulators.notices.attemptsUseSnapshots}
      </Notice>

      <ConfirmNotice pending={pending} onCancel={() => setPending(null)} />
    </Card>
  );
}

/** The version's own fields, including the provenance of the structure. */
function ExamVersionForm({
  version,
  onChanged,
}: {
  version: AdminExamVersionDetail;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const fields = VERSIONS.fields;
  const source = VERSIONS.source;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExamVersionFormValues, unknown, UpdateExamVersionInput>({
    resolver: zodResolver(updateExamVersionSchema),
    defaultValues: {
      selectionMode: version.selectionMode,
      totalQuestions: version.totalQuestions,
      totalDurationSec: version.totalDurationSec,
      resultDisclaimer: version.resultDisclaimer,
      changeSummary: version.changeSummary ?? '',
      sourceLabel: version.sourceLabel ?? '',
      sourceUrl: version.sourceUrl ?? '',
      // `<input type="date">` speaks `YYYY-MM-DD` and nothing else; the column
      // is a timestamptz, so the ISO string is cut at the day.
      sourceRetrievedAt: version.sourceRetrievedAt
        ? version.sourceRetrievedAt.toISOString().slice(0, 10)
        : '',
      sourceNote: version.sourceNote ?? '',
    },
  });

  const submit = handleSubmit(async (values) => {
    const next = await send<AdminExamVersionDetail>(
      `/api/admin/exam-versions/${version.id}`,
      'PATCH',
      values,
    );
    if (!next) return;

    onChanged(next);
    toast.success(VERSIONS.toast.updated);
  });

  const totalsDisagree =
    version.sections.length > 0 &&
    (version.totalQuestions !== version.sectionQuestionTotal ||
      version.totalDurationSec !== version.sectionDurationTotal);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
          {COPY.adminSimulators.sections.structure}
        </h2>

        <Field>
          <Label htmlFor="selectionMode">{fields.selectionMode.label}</Label>
          <Select
            id="selectionMode"
            disabled={!version.editable}
            aria-describedby="selection-hint"
            {...register('selectionMode')}
          >
            {(['BLUEPRINT', 'FIXED'] as const).map((mode) => (
              <option key={mode} value={mode}>
                {COPY.adminSimulators.selectionModeLabels[mode]}
              </option>
            ))}
          </Select>
          <FieldHint id="selection-hint">{fields.selectionMode.hint}</FieldHint>
          <FieldError message={errors.selectionMode?.message} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="totalQuestions">{fields.totalQuestions.label}</Label>
            <Input
              id="totalQuestions"
              type="number"
              inputMode="numeric"
              dir="ltr"
              disabled={!version.editable}
              aria-describedby="total-questions-hint"
              aria-invalid={Boolean(errors.totalQuestions)}
              {...register('totalQuestions', { valueAsNumber: true })}
            />
            <FieldHint id="total-questions-hint">{fields.totalQuestions.hint}</FieldHint>
            <FieldError message={errors.totalQuestions?.message} />
          </Field>

          <Field>
            <Label htmlFor="totalDurationSec">{fields.totalDurationSec.label}</Label>
            <Input
              id="totalDurationSec"
              type="number"
              inputMode="numeric"
              dir="ltr"
              disabled={!version.editable}
              aria-describedby="total-duration-hint"
              aria-invalid={Boolean(errors.totalDurationSec)}
              {...register('totalDurationSec', { valueAsNumber: true })}
            />
            <FieldHint id="total-duration-hint">{fields.totalDurationSec.hint}</FieldHint>
            <FieldError message={errors.totalDurationSec?.message} />
          </Field>
        </div>

        {/* Shown while the version is still editable rather than only when
            publication refuses: the disagreement is between two numbers on this
            screen, and the person looking at them can fix it in seconds. */}
        {totalsDisagree ? (
          <Notice tone="warning" role="note">
            {`${COPY.adminSimulators.errors.questionCountMismatch} ${COPY.adminSimulators.blueprint.coverage.requiredLabel}: ${formatNumber(version.sectionQuestionTotal)} · ${formatDurationWords(version.sectionDurationTotal)}`}
          </Notice>
        ) : null}

        <Field>
          <Label htmlFor="resultDisclaimer">{fields.resultDisclaimer.label}</Label>
          <Textarea
            id="resultDisclaimer"
            rows={4}
            disabled={!version.editable}
            aria-describedby="disclaimer-hint"
            aria-invalid={Boolean(errors.resultDisclaimer)}
            {...register('resultDisclaimer')}
          />
          <FieldHint id="disclaimer-hint">{fields.resultDisclaimer.hint}</FieldHint>
          <FieldError message={errors.resultDisclaimer?.message} />
        </Field>

        <Notice tone="neutral" role="note">
          {COPY.adminSimulators.notices.disclaimerIsLegal}
        </Notice>

        <Field>
          <Label htmlFor="changeSummary">
            {fields.changeSummary.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.adminCommon.form.optionalMark})</span>
          </Label>
          <Textarea
            id="changeSummary"
            rows={3}
            disabled={!version.editable}
            aria-describedby="change-summary-hint"
            {...register('changeSummary')}
          />
          <FieldHint id="change-summary-hint">{fields.changeSummary.hint}</FieldHint>
          <FieldError message={errors.changeSummary?.message} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {source.title}
          </h2>
          <p className="text-ink-700 max-w-prose text-sm">{source.description}</p>
        </div>

        <Notice tone="warning" role="note">
          {source.note}
        </Notice>

        <Field>
          <Label htmlFor="sourceLabel">{source.fields.sourceLabel.label}</Label>
          <Input id="sourceLabel" disabled={!version.editable} {...register('sourceLabel')} />
          <FieldHint id="source-label-hint">{source.fields.sourceLabel.hint}</FieldHint>
          <FieldError message={errors.sourceLabel?.message} />
        </Field>

        <Field>
          <Label htmlFor="sourceUrl">{source.fields.sourceUrl.label}</Label>
          {/* Latin, and part of an address: isolated so it cannot reorder
              against the Arabic label beside it. */}
          <Input
            id="sourceUrl"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            disabled={!version.editable}
            aria-invalid={Boolean(errors.sourceUrl)}
            {...register('sourceUrl')}
          />
          <FieldHint id="source-url-hint">{source.fields.sourceUrl.hint}</FieldHint>
          <FieldError message={errors.sourceUrl?.message} />
        </Field>

        <Field>
          <Label htmlFor="sourceRetrievedAt">{source.fields.sourceRetrievedAt.label}</Label>
          <Input
            id="sourceRetrievedAt"
            type="date"
            dir="ltr"
            disabled={!version.editable}
            aria-invalid={Boolean(errors.sourceRetrievedAt)}
            {...register('sourceRetrievedAt')}
          />
          <FieldHint id="source-date-hint">{source.fields.sourceRetrievedAt.hint}</FieldHint>
          <FieldError message={errors.sourceRetrievedAt?.message} />
        </Field>

        <Field>
          <Label htmlFor="sourceNote">{source.fields.sourceNote.label}</Label>
          <Textarea
            id="sourceNote"
            rows={3}
            disabled={!version.editable}
            {...register('sourceNote')}
          />
          <FieldHint id="source-note-hint">{source.fields.sourceNote.hint}</FieldHint>
          <FieldError message={errors.sourceNote?.message} />
        </Field>
      </Card>

      {version.editable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

const SECTIONS = COPY.adminSimulators.examSections;

/** The sections of a version, in order, each with its rules or its fixed list. */
function ExamSectionsEditor({
  version,
  onChanged,
}: {
  version: AdminExamVersionDetail;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function move(index: number, delta: number) {
    const ids = version.sections.map((section) => section.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;

    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    setReordering(true);
    try {
      const next = await send<AdminExamVersionDetail>(
        `/api/admin/exam-versions/${version.id}/sections`,
        'PATCH',
        { ids },
      );
      if (!next) return;
      onChanged(next);
      toast.success(SECTIONS.toast.reordered);
    } finally {
      setReordering(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {SECTIONS.title}
          </h2>
          <p className="text-ink-700 max-w-prose text-sm">{SECTIONS.description}</p>
        </div>
        {version.editable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() => setCreating(true)}
          >
            {SECTIONS.createAction}
          </Button>
        ) : null}
      </div>

      {creating && version.editable ? (
        <AdminEditorDialog
          title={SECTIONS.createTitle}
          size="md"
          onClose={() => setCreating(false)}
        >
          <ExamSectionForm
            onSubmit={async (values) => {
              const next = await send<AdminExamVersionDetail>(
                `/api/admin/exam-versions/${version.id}/sections`,
                'POST',
                values,
              );
              if (!next) return false;
              onChanged(next);
              toast.success(SECTIONS.toast.created);
              setCreating(false);
              return true;
            }}
            onCancel={() => setCreating(false)}
          />
        </AdminEditorDialog>
      ) : null}

      {version.sections.length === 0 ? (
        <EmptyState
          title={SECTIONS.empty.nothingYetTitle}
          description={SECTIONS.empty.nothingYetBody}
        />
      ) : (
        <ol className="flex list-none flex-col gap-5">
          {version.sections.map((section, index) => (
            <li key={section.id}>
              <ExamSectionPanel
                version={version}
                section={section}
                canMoveUp={index > 0}
                canMoveDown={index < version.sections.length - 1}
                reordering={reordering}
                onMove={(delta) => move(index, delta)}
                onChanged={onChanged}
              />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** One section: its settings, its ordering controls, and its selection rules. */
function ExamSectionPanel({
  version,
  section,
  canMoveUp,
  canMoveDown,
  reordering,
  onMove,
  onChanged,
}: {
  version: AdminExamVersionDetail;
  section: AdminExamSectionRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reordering: boolean;
  onMove: (delta: number) => void;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const reorder = COPY.adminSimulators.reorder;

  async function remove() {
    const next = await send<AdminExamVersionDetail>(
      `/api/admin/exam-sections/${section.id}`,
      'DELETE',
    );
    if (!next) return;
    onChanged(next);
    toast.success(SECTIONS.toast.deleted);
  }

  return (
    <div className="rounded-panel border-line-200 flex flex-col gap-4 border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-ink-600 text-xs">
          {`${SECTIONS.columns.position} ${formatNumber(section.position)}`}
        </span>
        <h3 className="text-ink-900 font-display min-w-0 text-base leading-[1.6] font-semibold">
          {section.title}
        </h3>
        <span className="text-ink-700 text-sm">{formatDurationWords(section.durationSec)}</span>
        <span className="text-ink-700 text-sm">
          {`${SECTIONS.columns.questionCount}: ${formatNumber(section.questionCount)}`}
        </span>

        {version.editable ? (
          <span className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canMoveUp || reordering}
              onClick={() => onMove(-1)}
            >
              {reorder.moveUp}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canMoveDown || reordering}
              onClick={() => onMove(1)}
            >
              {reorder.moveDown}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {COPY.adminCommon.actions.edit}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() =>
                setPending({
                  key: 'delete-section',
                  title: SECTIONS.confirmDelete.title,
                  body: SECTIONS.confirmDelete.body,
                  action: SECTIONS.confirmDelete.confirm,
                  danger: true,
                  run: remove,
                })
              }
            >
              {COPY.adminCommon.actions.delete}
            </Button>
          </span>
        ) : null}
      </div>

      <ConfirmNotice pending={pending} onCancel={() => setPending(null)} />

      {editing && version.editable ? (
        <AdminEditorDialog title={SECTIONS.editTitle} size="md" onClose={() => setEditing(false)}>
          <ExamSectionForm
            section={section}
            onSubmit={async (values) => {
              const next = await send<AdminExamVersionDetail>(
                `/api/admin/exam-sections/${section.id}`,
                'PATCH',
                { op: 'settings', ...values },
              );
              if (!next) return false;
              onChanged(next);
              toast.success(SECTIONS.toast.updated);
              setEditing(false);
              return true;
            }}
            onCancel={() => setEditing(false)}
          />
        </AdminEditorDialog>
      ) : null}

      {version.selectionMode === 'FIXED' ? (
        <FixedQuestionList version={version} section={section} onChanged={onChanged} />
      ) : (
        <BankDrawNote questionCount={section.questionCount} />
      )}

      {/* Restore with the classification section in `question-form.tsx`.

          The rule editor is what made a section "21% استيعاب المقروء، صعب". The
          bank no longer records which skill a question belongs to, so the rules
          matched nothing an author wrote and the section drew nothing from them;
          `attempt-selection.service.ts` stopped reading them. The rows and their
          API are untouched, so this is one line and one import to bring back.

      {version.selectionMode === 'FIXED' ? null : (
        <BlueprintRuleEditor
          sectionId={section.id}
          sectionQuestionCount={section.questionCount}
          rules={section.rules}
          editable={version.editable}
          onChanged={onChanged}
        />
      )}

      */}
    </div>
  );
}

/** The section settings form, used for both create and edit. */
function ExamSectionForm({
  section,
  onSubmit,
  onCancel,
}: {
  section?: AdminExamSectionRow;
  onSubmit: (values: CreateExamSectionInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const fields = SECTIONS.fields;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExamSectionFormValues, unknown, CreateExamSectionInput>({
    resolver: zodResolver(createExamSectionSchema),
    defaultValues: {
      title: section?.title ?? '',
      durationSec: section?.durationSec ?? 1_800,
      questionCount: section?.questionCount ?? 20,
      calculatorEnabled: section?.calculatorEnabled ?? false,
      scratchpadEnabled: section?.scratchpadEnabled ?? true,
      allowReviewWithinSection: section?.allowReviewWithinSection ?? true,
      lockOnAdvance: section?.lockOnAdvance ?? true,
      pauseEnabled: section?.pauseEnabled ?? false,
    },
  });

  const prefix = section ? `section-${section.id}` : 'section-new';

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <Field>
        <Label htmlFor={`${prefix}-title`}>{fields.title.label}</Label>
        <Input id={`${prefix}-title`} aria-invalid={Boolean(errors.title)} {...register('title')} />
        <FieldHint id={`${prefix}-title-hint`}>{fields.title.hint}</FieldHint>
        <FieldError message={errors.title?.message} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${prefix}-duration`}>{fields.durationSec.label}</Label>
          <Input
            id={`${prefix}-duration`}
            type="number"
            inputMode="numeric"
            dir="ltr"
            aria-invalid={Boolean(errors.durationSec)}
            {...register('durationSec', { valueAsNumber: true })}
          />
          <FieldHint id={`${prefix}-duration-hint`}>{fields.durationSec.hint}</FieldHint>
          <FieldError message={errors.durationSec?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-count`}>{fields.questionCount.label}</Label>
          <Input
            id={`${prefix}-count`}
            type="number"
            inputMode="numeric"
            dir="ltr"
            aria-invalid={Boolean(errors.questionCount)}
            {...register('questionCount', { valueAsNumber: true })}
          />
          <FieldHint id={`${prefix}-count-hint`}>{fields.questionCount.hint}</FieldHint>
          <FieldError message={errors.questionCount?.message} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        {(
          [
            ['calculatorEnabled', fields.calculatorEnabled],
            ['scratchpadEnabled', fields.scratchpadEnabled],
            ['allowReviewWithinSection', fields.allowReviewWithinSection],
            ['lockOnAdvance', fields.lockOnAdvance],
            ['pauseEnabled', fields.pauseEnabled],
          ] as const
        ).map(([name, copy]) => (
          <Field key={name}>
            <div className="flex items-start gap-3">
              <Checkbox id={`${prefix}-${name}`} className="mt-1" {...register(name)} />
              <Label htmlFor={`${prefix}-${name}`} className="leading-relaxed font-normal">
                {copy.label}
              </Label>
            </div>
            <FieldHint id={`${prefix}-${name}-hint`}>{copy.hint}</FieldHint>
          </Field>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={isSubmitting}>
          {COPY.adminCommon.actions.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {COPY.adminCommon.actions.cancel}
        </Button>
      </div>
    </form>
  );
}

// ── Drawing from the bank ────────────────────────────────────────────────

/**
 * What a blueprint section does, in one sentence.
 *
 * This is where the rule table used to be. A section that draws from the bank
 * has nothing to configure — the count is already on the section form above — so
 * the panel's whole job is to say what will happen when a student presses ابدأ,
 * and to say it where the thing that decides it can be edited.
 *
 * A `Notice`, not an `EmptyState`: nothing is missing here.
 */
function BankDrawNote({ questionCount }: { questionCount: number }) {
  const draw = COPY.adminSimulators.blueprint.bankDraw;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-ink-900 font-medium">{draw.title}</h4>
      <Notice tone="neutral" role="note">
        {draw.description.replace(
          '{count}',
          `${formatNumber(questionCount)} ${draw.questionCountUnit}`,
        )}
      </Notice>
    </div>
  );
}

// ── Fixed question lists ─────────────────────────────────────────────────

const FIXED = SECTIONS.fixedQuestions;

/**
 * The explicit question list of a `FIXED` section.
 *
 * Questions are added by id rather than through a browse panel: the bank has its
 * own screen with its own search, and duplicating it inside this one would mean
 * two places to keep in step with the workflow rules. The server refuses an
 * unpublished item, a duplicate and a track that does not fit, so the mistakes
 * this box makes easy are all named on the way back.
 */
function FixedQuestionList({
  version,
  section,
  onChanged,
}: {
  version: AdminExamVersionDetail;
  section: AdminExamSectionRow;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const [questionId, setQuestionId] = useState('');
  const [busy, setBusy] = useState(false);

  async function change(action: 'add' | 'remove', id: string) {
    setBusy(true);
    try {
      const next = await send<AdminExamVersionDetail>(
        `/api/admin/exam-sections/${section.id}`,
        'PATCH',
        { op: 'questions', action, questionId: id },
      );
      if (!next) return;
      onChanged(next);
      toast.success(
        action === 'add' ? SECTIONS.toast.questionAdded : SECTIONS.toast.questionRemoved,
      );
      if (action === 'add') setQuestionId('');
    } finally {
      setBusy(false);
    }
  }

  const columns: readonly DataTableColumn<AdminExamFixedQuestionRow>[] = [
    {
      key: 'position',
      header: FIXED.columns.position,
      cell: (row) => formatNumber(row.position),
    },
    {
      key: 'stem',
      header: FIXED.columns.stem,
      isRowHeader: true,
      cell: (row) => (
        <Link
          href={`/admin/questions/${row.questionId}`}
          className="text-brand-700 hover:underline"
        >
          {row.stemExcerpt}
        </Link>
      ),
    },
    /* Restore with the classification section in `question-form.tsx`.

       Hidden here for a sharper reason than tidiness: a question authored while
       the classification editor is hidden carries placeholder values, and these
       two columns would print them as though a person had chosen them.
    {
      key: 'domain',
      header: FIXED.columns.domain,
      cell: (row) => COPY.adminQuestions.domainLabels[row.domain],
    },
    {
      key: 'difficulty',
      header: FIXED.columns.difficulty,
      cell: (row) => COPY.adminQuestions.difficultyLabels[row.difficulty],
    },
    */
    {
      key: 'questionVersion',
      header: FIXED.columns.questionVersion,
      align: 'end',
      cell: (row) => formatNumber(row.questionVersion),
    },
    {
      key: 'actions',
      header: FIXED.columns.actions,
      headerHidden: true,
      align: 'end',
      cell: (row) =>
        version.editable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => change('remove', row.questionId)}
          >
            {FIXED.removeAction}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="text-ink-900 font-medium">{FIXED.title}</h4>
        <p className="text-ink-700 max-w-prose text-sm">{FIXED.description}</p>
      </div>

      <DataTable
        caption={`${FIXED.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={columns}
        rows={section.fixedQuestions}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={FIXED.empty.nothingYetTitle}
            description={FIXED.empty.nothingYetBody}
          />
        }
      />

      {version.editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-64 flex-1">
            <Label htmlFor={`${section.id}-add-question`}>{FIXED.addAction}</Label>
            <Input
              id={`${section.id}-add-question`}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={questionId}
              onChange={(event) => setQuestionId(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={questionId.trim().length === 0}
            onClick={() => change('add', questionId.trim())}
          >
            {COPY.adminCommon.actions.create}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
