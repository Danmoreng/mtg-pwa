import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValuationEngine } from '../../features/analytics/ValuationEngine';
import { Money } from '../../core/Money';
import { cardLotRepository, pricePointRepository } from '../../data/repos';
import { PriceQueryService } from '../../features/pricing/PriceQueryService';

// Mock the repositories
vi.mock('../../data/repos', () => ({
  cardLotRepository: {
    getAll: vi.fn(),
    getById: vi.fn()
  },
  pricePointRepository: {
    getByCardId: vi.fn()
  },
  transactionRepository: {
    getByKind: vi.fn(),
    getBuyTransactionsByCardId: vi.fn()
  },
  valuationRepository: {
    getAll: vi.fn(),
    add: vi.fn()
  }
}));

// Mock the PriceQueryService
vi.mock('../../features/pricing/PriceQueryService', () => ({
  PriceQueryService: {
    getLatestPriceForCard: vi.fn()
  }
}));

describe('ValuationEngine', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('calculateLotValue', () => {
    it('should calculate the value of a card lot', async () => {
      const lot = {
        cardId: 'test-card-1',
        quantity: 3,
        disposedQuantity: 1
      };

      // Mock price points
      vi.mocked(PriceQueryService.getLatestPriceForCard).mockResolvedValue({
        price: new Money(1500, 'EUR'), // 15.00 EUR in cents
        asOf: new Date(),
        provider: 'scryfall'
      });

      const value = await ValuationEngine.calculateLotValue(lot);
      expect(value).toBeInstanceOf(Money);
      // Should value only the remaining quantity (3 - 1 = 2)
      expect(value.getCents()).toBe(3000); // 2 * 15.00 EUR
    });

    it('should return zero value when no price points exist', async () => {
      const lot = {
        cardId: 'test-card-1',
        quantity: 3
      };

      // Mock no price points
      vi.mocked(PriceQueryService.getLatestPriceForCard).mockResolvedValue(null);

      const value = await ValuationEngine.calculateLotValue(lot);
      expect(value).toBeInstanceOf(Money);
      expect(value.getCents()).toBe(0);
    });
  });

  describe('calculateLotCostBasis', () => {
    it('should calculate the cost basis of a card lot', async () => {
      const lot = {
        unitCost: 1000, // 10.00 EUR in cents
        quantity: 3,
        disposedQuantity: 1
      };

      const costBasis = await ValuationEngine.calculateLotCostBasis(lot);
      expect(costBasis).toBeInstanceOf(Money);
      // Should calculate cost basis for remaining quantity (3 - 1 = 2)
      expect(costBasis.getCents()).toBe(2000); // 2 * 10.00 EUR
    });
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate the total portfolio value', async () => {
      // Mock card lots
      vi.mocked(cardLotRepository.getAll).mockResolvedValue([
        {
          cardId: 'test-card-1',
          quantity: 2,
          disposedQuantity: 0
        },
        {
          cardId: 'test-card-2',
          quantity: 1,
          disposedQuantity: 0
        }
      ]);

      // Mock price points
      vi.mocked(PriceQueryService.getLatestPriceForCard).mockImplementation((cardId: string) => {
        if (cardId === 'test-card-1') {
          return Promise.resolve({
            price: new Money(1500, 'EUR'), // 15.00 EUR in cents
            asOf: new Date(),
            provider: 'scryfall'
          });
        } else if (cardId === 'test-card-2') {
          return Promise.resolve({
            price: new Money(2000, 'EUR'), // 20.00 EUR in cents
            asOf: new Date(),
            provider: 'scryfall'
          });
        }
        return Promise.resolve(null);
      });

      const portfolioValue = await ValuationEngine.calculatePortfolioValue();
      expect(portfolioValue).toBeInstanceOf(Money);
      // Should be (2 * 15.00) + (1 * 20.00) = 50.00 EUR
      expect(portfolioValue.getCents()).toBe(5000);
    });
  });

  describe('calculateTotalCostBasis', () => {
    it('should calculate the total cost basis', async () => {
      // Mock card lots
      vi.mocked(cardLotRepository.getAll).mockResolvedValue([
        {
          unitCost: 1000, // 10.00 EUR in cents
          quantity: 2,
          disposedQuantity: 0
        },
        {
          unitCost: 1500, // 15.00 EUR in cents
          quantity: 1,
          disposedQuantity: 0
        }
      ]);

      const totalCostBasis = await ValuationEngine.calculateTotalCostBasis();
      expect(totalCostBasis).toBeInstanceOf(Money);
      // Should be (2 * 10.00) + (1 * 15.00) = 35.00 EUR
      expect(totalCostBasis.getCents()).toBe(3500);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('should calculate the unrealized profit/loss', async () => {
      // Mock portfolio value calculation
      vi.spyOn(ValuationEngine, 'calculatePortfolioValue').mockResolvedValue(
        new Money(5000, 'EUR') // 50.00 EUR
      );

      // Mock cost basis calculation
      vi.spyOn(ValuationEngine, 'calculateTotalCostBasis').mockResolvedValue(
        new Money(3500, 'EUR') // 35.00 EUR
      );

      const unrealizedPnL = await ValuationEngine.calculateUnrealizedPnL();
      expect(unrealizedPnL).toBeInstanceOf(Money);
      // Should be 50.00 - 35.00 = 15.00 EUR
      expect(unrealizedPnL.getCents()).toBe(1500);
    });
  });
});