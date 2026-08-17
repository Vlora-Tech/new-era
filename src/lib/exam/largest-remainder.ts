/**
 * Largest-remainder (Hamilton) allocation.
 *
 * A blueprint states domain shares as percentages, but a section holds a whole
 * number of questions, and percentages of 24 rarely land on integers. Rounding
 * each share independently would produce a set that does not add up to the
 * section size — sometimes 23, sometimes 25.
 *
 * The largest-remainder method floors every share, then hands the leftover
 * questions to the shares with the largest fractional parts, so the total is
 * exact by construction.
 *
 * Ties are broken deterministically (remainder, then percentage, then declared
 * order) so the same blueprint always produces the same counts. An administrator
 * previewing an allocation must see what publishing will actually create.
 */
export type AllocationRule = {
  /** Share of the section, 0–100. Ignored when `countOverride` is set. */
  percentage?: number | null;
  /** Explicit administrator override, taken before percentages are applied. */
  countOverride?: number | null;
  /** Declared order, used as the final tie-break. */
  position: number;
};

export type AllocationResult = {
  counts: number[];
  total: number;
};

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

export function allocateByLargestRemainder(
  rules: AllocationRule[],
  targetTotal: number,
): AllocationResult {
  if (!Number.isInteger(targetTotal) || targetTotal < 0) {
    throw new AllocationError('عدد الأسئلة المطلوب يجب أن يكون عددًا صحيحًا غير سالب.');
  }
  if (rules.length === 0) {
    if (targetTotal === 0) return { counts: [], total: 0 };
    throw new AllocationError('لا توجد قواعد توزيع لهذا القسم.');
  }

  const counts = new Array<number>(rules.length).fill(0);

  // 1. Honour explicit overrides first; they are not subject to rounding.
  let overriddenTotal = 0;
  const freeIndexes: number[] = [];
  rules.forEach((rule, index) => {
    if (rule.countOverride != null) {
      if (!Number.isInteger(rule.countOverride) || rule.countOverride < 0) {
        throw new AllocationError('العدد المحدد يدويًا يجب أن يكون عددًا صحيحًا غير سالب.');
      }
      counts[index] = rule.countOverride;
      overriddenTotal += rule.countOverride;
    } else {
      freeIndexes.push(index);
    }
  });

  if (overriddenTotal > targetTotal) {
    throw new AllocationError('مجموع الأعداد المحددة يدويًا أكبر من عدد أسئلة القسم.');
  }

  const remainingTotal = targetTotal - overriddenTotal;

  if (freeIndexes.length === 0) {
    if (remainingTotal !== 0) {
      throw new AllocationError('مجموع الأعداد المحددة يدويًا لا يساوي عدد أسئلة القسم.');
    }
    return { counts, total: targetTotal };
  }

  // 2. Percentages are renormalised over the rules that remain, so overriding
  //    one rule does not silently shrink the others.
  const percentageSum = freeIndexes.reduce(
    (sum, index) => sum + (rules[index]!.percentage ?? 0),
    0,
  );

  if (percentageSum <= 0) {
    if (remainingTotal === 0) return { counts, total: targetTotal };
    throw new AllocationError('مجموع النسب المئوية يجب أن يكون أكبر من صفر.');
  }

  const exact = freeIndexes.map((index) => {
    const percentage = rules[index]!.percentage ?? 0;
    return { index, value: (percentage / percentageSum) * remainingTotal };
  });

  let assigned = 0;
  for (const entry of exact) {
    const floored = Math.floor(entry.value);
    counts[entry.index] = floored;
    assigned += floored;
  }

  // 3. Distribute what flooring left over, largest fractional part first.
  const deficit = remainingTotal - assigned;
  if (deficit > 0) {
    const ranked = [...exact].sort((a, b) => {
      const remainderA = a.value - Math.floor(a.value);
      const remainderB = b.value - Math.floor(b.value);
      if (remainderB !== remainderA) return remainderB - remainderA;

      const percentageA = rules[a.index]!.percentage ?? 0;
      const percentageB = rules[b.index]!.percentage ?? 0;
      if (percentageB !== percentageA) return percentageB - percentageA;

      return rules[a.index]!.position - rules[b.index]!.position;
    });

    for (let i = 0; i < deficit; i += 1) {
      const target = ranked[i % ranked.length]!;
      counts[target.index] += 1;
    }
  }

  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total !== targetTotal) {
    // Unreachable if the arithmetic above is right; asserted so a future edit
    // cannot quietly start producing sections of the wrong size.
    throw new AllocationError('تعذّر توزيع الأسئلة بشكل متسق مع عدد أسئلة القسم.');
  }

  return { counts, total };
}
