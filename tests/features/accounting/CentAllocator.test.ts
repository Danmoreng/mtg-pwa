import { describe, expect, it } from 'vitest';
import { allocateIntegerCents } from '@/features/accounting/CentAllocator';

describe('allocateIntegerCents', () => {
  it('allocates every cent deterministically with a stable tie-break', () => {
    const result = allocateIntegerCents(100, [
      { id: 'c', weight: 1 },
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ]);

    expect(result).toEqual([
      { id: 'c', cents: 33 },
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
    ]);
    expect(result.reduce((sum, row) => sum + row.cents, 0)).toBe(100);
  });

  it('supports negative totals without losing cents', () => {
    const result = allocateIntegerCents(-5, [
      { id: 'a', weight: 2 },
      { id: 'b', weight: 1 },
    ]);

    expect(result).toEqual([
      { id: 'a', cents: -3 },
      { id: 'b', cents: -2 },
    ]);
    expect(result.reduce((sum, row) => sum + row.cents, 0)).toBe(-5);
  });

  it('rejects non-zero allocation without positive weight', () => {
    expect(() => allocateIntegerCents(1, [{ id: 'a', weight: 0 }])).toThrow();
  });

  it('rejects duplicate recipient IDs', () => {
    expect(() =>
      allocateIntegerCents(10, [
        { id: 'same', weight: 1 },
        { id: 'same', weight: 1 },
      ])
    ).toThrow();
  });
});
