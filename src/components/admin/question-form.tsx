'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import {
  createQuestionSchema,
  HIDDEN_CLASSIFICATION_DEFAULTS,
  type CreateQuestionFormValues,
  type CreateQuestionInput,
} from '@/validators/admin-question';

/**
 * The question editor.
 *
 * A client component because the options are an ordered, growable set with a
 * single-choice answer key across them — the one part of this product that
 * genuinely cannot be a form post. Everything it submits goes to a route handler
 * that re-validates with the same schema; nothing here is trusted, and nothing
 * here is authorization.
 *
 * Three decisions worth stating, because none is guessable from the markup:
 *
 *  1. **The answer key is a radio group over the option rows.** Independent
 *     checkboxes would let an editor build a state — two correct answers, or
 *     none — that the schema and a partial unique index in PostgreSQL both
 *     refuse. A control that cannot express an invalid state is better than a
 *     message explaining one.
 *  2. **`rightsDeclaration` opens empty.** Every other field has a defensible
 *     default; this one does not. A pre-selected rights declaration would have
 *     the platform assert originality on an author's behalf — which is precisely
 *     the assertion `docs/content-and-legal-checklist.md` requires a person to
 *     make.
 *  3. **Nothing here can publish.** The schema has no `workflow` field, so the
 *     form cannot carry one. Review and publication live in
 *     `QuestionWorkflowPanel` below, against a different endpoint, with their own
 *     audit rows.
 *
 * ── The classification section is hidden ────────────────────────────────────
 *
 * Skill, sub-skill, track, difficulty, estimated time and tags were taken off
 * this form at the client's request: a teacher writing a question should be
 * asked for a question, not for a taxonomy. The section is commented out rather
 * than deleted — it is a product decision that may be reversed, and the markup
 * it needs back is the markup that was working.
 *
 * What still happens to those columns:
 *
 *  - An **existing** question keeps its own values. They stay in the form's
 *    `defaultValues`, and react-hook-form submits its value tree, not only the
 *    fields that rendered — so editing a seeded, classified question does not
 *    quietly flatten it.
 *  - A **new** question is written with `HIDDEN_CLASSIFICATION_DEFAULTS`
 *    (`src/validators/admin-question.ts`), because the columns are `NOT NULL`.
 *    Those are placeholders, and the screens that would have displayed them —
 *    the bank's list columns and filters, the student's result breakdown, the
 *    administration attempt record — are commented out in step with this one.
 *
 * To restore: uncomment the `classification` section below and its `DOMAINS` /
 * `DIFFICULTIES` / `TRACKS` lists, then the matching blocks in
 * `question-list.tsx`, `exam-results.tsx`, `attempt-detail.tsx` and
 * `exam-version-editor.tsx`. No migration is involved, in either direction.
 */

type Domain = CreateQuestionInput['domain'];
type Difficulty = CreateQuestionInput['difficulty'];
type Track = CreateQuestionInput['track'];
type Rights = CreateQuestionInput['rightsDeclaration'];
type Workflow = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'RETIRED';

export type StimulusOption = {
  id: string;
  type: 'PASSAGE' | 'IMAGE' | 'TABLE' | 'CHART' | 'MATH';
  title: string | null;
};

export type QuestionFormInitial = {
  stem: string;
  options: Array<{ content: string; isCorrect: boolean }>;
  domain: Domain;
  difficulty: Difficulty;
  track: Track;
  subskill: string | null;
  explanation: string | null;
  hint: string | null;
  tags: string[];
  estimatedSeconds: number | null;
  shuffleOptions: boolean;
  stimulusId: string | null;
  authorOrLicensor: string;
  provenanceNote: string | null;
  rightsDeclaration: Rights | null;
};

type ApiEnvelope = {
  ok: boolean;
  data?: { id?: string };
  error?: { code?: string; message?: string };
};

async function send(url: string, method: string, body?: unknown): Promise<ApiEnvelope> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await response.json()) as ApiEnvelope;
}

/* Restore with the classification section.
/** Tags are typed as one line. Both commas are accepted; Arabic keyboards send `،`. *
function splitTags(value: string): string[] {
  const seen = new Set<string>();
  for (const raw of value.split(/[,،]/)) {
    const tag = raw.trim();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen];
}
*/

/**
 * The label on a select's "nothing chosen" row.
 *
 * Deliberately *not* the filter panel's `الكل` — that means "all", which is right
 * above a list and wrong inside a form, where the empty row means "none yet".
 * A word rather than an em dash, because punctuation announces as silence and
 * would leave the first option of three required selects unlabelled.
 */
const UNCHOSEN = COPY.adminCommon.form.unchosen;

/* Restore with the classification section.
const DOMAINS = Object.keys(COPY.adminQuestions.domainLabels) as Domain[];
const DIFFICULTIES = Object.keys(COPY.adminQuestions.difficultyLabels) as Difficulty[];
const TRACKS = Object.keys(COPY.adminQuestions.trackLabels) as Track[];
*/
const RIGHTS = Object.keys(COPY.adminQuestions.rightsLabels) as Rights[];

/**
 * A section of the editor.
 *
 * Plain headings inside a card rather than the site's ruled `Subhead`: that
 * figure opens a public page, and borrowing it for the inside of a tool would
 * either drag it out of place or force it to grow a variant to suit one.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-ink-900 text-lg font-semibold">{title}</h2>
        {description ? <p className="text-ink-700 max-w-prose text-sm">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function RequiredMark() {
  return <span className="text-ink-600 font-normal"> ({COPY.adminCommon.form.requiredMark})</span>;
}

function OptionalMark() {
  return <span className="text-ink-600 font-normal"> ({COPY.adminCommon.form.optionalMark})</span>;
}

const EMPTY_INITIAL: QuestionFormInitial = {
  stem: '',
  options: [
    { content: '', isCorrect: true },
    { content: '', isCorrect: false },
  ],
  // No longer "not yet chosen": nothing on this form asks, so a new question is
  // written with the placeholders the `NOT NULL` columns need. Restoring the
  // classification section means restoring `'' as unknown as Domain` here, so
  // that an unanswered required select is rejected rather than silently filed.
  domain: HIDDEN_CLASSIFICATION_DEFAULTS.domain,
  difficulty: HIDDEN_CLASSIFICATION_DEFAULTS.difficulty,
  track: HIDDEN_CLASSIFICATION_DEFAULTS.track,
  subskill: null,
  explanation: null,
  hint: null,
  tags: [],
  estimatedSeconds: null,
  shuffleOptions: true,
  stimulusId: null,
  authorOrLicensor: '',
  provenanceNote: null,
  rightsDeclaration: null,
};

export function QuestionForm({
  mode,
  questionId,
  initial,
  stimuli,
  workflow,
}: {
  mode: 'create' | 'edit';
  questionId?: string;
  initial?: QuestionFormInitial;
  stimuli: readonly StimulusOption[];
  workflow?: Workflow;
}) {
  const router = useRouter();
  const source = initial ?? EMPTY_INITIAL;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CreateQuestionFormValues, unknown, CreateQuestionInput>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: {
      stem: source.stem,
      options: source.options,
      domain: source.domain,
      difficulty: source.difficulty,
      track: source.track,
      subskill: source.subskill ?? '',
      explanation: source.explanation ?? '',
      hint: source.hint ?? '',
      tags: source.tags,
      estimatedSeconds: source.estimatedSeconds,
      shuffleOptions: source.shuffleOptions,
      stimulusId: source.stimulusId,
      authorOrLicensor: source.authorOrLicensor,
      provenanceNote: source.provenanceNote ?? '',
      rightsDeclaration: (source.rightsDeclaration ?? '') as unknown as Rights,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'options' });
  // `useWatch` rather than `watch()`: the latter hands back a function the React
  // Compiler refuses to memoise, which opts this whole component out of
  // compilation for one subscription.
  const optionValues = useWatch({ control, name: 'options' });

  /**
   * Move the answer key.
   *
   * Every row is written, not just the two that changed: leaving the previous
   * correct row alone would produce two correct options, which is the exact state
   * `question_options_one_correct_key` exists to refuse.
   */
  function markCorrect(index: number) {
    const current = getValues('options') ?? [];
    current.forEach((_, position) => {
      setValue(`options.${position}.isCorrect`, position === index, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }

  function removeOption(index: number) {
    const wasCorrect = getValues(`options.${index}.isCorrect`) === true;
    remove(index);
    // Removing the answer would otherwise leave the question with none, and the
    // editor with a validation message about a row they just deleted.
    if (wasCorrect) {
      setValue('options.0.isCorrect', true, { shouldDirty: true, shouldValidate: true });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const result =
      mode === 'create'
        ? await send('/api/admin/questions', 'POST', values)
        : await send(`/api/admin/questions/${questionId}`, 'PATCH', values);

    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
      return;
    }

    toast.success(
      mode === 'create' ? COPY.adminQuestions.toast.created : COPY.adminQuestions.toast.updated,
    );

    const nextId = result.data?.id ?? questionId;
    router.push(nextId ? `/admin/questions/${nextId}` : '/admin/questions');
    router.refresh();
  });

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {workflow === 'PUBLISHED' ? (
        <Notice tone="warning" role="note">
          {COPY.adminQuestions.notices.publishedEditsNeedRepublish}
        </Notice>
      ) : null}

      {/*
        The summary appears only after a rejected submission. Rendering it while
        somebody is still typing turns every half-filled field into an accusation.
      */}
      {submitCount > 0 && errorCount > 0 ? (
        <Notice tone="warning" role="status">
          <p className="font-medium">{COPY.adminCommon.form.errorsTitle}</p>
          <p>{COPY.adminCommon.form.errorsBody}</p>
          <p className="text-ink-700 mt-1 text-sm">
            {COPY.adminCommon.form.errorsCount.replace('{count}', String(errorCount))}
          </p>
        </Notice>
      ) : null}

      <Section title={COPY.adminQuestions.sections.content}>
        <Field>
          <Label htmlFor="stem">
            {COPY.adminQuestions.fields.stem.label}
            <RequiredMark />
          </Label>
          <Textarea
            id="stem"
            rows={5}
            aria-describedby="stem-hint"
            aria-invalid={Boolean(errors.stem)}
            {...register('stem')}
          />
          <FieldHint id="stem-hint">{COPY.adminQuestions.fields.stem.hint}</FieldHint>
          <FieldError message={errors.stem?.message} />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-ink-900 text-sm font-medium">
            {COPY.adminQuestions.fields.options.label}
            <RequiredMark />
          </legend>
          <p className="text-ink-700 text-sm">{COPY.adminQuestions.fields.options.hint}</p>
          <p className="text-ink-700 text-sm">{COPY.adminQuestions.optionsEditor.exactlyOneNote}</p>

          <ul className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const isCorrect = optionValues?.[index]?.isCorrect === true;
              return (
                <li
                  key={field.id}
                  className={cn(
                    'rounded-panel border-line-200 flex flex-col gap-2 border p-3',
                    isCorrect && 'border-brand-500 bg-brand-100/40',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctOption"
                      id={`correct-${field.id}`}
                      checked={isCorrect}
                      onChange={() => markCorrect(index)}
                      className="focus-visible:outline-brand-500 size-5 shrink-0 cursor-pointer accent-[var(--neb-brand-700)] focus-visible:outline-2"
                    />
                    <Label htmlFor={`correct-${field.id}`} className="font-normal">
                      <span className="sr-only">
                        {COPY.adminQuestions.optionsEditor.markCorrect} —{' '}
                      </span>
                      {COPY.adminQuestions.optionsEditor.optionLabel.replace(
                        '{number}',
                        String(index + 1),
                      )}
                    </Label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ms-auto"
                      // Two is the floor the schema states and the database's own
                      // shape assumes; the control disappears rather than failing.
                      disabled={fields.length <= 2}
                      onClick={() => removeOption(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      <span className="sr-only">
                        {COPY.adminQuestions.optionsEditor.removeOption}
                      </span>
                    </Button>
                  </div>

                  <Textarea
                    rows={2}
                    aria-label={COPY.adminQuestions.optionsEditor.optionLabel.replace(
                      '{number}',
                      String(index + 1),
                    )}
                    aria-invalid={Boolean(errors.options?.[index]?.content)}
                    {...register(`options.${index}.content` as const)}
                  />
                  <FieldError message={errors.options?.[index]?.content?.message} />
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fields.length >= 8}
              onClick={() => append({ content: '', isCorrect: false })}
            >
              <Plus className="size-4" aria-hidden="true" />
              {COPY.adminQuestions.optionsEditor.addOption}
            </Button>
            <p className="text-ink-700 text-sm">{COPY.adminQuestions.optionsEditor.minimumNote}</p>
          </div>

          {/* Zod reports the "exactly one correct" refusal against the array itself. */}
          <FieldError message={errors.options?.message ?? errors.options?.root?.message} />
        </fieldset>

        <Field>
          <div className="flex items-start gap-3">
            <Checkbox id="shuffleOptions" className="mt-1" {...register('shuffleOptions')} />
            <Label htmlFor="shuffleOptions" className="leading-relaxed font-normal">
              {COPY.adminQuestions.fields.shuffleOptions.label}
            </Label>
          </div>
          <FieldHint>{COPY.adminQuestions.fields.shuffleOptions.hint}</FieldHint>
        </Field>

        {/*
          The companion material moved here when the classification section was
          hidden. It never belonged with the taxonomy anyway: a passage, a table
          or a figure is part of what the student reads, and a reading-
          comprehension item without one is not a classified question — it is an
          unfinished one.
        */}
        <Field>
          <Label htmlFor="stimulusId">
            {COPY.adminQuestions.fields.stimulus.label}
            <OptionalMark />
          </Label>
          <Select
            id="stimulusId"
            aria-describedby="stimulus-hint"
            aria-invalid={Boolean(errors.stimulusId)}
            {...register('stimulusId', {
              setValueAs: (value: unknown) => (value === '' ? null : (value as string)),
            })}
          >
            <option value="">{UNCHOSEN}</option>
            {stimuli.map((stimulus) => (
              <option key={stimulus.id} value={stimulus.id}>
                {COPY.adminQuestions.stimulusTypeLabels[stimulus.type]}
                {stimulus.title ? ` — ${stimulus.title}` : ''}
              </option>
            ))}
          </Select>
          <FieldHint id="stimulus-hint">{COPY.adminQuestions.fields.stimulus.hint}</FieldHint>
          <FieldError message={errors.stimulusId?.message} />
        </Field>

        <Notice tone="neutral" role="note">
          {COPY.adminQuestions.notices.correctAnswerHidden}
        </Notice>
      </Section>

      {/*
        The classification section, hidden at the client's request: skill,
        difficulty, track, sub-skill, estimated time and tags. A teacher adding
        content should be asked for the question, not for the taxonomy around it,
        and nothing the student is shown depends on any of these six.

        Uncommenting this block restores the section exactly as it worked. Two
        notes for whoever does:

          - The companion-material picker used to close this section. It moved
            into the content section above — it is part of what the student
            reads, not a classification — and should stay there.
          - `EMPTY_INITIAL.domain` above becomes `'' as unknown as Domain` again,
            so an unanswered required select is refused rather than filed under
            the placeholder; `splitTags`, `DOMAINS`, `DIFFICULTIES` and `TRACKS`
            come back with it.

      <Section title={COPY.adminQuestions.sections.classification}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="domain">
              {COPY.adminQuestions.fields.domain.label}
              <RequiredMark />
            </Label>
            <Select
              id="domain"
              aria-describedby="domain-hint"
              aria-invalid={Boolean(errors.domain)}
              {...register('domain')}
            >
              <option value="">{UNCHOSEN}</option>
              {DOMAINS.map((domain) => (
                <option key={domain} value={domain}>
                  {COPY.adminQuestions.domainLabels[domain]}
                </option>
              ))}
            </Select>
            <FieldHint id="domain-hint">{COPY.adminQuestions.fields.domain.hint}</FieldHint>
            <FieldError message={errors.domain?.message} />
          </Field>

          <Field>
            <Label htmlFor="difficulty">
              {COPY.adminQuestions.fields.difficulty.label}
              <RequiredMark />
            </Label>
            <Select
              id="difficulty"
              aria-describedby="difficulty-hint"
              aria-invalid={Boolean(errors.difficulty)}
              {...register('difficulty')}
            >
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {COPY.adminQuestions.difficultyLabels[difficulty]}
                </option>
              ))}
            </Select>
            <FieldHint id="difficulty-hint">{COPY.adminQuestions.fields.difficulty.hint}</FieldHint>
            <FieldError message={errors.difficulty?.message} />
          </Field>

          <Field>
            <Label htmlFor="track">
              {COPY.adminQuestions.fields.track.label}
              <RequiredMark />
            </Label>
            <Select
              id="track"
              aria-describedby="track-hint"
              aria-invalid={Boolean(errors.track)}
              {...register('track')}
            >
              {TRACKS.map((track) => (
                <option key={track} value={track}>
                  {COPY.adminQuestions.trackLabels[track]}
                </option>
              ))}
            </Select>
            <FieldHint id="track-hint">{COPY.adminQuestions.fields.track.hint}</FieldHint>
            <FieldError message={errors.track?.message} />
          </Field>

          <Field>
            <Label htmlFor="subskill">
              {COPY.adminQuestions.fields.subskill.label}
              <OptionalMark />
            </Label>
            <Input
              id="subskill"
              aria-describedby="subskill-hint"
              aria-invalid={Boolean(errors.subskill)}
              {...register('subskill')}
            />
            <FieldHint id="subskill-hint">{COPY.adminQuestions.fields.subskill.hint}</FieldHint>
            <FieldError message={errors.subskill?.message} />
          </Field>

          <Field>
            <Label htmlFor="estimatedSeconds">
              {COPY.adminQuestions.fields.estimatedSeconds.label}
              <OptionalMark />
            </Label>
            <Input
              id="estimatedSeconds"
              type="number"
              inputMode="numeric"
              min={5}
              max={3600}
              dir="ltr"
              aria-describedby="estimatedSeconds-hint"
              aria-invalid={Boolean(errors.estimatedSeconds)}
              // An empty number input reads as `''`, which becomes `NaN` under
              // `valueAsNumber` and fails the integer rule with a message about a
              // field the editor deliberately left blank.
              {...register('estimatedSeconds', {
                setValueAs: (value: unknown) =>
                  value === '' || value === null || value === undefined ? null : Number(value),
              })}
            />
            <FieldHint id="estimatedSeconds-hint">
              {COPY.adminQuestions.fields.estimatedSeconds.hint}
            </FieldHint>
            <FieldError message={errors.estimatedSeconds?.message} />
          </Field>

          <Field>
            <Label htmlFor="tags">
              {COPY.adminQuestions.fields.tags.label}
              <OptionalMark />
            </Label>
            <Input
              id="tags"
              defaultValue={source.tags.join('، ')}
              aria-describedby="tags-hint"
              aria-invalid={Boolean(errors.tags)}
              onChange={(event) =>
                setValue('tags', splitTags(event.target.value), { shouldDirty: true })
              }
            />
            <FieldHint id="tags-hint">{COPY.adminQuestions.fields.tags.hint}</FieldHint>
            <FieldError message={errors.tags?.message ?? errors.tags?.root?.message} />
          </Field>
        </div>
      </Section>
      */}

      <Section title={COPY.adminQuestions.sections.guidance}>
        <Field>
          <Label htmlFor="explanation">
            {COPY.adminQuestions.fields.explanation.label}
            <OptionalMark />
          </Label>
          <Textarea
            id="explanation"
            rows={4}
            aria-describedby="explanation-hint"
            aria-invalid={Boolean(errors.explanation)}
            {...register('explanation')}
          />
          <FieldHint id="explanation-hint">{COPY.adminQuestions.fields.explanation.hint}</FieldHint>
          <FieldError message={errors.explanation?.message} />
        </Field>

        <Field>
          <Label htmlFor="hint">
            {COPY.adminQuestions.fields.hint.label}
            <OptionalMark />
          </Label>
          <Textarea
            id="hint"
            rows={2}
            aria-describedby="hint-hint"
            aria-invalid={Boolean(errors.hint)}
            {...register('hint')}
          />
          <FieldHint id="hint-hint">{COPY.adminQuestions.fields.hint.hint}</FieldHint>
          <FieldError message={errors.hint?.message} />
        </Field>
      </Section>

      {/*
        The rights section states the rule, not merely the fields. The cost of
        getting this wrong is not a badly-filled row: it is publishing protected
        examination material, which the regulation covering the official test
        treats as confidential intellectual property.
      */}
      <Section
        title={COPY.adminQuestions.rights.sectionTitle}
        description={COPY.adminQuestions.rights.sectionBody}
      >
        <Notice tone="warning" role="note">
          {COPY.adminQuestions.rights.mandatoryNote}
        </Notice>

        <Field>
          <Label htmlFor="authorOrLicensor">
            {COPY.adminQuestions.rights.authorOrLicensor.label}
            <RequiredMark />
          </Label>
          <Input
            id="authorOrLicensor"
            aria-describedby="authorOrLicensor-hint"
            aria-invalid={Boolean(errors.authorOrLicensor)}
            {...register('authorOrLicensor')}
          />
          <FieldHint id="authorOrLicensor-hint">
            {COPY.adminQuestions.rights.authorOrLicensor.hint}
          </FieldHint>
          <FieldError message={errors.authorOrLicensor?.message} />
        </Field>

        <Field>
          <Label htmlFor="rightsDeclaration">
            {COPY.adminQuestions.rights.rightsDeclaration.label}
            <RequiredMark />
          </Label>
          <Select
            id="rightsDeclaration"
            aria-describedby="rightsDeclaration-hint"
            aria-invalid={Boolean(errors.rightsDeclaration)}
            {...register('rightsDeclaration')}
          >
            <option value="">{UNCHOSEN}</option>
            {RIGHTS.map((declaration) => (
              <option key={declaration} value={declaration}>
                {COPY.adminQuestions.rightsLabels[declaration]}
              </option>
            ))}
          </Select>
          <FieldHint id="rightsDeclaration-hint">
            {COPY.adminQuestions.rights.rightsDeclaration.hint}
          </FieldHint>
          <FieldError message={errors.rightsDeclaration?.message} />
        </Field>

        <Field>
          <Label htmlFor="provenanceNote">
            {COPY.adminQuestions.rights.provenanceNote.label}
            <OptionalMark />
          </Label>
          <Textarea
            id="provenanceNote"
            rows={3}
            aria-describedby="provenanceNote-hint"
            aria-invalid={Boolean(errors.provenanceNote)}
            {...register('provenanceNote')}
          />
          <FieldHint id="provenanceNote-hint">
            {COPY.adminQuestions.rights.provenanceNote.hint}
          </FieldHint>
          <FieldError message={errors.provenanceNote?.message} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/questions">{COPY.adminCommon.actions.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── Review and publication ─────────────────────────

/**
 * A confirmation that says what the button will actually do.
 *
 * Built on Radix Dialog rather than `window.confirm`, for the same reasons the
 * administration drawer is: focus trap, focus restoration, Escape, `aria-modal`
 * and the labelled title come with it, and a native dialog cannot carry the note
 * field a review decision needs.
 */
function ConfirmAction({
  label,
  title,
  body,
  confirmLabel,
  variant = 'outline',
  withNote = false,
  pending,
  onConfirm,
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  withNote?: boolean;
  pending: boolean;
  onConfirm: (note: string | undefined) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant={variant} disabled={pending}>
          {label}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink-900/40 fixed inset-0 z-40" />
        {/*
          Centred with `inset-0` plus `m-auto` rather than a half-translate: a
          `-translate-x-1/2` pairs with a physical `left`, and under `dir="rtl"`
          the panel would sit a half-width off. Auto margins have no direction.
        */}
        <Dialog.Content
          className={cn(
            'fixed inset-0 z-50 m-auto h-fit w-[min(32rem,92vw)]',
            'rounded-panel border-line-200 bg-surface shadow-overlay flex flex-col gap-4 border p-5',
          )}
        >
          <Dialog.Title className="text-ink-900 text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-ink-700 text-sm leading-relaxed">
            {body}
          </Dialog.Description>

          {withNote ? (
            <Field>
              <Label htmlFor="transition-note">
                {COPY.adminQuestions.fields.reviewNote.label}
                <span className="text-ink-600 font-normal">
                  {' '}
                  ({COPY.adminCommon.form.optionalMark})
                </span>
              </Label>
              <Textarea
                id="transition-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <FieldHint>{COPY.adminQuestions.fields.reviewNote.hint}</FieldHint>
            </Field>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                {COPY.adminCommon.confirmDelete.cancel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              loading={pending}
              onClick={async () => {
                await onConfirm(withNote && note.trim() ? note.trim() : undefined);
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The review path, as controls.
 *
 * Which buttons exist follows the state machine in
 * `question-publish.service.ts`, and that is a convenience only: the server
 * refuses an illegal move whether or not a button for it was ever drawn. Every
 * confirmation states the consequence the verb does not — publication freezes a
 * version that live attempts serve, retirement leaves past attempts untouched.
 */
export function QuestionWorkflowPanel({
  questionId,
  workflow,
  deleteBlock,
}: {
  questionId: string;
  workflow: Workflow;
  /** Why deletion is unavailable, decided by the service. See `QuestionDetail`. */
  deleteBlock: 'none' | 'in_use' | 'not_a_draft';
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function move(to: Workflow, note: string | undefined, successMessage: string) {
    setPending(true);
    try {
      const result = await send(`/api/admin/questions/${questionId}/workflow`, 'POST', {
        to,
        note,
      });
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function destroy() {
    setPending(true);
    try {
      const result = await send(`/api/admin/questions/${questionId}`, 'DELETE');
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCommon.toast.deleteFailed);
        return;
      }
      toast.success(COPY.adminQuestions.toast.deleted);
      router.push('/admin/questions');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const transitions = COPY.adminQuestions.transitions;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-ink-900 text-lg font-semibold">{COPY.adminQuestions.sections.review}</h2>

      <div className="flex flex-wrap items-center gap-3">
        {workflow === 'DRAFT' ? (
          <ConfirmAction
            label={transitions.submitForReview}
            title={transitions.submitForReviewConfirmTitle}
            body={transitions.submitForReviewConfirmBody}
            confirmLabel={transitions.submitForReviewConfirmAction}
            variant="secondary"
            pending={pending}
            onConfirm={(note) =>
              move('IN_REVIEW', note, COPY.adminQuestions.toast.submittedForReview)
            }
          />
        ) : null}

        {workflow === 'IN_REVIEW' ? (
          <ConfirmAction
            label={transitions.approve}
            title={transitions.approveConfirmTitle}
            body={transitions.approveConfirmBody}
            confirmLabel={transitions.approveConfirmAction}
            variant="secondary"
            withNote
            pending={pending}
            onConfirm={(note) => move('APPROVED', note, COPY.adminQuestions.toast.approved)}
          />
        ) : null}

        {workflow === 'IN_REVIEW' || workflow === 'APPROVED' ? (
          <ConfirmAction
            label={transitions.requestChanges}
            title={transitions.requestChangesConfirmTitle}
            body={transitions.requestChangesConfirmBody}
            confirmLabel={transitions.requestChangesConfirmAction}
            withNote
            pending={pending}
            onConfirm={(note) => move('DRAFT', note, COPY.adminQuestions.toast.returnedToDraft)}
          />
        ) : null}

        {workflow === 'APPROVED' || workflow === 'PUBLISHED' ? (
          <ConfirmAction
            label={transitions.publish}
            title={transitions.publishConfirmTitle}
            body={transitions.publishConfirmBody}
            confirmLabel={transitions.publishConfirmAction}
            variant="primary"
            pending={pending}
            onConfirm={(note) => move('PUBLISHED', note, COPY.adminQuestions.toast.published)}
          />
        ) : null}

        {workflow === 'PUBLISHED' ? (
          <ConfirmAction
            label={transitions.retire}
            title={transitions.retireConfirmTitle}
            body={transitions.retireConfirmBody}
            confirmLabel={transitions.retireConfirmAction}
            pending={pending}
            onConfirm={(note) => move('RETIRED', note, COPY.adminQuestions.toast.retired)}
          />
        ) : null}

        {workflow === 'RETIRED' ? (
          <ConfirmAction
            label={transitions.restore}
            title={transitions.restoreConfirmTitle}
            body={transitions.restoreConfirmBody}
            confirmLabel={transitions.restoreConfirmAction}
            variant="secondary"
            pending={pending}
            onConfirm={(note) => move('DRAFT', note, COPY.adminQuestions.toast.returnedToDraft)}
          />
        ) : null}
      </div>

      {/*
        Three states, and the middle one is the reason `deleteBlock` is a reason
        rather than a flag:

         - deletable — a draft nothing points at;
         - `in_use` — permanently undeletable, and the sentence says retirement
           is the way out, because otherwise an editor presses the same refused
           button twice;
         - `not_a_draft` — nothing is wrong and nothing needs explaining. The
           control simply is not available yet, and it reappears the moment the
           item is returned to the editor with the button directly above. Saying
           "this is used elsewhere" here would be false.
      */}
      {deleteBlock === 'none' ? (
        <div className="border-line-200 flex flex-wrap items-center gap-3 border-t pt-4">
          <ConfirmAction
            label={COPY.adminCommon.actions.delete}
            title={COPY.adminCommon.confirmDelete.title}
            body={COPY.adminCommon.confirmDelete.body}
            confirmLabel={COPY.adminCommon.confirmDelete.confirm}
            variant="danger"
            pending={pending}
            onConfirm={() => destroy()}
          />
        </div>
      ) : deleteBlock === 'in_use' ? (
        <div className="border-line-200 border-t pt-4">
          <p className="text-ink-700 max-w-prose text-sm">
            <span className="text-ink-900 font-medium">
              {COPY.adminCommon.confirmDelete.blockedTitle}
            </span>{' '}
            {COPY.adminQuestions.errors.deleteBlockedInUse}
          </p>
        </div>
      ) : null}

      <p className="text-ink-600 text-sm">{COPY.adminCommon.notices.auditedAction}</p>
    </Card>
  );
}
