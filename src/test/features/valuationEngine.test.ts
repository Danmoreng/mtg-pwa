/*import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValuationEngine } from '../../features/analytics/ValuationEngine';
import { Money } from '../../core/Money';
import { cardLotRepository, pricePointRepository } from '../../data/repos';

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
      vi.mocked(pricePointRepository.getByCardId).mockResolvedValue([
        {
          price: 1500, // 15.00 EUR in cents
          currency: 'EUR',
          asOf: new Date()
        }
      ]);

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
      vi.mocked(pricePointRepository.getByCardId).mockResolvedValue([]);

      const value = await ValuationEngine.calculateLotValue(lot);
      expect(value).toBeInstanceOf(Money);
      expect(value.getCents()).toBe(0);
    });
  });

  describe('calculateLotCostBasis', () => {
    it('should calculate the cost basis of a card lot', async () => {
      const lot = {
        unitCost: 1000, // 10.00 EUR in cents
        quantity: 3
      };

      const costBasis = await ValuationEngine.calculateLotCostBasis(lot);
      expect(costBasis).toBeInstanceOf(Money);
      expect(costBasis.getCents()).toBe(3000); // 3 * 10.00 EUR
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
      vi.mocked(pricePointRepository.getByCardId).mockImplementation((cardId: string) => {
        if (cardId === 'test-card-1') {
          return Promise.resolve([
            {
              price: 1500, // 15.00 EUR in cents
              currency: 'EUR',
              asOf: new Date()
            }
          ]);
        } else if (cardId === 'test-card-2') {
          return Promise.resolve([
            {
              price: 2000, // 20.00 EUR in cents
              currency: 'EUR',
              asOf: new Date()
            }
          ]);
        }
        return Promise.resolve([]);
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
          quantity: 2
        },
        {
          unitCost: 1500, // 15.00 EUR in cents
          quantity: 1
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
});*/