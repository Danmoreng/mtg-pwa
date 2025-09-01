import { Money } from '../../core/Money';
import { holdingRepository, transactionRepository } from '../../data/repos';
import { pricePointRepository } from '../../data/repos';

// Valuation engine for calculating portfolio value and P/L
export class ValuationEngine {
  // Calculate the current value of a holding
  static async calculateHoldingValue(holding: any): Promise<Money> {
    // Get the latest price for the card from the database
    if (holding.cardId) {
      const pricePoints = await pricePointRepository.getByCardId(holding.cardId);
      
      // Find the most recent price point
      if (pricePoints.length > 0) {
        // Sort by date descending to get the most recent price
        pricePoints.sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
        const latestPricePoint = pricePoints[0];
        
        const price = new Money(latestPricePoint.price, latestPricePoint.currency);
        return price.multiply(holding.quantity);
      }
    }
    
    // If we can't get a price, return zero
    return new Money(0, 'EUR');
  }

  // Calculate the cost basis of a holding using FIFO
  static async calculateCostBasis(holding: any): Promise<Money> {
    // Get all BUY transactions for this card
    const buyTransactions = await transactionRepository.getByKind('BUY');
    const cardBuyTransactions = buyTransactions.filter(t => t.cardId === holding.cardId);
    
    // Sort by date (FIFO)
    cardBuyTransactions.sort((a, b) => a.happenedAt.getTime() - b.happenedAt.getTime());
    
    // Calculate cost basis based on quantity
    let remainingQuantity = holding.quantity;
    let totalCost = new Money(0, 'EUR');
    
    for (const transaction of cardBuyTransactions) {
      if (remainingQuantity <= 0) break;
      
      const quantityToUse = Math.min(remainingQuantity, transaction.quantity);
      const unitCost = new Money(transaction.unitPrice, transaction.currency);
      const cost = unitCost.multiply(quantityToUse);
      
      totalCost = totalCost.add(cost);
      remainingQuantity -= quantityToUse;
    }
    
    return totalCost;
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
      
      // Costs (simplified - would need to properly implement FIFO in a real implementation)
      const costs = new Money(0, 'EUR'); // Placeholder
      
      // Subtract fees and shipping
      const fees = new Money(transaction.fees, transaction.currency);
      const shipping = new Money(transaction.shipping, transaction.currency);
      
      const realizedPnL = revenue.subtract(costs).subtract(fees).subtract(shipping);
      totalRealizedPnL = totalRealizedPnL.add(realizedPnL);
    }
    
    return totalRealizedPnL;
  }

  // Calculate current portfolio value
  static async calculatePortfolioValue(): Promise<Money> {
    const holdings = await holdingRepository.getAll();
    let totalValue = new Money(0, 'EUR');
    
    for (const holding of holdings) {
      const holdingValue = await this.calculateHoldingValue(holding);
      totalValue = totalValue.add(holdingValue);
    }
    
    return totalValue;
  }

  // Calculate total cost basis
  static async calculateTotalCostBasis(): Promise<Money> {
    const holdings = await holdingRepository.getAll();
    let totalCostBasis = new Money(0, 'EUR');
    
    for (const holding of holdings) {
      const costBasis = await this.calculateCostBasis(holding);
      totalCostBasis = totalCostBasis.add(costBasis);
    }
    
    return totalCostBasis;
  }

  // Calculate unrealized P/L
  static async calculateUnrealizedPnL(): Promise<Money> {
    const portfolioValue = await this.calculatePortfolioValue();
    const costBasis = await this.calculateTotalCostBasis();
    return portfolioValue.subtract(costBasis);
  }
}