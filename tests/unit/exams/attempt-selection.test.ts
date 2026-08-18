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
 * the blueprint arithmetic and the no-duplicates rule can be asserted directly
 * rather than inferred from what a generated attempt happened to contain.
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

function section(id: string, position: number, questionCount: number, rules: BlueprintRuleInput[]) {
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
  it('honours the blueprint percentages exactly', () => {
    const sections = [
      section('s1', 1, 20, [
        rule({ domain: 'ARITHMETIC', position: 1, percentage: 50 }),
        rule({ domain: 'ALGEBRA', position: 2, percentage: 30 }),
        rule({ domain: 'GEOMETRY', position: 3, percentage: 20 }),
      ]),
    ];

    const selection = generateSelection({
      sections,
      pool: pool([
        { domain: 'ARITHMETIC', count: 40 },
        { domain: 'ALGEBRA', count: 40 },
        { domain: 'GEOMETRY', count: 40 },
      ]),
      seed: 1,
      defaultTrack: null,
    });

    const byDomain = new Map<string, number>();
    for (const question of selection[0]!.questions) {
      byDomain.set(question.domain, (byDomain.get(question.domain) ?? 0) + 1);
    }

    expect(selection[0]!.questions).toHaveLength(20);
    expect(byDomain.get('ARITHMETIC')).toBe(10);
    expect(byDomain.get('ALGEBRA')).toBe(6);
    expect(byDomain.get('GEOMETRY')).toBe(4);
  });

  it('never repeats a question across the whole attempt', () => {
    // Exactly enough questions for both sections: any repeat would leave a
    // section short, so this also proves the exclusion set spans sections.
    const rules = [
      rule({ domain: 'ARITHMETIC', position: 1, percentage: 50 }),
      rule({ domain: 'ALGEBRA', position: 2, percentage: 50 }),
    ];
    const sections = [section('s1', 1, 10, rules), section('s2', 2, 10, rules)];

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
    const sections = [
      section('s1', 1, 8, [rule({ domain: 'ARITHMETIC', position: 1, percentage: 100 })]),
    ];
    const bank = pool([{ domain: 'ARITHMETIC', count: 60 }]);

    const first = generateSelection({ sections, pool: bank, seed: 5, defaultTrack: null });
    const second = generateSelection({ sections, pool: bank, seed: 5, defaultTrack: null });
    const other = generateSelection({ sections, pool: bank, seed: 6, defaultTrack: null });

    expect(first[0]!.questions.map((q) => q.id)).toEqual(second[0]!.questions.map((q) => q.id));
    expect(first[0]!.questions.map((q) => q.id)).not.toEqual(other[0]!.questions.map((q) => q.id));
  });

  it('treats a BOTH question as valid for a single-track rule', () => {
    const sections = [
      section('s1', 1, 4, [rule({ domain: 'ARITHMETIC', position: 1, percentage: 100 })]),
    ];

    const selection = generateSelection({
      sections,
      pool: pool([
        { domain: 'ARITHMETIC', count: 4, track: 'BOTH' },
        { domain: 'ARITHMETIC', count: 4, track: 'THEORETICAL' },
      ]),
      seed: 9,
      defaultTrack: 'SCIENTIFIC',
    });

    for (const question of selection[0]!.questions) {
      expect(question.track).toBe('BOTH');
    }
  });

  it('respects an explicit difficulty and subskill on a rule', () => {
    const sections = [
      section('s1', 1, 3, [
        rule({
          domain: 'ALGEBRA',
          position: 1,
          percentage: 100,
          difficulty: 'HARD',
          subskill: 'معادلات',
        }),
      ]),
    ];

    const selection = generateSelection({
      sections,
      pool: pool([
        { domain: 'ALGEBRA', count: 5, difficulty: 'HARD', subskill: 'معادلات' },
        { domain: 'ALGEBRA', count: 5, difficulty: 'EASY', subskill: 'معادلات' },
        { domain: 'ALGEBRA', count: 5, difficulty: 'HARD', subskill: 'متباينات' },
      ]),
      seed: 2,
      defaultTrack: null,
    });

    for (const question of selection[0]!.questions) {
      expect(question.difficulty).toBe('HARD');
      expect(question.subskill).toBe('معادلات');
    }
  });

  it('aborts rather than delivering a short section', () => {
    const sections = [
      section('s1', 1, 10, [
        rule({ domain: 'ARITHMETIC', position: 1, percentage: 50 }),
        rule({ domain: 'GEOMETRY', position: 2, percentage: 50 }),
      ]),
    ];

    let thrown: unknown;
    try {
      generateSelection({
        sections,
        pool: pool([
          { domain: 'ARITHMETIC', count: 5 },
          { domain: 'GEOMETRY', count: 2 },
        ]),
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
      expect.objectContaining({ domain: 'GEOMETRY', required: 5, available: 2 }),
    ]);
  });

  it('reports every gap at once rather than only the first', () => {
    const sections = [
      section('s1', 1, 10, [
        rule({ domain: 'ARITHMETIC', position: 1, percentage: 50 }),
        rule({ domain: 'GEOMETRY', position: 2, percentage: 50 }),
      ]),
    ];

    try {
      generateSelection({
        sections,
        pool: pool([
          { domain: 'ARITHMETIC', count: 1 },
          { domain: 'GEOMETRY', count: 1 },
        ]),
        seed: 1,
        defaultTrack: null,
      });
      expect.unreachable('expected a shortage');
    } catch (error) {
      expect((error as QuestionShortageError).shortages).toHaveLength(2);
    }
  });

  it('honours an explicit question count override', () => {
    const sections = [
      section('s1', 1, 6, [
        rule({ domain: 'ARITHMETIC', position: 1, questionCount: 4 }),
        rule({ domain: 'ALGEBRA', position: 2, percentage: 100 }),
      ]),
    ];

    const selection = generateSelection({
      sections,
      pool: pool([
        { domain: 'ARITHMETIC', count: 10 },
        { domain: 'ALGEBRA', count: 10 },
      ]),
      seed: 3,
      defaultTrack: null,
    });

    const arithmetic = selection[0]!.questions.filter((q) => q.domain === 'ARITHMETIC');
    expect(arithmetic).toHaveLength(4);
    expect(selection[0]!.questions).toHaveLength(6);
  });
});
