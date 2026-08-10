export interface CentAllocationWeight {
  id: string;
  weight: number;
}

export interface CentAllocation {
  id: string;
  cents: number;
}

export function allocateIntegerCents(
  totalCent: number,
  weights: readonly CentAllocationWeight[]
): CentAllocation[] {
  if (!Number.isSafeInteger(totalCent)) {
    throw new Error('totalCent must be a safe integer.');
  }
  if (weights.length === 0) {
    if (totalCent === 0) return [];
    throw new Error('Cannot allocate a non-zero amount without recipients.');
  }

  const ids = new Set<string>();
  for (const row of weights) {
    if (!row.id || ids.has(row.id)) {
      throw new Error('Allocation recipient IDs must be non-empty and unique.');
    }
    ids.add(row.id);
    if (!Number.isSafeInteger(row.weight) || row.weight < 0) {
      throw new Error('Allocation weights must be non-negative safe integers.');
    }
  }

  const weightSum = weights.reduce((sum, row) => sum + BigInt(row.weight), 0n);
  if (weightSum === 0n) {
    if (totalCent === 0) {
      return weights.map(row => ({ id: row.id, cents: 0 }));
    }
    throw new Error('Cannot allocate a non-zero amount when all weights are zero.');
  }

  const sign = totalCent < 0 ? -1 : 1;
  const absoluteTotal = BigInt(Math.abs(totalCent));
  const provisional = weights.map((row, index) => {
    const numerator = absoluteTotal * BigInt(row.weight);
    return {
      id: row.id,
      index,
      cents: numerator / weightSum,
      remainder: numerator % weightSum,
    };
  });

  const allocatedFloor = provisional.reduce((sum, row) => sum + row.cents, 0n);
  const remainderCent = Number(absoluteTotal - allocatedFloor);
  const byRemainder = [...provisional].sort((left, right) => {
    if (left.remainder === right.remainder) return left.id.localeCompare(right.id);
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (let index = 0; index < remainderCent; index += 1) {
    byRemainder[index].cents += 1n;
  }

  const centsById = new Map(byRemainder.map(row => [row.id, row.cents]));
  return weights.map(row => ({
    id: row.id,
    cents: Number(centsById.get(row.id) ?? 0n) * sign,
  }));
}
