import type {
  AccountingIssue,
  AccountingMoney,
  CostBasisStatus,
  LotAccountingInput,
  LotAccountingSnapshot,
} from './AccountingTypes';

function isIntegerCent(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function mergeCostBasisStatus(
  current: CostBasisStatus,
  next: CostBasisStatus
): CostBasisStatus {
  if (current === 'unknown' || next === 'unknown') return 'unknown';
  if (current === 'estimated' || next === 'estimated') return 'estimated';
  return 'known';
}

function money(status: CostBasisStatus, cents?: number): AccountingMoney {
  if (status === 'unknown' || !isIntegerCent(cents)) {
    return { status: 'unknown' };
  }
  return { status, cents };
}

function addInvalidIntegerIssue(
  issues: AccountingIssue[],
  value: number | undefined,
  fieldName: string,
  entityId?: string
): boolean {
  if (isIntegerCent(value)) return false;
  issues.push({
    code: 'invalid_integer',
    entityId,
    message: `${fieldName} must be a safe integer.`,
  });
  return true;
}

export function calculateLotAccounting(
  input: LotAccountingInput
): LotAccountingSnapshot {
  const { lot } = input;
  const issues: AccountingIssue[] = [];
  const adjustments = (input.adjustments ?? []).filter(row => row.lotId === lot.id);
  const saleAllocations = (input.saleAllocations ?? []).filter(row => row.lotId === lot.id);
  const deckAllocations = (input.deckAllocations ?? []).filter(row => row.lotId === lot.id);

  addInvalidIntegerIssue(issues, lot.initialQuantity, 'initialQuantity', lot.id);
  if (!Number.isSafeInteger(lot.initialQuantity) || lot.initialQuantity <= 0) {
    issues.push({
      code: 'invalid_initial_quantity',
      entityId: lot.id,
      message: 'A lot must have a positive integer initialQuantity.',
    });
  }

  let adjustmentQuantity = 0;
  for (const adjustment of adjustments) {
    addInvalidIntegerIssue(
      issues,
      adjustment.quantityDelta,
      'quantityDelta',
      adjustment.id
    );
    if (!Number.isSafeInteger(adjustment.quantityDelta) || adjustment.quantityDelta === 0) {
      issues.push({
        code: 'invalid_adjustment_quantity',
        entityId: adjustment.id,
        message: 'An inventory adjustment must have a non-zero integer quantityDelta.',
      });
      continue;
    }
    adjustmentQuantity += adjustment.quantityDelta;
  }

  let soldQuantity = 0;
  for (const allocation of saleAllocations) {
    addInvalidIntegerIssue(issues, allocation.quantity, 'quantity', allocation.id);
    if (!Number.isSafeInteger(allocation.quantity) || allocation.quantity <= 0) {
      issues.push({
        code: 'invalid_allocation_quantity',
        entityId: allocation.id,
        message: 'A sale allocation must have a positive integer quantity.',
      });
      continue;
    }
    soldQuantity += allocation.quantity;
  }

  let deckReservedQuantity = 0;
  for (const allocation of deckAllocations) {
    if (allocation.releasedAt) continue;
    addInvalidIntegerIssue(issues, allocation.quantity, 'quantity', allocation.id);
    if (!Number.isSafeInteger(allocation.quantity) || allocation.quantity <= 0) {
      issues.push({
        code: 'invalid_allocation_quantity',
        entityId: allocation.id,
        message: 'A deck allocation must have a positive integer quantity.',
      });
      continue;
    }
    deckReservedQuantity += allocation.quantity;
  }

  const effectiveQuantity = lot.initialQuantity + adjustmentQuantity;
  const remainingQuantity = effectiveQuantity - soldQuantity;
  const availableForDecks = remainingQuantity - deckReservedQuantity;

  if (effectiveQuantity < 0) {
    issues.push({
      code: 'effective_quantity_negative',
      entityId: lot.id,
      message: 'Inventory adjustments reduce effective quantity below zero.',
    });
  }
  if (soldQuantity > effectiveQuantity) {
    issues.push({
      code: 'sold_quantity_exceeds_inventory',
      entityId: lot.id,
      message: 'Allocated sale quantity exceeds effective inventory quantity.',
    });
  }
  if (deckReservedQuantity > remainingQuantity) {
    issues.push({
      code: 'deck_reservation_exceeds_remaining',
      entityId: lot.id,
      message: 'Active deck reservations exceed inventory remaining after sales.',
    });
  }

  let openCostBasisStatus = lot.costBasisStatus;
  let openCostBasisCent = lot.allocatedCostCent;
  if (lot.costBasisStatus !== 'unknown' && !isIntegerCent(lot.allocatedCostCent)) {
    issues.push({
      code: 'missing_cost_basis_amount',
      entityId: lot.id,
      message: 'A known or estimated lot cost basis requires allocatedCostCent.',
    });
    openCostBasisStatus = 'unknown';
    openCostBasisCent = undefined;
  }

  for (const adjustment of adjustments) {
    openCostBasisStatus = mergeCostBasisStatus(
      openCostBasisStatus,
      adjustment.costBasisStatus
    );
    if (
      adjustment.costBasisStatus === 'unknown' ||
      !isIntegerCent(adjustment.costBasisDeltaCent) ||
      !isIntegerCent(openCostBasisCent)
    ) {
      if (
        adjustment.costBasisStatus !== 'unknown' &&
        !isIntegerCent(adjustment.costBasisDeltaCent)
      ) {
        issues.push({
          code: 'missing_cost_basis_amount',
          entityId: adjustment.id,
          message: 'A known or estimated adjustment requires costBasisDeltaCent.',
        });
      }
      openCostBasisStatus = 'unknown';
      openCostBasisCent = undefined;
      continue;
    }
    openCostBasisCent += adjustment.costBasisDeltaCent;
  }

  let realizedStatus: CostBasisStatus = 'known';
  let realizedPnLCent = 0;
  for (const allocation of saleAllocations) {
    if (!isIntegerCent(allocation.netProceedsCentSnapshot)) {
      addInvalidIntegerIssue(
        issues,
        allocation.netProceedsCentSnapshot,
        'netProceedsCentSnapshot',
        allocation.id
      );
      realizedStatus = 'unknown';
    }

    realizedStatus = mergeCostBasisStatus(realizedStatus, allocation.costBasisStatus);
    openCostBasisStatus = mergeCostBasisStatus(
      openCostBasisStatus,
      allocation.costBasisStatus
    );

    if (
      allocation.costBasisStatus === 'unknown' ||
      !isIntegerCent(allocation.costBasisCentSnapshot)
    ) {
      if (
        allocation.costBasisStatus !== 'unknown' &&
        !isIntegerCent(allocation.costBasisCentSnapshot)
      ) {
        issues.push({
          code: 'missing_cost_basis_amount',
          entityId: allocation.id,
          message: 'A known or estimated sale allocation requires a cost basis snapshot.',
        });
      }
      realizedStatus = 'unknown';
      openCostBasisStatus = 'unknown';
      openCostBasisCent = undefined;
      continue;
    }

    if (isIntegerCent(allocation.netProceedsCentSnapshot)) {
      realizedPnLCent +=
        allocation.netProceedsCentSnapshot - allocation.costBasisCentSnapshot;
    }
    if (isIntegerCent(openCostBasisCent)) {
      openCostBasisCent -= allocation.costBasisCentSnapshot;
    }
  }

  const openCostBasis = money(openCostBasisStatus, openCostBasisCent);
  const realizedPnL = money(realizedStatus, realizedPnLCent);

  let unrealizedPnL: AccountingMoney = { status: 'unknown' };
  if (isIntegerCent(input.marketValueCent) && openCostBasis.status !== 'unknown') {
    unrealizedPnL = {
      status: openCostBasis.status,
      cents: input.marketValueCent - openCostBasis.cents,
    };
  }

  return {
    lotId: lot.id,
    initialQuantity: lot.initialQuantity,
    adjustmentQuantity,
    effectiveQuantity,
    soldQuantity,
    remainingQuantity,
    deckReservedQuantity,
    availableForDecks,
    openCostBasis,
    realizedPnL,
    unrealizedPnL,
    issues,
  };
}
