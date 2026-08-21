import 'server-only';

import type { $Enums } from '@prisma/client';

import type { PrismaTransaction } from '@/lib/db';
// `allocateByLargestRemainder` returns with the per-rule draw below. Its module
// and its unit tests are untouched — nothing turning a share into a whole number
// of questions is needed while a section simply takes its count off the bank.
import { createRandom, deriveSeed, sampleWithoutReplacement } from '@/lib/exam/rng';

/**
 * Turning an exam version into a concrete list of questions.
 *
 * Two selection modes, and both are implemented here because a version may
 * declare either:
 *
 *  - **`BLUEPRINT`** draws a section's `questionCount` at random from the
 *    eligible bank. It used to state shares — "21% استيعاب المقروء" — and draw
 *    per rule; see the note below.
 *  - **`FIXED`** names the questions outright. `ExamSectionQuestion` pins them
 *    in the order an administrator chose, and the paper is that list. No
 *    allocation, no sampling, no seed — the only thing that can go wrong is a
 *    pinned question that has since been retired or withdrawn, which is refused
 *    rather than silently delivered short.
 *
 * ── Blueprint rules are no longer applied ───────────────────────────────────
 *
 * The question bank stopped asking authors for a skill, a difficulty or a track
 * (see the head of `src/components/admin/question-form.tsx`), so every question
 * written from now on carries the same placeholder classification. A rule saying
 * "21% استيعاب المقروء، صعب" would have matched none of them: a teacher could
 * fill the bank and watch the simulator ignore every question they wrote.
 *
 * So a blueprint section now means one thing — *take this many questions from
 * the bank* — and the rule rows are not read. They are still stored, still
 * editable through their API, and `SectionInput` still carries them, because the
 * day classification comes back is the day they should start counting again.
 * Restoring is uncommenting `matchesRule` and the per-rule loop below, and the
 * rule editor in `exam-version-editor.tsx`.
 *
 * The simulator's own track no longer narrows the draw either, for the same
 * reason: a track nobody chose is not a fact about a question.
 *
 * A `FIXED` version used to publish cleanly and then fail for every student:
 * `assertVersionPublishable` accepted it, and this file ran the blueprint
 * allocator regardless, which threw `AllocationError` on a section with no
 * rules. The version read as healthy on the administration screen while nobody
 * could start the exam.
 *
 * Two invariants are enforced here rather than trusted:
 *
 *   1. No question appears twice in one attempt. The exclusion set spans the
 *      whole attempt, not just the section, because a student who meets the
 *      same item in section 1 and section 4 has been given a shorter exam than
 *      the blueprint describes.
 *   2. A rule whose pool cannot cover its allocation aborts the whole
 *      generation. Delivering a section that is one question short is worse
 *      than refusing to start: the student finishes an exam that was never the
 *      exam they were told they were sitting, and the section timing no longer
 *      corresponds to anything.
 *
 * Selection is seeded, so the same attempt seed against the same bank yields
 * the same paper. Each rule draws from its own derived stream, so adding a rule
 * to a later section cannot change what an earlier section drew.
 */

/** Eligible pool definition: published-at-least-once and not withdrawn. */
type CandidateQuestion = {
  id: string;
  currentVersion: number;
  track: $Enums.QuestionTrack;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
};

export type SelectedQuestion = CandidateQuestion & {
  /**
   * Blueprint rule that drew it, kept for auditing a generated paper. `null` in
   * a `FIXED` version, where an administrator named the question directly and no
   * rule was involved.
   */
  ruleId: string | null;
};

export type SectionSelection = {
  examSectionId: string;
  position: number;
  questions: SelectedQuestion[];
};

export type BlueprintRuleInput = {
  id: string;
  position: number;
  track: $Enums.QuestionTrack | null;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty | null;
  percentage: number | null;
  questionCount: number | null;
};

/** One pinned question in a `FIXED` section, in the order it will be delivered. */
export type FixedQuestionInput = {
  questionId: string;
  position: number;
};

export type SectionInput = {
  id: string;
  position: number;
  questionCount: number;
  blueprintRules: BlueprintRuleInput[];
  /** Populated for a `FIXED` version; empty for a `BLUEPRINT` one. */
  fixedQuestions: FixedQuestionInput[];
};

/**
 * A rule could not be filled.
 *
 * Typed rather than a bare `Error` so the lifecycle can map it to a specific
 * Arabic message and an administrator-facing diagnosis, instead of it arriving
 * at the client as a generic server error.
 */
export class QuestionShortageError extends Error {
  readonly code = 'question_shortage';
  readonly shortages: Array<{
    examSectionId: string;
    sectionPosition: number;
    /**
     * The rule that went short, when rules are being applied. `null` is the
     * ordinary case now: a section draws from the whole bank, so a shortage is
     * a property of the section and the bank, not of any rule.
     */
    ruleId: string | null;
    domain: $Enums.QuestionDomain | null;
    subskill: string | null;
    difficulty: $Enums.QuestionDifficulty | null;
    required: number;
    available: number;
  }>;

  constructor(shortages: QuestionShortageError['shortages']) {
    super('لا توجد أسئلة منشورة كافية لتوليد هذه المحاولة، فلم يبدأ الاختبار.');
    this.name = 'QuestionShortageError';
    this.shortages = shortages;
  }
}

/**
 * A `FIXED` section's pinned list can no longer be delivered.
 *
 * Its own type rather than a `QuestionShortageError`: that error is per *rule*
 * and names a domain and a difficulty, which is the right report for a blueprint
 * and meaningless for a list somebody wrote by hand. What an administrator needs
 * here is which questions vanished, so that is what it carries.
 *
 * Publication checks the same property, so reaching this at attempt time means
 * the bank changed under a published version — a question retired after it was
 * pinned. Refusing is still right: delivering nineteen of twenty questions
 * would be a different exam from the one the version describes.
 */
export class FixedSelectionError extends Error {
  readonly code = 'fixed_selection_unavailable';
  readonly problems: Array<{
    examSectionId: string;
    sectionPosition: number;
    required: number;
    available: number;
    unavailableQuestionIds: string[];
  }>;

  constructor(problems: FixedSelectionError['problems']) {
    super('قائمة أسئلة هذا الاختبار الثابتة لم تعد مكتملة، فلم يبدأ الاختبار.');
    this.name = 'FixedSelectionError';
    this.problems = problems;
  }
}

/* Restore with the per-rule draw in `generateSelection`.

/**
 * Which question tracks satisfy a requested track.
 *
 * `BOTH` on a question means it is valid for either paper, so it always
 * qualifies. `BOTH` as a *request* means the rule does not care, and matches
 * anything except `CUSTOM` — a custom-track item is only ever served to a rule
 * that asks for it by name.
 *
function tracksMatching(requested: $Enums.QuestionTrack | null): $Enums.QuestionTrack[] | null {
  if (requested === null) return null;
  if (requested === 'BOTH') return ['SCIENTIFIC', 'THEORETICAL', 'BOTH'];
  return [requested, 'BOTH'];
}

function matchesRule(
  question: CandidateQuestion,
  rule: BlueprintRuleInput,
  defaultTrack: $Enums.QuestionTrack | null,
): boolean {
  if (question.domain !== rule.domain) return false;
  if (rule.subskill !== null && question.subskill !== rule.subskill) return false;
  if (rule.difficulty !== null && question.difficulty !== rule.difficulty) return false;

  // The rule's own track wins; otherwise the simulator's track applies, so a
  // scientific simulator never serves a theoretical-only item by omission.
  const tracks = tracksMatching(rule.track ?? defaultTrack);
  if (tracks !== null && !tracks.includes(question.track)) return false;

  return true;
}
*/

/**
 * Load every question that could be drawn for this exam version.
 *
 * One query for the whole attempt rather than one per section: round trips
 * inside the creation transaction hold locks for no benefit, and the drawing is
 * trivial once the rows are in memory.
 *
 * A blueprint version now reads the whole eligible bank. It used to be narrowed
 * to the domains its rules named, which was proportional to the blueprint; the
 * draw no longer looks at domains, so there is nothing to narrow by. Six small
 * columns per published question is a cheap read at the size this bank is built
 * for, and the alternative — a random page out of PostgreSQL — cannot be made
 * reproducible from a seed, which is what makes a paper explainable afterwards.
 *
 * Ordered by id so the pool a seed draws from is stable. Without that, two runs
 * with the same seed could select different questions purely because PostgreSQL
 * returned the rows in a different order.
 */
export async function loadCandidatePool(
  client: PrismaTransaction,
  sections: SectionInput[],
  selectionMode: $Enums.SelectionMode = 'BLUEPRINT',
): Promise<CandidateQuestion[]> {
  // The eligibility rule is the same for both modes and is applied in SQL for
  // both: "published at least once and not withdrawn". `currentVersion > 0` is
  // what guarantees a frozen snapshot exists to copy. A pinned question that
  // fails it simply does not come back, and the caller reports it as missing.
  const eligible = { currentVersion: { gt: 0 }, workflow: { not: 'RETIRED' as const } };

  const select = {
    id: true,
    currentVersion: true,
    track: true,
    domain: true,
    subskill: true,
    difficulty: true,
  };

  if (selectionMode === 'FIXED') {
    const ids = [
      ...new Set(
        sections.flatMap((section) => section.fixedQuestions.map((entry) => entry.questionId)),
      ),
    ];
    if (ids.length === 0) return [];

    return client.question.findMany({
      where: { id: { in: ids }, ...eligible },
      orderBy: { id: 'asc' },
      select,
    });
  }

  return client.question.findMany({
    where: eligible,
    orderBy: { id: 'asc' },
    select,
  });
}

/**
 * The `FIXED` paper: exactly the questions an administrator pinned.
 *
 * Deterministic without a seed, because there is nothing to draw. Three
 * invariants are still enforced rather than assumed:
 *
 *  1. **Every pinned question must still be eligible.** The pool was loaded
 *     with the engine's own eligibility rule, so anything absent from it has
 *     been retired or withdrawn since it was pinned.
 *  2. **The count must match the section's declared `questionCount`.** The
 *     student is told how long the section is and how many questions it holds
 *     before they start; a section that quietly delivers fewer is a different
 *     exam.
 *  3. **No question twice in one attempt**, exactly as the blueprint path
 *     guarantees. `@@unique([examSectionId, questionId])` only prevents a repeat
 *     *within* a section, so a question pinned into two sections is caught here.
 *
 * Every failing section is collected before throwing, so an administrator gets
 * the whole picture in one refusal instead of fixing it a section at a time.
 */
function selectFixed(sections: SectionInput[], pool: CandidateQuestion[]): SectionSelection[] {
  const byId = new Map(pool.map((question) => [question.id, question]));
  const used = new Set<string>();

  const problems: FixedSelectionError['problems'] = [];
  const selections: SectionSelection[] = [];

  for (const section of [...sections].sort((a, b) => a.position - b.position)) {
    const pinned = [...section.fixedQuestions].sort((a, b) => a.position - b.position);

    const questions: SelectedQuestion[] = [];
    const unavailable: string[] = [];

    for (const entry of pinned) {
      const question = byId.get(entry.questionId);
      if (!question || used.has(entry.questionId)) {
        unavailable.push(entry.questionId);
        continue;
      }
      used.add(entry.questionId);
      questions.push({ ...question, ruleId: null });
    }

    if (unavailable.length > 0 || questions.length !== section.questionCount) {
      problems.push({
        examSectionId: section.id,
        sectionPosition: section.position,
        required: section.questionCount,
        available: questions.length,
        unavailableQuestionIds: unavailable,
      });
      continue;
    }

    selections.push({ examSectionId: section.id, position: section.position, questions });
  }

  if (problems.length > 0) throw new FixedSelectionError(problems);

  return selections;
}

/**
 * Generate the whole attempt's selection.
 *
 * Returns sections in blueprint order with their questions in blueprint-rule
 * order; the lifecycle shuffles the delivered order separately, so the audit
 * view of "what each rule drew" stays legible.
 */
export function generateSelection(input: {
  sections: SectionInput[];
  pool: CandidateQuestion[];
  seed: number;
  /**
   * The simulator's track. Not read while blueprint rules are unapplied — a
   * track nobody was asked to choose cannot narrow a draw — and kept on the
   * input because every caller passes it and the per-rule path wants it back.
   */
  defaultTrack: $Enums.QuestionTrack | null;
  /** Defaulted so every existing blueprint caller reads unchanged. */
  selectionMode?: $Enums.SelectionMode;
}): SectionSelection[] {
  const { sections, pool, seed } = input;

  if (input.selectionMode === 'FIXED') return selectFixed(sections, pool);

  const used = new Set<string>();
  const shortages: QuestionShortageError['shortages'] = [];
  const selections: SectionSelection[] = [];

  const orderedSections = [...sections].sort((a, b) => a.position - b.position);

  for (const section of orderedSections) {
    const required = section.questionCount;

    // The exclusion set spans the attempt, so section 2 draws from what section
    // 1 left. Sections are walked in order for that reason: it is what makes the
    // paper a function of the seed rather than of iteration order.
    const eligible = pool.filter((question) => !used.has(question.id));

    if (eligible.length < required) {
      shortages.push({
        examSectionId: section.id,
        sectionPosition: section.position,
        ruleId: null,
        domain: null,
        subskill: null,
        difficulty: null,
        required,
        available: eligible.length,
      });
      continue;
    }

    // A stream per section, derived the way it was when rules existed
    // (`position * 1_000` was the rule-less base), so a version's papers do not
    // all change identity the moment rules stopped being read.
    const random = createRandom(deriveSeed(seed, section.position * 1_000));
    const drawn = sampleWithoutReplacement(eligible, required, random);

    const questions: SelectedQuestion[] = [];
    for (const question of drawn) {
      used.add(question.id);
      questions.push({ ...question, ruleId: null });
    }

    selections.push({ examSectionId: section.id, position: section.position, questions });
  }

  // Collected across every section rather than thrown at the first miss, so an
  // administrator sees the whole gap in one report instead of fixing it a
  // section at a time.
  if (shortages.length > 0) throw new QuestionShortageError(shortages);

  return selections;
}

/** Load the pool and generate in one call, for the creation transaction. */
export async function selectAttemptQuestions(
  client: PrismaTransaction,
  input: {
    sections: SectionInput[];
    seed: number;
    defaultTrack: $Enums.QuestionTrack | null;
    selectionMode?: $Enums.SelectionMode;
  },
): Promise<SectionSelection[]> {
  const pool = await loadCandidatePool(client, input.sections, input.selectionMode);
  return generateSelection({ ...input, pool });
}
