import { describe, expect, it } from 'vitest';
import { calculateLotAccounting } from '@/features/accounting/AccountingKernel';
import { assertAccountingSnapshot } from '@/features/accounting/AccountingValidation';
import type { LotAccountingInput } from '@/features/accounting/AccountingTypes';

function baseInput(overrides: Partial<LotAccountingInput> = {}): LotAccountingInput {
  return {
    lot: {
      id: 'lot-1',
      initialQuantity: 10,
      allocatedCostCent: 1000,
      costBasisStatus: 'known',
    },
    adjustments: [],
    saleAllocations: [],
    deckAllocations: [],
    marketValueCent: 2000,
    ...overrides,
  };
}

describe('AccountingKernel', () => {
  it('derives effective, remaining, and deck-available quantities from events', () => {
    const snapshot = calculateLotAccounting(
      baseInput({
        adjustments: [
          {
            id: 'adjustment-add',
            lotId: 'lot-1',
            quantityDelta: 2,
            costBasisDeltaCent: 200,
            costBasisStatus: 'known',
          },
          {
            id: 'adjustment-remove',
            lotId: 'lot-1',
            quantityDelta: -3,
            costBasisDeltaCent: -300,
            costBasisStatus: 'known',
          },
        ],
        saleAllocations: [
          {
            id: 'sale-allocation',
            lotId: 'lot-1',
            quantity: 4,
            costBasisCentSnapshot: 400,
            costBasisStatus: 'known',
            netProceedsCentSnapshot: 600,
          },
        ],
        deckAllocations: [
          { id: 'active-deck', lotId: 'lot-1', quantity: 2 },
          {
            id: 'released-deck',
            lotId: 'lot-1',
            quantity: 3,
            releasedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      })
    );

    expect(snapshot).toMatchObject({
      adjustmentQuantity: -1,
      effectiveQuantity: 9,
      soldQuantity: 4,
      remainingQuantity: 5,
      deckReservedQuantity: 2,
      availableForDecks: 3,
      openCostBasis: { status: 'known', cents: 500 },
      realizedPnL: { status: 'known', cents: 200 },
      unrealizedPnL: { status: 'known', cents: 1500 },
      issues: [],
    });
  });

  it('does not treat a manual removal as realized sale P&L', () => {
    const snapshot = calculateLotAccounting(
      baseInput({
        adjustments: [
          {
            id: 'lost-card',
            lotId: 'lot-1',
            quantityDelta: -1,
            costBasisDeltaCent: -100,
            costBasisStatus: 'known',
          },
        ],
      })
    );

    expect(snapshot.openCostBasis).toEqual({ status: 'known', cents: 900 });
    expect(snapshot.realizedPnL).toEqual({ status: 'known', cents: 0 });
  });

  it('restores quantity and cost basis with an equal and opposite reversal', () => {
    const snapshot = calculateLotAccounting(
      baseInput({
        adjustments: [
          {
            id: 'lost-card',
            lotId: 'lot-1',
            quantityDelta: -1,
            costBasisDeltaCent: -100,
            costBasisStatus: 'known',
          },
          {
            id: 'undo-lost-card',
            lotId: 'lot-1',
            quantityDelta: 1,
            costBasisDeltaCent: 100,
            costBasisStatus: 'known',
            reversesAdjustmentId: 'lost-card',
          },
        ],
      })
    );

    expect(snapshot.effectiveQuantity).toBe(10);
    expect(snapshot.openCostBasis).toEqual({ status: 'known', cents: 1000 });
  });

  it('propagates unknown cost basis instead of interpreting it as zero', () => {
    const snapshot = calculateLotAccounting(
      baseInput({
        lot: {
          id: 'lot-1',
          initialQuantity: 2,
          costBasisStatus: 'unknown',
        },
        marketValueCent: 500,
      })
    );

    expect(snapshot.openCostBasis).toEqual({ status: 'unknown' });
    expect(snapshot.unrealizedPnL).toEqual({ status: 'unknown' });
  });

  it('marks estimated cost components as estimated through the result', () => {
    const snapshot = calculateLotAccounting(
      baseInput({
        adjustments: [
          {
            id: 'estimated-found-card',
            lotId: 'lot-1',
            quantityDelta: 1,
            costBasisDeltaCent: 90,
            costBasisStatus: 'estimated',
          },
        ],
      })
    );

    expect(snapshot.openCostBasis).toEqual({ status: 'estimated', cents: 1090 });
    expect(snapshot.unrealizedPnL).toEqual({ status: 'estimated', cents: 910 });
  });

  it.each([
    {
      name: 'negative effective quantity',
      input: baseInput({
        adjustments: [
          {
            id: 'too-large-removal',
            lotId: 'lot-1',
            quantityDelta: -11,
            costBasisDeltaCent: -1100,
            costBasisStatus: 'known',
          },
        ],
      }),
      issue: 'effective_quantity_negative',
    },
    {
      name: 'sale larger than inventory',
      input: baseInput({
        saleAllocations: [
          {
            id: 'oversold',
            lotId: 'lot-1',
            quantity: 11,
            costBasisCentSnapshot: 1100,
            costBasisStatus: 'known',
            netProceedsCentSnapshot: 1500,
          },
        ],
      }),
      issue: 'sold_quantity_exceeds_inventory',
    },
    {
      name: 'deck reservation larger than remaining inventory',
      input: baseInput({
        deckAllocations: [{ id: 'overreserved', lotId: 'lot-1', quantity: 11 }],
      }),
      issue: 'deck_reservation_exceeds_remaining',
    },
  ])('reports and rejects $name', ({ input, issue }) => {
    const snapshot = calculateLotAccounting(input);
    expect(snapshot.issues.map(row => row.code)).toContain(issue);
    expect(() => assertAccountingSnapshot(snapshot)).toThrow();
  });

  it('is independent of input event ordering', () => {
    const adjustments = [
      {
        id: 'a',
        lotId: 'lot-1',
        quantityDelta: 2,
        costBasisDeltaCent: 200,
        costBasisStatus: 'known' as const,
      },
      {
        id: 'b',
        lotId: 'lot-1',
        quantityDelta: -1,
        costBasisDeltaCent: -100,
        costBasisStatus: 'known' as const,
      },
    ];

    const forward = calculateLotAccounting(baseInput({ adjustments }));
    const reverse = calculateLotAccounting(baseInput({ adjustments: [...adjustments].reverse() }));

    expect(reverse).toEqual(forward);
  });
});
