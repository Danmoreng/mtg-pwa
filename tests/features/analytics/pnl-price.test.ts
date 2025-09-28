import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAcquisitionPnL } from '../src/features/analytics/PnLService';
import { acquisitionRepository, cardLotRepository, transactionRepository } from '../src/data/repos';
import { PriceQueryService } from '../src/features/pricing/PriceQueryService';

// Mock the repositories
vi.mock('../src/data/repos', () => ({
  acquisitionRepository: {
    getById: vi.fn()
  },
  cardLotRepository: {
    getByAcquisitionId: vi.fn()
  },
  transactionRepository: {
    getByLotId: vi.fn()
  }
}));

vi.mock('../src/features/pricing/PriceQueryService', () => ({
  PriceQueryService: {
    getLatestPriceForCard: vi.fn()
  }
}));

describe('PnL Service with Price Integration', () => {
  const mockAcquisition = {
    id: 'acq123',
    totalPriceCent: 10000, // 100.00 EUR
    totalFeesCent: 500,    // 5.00 EUR
    totalShippingCent: 300, // 3.00 EUR
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockLot = {
    id: 'lot123',
    cardId: 'card123',
    cardFingerprint: 'mtg:dom:1:nonfoil:en',
    quantity: 10,
    totalAcquisitionCostCent: 10800, // Total cost for the lot
    unitCost: 1080, // Cost per unit in cents
    finish: 'nonfoil',
    purchasedAt: new Date()
  };

  const mockSellTransaction = {
    id: 'tx123',
    kind: 'SELL',
    quantity: 5,
    unitPrice: 1500, // 15.00 EUR per unit
    fees: 100,       // 1.00 EUR
    shipping: 200,   // 2.00 EUR
    happenedAt: new Date(),
    lotId: 'lot123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate P&L correctly when current market price is available', async () => {
    // Setup
    (acquisitionRepository.getById as vi.Mock).mockResolvedValue(mockAcquisition);
    (cardLotRepository.getByAcquisitionId as vi.Mock).mockResolvedValue([mockLot]);
    (transactionRepository.getByLotId as vi.Mock).mockResolvedValue([mockSellTransaction]);
    
    // Mock the price service to return a current price
    (PriceQueryService.getLatestPriceForCard as vi.Mock).mockResolvedValue({
      price: { getCents: () => 2000 }, // 20.00 EUR per card
      asOf: new Date(),
      provider: 'scryfall'
    });

    // Call the function
    const result = await getAcquisitionPnL('acq123');

    // Verify the results
    expect(result.totalCostCent).toBe(10800); // 10000 + 500 + 300
    expect(result.realizedPnLCent).toBeGreaterThan(0); // Should be positive if selling above cost
    expect(result.unrealizedPnLCent).toBeGreaterThan(0); // Should be positive if market price > cost
    
    // Verify that the PriceQueryService was called
    expect(PriceQueryService.getLatestPriceForCard).toHaveBeenCalledWith('card123');
  });

  it('should handle P&L calculation gracefully when no current market price is available', async () => {
    // Setup
    (acquisitionRepository.getById as vi.Mock).mockResolvedValue(mockAcquisition);
    (cardLotRepository.getByAcquisitionId as vi.Mock).mockResolvedValue([mockLot]);
    (transactionRepository.getByLotId as vi.Mock).mockResolvedValue([mockSellTransaction]);
    
    // Mock the price service to return null (no price available)
    (PriceQueryService.getLatestPriceForCard as vi.Mock).mockResolvedValue(null);

    // Call the function
    const result = await getAcquisitionPnL('acq123');

    // Verify the results
    expect(result.totalCostCent).toBe(10800); // 10000 + 500 + 300
    expect(result.realizedPnLCent).toBeGreaterThan(0); // Realized P&L should still be calculated
    expect(result.unrealizedPnLCent).toBe(0); // Unrealized P&L should be 0 when no price available
    
    // Verify that the PriceQueryService was called
    expect(PriceQueryService.getLatestPriceForCard).toHaveBeenCalledWith('card123');
  });
});