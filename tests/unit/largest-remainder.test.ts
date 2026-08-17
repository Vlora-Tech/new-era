import { describe, expect, it } from 'vitest';

import {
  AllocationError,
  allocateByLargestRemainder,
  type AllocationRule,
} from '@/lib/exam/largest-remainder';

/**
 * Blueprint percentages as published in the official guide, in the fixed domain
 * order: verbal analogy, sentence completion, contextual error, reading
 * comprehension, arithmetic, geometry, algebra, data analysis.
 */
const SCIENTIFIC = [17, 7, 10, 21, 23, 10, 4, 8];
const THEORETICAL = [21, 13, 16, 25, 13, 8, 0, 4];

function rules(percentages: number[]): AllocationRule[] {
  return percentages.map((percentage, index) => ({ percentage, position: index + 1 }));
}

describe('allocateByLargestRemainder', () => {
  it('allocates the scientific blueprint over a 24-question section', () => {
    const { counts, total } = allocateByLargestRemainder(rules(SCIENTIFIC), 24);
    expect(counts).toEqual([4, 2, 2, 5, 6, 2, 1, 2]);
    expect(total).toBe(24);
  });

  it('allocates the theoretical blueprint over a 24-question section', () => {
    const { counts, total } = allocateByLargestRemainder(rules(THEORETICAL), 24);
    expect(counts).toEqual([5, 3, 4, 6, 3, 2, 0, 1]);
    expect(total).toBe(24);
  });

  it('keeps the scientific split near 55% verbal and 45% quantitative', () => {
    const { counts } = allocateByLargestRemainder(rules(SCIENTIFIC), 24);
    const verbal = counts[0]! + counts[1]! + counts[2]! + counts[3]!;
    const quantitative = counts[4]! + counts[5]! + counts[6]! + counts[7]!;
    expect(verbal).toBe(13);
    expect(quantitative).toBe(11);
  });

  it('keeps the theoretical split near 75% verbal and 25% quantitative', () => {
    const { counts } = allocateByLargestRemainder(rules(THEORETICAL), 24);
    const verbal = counts[0]! + counts[1]! + counts[2]! + counts[3]!;
    const quantitative = counts[4]! + counts[5]! + counts[6]! + counts[7]!;
    expect(verbal).toBe(18);
    expect(quantitative).toBe(6);
  });

  it('always sums to the section size across many sizes', () => {
    for (const size of [5, 10, 12, 20, 24, 25, 30, 40, 120]) {
      const scientific = allocateByLargestRemainder(rules(SCIENTIFIC), size);
      const theoretical = allocateByLargestRemainder(rules(THEORETICAL), size);
      expect(scientific.total).toBe(size);
      expect(theoretical.total).toBe(size);
    }
  });

  it('is deterministic', () => {
    const first = allocateByLargestRemainder(rules(SCIENTIFIC), 24).counts;
    for (let run = 0; run < 20; run += 1) {
      expect(allocateByLargestRemainder(rules(SCIENTIFIC), 24).counts).toEqual(first);
    }
  });

  it('gives a zero-percentage rule no questions', () => {
    // Algebra is 0% on the theoretical track and must stay empty.
    const { counts } = allocateByLargestRemainder(rules(THEORETICAL), 24);
    expect(counts[6]).toBe(0);
  });

  it('honours an administrator override and reallocates the remainder', () => {
    const withOverride: AllocationRule[] = rules(SCIENTIFIC);
    withOverride[6] = { percentage: 4, countOverride: 5, position: 7 };

    const { counts, total } = allocateByLargestRemainder(withOverride, 24);
    expect(counts[6]).toBe(5);
    expect(total).toBe(24);
  });

  it('accepts overrides that exactly fill the section', () => {
    const fixed: AllocationRule[] = [
      { countOverride: 10, position: 1 },
      { countOverride: 14, position: 2 },
    ];
    expect(allocateByLargestRemainder(fixed, 24).counts).toEqual([10, 14]);
  });

  it('rejects overrides that exceed the section size', () => {
    const tooMany: AllocationRule[] = [
      { countOverride: 20, position: 1 },
      { countOverride: 10, position: 2 },
    ];
    expect(() => allocateByLargestRemainder(tooMany, 24)).toThrow(AllocationError);
  });

  it('rejects overrides that under-fill the section with no free rules left', () => {
    const tooFew: AllocationRule[] = [
      { countOverride: 5, position: 1 },
      { countOverride: 5, position: 2 },
    ];
    expect(() => allocateByLargestRemainder(tooFew, 24)).toThrow(AllocationError);
  });

  it('rejects percentages that sum to zero when questions remain', () => {
    const empty: AllocationRule[] = [
      { percentage: 0, position: 1 },
      { percentage: 0, position: 2 },
    ];
    expect(() => allocateByLargestRemainder(empty, 24)).toThrow(AllocationError);
  });

  it('handles a zero-question section', () => {
    expect(allocateByLargestRemainder(rules(SCIENTIFIC), 0).counts).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
