export type CostBasisStatus = 'known' | 'estimated' | 'unknown';

export interface AccountingLotInput {
  id: string;
  initialQuantity: number;
  allocatedCostCent?: number;
  costBasisStatus: CostBasisStatus;
}

export interface AccountingAdjustmentInput {
  id: string;
  lotId: string;
  quantityDelta: number;
  costBasisDeltaCent?: number;
  costBasisStatus: CostBasisStatus;
  reversesAdjustmentId?: string;
}

export interface AccountingSaleAllocationInput {
  id: string;
  lotId: string;
  quantity: number;
  costBasisCentSnapshot?: number;
  costBasisStatus: CostBasisStatus;
  netProceedsCentSnapshot: number;
}

export interface AccountingDeckAllocationInput {
  id: string;
  lotId: string;
  quantity: number;
  releasedAt?: Date;
}

export interface LotAccountingInput {
  lot: AccountingLotInput;
  adjustments?: readonly AccountingAdjustmentInput[];
  saleAllocations?: readonly AccountingSaleAllocationInput[];
  deckAllocations?: readonly AccountingDeckAllocationInput[];
  marketValueCent?: number;
}

export type AccountingIssueCode =
  | 'invalid_integer'
  | 'invalid_initial_quantity'
  | 'invalid_adjustment_quantity'
  | 'invalid_allocation_quantity'
  | 'missing_cost_basis_amount'
  | 'effective_quantity_negative'
  | 'sold_quantity_exceeds_inventory'
  | 'deck_reservation_exceeds_remaining';

export interface AccountingIssue {
  code: AccountingIssueCode;
  message: string;
  entityId?: string;
}

export type AccountingMoney =
  | {
      status: 'known' | 'estimated';
      cents: number;
    }
  | {
      status: 'unknown';
    };

export interface LotAccountingSnapshot {
  lotId: string;
  initialQuantity: number;
  adjustmentQuantity: number;
  effectiveQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  deckReservedQuantity: number;
  availableForDecks: number;
  openCostBasis: AccountingMoney;
  realizedPnL: AccountingMoney;
  unrealizedPnL: AccountingMoney;
  issues: AccountingIssue[];
}
