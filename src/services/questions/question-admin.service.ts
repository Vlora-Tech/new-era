import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { parseRichText, type RichText } from '@/lib/exam/content';
import {
  AUDIT_ACTIONS,
  auditChanges,
  writeAuditLog,
  type AuditMetadata,
} from '@/services/audit/audit.service';
import type {
  CreateQuestionInput,
  QuestionListQuery,
  QuestionOptionInput,
  UpdateQuestionInput,
} from '@/validators/admin-question';

/**
 * The question bank's editable head row.
 *
 * A `Question` is a draft that an editor owns; it is never what a student is
 * served. Publishing freezes a `QuestionVersion` and that snapshot is what the
 * exam engine copies into an attempt (see `question-publish.service.ts` and
 * `attempt-snapshot.service.ts`). Everything in this file therefore edits
 * *authoring* state only, and none of it can change an exam that is already
 * running — which is precisely why editing a published question is permitted at
 * all instead of being locked behind a clone.
 *
 * Two things this module owns and the route handlers do not:
 *
 *  - **Text conversion.** `Question.stem`, `explanation`, `hint` and
 *    `QuestionOption.content` are `Json` holding the `RichText` documents
 *    described in `src/lib/exam/content.ts`. The validators accept plain Arabic
 *    strings, so the wrapping happens here. It is deliberately not a Zod
 *    `.transform()`: react-hook-form submits a schema's *output*, so a transform
 *    would make the browser post a document to a handler whose identical schema
 *    expects a string.
 *  - **The "exactly one correct option" rule**, re-checked before every write.
 *    The Zod schema states it and a partial unique index on `question_options`
 *    enforces it; checking here too is what turns a race or a non-form write
 *    path into an Arabic message rather than a unique-violation 500 with the
 *    editor's work lost.
 */

/** Who is acting. `id` is stamped onto `createdById`; `email` is snapshotted into the trail. */
export type QuestionAdminActor = { id: string; email: string };

export type QuestionAdminContext = {
  actor: QuestionAdminActor;
  requestId?: string;
};

// ───────────────────────────── Text conversion ─────────────────────────────

/**
 * Wrap authored Arabic into a `RichText` document.
 *
 * A blank line starts a new paragraph — that is what the field hint tells the
 * editor, and it is the only structural mark the plain-text editor has. Single
 * newlines inside a paragraph collapse to spaces so the stored document says
 * what will actually be rendered: a lone newline has no meaning in the renderer,
 * and storing one would make the data and the screen disagree.
 */
export function toRichText(value: string): RichText {
  const paragraphs = value
    .split(/\r?\n[ \t]*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);

  return {
    blocks: paragraphs.map((text) => ({
      type: 'paragraph' as const,
      children: [{ type: 'text' as const, text }],
    })),
  };
}

/**
 * Project a stored document back into the text the editor types.
 *
 * Distinct from `richTextToPlain`, which flattens to one line for aria labels
 * and log entries. This one is the inverse of `toRichText`: paragraphs separated
 * by a blank line, so the round trip through the form is a fixpoint.
 *
 * A `math` inline is rendered as its TeX source and an `ltr` inline as its text,
 * because the editor has no way to express either. That loss is contained by
 * `preserveAuthoredDocument` below rather than being accepted.
 */
export function richTextToEditable(value: unknown): string {
  return parseRichText(value)
    .blocks.map((block) =>
      block.children
        .map((child) => (child.type === 'math' ? child.tex : child.text))
        .join('')
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0)
    .join('\n\n');
}

/**
 * Keep the stored document when the editor did not actually retype the field.
 *
 * The seeded bank contains `math` and `ltr` inlines that the plain-text editor
 * can only show as their source. Without this check, opening a question with a
 * formula in it and pressing save — changing nothing — would rewrite
 * `\frac{a}{b}` from a math node into literal characters, and every equation in
 * the bank would quietly degrade the first time somebody fixed a typo elsewhere
 * on the same question.
 *
 * So: if the submitted string is exactly the projection of what is stored, the
 * stored document is kept byte for byte. If it differs, the editor genuinely
 * rewrote the field and gets plain paragraphs — which is what they typed and
 * what they are looking at.
 */
function preserveAuthoredDocument(submitted: string, stored: Prisma.JsonValue | null): RichText {
  if (stored !== null && richTextToEditable(stored) === submitted) {
    return parseRichText(stored);
  }
  return toRichText(submitted);
}

/** `RichText` is structurally valid JSON; Prisma still wants the input type. */
function toJson(document: RichText): Prisma.InputJsonValue {
  return document as unknown as Prisma.InputJsonValue;
}

/** `DbNull` writes SQL NULL into a nullable `Json` column; `null` alone will not. */
function toNullableJson(document: RichText | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return document === null ? Prisma.DbNull : toJson(document);
}

// ─────────────────────────────── Invariants ────────────────────────────────

/**
 * Re-state the option rules the schema already carries.
 *
 * `questionOptionsSchema` refuses both of these at the edge, so in practice this
 * only fires for a caller that bypassed the form. It exists because the
 * alternative failure is a PostgreSQL unique violation surfacing as a generic
 * 500, and an editor who has just lost a rewritten question deserves better than
 * "حدث خطأ غير متوقع".
 */
function assertOptionRules(options: readonly QuestionOptionInput[]): void {
  if (options.length < 2) {
    throw new HttpError(400, COPY.adminQuestions.errors.needsTwoOptions, 'needs_two_options');
  }
  if (options.filter((option) => option.isCorrect).length !== 1) {
    throw new HttpError(
      400,
      COPY.adminQuestions.errors.needsExactlyOneCorrect,
      'needs_exactly_one_correct',
    );
  }
}

/** A stimulus is shared by several questions, so a bad reference is refused by name. */
async function assertStimulusExists(
  tx: PrismaTransaction,
  stimulusId: string | null,
): Promise<void> {
  if (!stimulusId) return;

  const stimulus = await tx.questionStimulus.findUnique({
    where: { id: stimulusId },
    select: { id: true },
  });
  if (!stimulus) {
    throw new HttpError(400, COPY.adminQuestions.errors.stimulusNotFound, 'stimulus_not_found');
  }
}

// ───────────────────────────────── Listing ─────────────────────────────────

export type QuestionListItem = {
  id: string;
  /** First line of the stem, for the table. Never the whole document. */
  stemExcerpt: string;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
  workflow: $Enums.QuestionWorkflow;
  /** 0 means no frozen version is being served. */
  currentVersion: number;
  authorOrLicensor: string;
  updatedAt: Date;
};

export type QuestionListResult = {
  items: QuestionListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

type QuestionListRow = {
  id: string;
  stem: Prisma.JsonValue;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
  workflow: $Enums.QuestionWorkflow;
  currentVersion: number;
  authorOrLicensor: string;
  updatedAt: Date;
};

const STEM_EXCERPT_LENGTH = 160;

function excerpt(stem: Prisma.JsonValue): string {
  const plain = richTextToEditable(stem).replace(/\s+/g, ' ').trim();
  return plain.length > STEM_EXCERPT_LENGTH ? `${plain.slice(0, STEM_EXCERPT_LENGTH)}…` : plain;
}

/**
 * Escape the wildcards `ILIKE` understands.
 *
 * Without this, a search for `%` matches the whole bank and a search for `_`
 * matches every single character — the reader would read that as a fact about
 * the data rather than as a pattern they accidentally wrote.
 */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

/**
 * The list query, written as SQL rather than through Prisma's query API.
 *
 * The search has to reach the stem, and the stem is a `Json` column holding a
 * document tree. Prisma's JSON filters address one value at a known path, which
 * a paragraph tree does not have, so there is no expressible `where` for "the
 * question text contains this word". Serialising the column with `::text` and
 * matching that is the one thing PostgreSQL will do in a single indexed pass.
 *
 * The trade is that the pattern also sees the document's own structural keys —
 * `blocks`, `paragraph`, `children`. An Arabic search term cannot collide with
 * them, and the alternatives (a second denormalised column, or pulling ids into
 * an unbounded `IN` list) cost more than the collision is worth.
 *
 * Rows and count run in one transaction so the total describes the same moment
 * as the page, rather than a page from before an insert and a count from after.
 */
export async function listQuestions(query: QuestionListQuery): Promise<QuestionListResult> {
  const conditions: Prisma.Sql[] = [];

  if (query.domain) conditions.push(Prisma.sql`q."domain" = ${query.domain}::"QuestionDomain"`);
  if (query.difficulty) {
    conditions.push(Prisma.sql`q."difficulty" = ${query.difficulty}::"QuestionDifficulty"`);
  }
  if (query.track) conditions.push(Prisma.sql`q."track" = ${query.track}::"QuestionTrack"`);
  if (query.workflow) {
    conditions.push(Prisma.sql`q."workflow" = ${query.workflow}::"QuestionWorkflow"`);
  }

  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(Prisma.sql`(
      q."stem"::text ILIKE ${pattern}
      OR q."subskill" ILIKE ${pattern}
      OR q."authorOrLicensor" ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM unnest(q."tags") AS tag WHERE tag ILIKE ${pattern})
    )`);
  }

  const where = conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, ' AND ');
  const perPage = query.perPage;
  const offset = (query.page - 1) * perPage;

  const [rows, totals] = await prisma.$transaction([
    prisma.$queryRaw<QuestionListRow[]>`
      SELECT
        q."id",
        q."stem",
        q."domain",
        q."difficulty",
        q."track",
        q."workflow",
        q."currentVersion",
        q."authorOrLicensor",
        q."updatedAt"
      FROM "questions" q
      WHERE ${where}
      ORDER BY q."updatedAt" DESC, q."id" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "questions" q WHERE ${where}
    `,
  ]);

  const total = totals[0]?.total ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      stemExcerpt: excerpt(row.stem),
      domain: row.domain,
      difficulty: row.difficulty,
      track: row.track,
      workflow: row.workflow,
      currentVersion: row.currentVersion,
      authorOrLicensor: row.authorOrLicensor,
      updatedAt: row.updatedAt,
    })),
    total,
    page: query.page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ────────────────────────────────── Detail ─────────────────────────────────

export type QuestionDetail = {
  id: string;
  stem: string;
  /**
   * Carries `isCorrect`. Every caller of this function is behind
   * `requireAdmin()`; nothing student-facing reads it, and the delivery path has
   * its own select (`STUDENT_QUESTION_SELECT`) that cannot express the column.
   */
  options: Array<{ id: string; content: string; isCorrect: boolean; position: number }>;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
  subskill: string | null;
  explanation: string | null;
  hint: string | null;
  tags: string[];
  estimatedSeconds: number | null;
  shuffleOptions: boolean;
  stimulusId: string | null;
  stimulus: { id: string; type: $Enums.StimulusType; title: string | null } | null;
  authorOrLicensor: string;
  provenanceNote: string | null;
  rightsDeclaration: $Enums.RightsDeclaration | null;
  workflow: $Enums.QuestionWorkflow;
  currentVersion: number;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  createdByName: string | null;
  publishedAt: Date | null;
  retiredAt: Date | null;
  updatedAt: Date;
  /** Everything that would break if this row were removed. */
  usage: {
    versions: number;
    examSections: number;
    lessonQuizzes: number;
    attempts: number;
  };
  /**
   * Why deletion is unavailable, or `none` when it is not.
   *
   * A reason rather than a boolean, because the two refusals need different
   * sentences: an item something points at can only ever be retired, while an
   * item merely sitting in review becomes deletable again the moment it is
   * returned to the editor. A single flag would force the screen to guess, and a
   * screen that guesses says "this is used elsewhere" about a question nothing
   * uses. Computed here so the screen and `deleteQuestion` cannot disagree — the
   * endpoint re-derives it anyway, since a hidden button is not authorization.
   */
  deleteBlock: 'none' | 'in_use' | 'not_a_draft';
};

const QUESTION_DETAIL_SELECT = {
  id: true,
  stem: true,
  domain: true,
  difficulty: true,
  track: true,
  subskill: true,
  explanation: true,
  hint: true,
  tags: true,
  estimatedSeconds: true,
  shuffleOptions: true,
  stimulusId: true,
  authorOrLicensor: true,
  provenanceNote: true,
  rightsDeclaration: true,
  workflow: true,
  currentVersion: true,
  reviewNote: true,
  reviewedAt: true,
  publishedAt: true,
  retiredAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  stimulus: { select: { id: true, type: true, title: true } },
  options: {
    orderBy: { position: 'asc' },
    select: { id: true, content: true, isCorrect: true, position: true },
  },
  _count: {
    select: {
      versions: true,
      examSectionUses: true,
      lessonQuizUses: true,
      attemptQuestions: true,
    },
  },
} as const satisfies Prisma.QuestionSelect;

export async function getQuestionDetail(questionId: string): Promise<QuestionDetail> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: QUESTION_DETAIL_SELECT,
  });

  if (!question) {
    throw new HttpError(404, COPY.adminQuestions.errors.notFound, 'question_not_found');
  }

  const usage = {
    versions: question._count.versions,
    examSections: question._count.examSectionUses,
    lessonQuizzes: question._count.lessonQuizUses,
    attempts: question._count.attemptQuestions,
  };

  return {
    id: question.id,
    stem: richTextToEditable(question.stem),
    options: question.options.map((option) => ({
      id: option.id,
      content: richTextToEditable(option.content),
      isCorrect: option.isCorrect,
      position: option.position,
    })),
    domain: question.domain,
    difficulty: question.difficulty,
    track: question.track,
    subskill: question.subskill,
    explanation: question.explanation === null ? null : richTextToEditable(question.explanation),
    hint: question.hint === null ? null : richTextToEditable(question.hint),
    tags: question.tags,
    estimatedSeconds: question.estimatedSeconds,
    shuffleOptions: question.shuffleOptions,
    stimulusId: question.stimulusId,
    stimulus: question.stimulus,
    authorOrLicensor: question.authorOrLicensor,
    provenanceNote: question.provenanceNote,
    rightsDeclaration: question.rightsDeclaration,
    workflow: question.workflow,
    currentVersion: question.currentVersion,
    reviewNote: question.reviewNote,
    reviewedAt: question.reviewedAt,
    reviewedByName: question.reviewedBy?.name ?? null,
    createdByName: question.createdBy?.name ?? null,
    publishedAt: question.publishedAt,
    retiredAt: question.retiredAt,
    updatedAt: question.updatedAt,
    usage,
    deleteBlock: deleteBlockFor(
      { workflow: question.workflow, currentVersion: question.currentVersion },
      usage,
    ),
  };
}

/** Stimuli an editor may attach, for the editor's picker. */
export async function listStimulusOptions(): Promise<
  Array<{ id: string; type: $Enums.StimulusType; title: string | null }>
> {
  return prisma.questionStimulus.findMany({
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, type: true, title: true },
    // A picker, not a browser. A bank with thousands of passages needs its own
    // screen; silently listing the first hundred is better than a select
    // element that takes a second to open.
    take: 100,
  });
}

// ─────────────────────────────── Audit shapes ──────────────────────────────

/**
 * The fields an audit row may record about a question.
 *
 * An explicit list rather than the row itself: `auditChanges` diffs only what is
 * named here, so a column added to the model later cannot ride into a table that
 * is read far more widely than the question it describes.
 */
const AUDITED_FIELDS = [
  'stem',
  'optionCount',
  'correctOptionPosition',
  'domain',
  'difficulty',
  'track',
  'subskill',
  'explanation',
  'hint',
  'tags',
  'estimatedSeconds',
  'shuffleOptions',
  'stimulusId',
  'authorOrLicensor',
  'provenanceNote',
  'rightsDeclaration',
] as const;

type AuditShape = Record<string, unknown>;

function auditShapeFromInput(input: CreateQuestionInput | UpdateQuestionInput): AuditShape {
  return {
    stem: input.stem,
    optionCount: input.options.length,
    correctOptionPosition: input.options.findIndex((option) => option.isCorrect) + 1,
    domain: input.domain,
    difficulty: input.difficulty,
    track: input.track,
    subskill: input.subskill,
    explanation: input.explanation,
    hint: input.hint,
    tags: input.tags,
    estimatedSeconds: input.estimatedSeconds,
    shuffleOptions: input.shuffleOptions,
    stimulusId: input.stimulusId,
    authorOrLicensor: input.authorOrLicensor,
    provenanceNote: input.provenanceNote,
    rightsDeclaration: input.rightsDeclaration,
  };
}

type StoredQuestionShape = {
  stem: Prisma.JsonValue;
  explanation: Prisma.JsonValue | null;
  hint: Prisma.JsonValue | null;
  domain: $Enums.QuestionDomain;
  difficulty: $Enums.QuestionDifficulty;
  track: $Enums.QuestionTrack;
  subskill: string | null;
  tags: string[];
  estimatedSeconds: number | null;
  shuffleOptions: boolean;
  stimulusId: string | null;
  authorOrLicensor: string;
  provenanceNote: string | null;
  rightsDeclaration: $Enums.RightsDeclaration | null;
  options: Array<{ isCorrect: boolean; position: number }>;
};

function auditShapeFromRow(question: StoredQuestionShape): AuditShape {
  return {
    stem: richTextToEditable(question.stem),
    optionCount: question.options.length,
    correctOptionPosition: question.options.find((option) => option.isCorrect)?.position ?? null,
    domain: question.domain,
    difficulty: question.difficulty,
    track: question.track,
    subskill: question.subskill,
    explanation: question.explanation === null ? null : richTextToEditable(question.explanation),
    hint: question.hint === null ? null : richTextToEditable(question.hint),
    tags: question.tags,
    estimatedSeconds: question.estimatedSeconds,
    shuffleOptions: question.shuffleOptions,
    stimulusId: question.stimulusId,
    authorOrLicensor: question.authorOrLicensor,
    provenanceNote: question.provenanceNote,
    rightsDeclaration: question.rightsDeclaration,
  };
}

// ─────────────────────────────── Mutations ─────────────────────────────────

export async function createQuestion(
  input: CreateQuestionInput,
  context: QuestionAdminContext,
): Promise<{ id: string }> {
  assertOptionRules(input.options);

  return prisma.$transaction(async (tx) => {
    await assertStimulusExists(tx, input.stimulusId);

    const question = await tx.question.create({
      data: {
        stem: toJson(toRichText(input.stem)),
        track: input.track,
        domain: input.domain,
        subskill: input.subskill,
        difficulty: input.difficulty,
        estimatedSeconds: input.estimatedSeconds,
        explanation: toNullableJson(
          input.explanation === null ? null : toRichText(input.explanation),
        ),
        hint: toNullableJson(input.hint === null ? null : toRichText(input.hint)),
        tags: input.tags,
        shuffleOptions: input.shuffleOptions,
        stimulusId: input.stimulusId,
        authorOrLicensor: input.authorOrLicensor,
        provenanceNote: input.provenanceNote,
        rightsDeclaration: input.rightsDeclaration,
        // A new question always starts unreviewed and unserved, whatever the
        // client sent — neither field exists on the schema that parsed it.
        workflow: 'DRAFT',
        currentVersion: 0,
        createdById: context.actor.id,
        options: {
          create: input.options.map((option, index) => ({
            content: toJson(toRichText(option.content)),
            // Position is the array index, assigned here. Accepting one from the
            // client would admit duplicates the unique constraint then rejects.
            position: index + 1,
            isCorrect: option.isCorrect,
          })),
        },
      },
      select: { id: true },
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.QUESTION_CREATED,
      targetType: 'Question',
      targetId: question.id,
      metadata: auditChanges(null, auditShapeFromInput(input), AUDITED_FIELDS).after,
      requestId: context.requestId,
    });

    return { id: question.id };
  });
}

const UPDATE_SOURCE_SELECT = {
  id: true,
  stem: true,
  explanation: true,
  hint: true,
  domain: true,
  difficulty: true,
  track: true,
  subskill: true,
  tags: true,
  estimatedSeconds: true,
  shuffleOptions: true,
  stimulusId: true,
  authorOrLicensor: true,
  provenanceNote: true,
  rightsDeclaration: true,
  workflow: true,
  options: {
    orderBy: { position: 'asc' },
    select: { content: true, isCorrect: true, position: true },
  },
} as const satisfies Prisma.QuestionSelect;

/**
 * Replace the draft.
 *
 * The whole option set is rewritten rather than diffed, and it is rewritten as a
 * delete followed by an insert inside one transaction. That order is not
 * incidental: `question_options_one_correct_key` is a partial unique index on
 * `(questionId) WHERE "isCorrect"`, so writing the new correct option before
 * removing the old one violates it mid-statement even though the final state is
 * legal. Deleting first means the constraint is never transiently false.
 *
 * Replacing rows also changes option ids, which is safe for exactly one reason:
 * nothing serves a live `QuestionOption`. A delivered question is always a copy
 * taken from a frozen `QuestionVersion`, and the keys inside that snapshot are
 * the ids the options had when it was written.
 */
export async function updateQuestion(
  questionId: string,
  input: UpdateQuestionInput,
  context: QuestionAdminContext,
): Promise<void> {
  assertOptionRules(input.options);

  await prisma.$transaction(async (tx) => {
    const before = await tx.question.findUnique({
      where: { id: questionId },
      select: UPDATE_SOURCE_SELECT,
    });
    if (!before) {
      throw new HttpError(404, COPY.adminQuestions.errors.notFound, 'question_not_found');
    }

    await assertStimulusExists(tx, input.stimulusId);

    await tx.question.update({
      where: { id: questionId },
      data: {
        stem: toJson(preserveAuthoredDocument(input.stem, before.stem)),
        track: input.track,
        domain: input.domain,
        subskill: input.subskill,
        difficulty: input.difficulty,
        estimatedSeconds: input.estimatedSeconds,
        explanation: toNullableJson(
          input.explanation === null
            ? null
            : preserveAuthoredDocument(input.explanation, before.explanation),
        ),
        hint: toNullableJson(
          input.hint === null ? null : preserveAuthoredDocument(input.hint, before.hint),
        ),
        tags: input.tags,
        shuffleOptions: input.shuffleOptions,
        stimulusId: input.stimulusId,
        authorOrLicensor: input.authorOrLicensor,
        provenanceNote: input.provenanceNote,
        rightsDeclaration: input.rightsDeclaration,
      },
    });

    await tx.questionOption.deleteMany({ where: { questionId } });
    await tx.questionOption.createMany({
      data: input.options.map((option, index) => ({
        questionId,
        // Matched to the stored option that held this position, so a save that
        // did not touch the text keeps whatever the text really was.
        content: toJson(
          preserveAuthoredDocument(option.content, before.options[index]?.content ?? null),
        ),
        position: index + 1,
        isCorrect: option.isCorrect,
      })),
    });

    const changes = auditChanges(
      auditShapeFromRow(before),
      auditShapeFromInput(input),
      AUDITED_FIELDS,
    );

    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.QUESTION_UPDATED,
      targetType: 'Question',
      targetId: questionId,
      metadata: {
        workflow: before.workflow,
        ...(changes as unknown as AuditMetadata),
      },
      requestId: context.requestId,
    });
  });
}

// ─────────────────────────────── Deletion ──────────────────────────────────

type DeletionUsage = {
  versions: number;
  examSections: number;
  lessonQuizzes: number;
  attempts: number;
};

/**
 * Whether a question may be removed rather than retired, and why not.
 *
 * Only a draft that was never published and that nothing references. Every other
 * question is retired instead — `QuestionVersion.questionId` is `onDelete:
 * Restrict` for exactly this reason, and so are the exam-section, lesson-quiz
 * and attempt edges. A past attempt has to stay readable: its score was computed
 * against a question, and a result nobody can explain is worse than a bank with
 * a withdrawn item in it.
 *
 * The two refusals are reported apart because they are not the same fact.
 * `in_use` is permanent and the answer is retirement; `not_a_draft` is temporary
 * and the answer is returning the item to the editor.
 */
function deleteBlockFor(
  question: { workflow: $Enums.QuestionWorkflow; currentVersion: number },
  usage: DeletionUsage,
): QuestionDetail['deleteBlock'] {
  const referenced =
    question.currentVersion !== 0 ||
    usage.versions > 0 ||
    usage.examSections > 0 ||
    usage.lessonQuizzes > 0 ||
    usage.attempts > 0;

  if (referenced) return 'in_use';
  if (question.workflow !== 'DRAFT') return 'not_a_draft';
  return 'none';
}

export async function deleteQuestion(
  questionId: string,
  context: QuestionAdminContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const question = await tx.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        workflow: true,
        currentVersion: true,
        domain: true,
        authorOrLicensor: true,
        _count: {
          select: {
            versions: true,
            examSectionUses: true,
            lessonQuizUses: true,
            attemptQuestions: true,
          },
        },
      },
    });
    if (!question) {
      throw new HttpError(404, COPY.adminQuestions.errors.notFound, 'question_not_found');
    }

    const usage: DeletionUsage = {
      versions: question._count.versions,
      examSections: question._count.examSectionUses,
      lessonQuizzes: question._count.lessonQuizUses,
      attempts: question._count.attemptQuestions,
    };

    const block = deleteBlockFor(question, usage);
    if (block !== 'none') {
      // Both refusals answer the same message. It is the accurate one for the
      // permanent case and the safe one for the temporary case, and inventing a
      // second sentence would mean authoring Arabic outside `COPY`.
      throw new HttpError(
        409,
        COPY.adminQuestions.errors.deleteBlockedInUse,
        block === 'in_use' ? 'delete_blocked_in_use' : 'delete_blocked_not_a_draft',
      );
    }

    // The audit row is written first so it is part of the same transaction as
    // the delete; the target id survives in the trail after the row is gone.
    await writeAuditLog(tx, {
      actor: context.actor,
      action: AUDIT_ACTIONS.QUESTION_DELETED,
      targetType: 'Question',
      targetId: questionId,
      metadata: { domain: question.domain, authorOrLicensor: question.authorOrLicensor },
      requestId: context.requestId,
    });

    // Options cascade from the question; nothing else may point at it or the
    // guard above would have refused.
    await tx.question.delete({ where: { id: questionId } });
  });
}
