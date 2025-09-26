// 7) Cost allocation service (per acquisition)

import { acquisitionRepository, cardLotRepository, pricePointRepository } from '../../data/repos';
import type { CardLot } from '../../data/db';
import db from '../../data/db';

type AllocationMethod = 'equal_per_card' | 'by_market_price' | 'manual' | 'by_rarity';

interface AllocationOptions {
  provider?: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide';
  date?: string;
}

/**
 * Compute weights for cost allocation
 * @param lots 
 * @param method 
 * @param opts 
 * @returns Promise<number[]> - weights array same length as lots
 */
async function computeWeights(
  lots: CardLot[],
  method: AllocationMethod,
  opts?: AllocationOptions
): Promise<number[]> {
  const weights: number[] = [];
  
  switch (method) {
    case 'equal_per_card':
      // Distributes total cost equally per physical card across all lots (by quantity)
      for (const lot of lots) {
        weights.push(lot.quantity);
      }
      break;
      
    case 'by_market_price':
      // Weight by PricePoint (e.g., avg7dCent) near happenedAt
      const provider = opts?.provider || 'scryfall';
      const date = opts?.date || new Date().toISOString().slice(0, 10);
      
      for (const lot of lots) {
        // Get price point for this card
        const pricePoints = await pricePointRepository.getByCardIdAndProviderAndFinishAndDate(
          lot.cardId,
          provider,
          lot.finish || 'nonfoil',
          date
        );
        
        if (pricePoints.length > 0) {
          // Use the first price point (should be the most relevant)
          const pricePoint = pricePoints[0];
          weights.push(pricePoint.priceCent * lot.quantity);
        } else {
          // Fallback to equal distribution if no price point found
          weights.push(lot.quantity);
        }
      }
      break;
      
    case 'by_rarity':
      // Heuristic weights (mythic > rare > uncommon > common)
      // For simplicity, we'll use a basic mapping
      // In a real implementation, you would look up the card's rarity
      for (const lot of lots) {
        // Placeholder weights - in reality you'd determine this from card data
        const rarityWeight = 1; // default
        weights.push(lot.quantity * rarityWeight);
      }
      break;
      
    case 'manual':
      // UI provides per-lot overrides
      // For now, we'll default to equal distribution
      for (const lot of lots) {
        weights.push(lot.quantity);
      }
      break;
  }
  
  return weights;
}

/**
 * Allocate acquisition costs to lots
 * @param acquisitionId 
 * @param method 
 * @param opts 
 */
async function allocateAcquisitionCosts(
  acquisitionId: string,
  method: AllocationMethod,
  opts?: AllocationOptions
): Promise<void> {
  return db.transaction('rw', db.card_lots, db.acquisitions, db.price_points, async () => {
    const A = await acquisitionRepository.getById(acquisitionId);
    if (!A) throw new Error('Acquisition not found');
    
    const total = (A.totalPriceCent ?? 0) + (A.totalFeesCent ?? 0) + (A.totalShippingCent ?? 0);
    const lots = await cardLotRepository.getByAcquisitionId(acquisitionId);
    const weights = await computeWeights(lots, method, opts); // number[] same length as lots
    
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;

    // Largest Remainder Method (LRM) for fair rounding
    const idealAllocations = lots.map((_, i) => total * (weights[i] / sumW));
    const floorAllocations = idealAllocations.map(alloc => Math.floor(alloc));
    const totalFloor = floorAllocations.reduce((a, b) => a + b, 0);
    let remainder = total - totalFloor;

    const remainders = idealAllocations.map((alloc, i) => alloc - floorAllocations[i]);
    const lotsWithRemainders = lots
      .map((lot, i) => ({ lot, remainder: remainders[i], originalIndex: i }))
      .sort((a, b) => b.remainder - a.remainder);

    const finalAllocations = [...floorAllocations];
    for (let i = 0; i < remainder; i++) {
      const lotToIncrement = lotsWithRemainders[i];
      if (lotToIncrement) {
        finalAllocations[lotToIncrement.originalIndex]++;
      }
    }

    for (let i = 0; i < lots.length; i++) {
      const alloc = finalAllocations[i];
      const unit = Math.floor(alloc / Math.max(1, lots[i].quantity));
      await cardLotRepository.update(lots[i].id, {
        totalAcquisitionCostCent: alloc,
        unitCost: unit,
        acquisitionPriceCent: alloc, // optional: keep quartet in sync
        updatedAt: new Date()
      });
    }
    
    await acquisitionRepository.update(acquisitionId, {
      totalCostCent: total,
      allocationMethod: method,
      allocationAsOf: new Date(),
      allocationSourceRev: opts?.provider ? `${opts.provider}:${opts?.date ?? ''}` : undefined,
      updatedAt: new Date()
    });
  });
}

export { allocateAcquisitionCosts, type AllocationMethod, type AllocationOptions };