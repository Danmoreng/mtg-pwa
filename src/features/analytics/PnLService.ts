import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingQueryService } from '../accounting/AccountingQueryService';

export interface LotPnL {
  lotId: string;
  cardId: string;
  quantity: number;
  acquisitionCostCent: number;
  saleRevenueCent: number;
  feesCent: number;
  shippingCent: number;
  realizedPnLCent: number;
  costBasisStatus: 'known' | 'estimated' | 'unknown';
}

export interface AcquisitionPnL {
  totalCostCent: number;
  totalRevenueCent: number;
  realizedPnLCent: number;
  unrealizedPnLCent: number;
  costBasisStatus: 'known' | 'estimated' | 'unknown';
  realizedPnLStatus: 'known' | 'estimated' | 'unknown';
  unrealizedPnLStatus: 'known' | 'estimated' | 'unknown';
  lots: LotPnL[];
}

export async function getAcquisitionPnL(
  acquisitionId: string,
  _asOf: Date = new Date(),
  db: MtgTrackerDb = getDb()
): Promise<AcquisitionPnL> {
  const summary = await new AccountingQueryService(db).getAcquisitionSummary(acquisitionId);
  if (!summary) throw new Error('Acquisition not found');

  const allocations = await db.lot_allocations.toArray();
  const allocationsByLot = new Map<string, typeof allocations>();
  for (const allocation of allocations) {
    const rows = allocationsByLot.get(allocation.lotId) ?? [];
    rows.push(allocation);
    allocationsByLot.set(allocation.lotId, rows);
  }

  return {
    totalCostCent: summary.acquisitionCost.cents ?? summary.acquisitionCost.knownCents,
    totalRevenueCent: summary.netSaleProceedsCent,
    realizedPnLCent: summary.realizedPnL.cents ?? summary.realizedPnL.knownCents,
    unrealizedPnLCent: summary.unrealizedPnL.cents ?? summary.unrealizedPnL.knownCents,
    costBasisStatus: summary.acquisitionCost.status,
    realizedPnLStatus: summary.realizedPnL.status,
    unrealizedPnLStatus: summary.unrealizedPnL.status,
    lots: summary.lots.map(row => {
      const lotAllocations = allocationsByLot.get(row.lot.id) ?? [];
      const saleRevenueCent = lotAllocations.reduce(
        (sum, allocation) => sum + allocation.netProceedsCentSnapshot,
        0
      );
      const soldCost = lotAllocations.reduce(
        (sum, allocation) => sum + (allocation.costBasisCentSnapshot ?? 0),
        0
      );
      const openCost =
        row.snapshot.openCostBasis.status === 'unknown'
          ? 0
          : row.snapshot.openCostBasis.cents;
      const realized =
        row.snapshot.realizedPnL.status === 'unknown'
          ? 0
          : row.snapshot.realizedPnL.cents;
      return {
        lotId: row.lot.id,
        cardId: row.lot.cardId,
        quantity: row.lot.initialQuantity,
        acquisitionCostCent: openCost + soldCost,
        saleRevenueCent,
        feesCent: 0,
        shippingCent: 0,
        realizedPnLCent: realized,
        costBasisStatus: row.lot.costBasisStatus,
      };
    }),
  };
}
