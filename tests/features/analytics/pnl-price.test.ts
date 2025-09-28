import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAcquisitionPnL } from '@/features/analytics/PnLService';
import { acquisitionRepository, cardLotRepository, transactionRepository, sellAllocationRepository } from '@/data/repos';
import { PriceQueryService } from '@/features/pricing/PriceQueryService';

// Also need to mock sell allocation repository for P&L calculations
vi.mock('@/data/repos', async () => {
  const actual = await vi.importActual('@/data/repos');
  return {
    ...actual,
    acquisitionRepository: {
      getById: vi.fn()
    },
    cardLotRepository: {
      getByAcquisitionId: vi.fn()
    },
    transactionRepository: {
      getById: vi.fn(),
      getByLotId: vi.fn()
    },
    sellAllocationRepository: {
      getByLotId: vi.fn().mockResolvedValue([]) // Initially empty
    }
  };
});

vi.mock('@/features/pricing/PriceQueryService', () => ({
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

  // Mock sell allocation for the transaction
  const mockSellAllocation = {
    id: 'alloc123',
    transactionId: 'tx123',
    lotId: 'lot123',
    quantity: 5,
    unitCostCentAtSale: 1080, // Cost per unit in cents at time of sale
    createdAt: new Date()
  };

  const mockSellTransaction = {
    id: 'tx123',
    kind: 'SELL',
    quantity: 5,
    unitPrice: 1500, // 15.00 EUR per unit
    fees: 100,       // 1.00 EUR
    shipping: 200,   // 2.00 EUR
    happenedAt: new Date(),
    lotId: 'lot123',
    cardId: 'card123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate P&L correctly when current market price is available', async () => {
    // Setup
    (acquisitionRepository.getById as vi.Mock).mockResolvedValue(mockAcquisition);
    (cardLotRepository.getByAcquisitionId as vi.Mock).mockResolvedValue([mockLot]);
    (transactionRepository.getByLotId as vi.Mock).mockResolvedValue([mockSellTransaction]);
    (transactionRepository.getById as vi.Mock).mockResolvedValue(mockSellTransaction);
    (sellAllocationRepository.getByLotId as vi.Mock).mockResolvedValue([mockSellAllocation]);
    
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
    (transactionRepository.getById as vi.Mock).mockResolvedValue(mockSellTransaction);
    (sellAllocationRepository.getByLotId as vi.Mock).mockResolvedValue([mockSellAllocation]);
    
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