import { describe, expect, it } from 'vitest';

import type { $Enums } from '@prisma/client';

import {
  QuestionShortageError,
  generateSelection,
  type BlueprintRuleInput,
  type SectionInput,
} from '@/services/exams/attempt-selection.service';

/**
 * Selection, exercised without a database.
 *
 * `generateSelection` is deliberately pure: the pool comes in as an array, so
 * the draw and the no-duplicates rule can be asserted directly rather than
 * inferred from what a generated attempt happened to contain.
 *
 * A blueprint section means "take this many questions from the bank" — the rule
 * rows are stored and not read, because the bank no longer records the skill a
 * rule would select on. The suite states that as its own case rather than
 * leaving it to be inferred from an absence: a rule quietly starting to count
 * again is exactly the regression that would be hard to see.
 */
type PoolQuestion = {
  id: string;
  currentVersion: number;
  track: $Enums.QuestionTrack;
  domain: $Enums.QuestionDomain;
  subskill: string | null;
  difficulty: $Enums.QuestionDifficulty;
};

function pool(
  entries: Array<{
    domain: $Enums.QuestionDomain;
    count: number;
    track?: $Enums.QuestionTrack;
    difficulty?: $Enums.QuestionDifficulty;
    subskill?: string | null;
  }>,
): PoolQuestion[] {
  const questions: PoolQuestion[] = [];
  for (const entry of entries) {
    for (let index = 0; index < entry.count; index += 1) {
      questions.push({
        id: `${entry.domain}-${entry.track ?? 'BOTH'}-${entry.difficulty ?? 'MEDIUM'}-${index}`,
        currentVersion: 1,
        track: entry.track ?? 'BOTH',
        domain: entry.domain,
        subskill: entry.subskill ?? null,
        difficulty: entry.difficulty ?? 'MEDIUM',
      });
    }
  }
  return questions;
}

function rule(overrides: Partial<BlueprintRuleInput> & { domain: $Enums.QuestionDomain }) {
  return {
    id: `rule-${overrides.domain}-${overrides.position ?? 1}`,
    position: 1,
    track: null,
    subskill: null,
    difficulty: null,
    percentage: null,
    questionCount: null,
    ...overrides,
  } satisfies BlueprintRuleInput;
}

function section(
  id: string,
  position: number,
  questionCount: number,
  rules: BlueprintRuleInput[] = [],
) {
  // A blueprint section pins nothing; `fixedQuestions` is the other mode's list.
  return {
    id,
    position,
    questionCount,
    blueprintRules: rules,
    fixedQuestions: [],
  } satisfies SectionInput;
}

describe('generateSelection', () => {
  it('draws exactly the section question count from the bank', () => {
    const selection = generateSelection({
      sections: [section('s1', 1, 20)],
      pool: pool([
        { domain: 'ARITHMETIC', count: 40 },
        { domain: 'READING_COMPREHENSION', count: 40 },
      ]),
      seed: 1,
      defaultTrack: null,
    });

    expect(selection[0]!.questions).toHaveLength(20);
    // Nothing selected it, so nothing claims to have.
    for (const question of selection[0]!.questions) {
      expect(question.ruleId).toBeNull();
    }
  });

  it('ignores blueprint rules that are still stored', () => {
    // Rules for a skill the bank holds none of. Under the per-rule draw this
    // was a shortage; the section now takes its count off the whole bank, which
    // is what stops a teacher's unclassified questions being invisible.
    const sections = [
      section('s1', 1, 6, [
        rule({ domain: 'GEOMETRY', position: 1, percentage: 50, difficulty: 'HARD' }),
        rule({ domain: 'DATA_ANALYSIS', position: 2, percentage: 50, subskill: 'جداول' }),
      ]),
    ];

    const selection = generateSelection({
      sections,
      pool: pool([{ domain: 'VERBAL_ANALOGY', count: 10, difficulty: 'MEDIUM' }]),
      seed: 4,
      defaultTrack: null,
    });

    expect(selection[0]!.questions).toHaveLength(6);
    for (const question of selection[0]!.questions) {
      expect(question.domain).toBe('VERBAL_ANALOGY');
    }
  });

  it('draws whatever the bank holds regardless of the simulator track', () => {
    const selection = generateSelection({
      sections: [section('s1', 1, 8)],
      pool: pool([{ domain: 'ARITHMETIC', count: 8, track: 'THEORETICAL' }]),
      seed: 9,
      defaultTrack: 'SCIENTIFIC',
    });

    expect(selection[0]!.questions).toHaveLength(8);
  });

  it('never repeats a question across the whole attempt', () => {
    // Exactly enough questions for both sections: any repeat would leave a
    // section short, so this also proves the exclusion set spans sections.
    const sections = [section('s1', 1, 10), section('s2', 2, 10)];

    const selection = generateSelection({
      sections,
      pool: pool([
        { domain: 'ARITHMETIC', count: 10 },
        { domain: 'ALGEBRA', count: 10 },
      ]),
      seed: 77,
      defaultTrack: null,
    });

    const ids = selection.flatMap((entry) => entry.questions.map((question) => question.id));
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it('is reproducible for a given seed and differs across seeds', () => {
    const sections = [section('s1', 1, 8)];
    const bank = pool([{ domain: 'ARITHMETIC', count: 60 }]);

    const first = generateSelection({ sections, pool: bank, seed: 5, defaultTrack: null });
    const second = generateSelection({ sections, pool: bank, seed: 5, defaultTrack: null });
    const other = generateSelection({ sections, pool: bank, seed: 6, defaultTrack: null });

    expect(first[0]!.questions.map((q) => q.id)).toEqual(second[0]!.questions.map((q) => q.id));
    expect(first[0]!.questions.map((q) => q.id)).not.toEqual(other[0]!.questions.map((q) => q.id));
  });

  it('aborts rather than delivering a short section', () => {
    let thrown: unknown;
    try {
      generateSelection({
        sections: [section('s1', 1, 10)],
        pool: pool([{ domain: 'ARITHMETIC', count: 7 }]),
        seed: 1,
        defaultTrack: null,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(QuestionShortageError);
    const shortage = thrown as QuestionShortageError;
    expect(shortage.message).toMatch(/[؀-ۿ]/);
    expect(shortage.shortages).toEqual([
      // No rule to blame: the section wanted ten and the bank held seven.
      expect.objectContaining({ examSectionId: 's1', ruleId: null, required: 10, available: 7 }),
    ]);
  });

  it('reports every gap at once rather than only the first', () => {
    try {
      generateSelection({
        sections: [section('s1', 1, 4), section('s2', 2, 4)],
        pool: pool([{ domain: 'ARITHMETIC', count: 2 }]),
        seed: 1,
        defaultTrack: null,
      });
      expect.unreachable('expected a shortage');
    } catch (error) {
      expect((error as QuestionShortageError).shortages).toHaveLength(2);
    }
  });

  it('leaves the second section the questions the first did not take', () => {
    // Ten in the bank, six then four: the second section can only be filled by
    // what the first left, so this is the exclusion set doing arithmetic.
    const selection = generateSelection({
      sections: [section('s1', 1, 6), section('s2', 2, 4)],
      pool: pool([{ domain: 'ARITHMETIC', count: 10 }]),
      seed: 21,
      defaultTrack: null,
    });

    expect(selection[0]!.questions).toHaveLength(6);
    expect(selection[1]!.questions).toHaveLength(4);
    expect(
      new Set(selection.flatMap((entry) => entry.questions.map((question) => question.id))).size,
    ).toBe(10);
  });
});
