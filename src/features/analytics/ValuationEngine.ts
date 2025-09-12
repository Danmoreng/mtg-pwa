import { Money } from '../../core/Money';
import {cardLotRepository, pricePointRepository, transactionRepository} from '../../data/repos';
import type { CardLot } from '../../data/db';

// Valuation engine for calculating portfolio value and P/L
export class ValuationEngine {
  // Calculate the current value of a card lot
  static async calculateLotValue(lot: CardLot): Promise<Money> {
    // Get the latest price for the card from the database
    if (lot.cardId) {
      const pricePoints = await pricePointRepository.getByCardId(lot.cardId);
      
      // Find the most recent price point
      if (pricePoints.length > 0) {
        // Sort by date descending to get the most recent price
        pricePoints.sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
        const latestPricePoint = pricePoints[0];
        
        const price = new Money(latestPricePoint.price, latestPricePoint.currency);
        // Only value the remaining quantity that hasn't been disposed
        const remainingQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
        return price.multiply(remainingQuantity);
      }
    }
    
    // If we can't get a price, return zero
    return new Money(0, 'EUR');
  }

  // Calculate the cost basis of a card lot
  static async calculateLotCostBasis(lot: CardLot): Promise<Money> {
    // Use enhanced cost calculation that includes fees and shipping
    if (lot.totalAcquisitionCostCent) {
      const remaining = lot.disposedQuantity ? (lot.quantity - lot.disposedQuantity) : lot.quantity;
      const proportion = remaining / lot.quantity;
      return new Money(lot.totalAcquisitionCostCent * proportion, lot.currency || 'EUR');
    }
    
    const unitCost = new Money(lot.unitCost, lot.currency || 'EUR');
    const remaining = lot.disposedQuantity ? (lot.quantity - lot.disposedQuantity) : lot.quantity;
    return unitCost.multiply(remaining);
  }

  // Calculate realized P/L from SELL transactions
  static async calculateRealizedPnL(): Promise<Money> {
    // Get all SELL transactions
    const sellTransactions = await transactionRepository.getByKind('SELL');
    
    // Calculate realized P/L
    let totalRealizedPnL = new Money(0, 'EUR');
    
    for (const transaction of sellTransactions) {
      // Revenue from sale
      const revenue = new Money(transaction.unitPrice, transaction.currency).multiply(transaction.quantity);
      
      // Calculate actual costs using FIFO
      let costs = new Money(0, 'EUR');
      
      // If this transaction is linked to a lot, use the lot's cost basis
      if (transaction.lotId) {
        const lot = await cardLotRepository.getById(transaction.lotId);
        if (lot) {
          // Use enhanced cost calculation that includes fees and shipping
          const lotCost = lot.totalAcquisitionCostCent ? 
                         new Money(lot.totalAcquisitionCostCent, lot.currency || 'EUR') :
                         new Money(lot.unitCost, lot.currency || 'EUR').multiply(lot.quantity);
          costs = lotCost.multiply(transaction.quantity / lot.quantity);
        }
      } else if (transaction.cardId) {
        // Fallback to lot-based FIFO calculation if no lot is linked
        costs = await this.calculateFIFOCostForCard(transaction.cardId, transaction.quantity);
      }
      
      // Subtract fees and shipping
      const fees = new Money(transaction.fees, transaction.currency);
      const shipping = new Money(transaction.shipping, transaction.currency);
      
      const realizedPnL = revenue.subtract(costs).subtract(fees).subtract(shipping);
      totalRealizedPnL = totalRealizedPnL.add(realizedPnL);
    }
    
    return totalRealizedPnL;
  }

  // Calculate FIFO cost for a given card and quantity using lot-based tracking
  static async calculateFIFOCostForCard(cardId: string, quantity: number): Promise<Money> {
    // Get all active lots for this card, sorted by purchase date (FIFO)
    const lots = await cardLotRepository.getByCardId(cardId);
    
    // Filter and sort lots by purchase date (FIFO)
    const activeLots = lots
      .filter((lot: any) => !lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity))
      .sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());
    
    // Calculate cost basis based on quantity
    let remainingQuantity = quantity;
    let totalCost = new Money(0, 'EUR');
    
    for (const lot of activeLots) {
      if (remainingQuantity <= 0) break;
      
      // Calculate how many items from this lot are still available
      const availableQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
      const quantityToUse = Math.min(remainingQuantity, availableQuantity);
      
      const unitCost = new Money(lot.unitCost, lot.currency || 'EUR');
      const cost = unitCost.multiply(quantityToUse);
      
      totalCost = totalCost.add(cost);
      remainingQuantity -= quantityToUse;
    }
    
    return totalCost;
  }

  // Calculate current portfolio value
  static async calculatePortfolioValue(): Promise<Money> {
    // Get all card lots
    const lots = await cardLotRepository.getAll();
    let totalValue = new Money(0, 'EUR');
    
    for (const lot of lots) {
      // Only count lots that haven't been fully disposed
      if (!lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity)) {
        const lotValue = await this.calculateLotValue(lot);
        totalValue = totalValue.add(lotValue);
      }
    }
    
    return totalValue;
  }

  // Calculate total cost basis
  static async calculateTotalCostBasis(): Promise<Money> {
    // Get all card lots
    const lots = await cardLotRepository.getAll();
    let totalCostBasis = new Money(0, 'EUR');
    
    for (const lot of lots) {
      // Only count lots that haven't been fully disposed
      if (!lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity)) {
        const costBasis = await this.calculateLotCostBasis(lot);
        totalCostBasis = totalCostBasis.add(costBasis);
      }
    }
    
    return totalCostBasis;
  }

  // Calculate unrealized P/L
  static async calculateUnrealizedPnL(): Promise<Money> {
    const portfolioValue = await this.calculatePortfolioValue();
    const costBasis = await this.calculateTotalCostBasis();
    return portfolioValue.subtract(costBasis);
  }

  // Get all active lots (lots that still have cards that haven't been sold)
  static async getActiveLots(): Promise<CardLot[]> {
    const lots = await cardLotRepository.getAll();
    return lots.filter(lot => !lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity));
  }

  // Get the total quantity of a card that is still owned (not disposed)
  static async getOwnedQuantity(cardId: string): Promise<number> {
    const lots = await cardLotRepository.getByCardId(cardId);
    let totalOwned = 0;
    
    for (const lot of lots) {
      if (!lot.disposedAt) {
        totalOwned += lot.quantity;
      } else if (lot.disposedQuantity && lot.disposedQuantity < lot.quantity) {
        totalOwned += lot.quantity - lot.disposedQuantity;
      }
    }
    
    return totalOwned;
  }
}