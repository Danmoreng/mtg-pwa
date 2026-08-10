import { Money } from '../../core/Money';
import { getDb } from '../../data/init';
import { AccountingQueryService } from '../accounting/AccountingQueryService';

export class FinanceService {
  static calculateTrueAcquisitionCost(merchandiseValue: number, shipmentCosts: number, commission: number, articleCount: number): number {
    return Math.round(((merchandiseValue + shipmentCosts + commission) / articleCount) * 100);
  }

  static calculateNetRevenuePerCard(merchandiseValue: number, shipmentCosts: number, commission: number, articleCount: number): number {
    return Math.round(((merchandiseValue - shipmentCosts - commission) / articleCount) * 100);
  }

  static async getTotalFees(startDate?: Date, endDate?: Date): Promise<Money> {
    const db = getDb();
    const [sales, acquisitions] = await Promise.all([db.sales.toArray(), db.acquisitions.toArray()]);
    const inRange = (date: Date) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
    const cents = sales.filter(row => inRange(row.occurredAt)).reduce((sum, row) => sum + row.platformFeesCent, 0) +
      acquisitions.filter(row => inRange(row.occurredAt ?? row.happenedAt)).reduce((sum, row) => sum + (row.feesCent ?? row.totalFeesCent ?? 0), 0);
    return new Money(cents, 'EUR');
  }

  static async getTotalShippingCosts(direction: 'purchase' | 'sale', startDate?: Date, endDate?: Date): Promise<Money> {
    const db = getDb();
    const inRange = (date: Date) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
    if (direction === 'purchase') {
      const rows = await db.acquisitions.toArray();
      return new Money(rows.filter(row => inRange(row.occurredAt ?? row.happenedAt)).reduce((sum, row) => sum + (row.shippingCent ?? row.totalShippingCent ?? 0), 0), 'EUR');
    }
    const rows = await db.sales.toArray();
    return new Money(rows.filter(row => inRange(row.occurredAt)).reduce((sum, row) => sum + row.shippingExpenseCent, 0), 'EUR');
  }

  static async getTotalNetProfit(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).totalPnL;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }

  static async getTotalRevenue(): Promise<Money> {
    const value = await new AccountingQueryService().getPortfolioSummary();
    return new Money(value.grossSalesCent, 'EUR');
  }

  static async getTotalCosts(): Promise<Money> {
    const value = (await new AccountingQueryService().getPortfolioSummary()).acquisitionCost;
    return new Money(value.cents ?? value.knownCents, 'EUR');
  }
}
