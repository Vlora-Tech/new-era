import 'server-only';

import type { $Enums } from '@prisma/client';

import type { PrismaTransaction } from '@/lib/db';
import { allocateByLargestRemainder, type AllocationRule } from '@/lib/exam/largest-remainder';
import { createRandom, deriveSeed, sampleWithoutReplacement } from '@/lib/exam/rng';

/**
 * Turning a blueprint into a concrete list of questions.
 *
 * A blueprint states shares — "21% استيعاب المقروء" — and a section holds a
 * whole number of questions. `allocateByLargestRemainder` converts one into the
 * other exactly; this service then draws that many questions per rule from the
 * eligible bank.
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
  /** Blueprint rule that drew it, kept for auditing a generated paper. */
  ruleId: string;
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

export type SectionInput = {
  id: string;
  position: number;
  questionCount: number;
  blueprintRules: BlueprintRuleInput[];
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
    ruleId: string;
    domain: $Enums.QuestionDomain;
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
 * Which question tracks satisfy a requested track.
 *
 * `BOTH` on a question means it is valid for either paper, so it always
 * qualifies. `BOTH` as a *request* means the rule does not care, and matches
 * anything except `CUSTOM` — a custom-track item is only ever served to a rule
 * that asks for it by name.
 */
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

/**
 * Load every question that could be drawn for this exam version.
 *
 * One query for the whole attempt rather than one per rule: forty round trips
 * inside the creation transaction would hold locks for no benefit, and the
 * per-rule filtering is trivial once the rows are in memory. The candidate set
 * is narrowed by domain so the query stays proportional to the blueprint rather
 * than to the whole bank.
 *
 * Ordered by id so the pool a seed draws from is stable. Without that, two runs
 * with the same seed could select different questions purely because PostgreSQL
 * returned the rows in a different order.
 */
export async function loadCandidatePool(
  client: PrismaTransaction,
  sections: SectionInput[],
): Promise<CandidateQuestion[]> {
  const domains = new Set<$Enums.QuestionDomain>();
  for (const section of sections) {
    for (const rule of section.blueprintRules) domains.add(rule.domain);
  }

  if (domains.size === 0) return [];

  return client.question.findMany({
    where: {
      domain: { in: [...domains] },
      // "Published at least once and not withdrawn" is the eligibility rule.
      // `currentVersion > 0` is what guarantees a frozen snapshot exists to copy.
      currentVersion: { gt: 0 },
      workflow: { not: 'RETIRED' },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      currentVersion: true,
      track: true,
      domain: true,
      subskill: true,
      difficulty: true,
    },
  });
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
  defaultTrack: $Enums.QuestionTrack | null;
}): SectionSelection[] {
  const { sections, pool, seed, defaultTrack } = input;

  const used = new Set<string>();
  const shortages: QuestionShortageError['shortages'] = [];
  const selections: SectionSelection[] = [];

  const orderedSections = [...sections].sort((a, b) => a.position - b.position);

  for (const section of orderedSections) {
    const rules = [...section.blueprintRules].sort((a, b) => a.position - b.position);

    const allocationRules: AllocationRule[] = rules.map((rule) => ({
      percentage: rule.percentage,
      countOverride: rule.questionCount,
      position: rule.position,
    }));
    const { counts } = allocateByLargestRemainder(allocationRules, section.questionCount);

    const questions: SelectedQuestion[] = [];

    rules.forEach((rule, ruleIndex) => {
      const required = counts[ruleIndex]!;
      if (required === 0) return;

      const eligible = pool.filter(
        (question) => !used.has(question.id) && matchesRule(question, rule, defaultTrack),
      );

      if (eligible.length < required) {
        shortages.push({
          examSectionId: section.id,
          sectionPosition: section.position,
          ruleId: rule.id,
          domain: rule.domain,
          subskill: rule.subskill,
          difficulty: rule.difficulty,
          required,
          available: eligible.length,
        });
        return;
      }

      // A stream per rule: the draw for section 3 rule 5 does not move when an
      // unrelated rule's allocation changes.
      const random = createRandom(deriveSeed(seed, section.position * 1_000 + rule.position));
      const drawn = sampleWithoutReplacement(eligible, required, random);

      for (const question of drawn) {
        used.add(question.id);
        questions.push({ ...question, ruleId: rule.id });
      }
    });

    selections.push({ examSectionId: section.id, position: section.position, questions });
  }

  // Collected across every rule rather than thrown at the first miss, so an
  // administrator sees the whole gap in one report instead of fixing it eight
  // times.
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
  },
): Promise<SectionSelection[]> {
  const pool = await loadCandidatePool(client, input.sections);
  return generateSelection({ ...input, pool });
}
