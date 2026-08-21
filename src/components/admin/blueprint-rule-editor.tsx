'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { Card, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import type {
  AdminExamRuleRow,
  AdminExamVersionDetail,
  CoverageReport,
} from '@/services/exams/exam-version-admin.service';
import {
  createBlueprintRuleSchema,
  type BlueprintRuleFormValues,
  type CreateBlueprintRuleInput,
} from '@/validators/admin-simulator';

/**
 * Blueprint rules, and the coverage check that decides whether they can be met.
 *
 * A rule states a share of a section — "٢١٪ استيعاب المقروء، صعب" — and
 * `attempt-selection.service.ts` turns those shares into whole numbers and draws
 * that many questions from the bank when a student starts. Two things can be
 * wrong with a set of rules and they fail in different places:
 *
 *  - **The arithmetic does not close.** Percentages over a hundred, explicit
 *    counts adding to more than the section holds. Refused as the rule is saved,
 *    because it is a property of the rules alone.
 *  - **The bank cannot fill them.** Twelve hard geometry questions when four are
 *    published. Nothing about the rules is wrong; the bank is short. That is what
 *    the coverage panel is for, and it is the failure worth catching here — the
 *    alternative is a student meeting it at the moment they press "ابدأ".
 */

const BLUEPRINT = COPY.adminSimulators.blueprint;

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

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

/**
 * The rules of one section.
 *
 * Every mutation answers with the whole version, because changing one rule's
 * percentage changes what every other rule in the section is allocated — a
 * response carrying only the edited row would leave stale numbers on screen
 * beside a fresh one.
 */
export function BlueprintRuleEditor({
  sectionId,
  sectionQuestionCount,
  rules,
  editable,
  onChanged,
}: {
  sectionId: string;
  sectionQuestionCount: number;
  rules: readonly AdminExamRuleRow[];
  editable: boolean;
  onChanged: (next: AdminExamVersionDetail) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(index: number, delta: number) {
    const ids = rules.map((rule) => rule.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    setBusy(true);
    try {
      const next = await send<AdminExamVersionDetail>(
        `/api/admin/exam-sections/${sectionId}/rules`,
        'PATCH',
        { op: 'reorder', ids },
      );
      if (!next) return;
      onChanged(next);
      toast.success(BLUEPRINT.toast.reordered);
    } finally {
      setBusy(false);
    }
  }

  async function remove(ruleId: string) {
    setBusy(true);
    try {
      const next = await send<AdminExamVersionDetail>(
        `/api/admin/exam-sections/${sectionId}/rules?ruleId=${encodeURIComponent(ruleId)}`,
        'DELETE',
      );
      if (!next) return;
      onChanged(next);
      toast.success(BLUEPRINT.toast.deleted);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The share as words.
   *
   * A rule carries a percentage or an explicit count, never both — the server
   * refuses the pair — so the cell shows whichever one is in force rather than
   * an empty column beside a filled one.
   */
  function shareLabel(rule: AdminExamRuleRow): string {
    if (rule.questionCount !== null) return formatNumber(rule.questionCount);
    if (rule.percentage !== null) return formatPercent(rule.percentage / 100);
    return COPY.common.notAvailable;
  }

  const columns: readonly DataTableColumn<AdminExamRuleRow>[] = [
    {
      key: 'position',
      header: BLUEPRINT.columns.position,
      cell: (row) => formatNumber(row.position),
    },
    {
      key: 'domain',
      header: BLUEPRINT.columns.domain,
      isRowHeader: true,
      cell: (row) => COPY.adminQuestions.domainLabels[row.domain],
    },
    {
      key: 'subskill',
      header: BLUEPRINT.columns.subskill,
      cell: (row) => row.subskill ?? COPY.common.notAvailable,
    },
    {
      key: 'difficulty',
      header: BLUEPRINT.columns.difficulty,
      cell: (row) =>
        row.difficulty
          ? COPY.adminQuestions.difficultyLabels[row.difficulty]
          : COPY.adminCommon.filter.all,
    },
    {
      key: 'track',
      header: BLUEPRINT.columns.track,
      cell: (row) =>
        row.track ? COPY.adminSimulators.trackLabels[row.track] : COPY.adminCommon.filter.all,
    },
    { key: 'share', header: BLUEPRINT.columns.share, align: 'end', cell: shareLabel },
    {
      key: 'actions',
      header: BLUEPRINT.columns.actions,
      headerHidden: true,
      align: 'end',
      cell: (row) => {
        if (!editable) return null;
        const index = rules.findIndex((rule) => rule.id === row.id);
        return (
          <span className="flex flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || index <= 0}
              onClick={() => move(index, -1)}
            >
              {COPY.adminSimulators.reorder.moveUp}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || index < 0 || index >= rules.length - 1}
              onClick={() => move(index, 1)}
            >
              {COPY.adminSimulators.reorder.moveDown}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingId((current) => (current === row.id ? null : row.id))}
            >
              {COPY.adminCommon.actions.edit}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => remove(row.id)}
            >
              {COPY.adminCommon.actions.delete}
            </Button>
          </span>
        );
      },
    },
  ];

  const editing = rules.find((rule) => rule.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="text-ink-900 font-medium">{BLUEPRINT.title}</h4>
          <p className="text-ink-700 max-w-prose text-sm">{BLUEPRINT.description}</p>
        </div>
        {editable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() => {
              setEditingId(null);
              setCreating((open) => !open);
            }}
          >
            {BLUEPRINT.createAction}
          </Button>
        ) : null}
      </div>

      <DataTable
        caption={`${BLUEPRINT.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={columns}
        rows={rules}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            title={BLUEPRINT.empty.nothingYetTitle}
            description={BLUEPRINT.empty.nothingYetBody}
          />
        }
      />

      {creating && editable ? (
        <BlueprintRuleForm
          title={BLUEPRINT.createTitle}
          sectionQuestionCount={sectionQuestionCount}
          onSubmit={async (values) => {
            const next = await send<AdminExamVersionDetail>(
              `/api/admin/exam-sections/${sectionId}/rules`,
              'POST',
              values,
            );
            if (!next) return;
            onChanged(next);
            toast.success(BLUEPRINT.toast.created);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {editing && editable ? (
        <BlueprintRuleForm
          title={BLUEPRINT.editTitle}
          rule={editing}
          sectionQuestionCount={sectionQuestionCount}
          onSubmit={async (values) => {
            const next = await send<AdminExamVersionDetail>(
              `/api/admin/exam-sections/${sectionId}/rules`,
              'PATCH',
              { op: 'update', ruleId: editing.id, ...values },
            );
            if (!next) return;
            onChanged(next);
            toast.success(BLUEPRINT.toast.updated);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * One rule's fields.
 *
 * Percentage and count are two boxes rather than a mode switch, and the hint on
 * each says the other exists. The server refuses a rule that sets neither or
 * both by name, because a rule carrying both is genuinely ambiguous: the
 * allocator prefers the count, and an administrator who typed 40٪ and 12 would
 * get twelve with nothing telling them their percentage was ignored.
 */
function BlueprintRuleForm({
  title,
  rule,
  sectionQuestionCount,
  onSubmit,
  onCancel,
}: {
  title: string;
  rule?: AdminExamRuleRow;
  sectionQuestionCount: number;
  onSubmit: (values: CreateBlueprintRuleInput) => Promise<void>;
  onCancel: () => void;
}) {
  const fields = BLUEPRINT.fields;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlueprintRuleFormValues, unknown, CreateBlueprintRuleInput>({
    resolver: zodResolver(createBlueprintRuleSchema),
    defaultValues: {
      domain: rule?.domain ?? 'VERBAL_ANALOGY',
      subskill: rule?.subskill ?? '',
      difficulty: rule?.difficulty ?? null,
      track: rule?.track ?? null,
      percentage: rule?.percentage ?? null,
      questionCount: rule?.questionCount ?? null,
    },
  });

  const prefix = rule ? `rule-${rule.id}` : 'rule-new';

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="bg-surface-muted rounded-panel flex flex-col gap-4 p-4"
      noValidate
    >
      <h5 className="text-ink-900 font-medium">{title}</h5>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${prefix}-domain`}>{fields.domain.label}</Label>
          <Select
            id={`${prefix}-domain`}
            aria-invalid={Boolean(errors.domain)}
            {...register('domain')}
          >
            {(
              [
                'VERBAL_ANALOGY',
                'SENTENCE_COMPLETION',
                'CONTEXTUAL_ERROR',
                'READING_COMPREHENSION',
                'ARITHMETIC',
                'GEOMETRY',
                'ALGEBRA',
                'DATA_ANALYSIS',
              ] as const
            ).map((domain) => (
              <option key={domain} value={domain}>
                {COPY.adminQuestions.domainLabels[domain]}
              </option>
            ))}
          </Select>
          <FieldHint id={`${prefix}-domain-hint`}>{fields.domain.hint}</FieldHint>
          <FieldError message={errors.domain?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-subskill`}>
            {fields.subskill.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.adminCommon.form.optionalMark})</span>
          </Label>
          <Input id={`${prefix}-subskill`} {...register('subskill')} />
          <FieldHint id={`${prefix}-subskill-hint`}>{fields.subskill.hint}</FieldHint>
          <FieldError message={errors.subskill?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-difficulty`}>{fields.difficulty.label}</Label>
          <Select id={`${prefix}-difficulty`} {...register('difficulty')}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {COPY.adminQuestions.difficultyLabels[difficulty]}
              </option>
            ))}
          </Select>
          <FieldHint id={`${prefix}-difficulty-hint`}>{fields.difficulty.hint}</FieldHint>
          <FieldError message={errors.difficulty?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-track`}>{fields.track.label}</Label>
          <Select id={`${prefix}-track`} {...register('track')}>
            <option value="">{COPY.adminCommon.filter.all}</option>
            {(['SCIENTIFIC', 'THEORETICAL', 'BOTH', 'CUSTOM'] as const).map((track) => (
              <option key={track} value={track}>
                {COPY.adminSimulators.trackLabels[track]}
              </option>
            ))}
          </Select>
          <FieldHint id={`${prefix}-track-hint`}>{fields.track.hint}</FieldHint>
          <FieldError message={errors.track?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-percentage`}>{fields.percentage.label}</Label>
          <Input
            id={`${prefix}-percentage`}
            type="number"
            inputMode="numeric"
            dir="ltr"
            aria-invalid={Boolean(errors.percentage)}
            {...register('percentage', { setValueAs: toNullableNumber })}
          />
          <FieldHint id={`${prefix}-percentage-hint`}>{fields.percentage.hint}</FieldHint>
          <FieldError message={errors.percentage?.message} />
        </Field>

        <Field>
          <Label htmlFor={`${prefix}-count`}>{fields.questionCount.label}</Label>
          <Input
            id={`${prefix}-count`}
            type="number"
            inputMode="numeric"
            dir="ltr"
            aria-invalid={Boolean(errors.questionCount)}
            {...register('questionCount', { setValueAs: toNullableNumber })}
          />
          <FieldHint id={`${prefix}-count-hint`}>
            {`${fields.questionCount.hint} ${BLUEPRINT.columns.available}: ${formatNumber(sectionQuestionCount)}`}
          </FieldHint>
          <FieldError message={errors.questionCount?.message} />
        </Field>
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

/**
 * An empty number box means "not set", which is `null`.
 *
 * `valueAsNumber` turns an empty input into `NaN`, and `NaN` would fail the
 * schema with "النسبة يجب أن تكون رقمًا" beside a box the administrator
 * deliberately left blank — the whole point of the pair is that exactly one of
 * them is filled in.
 */
function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// ── Coverage ─────────────────────────────────────────────────────────────

/**
 * `checkedAt` crosses the boundary twice and arrives differently each time: as a
 * `Date` in the server component's props, and as an ISO string from the check
 * endpoint. `formatDateTime` accepts both, so the type says so rather than the
 * component pretending one of the two does not happen.
 */
type ClientCoverageReport = Omit<CoverageReport, 'checkedAt'> & { checkedAt: Date | string };

/**
 * What the blueprint asks for against what the bank holds.
 *
 * Rendered from the server's own computation on first paint, and re-runnable
 * without leaving the page. The answer describes this moment and the copy says
 * so: publishing a question later closes a shortfall, retiring one opens a new
 * one, and neither event touches this version.
 */
export function CoveragePanel({
  versionId,
  report: initial,
}: {
  versionId: string;
  report: ClientCoverageReport | null;
}) {
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);
  const coverage = BLUEPRINT.coverage;

  async function run() {
    setBusy(true);
    try {
      const next = await send<ClientCoverageReport>(
        `/api/admin/exam-versions/${versionId}/status`,
        'GET',
      );
      if (next) setReport(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {coverage.title}
          </h2>
          <p className="text-ink-700 max-w-prose text-sm">{coverage.description}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="ms-auto"
          loading={busy}
          onClick={run}
        >
          {busy ? coverage.running : coverage.runAction}
        </Button>
      </div>

      {/* A read that failed is not a coverage result. The panel says nothing
          rather than drawing an "all clear" nobody computed. */}
      {report === null ? (
        <Notice tone="warning" role="note">
          {COPY.common.loadFailedBody}
        </Notice>
      ) : !report.applicable ? (
        <Notice tone="neutral" role="note">
          <span className="text-ink-900 block font-medium">{coverage.notApplicableTitle}</span>
          <span className="block text-sm">{coverage.notApplicableBody}</span>
        </Notice>
      ) : (
        <>
          <Notice tone={report.ok ? 'neutral' : 'warning'} role="note">
            <span className="text-ink-900 block font-medium">
              {report.ok ? coverage.okTitle : coverage.shortageTitle}
            </span>
            <span className="block text-sm">
              {report.ok ? coverage.okBody : coverage.shortageBody}
            </span>
          </Notice>

          {/* The version's arithmetic, which is now the whole check: every
              section draws from one bank, so what decides the answer is the
              total against what is published. */}
          <dl className="text-ink-700 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt>{coverage.requiredLabel}</dt>
              <dd className="text-ink-900 font-medium tabular-nums">
                {formatNumber(report.totalRequired)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>{coverage.bankSizeLabel}</dt>
              <dd className="text-ink-900 font-medium tabular-nums">
                {formatNumber(report.bankSize)}
              </dd>
            </div>
            {report.shortfall > 0 ? (
              <div className="flex gap-2">
                <dt>{coverage.shortfallLabel}</dt>
                <dd className="text-error font-medium tabular-nums">
                  {formatNumber(report.shortfall)}
                </dd>
              </div>
            ) : null}
          </dl>

          <ul className="text-ink-700 flex list-none flex-col gap-1 text-sm">
            {report.sections.map((section) => (
              <li key={section.sectionId} className="flex flex-wrap gap-x-4">
                <span className="text-ink-900 font-medium">{section.title}</span>
                <span>{`${coverage.sectionDrawLabel}: ${formatNumber(section.questionCount)}`}</span>
              </li>
            ))}
          </ul>

          {/* Restore with the blueprint rule editor above: the per-rule
              required/available/shortfall lines, and the allocation refusal that
              belongs to a section whose percentages do not resolve.

          {report.sections.map((section) => (
            <div key={section.sectionId} className="flex flex-col gap-2">
              <h3 className="text-ink-900 text-sm font-semibold">{section.title}</h3>

              {section.allocationError ? (
                <Notice tone="warning" role="note">
                  <span className="text-ink-900 block font-medium">{coverage.allocationTitle}</span>
                  <span className="block text-sm">{section.allocationError}</span>
                </Notice>
              ) : null}

              <ul className="text-ink-700 flex list-none flex-col gap-1 text-sm">
                {section.rules.map((rule) => (
                  <li key={rule.ruleId} className="flex flex-wrap gap-x-4">
                    <span className="text-ink-900 font-medium">
                      {[
                        COPY.adminQuestions.domainLabels[rule.domain],
                        rule.subskill,
                        rule.difficulty
                          ? COPY.adminQuestions.difficultyLabels[rule.difficulty]
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </span>
                    <span>{`${coverage.requiredLabel}: ${formatNumber(rule.required)}`}</span>
                    <span>{`${coverage.availableLabel}: ${formatNumber(rule.available)}`}</span>
                    {rule.shortfall > 0 ? (
                      <span className="text-error font-medium">
                        {`${coverage.shortfallLabel}: ${formatNumber(rule.shortfall)}`}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          */}

          <p className="text-ink-600 text-xs">
            {`${COPY.adminCommon.table.updatedAt}: ${formatDateTime(report.checkedAt)}`}
          </p>
        </>
      )}
    </Card>
  );
}
