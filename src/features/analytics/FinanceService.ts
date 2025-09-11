import { Money } from '../../core/Money';
import { cardLotRepository, transactionRepository } from '../../data/repos';
import db from '../../data/db';
import type { CardLot } from '../../data/db';

// Finance service for handling complex financial calculations
export class FinanceService {
  // Calculate true acquisition cost per card
  static calculateTrueAcquisitionCost(
    merchandiseValue: number,
    shipmentCosts: number,
    commission: number,
    articleCount: number
  ): number {
    const totalCost = merchandiseValue + shipmentCosts + commission;
    return Math.round((totalCost / articleCount) * 100); // Convert to cents
  }

  // Calculate net revenue per card
  static calculateNetRevenuePerCard(
    merchandiseValue: number,
    shipmentCosts: number,
    commission: number,
    articleCount: number
  ): number {
    const netRevenue = merchandiseValue - shipmentCosts - commission;
    return Math.round((netRevenue / articleCount) * 100); // Convert to cents
  }

  // Sum all fees for a period
  static async getTotalFees(startDate?: Date, endDate?: Date): Promise<Money> {
    const transactions = await transactionRepository.getAll();

    let totalFees = new Money(0, 'EUR');
    for (const tx of transactions) {
      // Filter by date range if provided
      if (startDate && new Date(tx.happenedAt) < startDate) continue;
      if (endDate && new Date(tx.happenedAt) > endDate) continue;
      
      // Add fees from transactions
      totalFees = totalFees.add(new Money(tx.fees || 0, 'EUR'));
    }
    return totalFees;
  }

  // Sum all shipping costs/expenses
  static async getTotalShippingCosts(
    direction: 'purchase' | 'sale',
    startDate?: Date,
    endDate?: Date
  ): Promise<Money> {
    const transactions = await transactionRepository.getAll();
    let totalShipping = new Money(0, 'EUR');
    
    for (const tx of transactions) {
      // Filter by direction (purchase/sale)
      if (direction === 'purchase' && tx.kind !== 'BUY') continue;
      if (direction === 'sale' && tx.kind !== 'SELL') continue;
      
      // Filter by date range if provided
      if (startDate && new Date(tx.happenedAt) < startDate) continue;
      if (endDate && new Date(tx.happenedAt) > endDate) continue;
      
      // Add shipping costs
      totalShipping = totalShipping.add(new Money(tx.shipping || 0, tx.currency || 'EUR'));
    }
    
    return totalShipping;
  }

  // Calculate net profit for a card lot
  static calculateLotNetProfit(lot: CardLot): number {
    if (!lot.disposedAt || !lot.salePriceCent) return 0;

    const acquisitionCost = lot.totalAcquisitionCostCent ||
                            (lot.unitCost * lot.quantity);

    const saleRevenue = lot.totalSaleRevenueCent ||
                        ((lot.salePriceCent * lot.quantity) -
                         (lot.saleFeesCent || 0) +
                         (lot.saleShippingCent || 0));

    return saleRevenue - acquisitionCost;
  }

  // Calculate total net profit for all disposed lots
  static async getTotalNetProfit(): Promise<Money> {
    const lots = await cardLotRepository.getAll();
    let totalNetProfit = new Money(0, 'EUR');
    
    for (const lot of lots) {
      if (lot.disposedAt && lot.totalNetProfitCent !== undefined) {
        totalNetProfit = totalNetProfit.add(new Money(lot.totalNetProfitCent, 'EUR'));
      } else if (lot.disposedAt && lot.salePriceCent) {
        // Calculate net profit for lots that haven't been updated yet
        const netProfit = this.calculateLotNetProfit(lot);
        totalNetProfit = totalNetProfit.add(new Money(netProfit, 'EUR'));
      }
    }
    
    return totalNetProfit;
  }

  // Calculate total revenue from sales
  static async getTotalRevenue(): Promise<Money> {
    const sellTransactions = await transactionRepository.getByKind('SELL');
    let totalRevenue = new Money(0, 'EUR');

    for (const tx of sellTransactions) {
      const revenue = new Money(tx.unitPrice * tx.quantity, tx.currency);
      totalRevenue = totalRevenue.add(revenue);
    }

    return totalRevenue;
  }

  // Calculate total costs including fees and shipping
  static async getTotalCosts(): Promise<Money> {
    const buyTransactions = await transactionRepository.getByKind('BUY');
    let totalCosts = new Money(0, 'EUR');

    for (const tx of buyTransactions) {
      const cost = new Money(tx.unitPrice * tx.quantity, tx.currency);
      const fees = new Money(tx.fees || 0, tx.currency);
      const shipping = new Money(tx.shipping || 0, tx.currency);
      totalCosts = totalCosts.add(cost).add(fees).add(shipping);
    }

    return totalCosts;
  }
}