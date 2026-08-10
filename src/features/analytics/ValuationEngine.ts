import { Money } from '../../core/Money';
import type { InventoryLot } from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingQueryService } from '../accounting/AccountingQueryService';
import { getAcquisitionPnL, type AcquisitionPnL } from './PnLService';

export class ValuationEngine {
  static async calculateLotValue(lot: InventoryLot): Promise<Money> {
    const view = (await new AccountingQueryService().getLotViews(lot.cardId)).find(row => row.lot.id === lot.id);
    return new Money(view?.marketValue.status === 'unknown' ? 0 : view?.marketValue.cents ?? 0, 'EUR');
  }

  static async calculateLotCostBasis(lot: InventoryLot): Promise<Money> {
    const view = (await new AccountingQueryService().getLotViews(lot.cardId)).find(row => row.lot.id === lot.id);
    return new Money(view?.snapshot.openCostBasis.status === 'unknown' ? 0 : view?.snapshot.openCostBasis.cents ?? 0, 'EUR');
  }

  static async calculatePortfolioValue(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).marketValue;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }

  static async calculateTotalCostBasis(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).openCostBasis;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }

  static async calculateRealizedPnL(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).realizedPnL;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }

  static async calculateUnrealizedPnL(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).unrealizedPnL;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }

  static async getActiveLots(): Promise<InventoryLot[]> {
    return (await new AccountingQueryService().getLotViews())
      .filter(row => row.snapshot.remainingQuantity > 0)
      .map(row => row.lot);
  }

  static async getOwnedQuantity(cardId: string): Promise<number> {
    return (await new AccountingQueryService().getHoldings())
      .find(row => row.cardId === cardId)?.quantity ?? 0;
  }

  static async createValuationSnapshot(): Promise<void> {
    const db = getDb();
    const summary = await new AccountingQueryService(db).getPortfolioSummary();
    if (
      summary.marketValue.status === 'unknown' ||
      summary.openCostBasis.status === 'unknown' ||
      summary.realizedPnL.status === 'unknown'
    ) {
      console.warn('Valuation snapshot skipped because price or cost basis is incomplete.');
      return;
    }
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const existing = await db.valuations.filter(row => {
      const date = new Date(row.asOf); date.setHours(0, 0, 0, 0); return date.getTime() === startOfDay.getTime();
    }).first();
    if (existing) return;
    await db.valuations.add({
      id: `valuation-${now.getTime()}`,
      asOf: now,
      totalValue: summary.marketValue.cents ?? 0,
      totalCostBasis: summary.openCostBasis.cents ?? 0,
      realizedPnLToDate: summary.realizedPnL.cents ?? 0,
      createdAt: now,
    });
  }

  static async getAcquisitionPnL(acquisitionId: string, asOf: Date = new Date()): Promise<AcquisitionPnL> {
    return getAcquisitionPnL(acquisitionId, asOf);
  }
}
