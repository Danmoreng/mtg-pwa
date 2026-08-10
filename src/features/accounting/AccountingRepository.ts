import type MtgTrackerDb from '../../data/db';
import type { InventoryLot } from '../../data/db';
import { calculateLotAccounting } from './AccountingKernel';
import type { LotAccountingSnapshot } from './AccountingTypes';

export interface AvailableInventoryLot {
  lot: InventoryLot;
  snapshot: LotAccountingSnapshot;
}

export class AccountingRepository {
  private readonly db: MtgTrackerDb;

  constructor(db: MtgTrackerDb) {
    this.db = db;
  }

  async getLotSnapshot(
    lotId: string,
    marketValueCent?: number
  ): Promise<LotAccountingSnapshot | undefined> {
    const lot = await this.db.inventory_lots.get(lotId);
    if (!lot) return undefined;

    const [adjustments, saleAllocations, deckAllocations] = await Promise.all([
      this.db.inventory_adjustments.where('lotId').equals(lotId).toArray(),
      this.db.lot_allocations.where('lotId').equals(lotId).toArray(),
      this.db.deck_inventory_allocations.where('lotId').equals(lotId).toArray(),
    ]);

    return calculateLotAccounting({
      lot: {
        id: lot.id,
        initialQuantity: lot.initialQuantity,
        allocatedCostCent: lot.allocatedCostCent,
        costBasisStatus: lot.costBasisStatus,
      },
      adjustments,
      saleAllocations,
      deckAllocations,
      marketValueCent,
    });
  }

  async getAvailableLots(
    cardId: string,
    finish?: InventoryLot['finish'],
    language?: string
  ): Promise<AvailableInventoryLot[]> {
    const lots = await this.db.inventory_lots.where('cardId').equals(cardId).toArray();
    const matchingLots = lots
      .filter(lot => !finish || lot.finish === finish)
      .filter(lot => !language || lot.language.toLowerCase() === language.toLowerCase())
      .sort((left, right) => {
        const dateDifference = left.acquiredAt.getTime() - right.acquiredAt.getTime();
        return dateDifference || left.id.localeCompare(right.id);
      });

    const snapshots = await Promise.all(
      matchingLots.map(lot => this.getLotSnapshot(lot.id))
    );

    return matchingLots.flatMap((lot, index) => {
      const snapshot = snapshots[index];
      return snapshot ? [{ lot, snapshot }] : [];
    });
  }
}
