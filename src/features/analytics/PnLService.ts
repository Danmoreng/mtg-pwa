// 8) Per-box analytics (P&L)

import { acquisitionRepository, cardLotRepository, transactionRepository } from '../../data/repos';
import { PriceQueryService } from '../../features/pricing/PriceQueryService';
// import { parseIdentity } from '../../shared/identity'; // Not currently used in this file, removing unused import

interface LotPnL {
  lotId: string;
  cardId: string;
  quantity: number;
  acquisitionCostCent: number;
  saleRevenueCent: number;
  feesCent: number;
  shippingCent: number;
  realizedPnLCent: number;
}

interface AcquisitionPnL {
  totalCostCent: number;
  totalRevenueCent: number;
  realizedPnLCent: number;
  unrealizedPnLCent: number;
  lots: LotPnL[];
}

/**
 * Calculate P&L for an acquisition
 * @param acquisitionId 
 * @param asOf 
 * @returns Promise<AcquisitionPnL>
 */
async function getAcquisitionPnL(
  acquisitionId: string,
  asOf: Date = new Date()
): Promise<AcquisitionPnL> {
  const A = await acquisitionRepository.getById(acquisitionId);
  if (!A) throw new Error('Acquisition not found');

  const totalCostCent = (A.totalPriceCent ?? 0) + (A.totalFeesCent ?? 0) + (A.totalShippingCent ?? 0);
  
  // Get all lots associated with this acquisition
  const lots = await cardLotRepository.getByAcquisitionId(acquisitionId);
  
  let totalRevenueCent = 0;
  let realizedPnLCent = 0;
  let unrealizedPnLCent = 0;
  const lotPnLs: LotPnL[] = [];

  // Process each lot
  for (const lot of lots) {
    // 8.1 Realized P&L (sold)
    const sellTransactions = await transactionRepository.getByLotId(lot.id);
    const relevantSells = sellTransactions.filter(tx => 
      tx.kind === 'SELL' && tx.happenedAt <= asOf
    );

    let revenue_t = 0;
    let cogs_t = 0;
    let fees_t = 0;
    let shipping_t = 0;
    let realized_pnl_t = 0;

    for (const sell of relevantSells) {
      // revenue_t = t.quantity * t.unitPrice - t.fees + t.shipping
      revenue_t += sell.quantity * sell.unitPrice - (sell.fees || 0) + (sell.shipping || 0);
      
      // cogs_t = t.quantity * lot.unitCostCent
      const acquisitionCost = lot.totalAcquisitionCostCent || 
        (lot.unitCost * lot.quantity);
      cogs_t += (acquisitionCost / lot.quantity) * sell.quantity;
      
      fees_t += sell.fees || 0;
      shipping_t += sell.shipping || 0;
    }

    realized_pnl_t = revenue_t - cogs_t;
    totalRevenueCent += revenue_t;
    realizedPnLCent += realized_pnl_t;

    // 8.2 Unrealized P&L (remaining)
    const remainingQuantity = lot.quantity - 
      relevantSells.reduce((sum, sell) => sum + sell.quantity, 0);
    
    if (remainingQuantity > 0) {
      // Get current market price for the card
      const latestPrice = await PriceQueryService.getLatestPriceForCard(lot.cardId);
      const currentPriceCent = latestPrice ? latestPrice.price.getCents() : 0;
      
      // mtm_lot = remaining_q * current_price(cardId, finish)
      const mtm_lot = remainingQuantity * currentPriceCent;
      
      // unrealized_pnl_lot = mtm_lot - (remaining_q * lot.unitCostCent)
      const acquisitionCost = lot.totalAcquisitionCostCent || 
        (lot.unitCost * lot.quantity);
      const unitCostCent = acquisitionCost / lot.quantity;
      const unrealized_pnl_lot = mtm_lot - (remainingQuantity * unitCostCent);
      
      unrealizedPnLCent += unrealized_pnl_lot;
    }

    // Add to lot P&L details
    lotPnLs.push({
      lotId: lot.id,
      cardId: lot.cardId,
      quantity: lot.quantity,
      acquisitionCostCent: lot.totalAcquisitionCostCent || (lot.unitCost * lot.quantity),
      saleRevenueCent: revenue_t,
      feesCent: fees_t,
      shippingCent: shipping_t,
      realizedPnLCent: realized_pnl_t
    });
  }

  return {
    totalCostCent,
    totalRevenueCent,
    realizedPnLCent,
    unrealizedPnLCent,
    lots: lotPnLs
  };
}

export { getAcquisitionPnL, type AcquisitionPnL, type LotPnL };