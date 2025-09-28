// 8) Per-box analytics (P&L)

import { acquisitionRepository, cardLotRepository, transactionRepository, sellAllocationRepository } from '../../data/repos';
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
    const allocations = await sellAllocationRepository.getByLotId(lot.id);

    let revenue_t = 0;
    let cogs_t = 0;
    let fees_t = 0;
    let shipping_t = 0;
    let realized_pnl_t = 0;

    for (const alloc of allocations) {
        const sell = await transactionRepository.getById(alloc.transactionId);
        if (!sell || sell.happenedAt > asOf) continue;

        const proportion = alloc.quantity / sell.quantity;

        revenue_t += proportion * (sell.quantity * sell.unitPrice - (sell.fees || 0) + (sell.shipping || 0));
        cogs_t += alloc.quantity * (alloc.unitCostCentAtSale ?? lot.unitCost);
        fees_t += proportion * (sell.fees || 0);
        shipping_t += proportion * (sell.shipping || 0);
    }
    realized_pnl_t = revenue_t - cogs_t;

    totalRevenueCent += revenue_t;
    realizedPnLCent += realized_pnl_t;

    // 8.2 Unrealized P&L (remaining)
    const soldQuantity = allocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    const remainingQuantity = lot.quantity - soldQuantity;
    
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