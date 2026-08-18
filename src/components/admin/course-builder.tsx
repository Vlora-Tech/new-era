'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  MonitorPlay,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import type { $Enums } from '@prisma/client';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { LessonForm, type LessonFormVideo } from '@/components/admin/lesson-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { Badge, Card, EmptyState, Notice } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  updateCourseSettingsSchema,
  type CourseSettingsFormValues,
  type UpdateCourseSettingsInput,
} from '@/validators/admin-course';

/**
 * The course builder: settings, modules, lessons, and each lesson's short quiz.
 *
 * One client component for the whole tree, because the tree is one editing
 * session. Splitting it per module would mean a reorder in one card and a
 * publication in another disagreeing about what the list currently contains,
 * and the disagreement would only surface as a saved order nobody chose.
 *
 * Four decisions are worth stating, because each of them is a place the obvious
 * implementation is wrong:
 *
 *  1. **A reorder is one request carrying the whole list.** `position` is not
 *     unique on `CourseModule` or `Lesson`, so an ordering is only ever
 *     consistent as a set; sending "move this one up" as its own call would let
 *     two half-applied orderings interleave. The arrows below compute the new
 *     complete array locally and `PATCH` it once.
 *  2. **Publication is never a form field.** Every transition goes through its
 *     own confirmed action and its own `intent: 'transition'` body, and each
 *     confirmation says what actually changes for a student — which for a lesson
 *     inside a draft module is nothing.
 *  3. **Refusals are shown before they are earned.** A lesson somebody has
 *     watched cannot be deleted, and the button is disabled with the reason
 *     printed beside it rather than left live to produce a 409.
 *  4. **The types here are restated, not imported from the service.** That
 *     module is `server-only`; a client component that reached into it — even
 *     for a type — would point the dependency arrow the wrong way. TypeScript
 *     checks the two shapes agree where the page hands one to the other, which
 *     is the only place a divergence could matter.
 */

type ApiEnvelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

async function send(url: string, method: string, body?: unknown): Promise<ApiEnvelope> {
  const response = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return (await response.json()) as ApiEnvelope;
}

// ── The shapes the page hands over ───────────────────────────────────────

export type BuilderLesson = {
  id: string;
  title: string;
  position: number;
  status: $Enums.ContentStatus;
  durationSec: number | null;
  isPreview: boolean;
  hasContent: boolean;
  videoAssetId: string | null;
  videoTitle: string | null;
  videoReady: boolean;
  completionThresholdPercent: number | null;
  quizQuestionCount: number | null;
  quizAttemptCount: number;
  progressCount: number;
  updatedAt: Date;
};

export type BuilderModule = {
  id: string;
  title: string;
  position: number;
  status: $Enums.ContentStatus;
  lessons: BuilderLesson[];
  publishedLessonCount: number;
  durationSec: number;
  progressCount: number;
  quizAttemptCount: number;
  updatedAt: Date;
};

export type BuilderCourse = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: $Enums.ProductStatus;
  category: string | null;
  level: string | null;
  completionThresholdPercent: number;
  modules: BuilderModule[];
  totals: {
    moduleCount: number;
    lessonCount: number;
    publishedLessonCount: number;
    durationSec: number;
  };
};

const CONTENT_STATUS_VARIANTS: Record<$Enums.ContentStatus, 'neutral' | 'success' | 'outline'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'outline',
};

/**
 * A module's or lesson's own publication state.
 *
 * Local to the builder rather than added to `status-badge.tsx`: the colours
 * match `ProductStatusBadge` because the three states mean the same thing to an
 * administrator, and the label always carries the meaning in words so the state
 * survives greyscale.
 */
function ContentStatusBadge({ status }: { status: $Enums.ContentStatus }) {
  return (
    <Badge variant={CONTENT_STATUS_VARIANTS[status]}>
      {COPY.adminCourses.statusLabels[status]}
    </Badge>
  );
}

/**
 * A control whose label is its icon.
 *
 * Reordering and deletion used to be text buttons — «تحريك للأعلى»، «تحريك
 * للأسفل»، «حذف» — and six of them in one cell is what made a lesson row wrap
 * into a vertical stack of buttons three hundred pixels tall, with the table
 * overflowing its card besides. The words are not lost: they move to
 * `aria-label` and `title`, so the accessible name and the hover tooltip say
 * exactly what they said before and only the pixels are gone.
 *
 * Only ever used for actions whose meaning an icon can actually carry — an
 * arrow and a bin. Publication stays in words, because there is no glyph that
 * distinguishes «نشر» from «أرشفة» without teaching one first.
 */
function IconAction({
  label,
  icon: Icon,
  tone = 'neutral',
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      // Both, deliberately: `aria-label` names it for a screen reader and
      // `title` for a pointer. A tooltip alone leaves the button unnamed.
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('px-2', tone === 'danger' && 'text-error hover:bg-error-soft hover:text-error')}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}

// ── Confirmation ─────────────────────────────────────────────────────────

type PendingConfirm = {
  key: string;
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  run: () => Promise<void>;
};

/**
 * One confirmation dialog for the whole screen.
 *
 * A single slot rather than a prompt per row: two open confirmations, each
 * describing a destructive action on a different lesson, is how the wrong one
 * gets confirmed.
 *
 * It is a modal, and that is the whole point. As an inline panel it rendered at
 * the top of the tree while its trigger could be the حذف button of lesson
 * thirty-seven, hundreds of pixels below the fold — so pressing حذف appeared to
 * do nothing, the layout shifted by the panel's height, and the obvious next
 * act of pressing حذف again landed on a different row. That was patched with a
 * `scrollIntoView` and a manual `focus()`, which is a workaround for the panel
 * being in the wrong place rather than a fix. A dialog is never in the wrong
 * place: Radix portals it over the page, centres it, traps focus inside it,
 * locks background scrolling, closes on Escape, and returns focus to the button
 * that opened it — all the behaviour the manual version was approximating.
 *
 * `Dialog.Title` and `Dialog.Description` are the real elements, not styled
 * spans, so the dialog is announced with its question and its consequence
 * rather than as an unlabelled region.
 */
function ConfirmPanel({ pending, onCancel }: { pending: PendingConfirm; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        // Radix requests a close for Escape and for an overlay click alike.
        // Both are refused while the action is in flight: cancelling the dialog
        // would not cancel the request, and dismissing it mid-write suggests
        // nothing happened when something did.
        if (!next && !busy) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink-900/40 fixed inset-0 z-[60]" />
        <Dialog.Content
          /*
           * Physical `left-1/2`, not logical `start-1/2` — `translate-x` is
           * physical in both directions, so pairing it with `start` under
           * `dir="rtl"` resolves to `right: 50%` and shifts the panel a further
           * half-width, hanging it off the inline-start edge. Same reasoning as
           * the lesson form's dialog.
           */
          className={cn(
            'fixed top-1/2 left-1/2 z-[70] -translate-x-1/2 -translate-y-1/2',
            'max-h-[calc(100dvh-4rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto',
            'rounded-panel border-line-200 bg-surface shadow-overlay border p-5 sm:p-6',
          )}
          onOpenAutoFocus={(event) => {
            /*
             * A destructive action never opens with its own confirm button
             * focused. Radix otherwise focuses the first tabbable element, which
             * would put حذف one stray Enter away from running. Preventing the
             * default leaves focus on the dialog itself: still trapped, still
             * Escape-able, but the confirmation has to be reached deliberately.
             * A publish or an unpublish is reversible, so it keeps the
             * convenience.
             */
            if (pending.danger) event.preventDefault();
          }}
        >
          <Dialog.Title className="text-ink-900 text-base font-semibold">
            {pending.title}
          </Dialog.Title>
          <Dialog.Description className="text-ink-700 mt-2 text-sm leading-[1.85]">
            {pending.body}
          </Dialog.Description>

          <div className="mt-5 flex flex-wrap gap-2">
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
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
              {COPY.adminCommon.confirmDelete.cancel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Course settings ──────────────────────────────────────────────────────

const SETTINGS = COPY.adminCourses.settings;

function CourseSettingsForm({ course, onSaved }: { course: BuilderCourse; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CourseSettingsFormValues, unknown, UpdateCourseSettingsInput>({
    resolver: zodResolver(updateCourseSettingsSchema),
    defaultValues: {
      category: course.category ?? '',
      level: course.level ?? '',
      completionThresholdPercent: course.completionThresholdPercent,
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await send(`/api/admin/courses/${course.id}`, 'PATCH', values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.error?.details ?? {})) {
        if (field in values) setError(field as keyof CourseSettingsFormValues, { message });
      }
      toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
      return;
    }
    toast.success(SETTINGS.toast.updated);
    onSaved();
  });

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-ink-900 text-lg font-semibold">{SETTINGS.title}</h2>
        <p className="text-ink-700 max-w-prose text-sm">{SETTINGS.description}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="course-category-field">{SETTINGS.fields.category.label}</Label>
            <Input
              id="course-category-field"
              aria-describedby="course-category-hint"
              aria-invalid={Boolean(errors.category)}
              {...register('category')}
            />
            <FieldHint id="course-category-hint">{SETTINGS.fields.category.hint}</FieldHint>
            <FieldError message={errors.category?.message} />
          </Field>

          <Field>
            <Label htmlFor="course-level-field">{SETTINGS.fields.level.label}</Label>
            <Input
              id="course-level-field"
              aria-describedby="course-level-hint"
              aria-invalid={Boolean(errors.level)}
              {...register('level')}
            />
            <FieldHint id="course-level-hint">{SETTINGS.fields.level.hint}</FieldHint>
            <FieldError message={errors.level?.message} />
          </Field>
        </div>

        <Field>
          <Label htmlFor="course-threshold-field">
            {SETTINGS.fields.completionThresholdPercent.label}
          </Label>
          <Input
            id="course-threshold-field"
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            aria-describedby="course-threshold-hint"
            aria-invalid={Boolean(errors.completionThresholdPercent)}
            {...register('completionThresholdPercent', {
              setValueAs: (value: unknown) => (value === '' ? Number.NaN : Number(value)),
            })}
          />
          <FieldHint id="course-threshold-hint">
            {SETTINGS.fields.completionThresholdPercent.hint}
          </FieldHint>
          <FieldError message={errors.completionThresholdPercent?.message} />
        </Field>

        {/* Restated beside the control that would otherwise appear to rewrite
            history: changing the threshold moves the bar for future watching and
            leaves every completed lesson completed. */}
        <Notice tone="neutral" role="note">
          {COPY.adminCourses.notices.progressNote}
        </Notice>

        <div>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── The module title form ────────────────────────────────────────────────

function ModuleTitleForm({
  courseId,
  module,
  onSaved,
  onCancel,
}: {
  courseId: string;
  /** Undefined creates a module at the end of the course; a value renames one. */
  module?: BuilderModule;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = module !== undefined;
  const [title, setTitle] = useState(module?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = isEdit
        ? await send(`/api/admin/modules/${module.id}`, 'PATCH', { intent: 'update', title })
        : await send(`/api/admin/courses/${courseId}/modules`, 'POST', { title });

      if (!result.ok) {
        setMessage(
          result.error?.details?.title ??
            result.error?.message ??
            (isEdit ? COPY.adminCommon.toast.updateFailed : COPY.adminCommon.toast.createFailed),
        );
        return;
      }

      toast.success(
        isEdit ? COPY.adminCourses.modules.toast.updated : COPY.adminCourses.modules.toast.created,
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-ink-900 text-base font-semibold">
          {isEdit ? COPY.adminCourses.modules.editTitle : COPY.adminCourses.modules.createTitle}
        </h3>
        {isEdit ? null : (
          <p className="text-ink-700 text-sm">{COPY.adminCourses.modules.createDescription}</p>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field>
          <Label htmlFor="module-title-field">{COPY.adminCourses.modules.fields.title.label}</Label>
          <Input
            id="module-title-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby="module-title-hint"
            aria-invalid={message !== null}
          />
          <FieldHint id="module-title-hint">
            {COPY.adminCourses.modules.fields.title.hint}
          </FieldHint>
          <FieldError message={message ?? undefined} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" loading={busy}>
            {busy ? COPY.adminCommon.actions.saving : COPY.adminCommon.actions.save}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {COPY.adminCommon.actions.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── The lesson quiz ──────────────────────────────────────────────────────

const QUIZ = COPY.adminCourses.quiz;

type QuizRow = {
  questionId: string;
  points: number;
  stemExcerpt: string;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  /** The bank's current workflow, so a question retired since it was added shows as such. */
  workflow: $Enums.QuestionWorkflow;
};

type BankResult = {
  id: string;
  stemExcerpt: string;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
};

const QUESTION_DOMAINS = Object.keys(COPY.adminQuestions.domainLabels) as $Enums.QuestionDomain[];
const QUESTION_DIFFICULTIES = Object.keys(
  COPY.adminQuestions.difficultyLabels,
) as $Enums.QuestionDifficulty[];

/**
 * The short quiz attached to one lesson.
 *
 * Questions are references into the bank, never authored here: the picker
 * searches `workflow=PUBLISHED` only, because the bank's review workflow exists
 * so that unreviewed material cannot reach a student, and a second door into the
 * same content would make that guarantee decorative. The server refuses a
 * non-published id regardless of what this component sends.
 *
 * The whole quiz is saved in one `PUT` — settings, membership, order and points
 * together — so a failure leaves the quiz exactly as it was rather than
 * half-edited, and `@@unique([quizId, questionId])` is checked against the
 * submitted list before anything is written.
 */
function LessonQuizEditor({
  lessonId,
  lessonTitle,
  onSaved,
  onCancel,
  onConfirm,
}: {
  lessonId: string;
  lessonTitle: string;
  onSaved: () => void;
  onCancel: () => void;
  onConfirm: (pending: PendingConfirm) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [exists, setExists] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedbackMode, setFeedbackMode] = useState<$Enums.FeedbackMode>('AFTER_SUBMISSION');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [term, setTerm] = useState('');
  const [domain, setDomain] = useState<$Enums.QuestionDomain | ''>('');
  const [difficulty, setDifficulty] = useState<$Enums.QuestionDifficulty | ''>('');
  const [bankPage, setBankPage] = useState(1);
  const [bankPageCount, setBankPageCount] = useState(1);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankFailed, setBankFailed] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [searching, setSearching] = useState(true);
  const [results, setResults] = useState<BankResult[]>([]);
  const bankRequest = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await send(`/api/admin/lessons/${lessonId}/quiz`, 'GET');
        if (cancelled) return;

        if (!result.ok) {
          setLoadFailed(true);
          return;
        }
        // `null` is the ordinary "no quiz yet" answer, not a failure — the route
        // says so deliberately rather than answering 404.
        const quiz = result.data as {
          feedbackMode: $Enums.FeedbackMode;
          maxAttempts: number | null;
          attemptCount: number;
          questions: QuizRow[];
        } | null;

        if (quiz) {
          setExists(true);
          setFeedbackMode(quiz.feedbackMode);
          setMaxAttempts(quiz.maxAttempts === null ? '' : String(quiz.maxAttempts));
          setAttemptCount(quiz.attemptCount);
          setRows(quiz.questions);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  /*
   * Browsing is the default, not a reward for guessing a search term. The
   * latest published questions load as soon as the picker opens; typing and
   * filtering merely refine that visible list. A short debounce avoids one
   * request per keystroke, while the sequence number prevents an older, slower
   * response replacing a newer one.
   */
  useEffect(() => {
    const request = ++bankRequest.current;

    const timer = window.setTimeout(
      () => {
        setSearching(true);
        setBankFailed(false);
        void (async () => {
          try {
            const params = new URLSearchParams({
              workflow: 'PUBLISHED',
              perPage: '12',
              page: String(bankPage),
            });
            if (term.trim()) params.set('q', term.trim());
            if (domain) params.set('domain', domain);
            if (difficulty) params.set('difficulty', difficulty);

            const result = await send(`/api/admin/questions?${params.toString()}`, 'GET');
            if (request !== bankRequest.current) return;

            if (!result.ok) {
              setResults([]);
              setBankTotal(0);
              setBankPageCount(1);
              setBankFailed(true);
              return;
            }

            const bank = result.data as {
              items?: BankResult[];
              total?: number;
              pageCount?: number;
            };
            setResults(bank.items ?? []);
            setBankTotal(bank.total ?? 0);
            setBankPageCount(bank.pageCount ?? 1);
          } catch {
            if (request !== bankRequest.current) return;
            setResults([]);
            setBankTotal(0);
            setBankPageCount(1);
            setBankFailed(true);
          } finally {
            if (request === bankRequest.current) setSearching(false);
          }
        })();
      },
      term.trim() ? 250 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [bankPage, difficulty, domain, refreshToken, term]);

  function addQuestion(item: BankResult) {
    setRows((current) =>
      // The server enforces `@@unique([quizId, questionId])` and the schema
      // rejects a duplicated list; refusing here too means the administrator
      // never assembles a selection that cannot be saved.
      current.some((row) => row.questionId === item.id)
        ? current
        : [
            ...current,
            {
              questionId: item.id,
              points: 1,
              stemExcerpt: item.stemExcerpt,
              domain: item.domain,
              difficulty: item.difficulty,
              workflow: 'PUBLISHED' as const,
            },
          ],
    );
  }

  function removeQuestion(questionId: string) {
    setRows((current) => current.filter((item) => item.questionId !== questionId));
  }

  function clearBankFilters() {
    setTerm('');
    setDomain('');
    setDifficulty('');
    setBankPage(1);
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      if (row) next.splice(target, 0, row);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await send(`/api/admin/lessons/${lessonId}/quiz`, 'PUT', {
        feedbackMode,
        maxAttempts: maxAttempts.trim() === '' ? null : Number(maxAttempts),
        questions: rows.map((row) => ({ questionId: row.questionId, points: row.points })),
      });

      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
        return;
      }
      toast.success(exists ? QUIZ.toast.updated : QUIZ.toast.created);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const hasRetired = rows.some((row) => row.workflow !== 'PUBLISHED');

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        // Keep the dialog in place while the save request is in flight. Closing
        // it would not cancel the request and makes a successful save look lost.
        if (!next && !saving) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink-900/40 fixed inset-0 z-40" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden',
            'rounded-panel border-line-200 bg-surface shadow-overlay border',
            'sm:max-h-[calc(100dvh-4rem)] sm:w-[min(72rem,calc(100vw-4rem))]',
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="border-line-200 flex shrink-0 items-start gap-4 border-b p-5 sm:p-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title
                ref={titleRef}
                tabIndex={-1}
                className="text-ink-900 text-lg font-semibold outline-none"
              >
                {exists ? QUIZ.editTitle : QUIZ.createTitle}
              </Dialog.Title>
              <p className="text-ink-900 mt-1 truncate text-sm font-medium">{lessonTitle}</p>
              <Dialog.Description className="text-ink-700 mt-1 max-w-prose text-sm">
                {QUIZ.description}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                disabled={saving}
                aria-label={COPY.adminCommon.actions.cancel}
                title={COPY.adminCommon.actions.cancel}
                className={cn(
                  'rounded-control inline-flex size-9 shrink-0 items-center justify-center',
                  'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
                  'focus-visible:outline-brand-500 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
                  'disabled:pointer-events-none disabled:opacity-55',
                )}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {loadFailed ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-ink-900 font-medium">{COPY.common.unexpectedError}</p>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                  {COPY.adminCommon.actions.cancel}
                </Button>
              </div>
            ) : loading ? (
              <p className="text-ink-700 text-sm" role="status">
                {COPY.common.loading}
              </p>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
                <section className="flex min-w-0 flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-ink-900 font-semibold">{QUIZ.questions.bank.title}</h4>
                    <p className="text-ink-700 text-sm">{QUIZ.questions.bank.description}</p>
                  </div>

                  <div className="rounded-panel bg-surface-muted flex flex-col gap-3 p-3 sm:p-4">
                    <Field>
                      <Label htmlFor="quiz-bank-search">{COPY.adminCommon.search.label}</Label>
                      <Input
                        id="quiz-bank-search"
                        type="search"
                        value={term}
                        onChange={(event) => {
                          setTerm(event.target.value);
                          setBankPage(1);
                        }}
                        placeholder={QUIZ.questions.bank.searchPlaceholder}
                      />
                      <FieldHint>{QUIZ.questions.bank.searchHint}</FieldHint>
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <Label htmlFor="quiz-bank-domain">
                          {COPY.adminQuestions.filters.domain}
                        </Label>
                        <Select
                          id="quiz-bank-domain"
                          value={domain}
                          onChange={(event) => {
                            setDomain(event.target.value as $Enums.QuestionDomain | '');
                            setBankPage(1);
                          }}
                        >
                          <option value="">{COPY.adminCommon.filter.all}</option>
                          {QUESTION_DOMAINS.map((item) => (
                            <option key={item} value={item}>
                              {COPY.adminQuestions.domainLabels[item]}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field>
                        <Label htmlFor="quiz-bank-difficulty">
                          {COPY.adminQuestions.filters.difficulty}
                        </Label>
                        <Select
                          id="quiz-bank-difficulty"
                          value={difficulty}
                          onChange={(event) => {
                            setDifficulty(event.target.value as $Enums.QuestionDifficulty | '');
                            setBankPage(1);
                          }}
                        >
                          <option value="">{COPY.adminCommon.filter.all}</option>
                          {QUESTION_DIFFICULTIES.map((item) => (
                            <option key={item} value={item}>
                              {COPY.adminQuestions.difficultyLabels[item]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    {term.trim() || domain || difficulty ? (
                      <div>
                        <Button type="button" variant="ghost" size="sm" onClick={clearBankFilters}>
                          {COPY.adminCommon.filter.clear}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
                    <p className="text-ink-700 text-sm" role="status" aria-live="polite">
                      {searching
                        ? QUIZ.questions.bank.loading
                        : QUIZ.questions.bank.resultsCount.replace(
                            '{count}',
                            formatNumber(bankTotal),
                          )}
                    </p>
                    {!searching && !term.trim() && !domain && !difficulty && bankTotal > 0 ? (
                      <p className="text-ink-600 text-xs">{QUIZ.questions.bank.latestNote}</p>
                    ) : null}
                  </div>

                  {bankFailed ? (
                    <Notice tone="warning" role="status">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>{QUIZ.questions.bank.loadFailed}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRefreshToken((current) => current + 1)}
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          {QUIZ.questions.bank.refreshAction}
                        </Button>
                      </div>
                    </Notice>
                  ) : null}

                  {!bankFailed && !searching && results.length === 0 ? (
                    <div className="rounded-panel border-line-200 flex flex-col items-start gap-3 border border-dashed p-5">
                      <div>
                        <p className="text-ink-900 font-medium">
                          {QUIZ.questions.empty.noResultsTitle}
                        </p>
                        <p className="text-ink-700 mt-1 text-sm">
                          {QUIZ.questions.empty.noResultsBody}
                        </p>
                      </div>
                      {term.trim() || domain || difficulty ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={clearBankFilters}
                        >
                          {COPY.adminCommon.filter.clear}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {results.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {results.map((item) => {
                        const already = rows.some((row) => row.questionId === item.id);
                        return (
                          <li
                            key={item.id}
                            className={cn(
                              'rounded-panel border-line-200 flex items-start gap-3 border p-3',
                              already && 'border-brand-500 bg-brand-50',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-ink-900 text-sm leading-relaxed">
                                {item.stemExcerpt}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {COPY.adminQuestions.domainLabels[item.domain]}
                                </Badge>
                                <span className="text-ink-600 text-xs">
                                  {COPY.adminQuestions.difficultyLabels[item.difficulty]}
                                </span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={already ? 'secondary' : 'outline'}
                              disabled={already}
                              onClick={() => addQuestion(item)}
                            >
                              {already ? (
                                <Check className="size-4" aria-hidden="true" />
                              ) : (
                                <Plus className="size-4" aria-hidden="true" />
                              )}
                              {already ? QUIZ.questions.bank.addedAction : QUIZ.questions.addAction}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {bankPageCount > 1 ? (
                    <nav
                      aria-label={COPY.adminCommon.pagination.label}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <p className="text-ink-700 text-sm">
                        {COPY.adminCommon.pagination.pageOfTotal
                          .replace('{current}', formatNumber(bankPage))
                          .replace('{total}', formatNumber(bankPageCount))}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={bankPage === 1 || searching}
                          onClick={() => setBankPage((current) => Math.max(1, current - 1))}
                        >
                          {COPY.adminCommon.pagination.previous}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={bankPage === bankPageCount || searching}
                          onClick={() =>
                            setBankPage((current) => Math.min(bankPageCount, current + 1))
                          }
                        >
                          {COPY.adminCommon.pagination.next}
                        </Button>
                      </div>
                    </nav>
                  ) : null}

                  <div className="border-line-200 flex flex-col gap-3 border-t pt-4">
                    <p className="text-ink-700 text-sm">{QUIZ.questions.bank.manageHint}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/admin/questions" target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" aria-hidden="true" />
                          {QUIZ.questions.bank.openAction}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/admin/questions/new" target="_blank" rel="noreferrer">
                          <Plus className="size-4" aria-hidden="true" />
                          {QUIZ.questions.bank.createAction}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={searching}
                        onClick={() => setRefreshToken((current) => current + 1)}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        {QUIZ.questions.bank.refreshAction}
                      </Button>
                    </div>
                  </div>
                </section>

                <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-0">
                  <section className="rounded-panel border-line-200 flex flex-col gap-3 border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-ink-900 font-semibold">
                          {QUIZ.questions.selected.title}
                        </h4>
                        <p className="text-ink-700 mt-1 text-sm">
                          {QUIZ.questions.selected.description}
                        </p>
                      </div>
                      <Badge variant={rows.length > 0 ? 'success' : 'neutral'}>
                        {formatNumber(rows.length)}
                      </Badge>
                    </div>

                    {/* A retired bank item remains selected until a person removes
                        it; silently rewriting a saved quiz would be worse. */}
                    {hasRetired ? (
                      <Notice tone="warning" role="status">
                        {QUIZ.questions.notPublishedNote}
                      </Notice>
                    ) : null}

                    {rows.length === 0 ? (
                      <div className="rounded-control bg-surface-muted p-4">
                        <p className="text-ink-900 text-sm font-medium">
                          {QUIZ.questions.selected.emptyTitle}
                        </p>
                        <p className="text-ink-700 mt-1 text-sm">
                          {QUIZ.questions.selected.emptyBody}
                        </p>
                      </div>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {rows.map((row, index) => (
                          <li
                            key={row.questionId}
                            className="rounded-control border-line-200 flex items-start gap-2 border p-3"
                          >
                            <span
                              className="bg-brand-50 text-brand-700 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                              dir="ltr"
                            >
                              {formatNumber(index + 1)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-ink-900 line-clamp-2 text-sm leading-relaxed">
                                {row.stemExcerpt}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-ink-600 text-xs">
                                  {COPY.adminQuestions.domainLabels[row.domain]}
                                </span>
                                {row.workflow === 'PUBLISHED' ? null : (
                                  <Badge variant="warning">
                                    {QUIZ.questions.notPublishedBadge}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <IconAction
                                label={COPY.adminCourses.reorder.moveUp}
                                icon={ArrowUp}
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                              />
                              <IconAction
                                label={COPY.adminCourses.reorder.moveDown}
                                icon={ArrowDown}
                                disabled={index === rows.length - 1}
                                onClick={() => move(index, 1)}
                              />
                              <IconAction
                                label={QUIZ.questions.removeAction}
                                icon={Trash2}
                                tone="danger"
                                onClick={() => removeQuestion(row.questionId)}
                              />
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <details className="group rounded-panel border-line-200 border">
                    <summary className="focus-visible:outline-brand-500 flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-2">
                      <Settings2 className="text-ink-600 size-5" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-900 block text-sm font-semibold">
                          {QUIZ.advanced.title}
                        </span>
                        <span className="text-ink-600 mt-0.5 block text-xs">
                          {QUIZ.advanced.summary}
                        </span>
                      </span>
                    </summary>

                    <div className="border-line-200 flex flex-col gap-5 border-t p-4">
                      <Field>
                        <Label htmlFor="quiz-feedback">{QUIZ.fields.feedbackMode.label}</Label>
                        <Select
                          id="quiz-feedback"
                          value={feedbackMode}
                          onChange={(event) =>
                            setFeedbackMode(event.target.value as $Enums.FeedbackMode)
                          }
                          aria-describedby="quiz-feedback-hint"
                        >
                          {(['IMMEDIATE', 'AFTER_SUBMISSION'] as const).map((mode) => (
                            <option key={mode} value={mode}>
                              {COPY.adminCourses.feedbackModeLabels[mode]}
                            </option>
                          ))}
                        </Select>
                        <FieldHint id="quiz-feedback-hint">
                          {QUIZ.fields.feedbackMode.hint}
                        </FieldHint>
                      </Field>

                      <Field>
                        <Label htmlFor="quiz-max-attempts">
                          {QUIZ.fields.maxAttempts.label}{' '}
                          <span className="text-ink-600 font-normal">
                            ({COPY.adminCommon.form.optionalMark})
                          </span>
                        </Label>
                        <Input
                          id="quiz-max-attempts"
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          autoComplete="off"
                          value={maxAttempts}
                          onChange={(event) => setMaxAttempts(event.target.value)}
                          aria-describedby="quiz-max-attempts-hint"
                        />
                        <FieldHint id="quiz-max-attempts-hint">
                          {QUIZ.fields.maxAttempts.hint}
                        </FieldHint>
                      </Field>

                      {rows.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-ink-900 text-sm font-medium">
                              {QUIZ.questions.pointsField.groupTitle}
                            </p>
                            <p className="text-ink-700 mt-1 text-xs">
                              {QUIZ.questions.pointsField.hint}
                            </p>
                          </div>
                          {rows.map((row, index) => (
                            <div key={row.questionId} className="flex items-center gap-3">
                              <Label
                                htmlFor={`points-${row.questionId}`}
                                className="min-w-0 flex-1 truncate text-xs font-normal"
                              >
                                {formatNumber(index + 1)}. {row.stemExcerpt}
                              </Label>
                              <Input
                                id={`points-${row.questionId}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={100}
                                dir="ltr"
                                className="w-20"
                                value={String(row.points)}
                                aria-label={`${QUIZ.questions.pointsField.label}: ${row.stemExcerpt}`}
                                onChange={(event) => {
                                  const points = Number(event.target.value);
                                  if (!Number.isInteger(points) || points < 1 || points > 100)
                                    return;
                                  setRows((current) =>
                                    current.map((item) =>
                                      item.questionId === row.questionId
                                        ? { ...item, points }
                                        : item,
                                    ),
                                  );
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </aside>
              </div>
            )}
          </div>

          {!loading && !loadFailed ? (
            <div className="border-line-200 bg-surface flex shrink-0 flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <div className="min-w-0 flex-1" aria-live="polite">
                <p className="text-ink-900 text-sm font-medium">
                  {QUIZ.questions.selected.count.replace('{count}', formatNumber(rows.length))}
                </p>
                {rows.length === 0 ? (
                  <p className="text-ink-700 mt-0.5 text-xs">
                    {COPY.adminCourses.errors.quizNeedsQuestion}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" loading={saving} disabled={rows.length === 0} onClick={save}>
                  {saving ? COPY.adminCommon.actions.saving : QUIZ.saveAction}
                </Button>
                <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
                  {COPY.adminCommon.actions.cancel}
                </Button>

                {exists ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    // Refused by the server once anybody has sat it, because the
                    // attempt rows are a student's record of what they answered.
                    disabled={attemptCount > 0 || saving}
                    onClick={() =>
                      onConfirm({
                        key: `quiz-delete-${lessonId}`,
                        title: QUIZ.confirmDelete.title,
                        body: QUIZ.confirmDelete.body,
                        action: QUIZ.confirmDelete.confirm,
                        danger: true,
                        run: async () => {
                          const result = await send(
                            `/api/admin/lessons/${lessonId}/quiz`,
                            'DELETE',
                          );
                          if (!result.ok) {
                            toast.error(
                              result.error?.message ?? COPY.adminCommon.toast.deleteFailed,
                            );
                            return;
                          }
                          toast.success(QUIZ.toast.deleted);
                          onSaved();
                        },
                      })
                    }
                  >
                    {QUIZ.removeAction}
                  </Button>
                ) : null}
              </div>

              {exists && attemptCount > 0 ? (
                <p className="text-ink-700 text-xs sm:max-w-56">
                  {COPY.adminCourses.errors.deleteBlockedByQuizAttempts}
                </p>
              ) : null}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── One module ───────────────────────────────────────────────────────────

const TRANSITIONS = COPY.adminCourses.transitions;

/**
 * The publication controls for a module or a lesson.
 *
 * The same four confirmations serve both, which is why the copy words them
 * generically: what changes for a student is identical, and the difference
 * between "this module" and "this lesson" is already on screen.
 */
function transitionOptions(
  status: $Enums.ContentStatus,
  run: (next: $Enums.ContentStatus, key: string) => Promise<void>,
  /**
   * Why publishing cannot succeed yet, when it cannot.
   *
   * The server refuses these cases anyway — a module with no published lesson,
   * a lesson with neither a video nor any text. Passing the reason here disables
   * the control and states it up front instead, which matters because the two
   * gates chain: an administrator who adds a unit and an empty lesson is two
   * steps from a publishable module, and discovering that as two separate 409s
   * reads as the screen being broken rather than as work still to do.
   */
  publishBlockedReason?: string,
): Array<PendingConfirm & { label: string; blockedReason?: string }> {
  const options: Array<PendingConfirm & { label: string; blockedReason?: string }> = [];

  if (status !== 'PUBLISHED') {
    options.push({
      key: 'publish',
      label: TRANSITIONS.publish,
      title: TRANSITIONS.publishConfirmTitle,
      body: TRANSITIONS.publishConfirmBody,
      action: TRANSITIONS.publishConfirmAction,
      run: () => run('PUBLISHED', 'published'),
      blockedReason: publishBlockedReason,
    });
  } else {
    options.push({
      key: 'unpublish',
      label: TRANSITIONS.unpublish,
      title: TRANSITIONS.unpublishConfirmTitle,
      body: TRANSITIONS.unpublishConfirmBody,
      action: TRANSITIONS.unpublishConfirmAction,
      run: () => run('DRAFT', 'unpublished'),
    });
  }

  if (status !== 'ARCHIVED') {
    options.push({
      key: 'archive',
      label: TRANSITIONS.archive,
      title: TRANSITIONS.archiveConfirmTitle,
      body: TRANSITIONS.archiveConfirmBody,
      action: TRANSITIONS.archiveConfirmAction,
      run: () => run('ARCHIVED', 'archived'),
    });
  } else {
    options.push({
      key: 'restore',
      label: TRANSITIONS.restore,
      title: TRANSITIONS.restoreConfirmTitle,
      body: TRANSITIONS.restoreConfirmBody,
      action: TRANSITIONS.restoreConfirmAction,
      run: () => run('DRAFT', 'unpublished'),
    });
  }

  return options;
}

function ModuleCard({
  course,
  module,
  index,
  moduleCount,
  reordering,
  onConfirm,
  onRefresh,
  onMoveModule,
  onEditModule,
  onAddLesson,
  onEditLesson,
  onOpenQuiz,
}: {
  course: BuilderCourse;
  module: BuilderModule;
  index: number;
  moduleCount: number;
  reordering: boolean;
  onConfirm: (pending: PendingConfirm) => void;
  onRefresh: () => void;
  onMoveModule: (index: number, delta: number) => void;
  onEditModule: (module: BuilderModule) => void;
  onAddLesson: (moduleId: string) => void;
  onEditLesson: (moduleId: string, lessonId: string) => void;
  onOpenQuiz: (lesson: BuilderLesson) => void;
}) {
  const [savingOrder, setSavingOrder] = useState(false);

  async function moveLesson(lessonIndex: number, delta: number) {
    const ids = module.lessons.map((lesson) => lesson.id);
    const target = lessonIndex + delta;
    if (target < 0 || target >= ids.length) return;
    const [moved] = ids.splice(lessonIndex, 1);
    if (moved) ids.splice(target, 0, moved);

    setSavingOrder(true);
    try {
      const result = await send(`/api/admin/modules/${module.id}/lessons`, 'PATCH', { ids });
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCourses.reorder.failed);
        return;
      }
      toast.success(COPY.adminCourses.lessons.toast.reordered);
      onRefresh();
    } finally {
      setSavingOrder(false);
    }
  }

  async function transitionLesson(
    lesson: BuilderLesson,
    next: $Enums.ContentStatus,
    toastKey: 'published' | 'unpublished' | 'archived',
  ) {
    const result = await send(`/api/admin/lessons/${lesson.id}`, 'PATCH', {
      intent: 'transition',
      status: next,
    });
    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
      return;
    }
    toast.success(
      result.data?.changed
        ? COPY.adminCourses.lessons.toast[toastKey]
        : COPY.adminCommon.toast.noChanges,
    );
    onRefresh();
  }

  /*
   * Six columns, down from ten.
   *
   * The table was every field the lesson has, one per column, plus an action
   * cell holding six text buttons — so the action cell wrapped into a vertical
   * stack, every row stood about three hundred pixels tall, and the whole thing
   * still overflowed its card sideways. Three moves fix that, and each is a
   * judgement about rank rather than a way to save pixels:
   *
   *  1. **Reordering moved into the الترتيب column, as arrows.** The control that
   *     changes a position now sits in the column that shows it, which is where
   *     a reader looks for it anyway — it was previously at the far inline end,
   *     as far from the number as the row allowed.
   *  2. **The lesson's attributes moved under its title.** Duration, video and
   *     the free-preview flag describe the lesson; they are not comparable
   *     across rows the way a status or a threshold is, and giving each its own
   *     column bought three headers and a scrollbar to state three facts that
   *     read better as one line.
   *  3. **آخر تحديث dropped.** It was a three-line wrap in a narrow column and
   *     it answers a question a builder screen does not raise — the person
   *     reading it is the person who made the change. It remains in the audit
   *     log, which is where "who changed what, when" actually belongs.
   *
   * Nothing was hidden behind a menu. Every action is still one click away, so
   * no discoverability was traded for the space.
   */
  const lessonColumns: readonly DataTableColumn<BuilderLesson>[] = [
    {
      key: 'position',
      header: COPY.adminCourses.lessons.columns.position,
      className: 'w-px whitespace-nowrap',
      cell: (lesson) => {
        const lessonIndex = module.lessons.indexOf(lesson);
        return (
          <span className="flex items-center gap-0.5">
            <span className="text-ink-600 w-4 text-xs" dir="ltr">
              {formatNumber(lessonIndex + 1)}
            </span>
            <IconAction
              label={COPY.adminCourses.reorder.moveUp}
              icon={ArrowUp}
              disabled={lessonIndex === 0 || savingOrder}
              onClick={() => void moveLesson(lessonIndex, -1)}
            />
            <IconAction
              label={COPY.adminCourses.reorder.moveDown}
              icon={ArrowDown}
              disabled={lessonIndex === module.lessons.length - 1 || savingOrder}
              onClick={() => void moveLesson(lessonIndex, 1)}
            />
          </span>
        );
      },
    },
    {
      key: 'title',
      header: COPY.adminCourses.lessons.columns.title,
      isRowHeader: true,
      /*
       * `w-full` makes this the column that absorbs the slack, and `min-w` is a
       * floor rather than a width.
       *
       * Every other column is `whitespace-nowrap`, so their widths are fixed by
       * their content and the title was the only column left to squeeze — at
       * 820px it collapsed to about four characters and set each title one word
       * per line. The floor stops that; the table's own scroll region takes the
       * overflow, which is the honest outcome for a six-column table on a narrow
       * screen. The floor is deliberately modest: raising it to 15rem pushed the
       * sum of the minimums past the desktop width too, which put the horizontal
       * scrollbar back on the screen this redesign removed it from.
       */
      className: 'w-full min-w-[10rem]',
      cell: (lesson) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-ink-900">{lesson.title}</span>

          {/*
            The lesson's own attributes, as one muted line. `text-ink-700` and
            not `ink-600`: this is the smallest text on the row and it has to
            keep clearing 4.5:1 on the hover ground as well as on white.
          */}
          <span className="text-ink-700 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {/*
              Each fact carries its own glyph, because a meta line is read as a
              run of values with no headers above them: a bare «غير متاح» here
              said nothing about *what* was unavailable. A duration that does not
              exist is simply left out rather than printed as an absence — the
              row already says «بلا مقطع», which is the reason for it.
            */}
            {lesson.durationSec === null ? null : (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                <span dir="ltr">{formatDurationWords(lesson.durationSec)}</span>
              </span>
            )}

            {lesson.videoAssetId === null ? (
              <span>{COPY.adminCourses.lessons.video.none}</span>
            ) : lesson.videoReady ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MonitorPlay className="size-3.5 shrink-0" aria-hidden="true" />
                {/* A provider filename can be long; the column is not. */}
                <span className="max-w-[14rem] truncate">
                  {lesson.videoTitle ?? COPY.adminCourses.lessons.video.ready}
                </span>
              </span>
            ) : (
              <Badge variant="warning">{COPY.adminCourses.lessons.video.notReady}</Badge>
            )}

            {/*
              Shown only when true. A «لا» in every row of a column nobody scans
              is the least useful cell a table can carry, and as a chip the flag
              now reads as a property of the lesson rather than as an answer to
              a question.
            */}
            {lesson.isPreview ? (
              <Badge variant="teal" shape="square">
                {COPY.adminCourses.lessons.columns.isPreview}
              </Badge>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: COPY.adminCourses.lessons.columns.status,
      className: 'whitespace-nowrap',
      cell: (lesson) => <ContentStatusBadge status={lesson.status} />,
    },
    {
      key: 'threshold',
      header: COPY.adminCourses.threshold.effectiveLabel,
      className: 'whitespace-nowrap',
      // The effective number and its source together. A bare percentage in this
      // column would leave the reader unable to tell an override from the course
      // default, which is the one thing this column exists to answer.
      cell: (lesson) => (
        <span className="flex flex-col">
          <span dir="ltr">
            {formatPercent(
              (lesson.completionThresholdPercent ?? course.completionThresholdPercent) / 100,
            )}
          </span>
          <span className="text-ink-700 text-xs">
            {lesson.completionThresholdPercent === null
              ? COPY.adminCourses.threshold.inherited
              : COPY.adminCourses.threshold.overridden}
          </span>
        </span>
      ),
    },
    {
      key: 'quiz',
      header: COPY.adminCourses.lessons.columns.quiz,
      className: 'whitespace-nowrap',
      cell: (lesson) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenQuiz(lesson)}>
          {lesson.quizQuestionCount === null
            ? QUIZ.createAction
            : `${QUIZ.questions.title} (${formatNumber(lesson.quizQuestionCount)})`}
        </Button>
      ),
    },
    {
      key: 'actions',
      header: COPY.adminCourses.lessons.columns.actions,
      headerHidden: true,
      align: 'end',
      // `whitespace-nowrap` is what keeps this cell one line. Without it the
      // buttons wrap the moment the viewport narrows, which is the stack this
      // redesign exists to remove; the table's own scroll region handles the
      // overflow instead, which is what it is for.
      className: 'whitespace-nowrap',
      cell: (lesson) => {
        const options = transitionOptions(
          lesson.status,
          (next, key) =>
            transitionLesson(lesson, next, key as 'published' | 'unpublished' | 'archived'),
          // The same condition `transitionLessonStatus` enforces server-side.
          !lesson.hasContent && lesson.videoAssetId === null
            ? COPY.adminCourses.errors.lessonNeedsContentToPublish
            : undefined,
        );

        return (
          <span className="inline-flex items-center justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onEditLesson(module.id, lesson.id)}
            >
              {COPY.adminCommon.actions.edit}
            </Button>
            {options.map(({ blockedReason, ...option }) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant="outline"
                // `blockedReason` is destructured out rather than spread on:
                // it explains the control, it is not part of the confirmation
                // the dialog receives.
                disabled={Boolean(blockedReason)}
                title={blockedReason}
                onClick={() => onConfirm({ ...option, key: `${option.key}-${lesson.id}` })}
              >
                {option.label}
              </Button>
            ))}
            <IconAction
              label={COPY.adminCommon.actions.delete}
              icon={Trash2}
              tone="danger"
              // Stated before the button is pressed rather than after: a lesson
              // somebody has watched is not deletable, and the note under the
              // table says which obstacle applies.
              disabled={lesson.progressCount > 0 || lesson.quizAttemptCount > 0}
              onClick={() =>
                onConfirm({
                  key: `lesson-delete-${lesson.id}`,
                  title: COPY.adminCourses.lessons.confirmDelete.title,
                  body: COPY.adminCourses.lessons.confirmDelete.body,
                  action: COPY.adminCourses.lessons.confirmDelete.confirm,
                  danger: true,
                  run: async () => {
                    const result = await send(`/api/admin/lessons/${lesson.id}`, 'DELETE');
                    if (!result.ok) {
                      toast.error(result.error?.message ?? COPY.adminCommon.toast.deleteFailed);
                      return;
                    }
                    toast.success(COPY.adminCourses.lessons.toast.deleted);
                    onRefresh();
                  },
                })
              }
            />
          </span>
        );
      },
    },
  ];

  const moduleOptions = transitionOptions(
    module.status,
    async (next, key) => {
      const result = await send(`/api/admin/modules/${module.id}`, 'PATCH', {
        intent: 'transition',
        status: next,
      });
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCommon.toast.updateFailed);
        return;
      }
      toast.success(
        result.data?.changed
          ? COPY.adminCourses.modules.toast[key as 'published' | 'unpublished' | 'archived']
          : COPY.adminCommon.toast.noChanges,
      );
      onRefresh();
    },
    // The same condition `transitionModuleStatus` enforces server-side. The row
    // already shows "دروس منشورة ٠"; this stops that count being something the
    // reader has to connect to a refusal on their own.
    module.publishedLessonCount === 0
      ? COPY.adminCourses.errors.moduleNeedsLessonToPublish
      : undefined,
  );

  const blockedLessons = module.lessons.filter(
    (lesson) => lesson.progressCount > 0 || lesson.quizAttemptCount > 0,
  );

  return (
    <Card className="flex flex-col gap-4 p-5">
      {/*
        Two rows, not one.

        Everything used to sit on a single wrapping line: an ordinal, the title,
        a badge, three statistics and seven buttons. At any real width that line
        broke wherever it happened to run out of room, so the title — the one
        thing that identifies the card — ended up crowded between a badge and a
        button. Identity goes on the first row with the controls that act on it,
        and the statistics get their own quieter line beneath.
      */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-ink-600 text-xs" dir="ltr">
            {formatNumber(index + 1)}
          </span>
          <h3 className="text-ink-900 min-w-0 text-base font-semibold">{module.title}</h3>
          <ContentStatusBadge status={module.status} />
        </div>

        <span className="flex flex-wrap items-center gap-1">
          <IconAction
            label={COPY.adminCourses.reorder.moveUp}
            icon={ArrowUp}
            disabled={index === 0 || reordering}
            onClick={() => onMoveModule(index, -1)}
          />
          <IconAction
            label={COPY.adminCourses.reorder.moveDown}
            icon={ArrowDown}
            disabled={index === moduleCount - 1 || reordering}
            onClick={() => onMoveModule(index, 1)}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => onEditModule(module)}>
            {COPY.adminCommon.actions.edit}
          </Button>
          {moduleOptions.map(({ blockedReason, ...option }) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(blockedReason)}
              title={blockedReason}
              onClick={() => onConfirm({ ...option, key: `${option.key}-${module.id}` })}
            >
              {option.label}
            </Button>
          ))}
          <IconAction
            label={COPY.adminCommon.actions.delete}
            icon={Trash2}
            tone="danger"
            disabled={module.progressCount > 0 || module.quizAttemptCount > 0}
            onClick={() =>
              onConfirm({
                key: `module-delete-${module.id}`,
                title: COPY.adminCourses.modules.confirmDelete.title,
                body: COPY.adminCourses.modules.confirmDelete.body,
                action: COPY.adminCourses.modules.confirmDelete.confirm,
                danger: true,
                run: async () => {
                  const result = await send(`/api/admin/modules/${module.id}`, 'DELETE');
                  if (!result.ok) {
                    toast.error(result.error?.message ?? COPY.adminCommon.toast.deleteFailed);
                    return;
                  }
                  toast.success(COPY.adminCourses.modules.toast.deleted);
                  onRefresh();
                },
              })
            }
          />
          {/* The one filled button on the card: adding a lesson is what an
              administrator opens a module to do. */}
          <Button type="button" size="sm" onClick={() => onAddLesson(module.id)}>
            {COPY.adminCourses.lessons.createAction}
          </Button>
        </span>
      </div>

      <dl className="text-ink-700 border-line-200 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b pb-3 text-xs">
        <span className="flex gap-1">
          <dt>{COPY.adminCourses.columns.lessonCount}</dt>
          <dd className="text-ink-900 font-medium">{formatNumber(module.lessons.length)}</dd>
        </span>
        <span className="flex gap-1">
          <dt>{COPY.adminCourses.columns.publishedLessonCount}</dt>
          <dd className="text-ink-900 font-medium">{formatNumber(module.publishedLessonCount)}</dd>
        </span>
        <span className="flex gap-1">
          <dt>{COPY.adminCourses.columns.duration}</dt>
          <dd className="text-ink-900 font-medium">
            {module.durationSec > 0
              ? formatDurationWords(module.durationSec)
              : COPY.common.notAvailable}
          </dd>
        </span>
      </dl>

      {module.progressCount > 0 || module.quizAttemptCount > 0 ? (
        <p className="text-ink-700 text-sm">
          {module.progressCount > 0
            ? COPY.adminCourses.errors.deleteBlockedByProgress
            : COPY.adminCourses.errors.deleteBlockedByQuizAttempts}
        </p>
      ) : null}

      <DataTable
        caption={`${module.title} — ${COPY.adminCommon.table.captionSuffix}`}
        columns={lessonColumns}
        rows={module.lessons}
        getRowKey={(lesson) => lesson.id}
        // The table sits inside the module's own card, so it keeps its border
        // and drops its shadow: two stacked shadows is what made the nesting
        // read as muddy rather than as one panel containing a list.
        className="shadow-none"
        empty={
          <EmptyState
            title={COPY.adminCourses.lessons.empty.nothingYetTitle}
            description={COPY.adminCourses.lessons.empty.nothingYetBody}
            action={
              <Button type="button" onClick={() => onAddLesson(module.id)}>
                {COPY.adminCourses.lessons.empty.nothingYetAction}
              </Button>
            }
          />
        }
      />

      {blockedLessons.length > 0 ? (
        <p className="text-ink-700 text-xs">{COPY.adminCourses.errors.deleteBlockedByProgress}</p>
      ) : null}
    </Card>
  );
}

// ── The screen ───────────────────────────────────────────────────────────

export function CourseBuilder({
  course,
  videoOptions,
  videoEnabled,
  videoLibraryId,
  videoCanConfirm,
}: {
  course: BuilderCourse;
  videoOptions: readonly LessonFormVideo[];
  /** False when no video provider is configured for this environment. */
  videoEnabled: boolean;
  /*
   * Passed straight through to `LessonForm`, which registers a video from a
   * dialog on its own video field. The builder never reads either value — they
   * are here because the page is the only thing that can read server
   * configuration, and the lesson form is where the need for it appears.
   */
  videoLibraryId: string | null;
  videoCanConfirm: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [reordering, setReordering] = useState(false);
  const [moduleEditor, setModuleEditor] = useState<{ module?: BuilderModule } | null>(null);
  const [lessonEditor, setLessonEditor] = useState<{
    moduleId: string;
    lessonId?: string;
  } | null>(null);
  const [quizLesson, setQuizLesson] = useState<BuilderLesson | null>(null);

  function refresh() {
    router.refresh();
  }

  async function moveModule(index: number, delta: number) {
    const ids = course.modules.map((module) => module.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const [moved] = ids.splice(index, 1);
    if (moved) ids.splice(target, 0, moved);

    setReordering(true);
    try {
      const result = await send(`/api/admin/courses/${course.id}/modules`, 'PATCH', { ids });
      if (!result.ok) {
        toast.error(result.error?.message ?? COPY.adminCourses.reorder.failed);
        return;
      }
      toast.success(COPY.adminCourses.modules.toast.reordered);
      refresh();
    } finally {
      setReordering(false);
    }
  }

  const moduleOptionsForForm = course.modules.map((module) => ({
    id: module.id,
    title: module.title,
  }));
  const hasPreview = course.modules.some((module) =>
    module.lessons.some((lesson) => lesson.isPreview),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* The gate that is easiest to forget. A perfectly published lesson inside
          a draft product reaches nobody, and an administrator who cannot find
          their course needs to be told which of the two gates is shut. */}
      {course.productStatus !== 'PUBLISHED' ? (
        <Notice tone="warning" role="note">
          {COPY.adminCourses.notices.draftProductNote}
        </Notice>
      ) : null}

      <Notice tone="neutral" role="note">
        {COPY.adminCourses.notices.publishGateNote}
      </Notice>

      {hasPreview ? (
        <Notice tone="neutral" role="note">
          {COPY.adminCourses.notices.previewNote}
        </Notice>
      ) : null}

      {/*
        Rendered last rather than here in the flow: it portals to the body, so
        its position in this tree decides nothing visually, and leaving it
        between two sections invited the next reader to treat it as one.
      */}

      <CourseSettingsForm course={course} onSaved={refresh} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-ink-900 text-lg font-semibold">
              {COPY.adminCourses.modules.title}
            </h2>
            <p className="text-ink-700 max-w-prose text-sm">
              {COPY.adminCourses.modules.description}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <span className="text-ink-600 text-xs">
              {reordering ? COPY.adminCourses.reorder.saving : COPY.adminCourses.reorder.hint}
            </span>
            <Button type="button" onClick={() => setModuleEditor({})}>
              {COPY.adminCourses.modules.createAction}
            </Button>
          </div>
        </div>

        {moduleEditor ? (
          <ModuleTitleForm
            courseId={course.id}
            module={moduleEditor.module}
            onSaved={() => {
              setModuleEditor(null);
              refresh();
            }}
            onCancel={() => setModuleEditor(null)}
          />
        ) : null}

        {course.modules.length === 0 ? (
          <EmptyState
            title={COPY.adminCourses.modules.empty.nothingYetTitle}
            description={COPY.adminCourses.modules.empty.nothingYetBody}
            action={
              <Button type="button" onClick={() => setModuleEditor({})}>
                {COPY.adminCourses.modules.empty.nothingYetAction}
              </Button>
            }
          />
        ) : (
          course.modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              course={course}
              module={module}
              index={index}
              moduleCount={course.modules.length}
              reordering={reordering}
              onConfirm={setPending}
              onRefresh={refresh}
              onMoveModule={(from, delta) => void moveModule(from, delta)}
              onEditModule={(target) => setModuleEditor({ module: target })}
              onAddLesson={(moduleId) => setLessonEditor({ moduleId })}
              onEditLesson={(moduleId, lessonId) => setLessonEditor({ moduleId, lessonId })}
              onOpenQuiz={setQuizLesson}
            />
          ))
        )}
      </section>

      {lessonEditor ? (
        <LessonForm
          key={lessonEditor.lessonId ?? `new-${lessonEditor.moduleId}`}
          moduleId={lessonEditor.moduleId}
          lessonId={lessonEditor.lessonId}
          modules={moduleOptionsForForm}
          videoOptions={videoOptions}
          videoEnabled={videoEnabled}
          videoLibraryId={videoLibraryId}
          videoCanConfirm={videoCanConfirm}
          courseThresholdPercent={course.completionThresholdPercent}
          onSaved={() => {
            setLessonEditor(null);
            refresh();
          }}
          onCancel={() => setLessonEditor(null)}
        />
      ) : null}

      {quizLesson ? (
        <LessonQuizEditor
          key={quizLesson.id}
          lessonId={quizLesson.id}
          lessonTitle={quizLesson.title}
          onConfirm={setPending}
          onSaved={() => {
            setQuizLesson(null);
            refresh();
          }}
          onCancel={() => setQuizLesson(null)}
        />
      ) : null}

      <Notice tone="neutral" role="note">
        {COPY.adminCommon.notices.auditedAction}
      </Notice>

      <p className="text-ink-700 text-sm">
        <Link href={`/admin/products/${course.productId}`} className="text-brand-700 underline">
          {COPY.adminCourses.openProduct}
        </Link>
      </p>

      {pending ? <ConfirmPanel pending={pending} onCancel={() => setPending(null)} /> : null}
    </div>
  );
}
