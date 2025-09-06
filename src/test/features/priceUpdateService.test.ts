/*import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceUpdateService } from '../../features/pricing/PriceUpdateService';
import { ScryfallProvider } from '../../features/pricing/ScryfallProvider';
import { cardRepository } from '../../data/repos';
import db from '../../data/db';
import { Money } from '../../core/Money';

// Mock the ScryfallProvider
vi.mock('../../features/pricing/ScryfallProvider', () => ({
  ScryfallProvider: {
    getPriceById: vi.fn(),
    hydrateCard: vi.fn(),
    getImageUrlById: vi.fn()
  }
}));

// Mock the card repository
vi.mock('../../data/repos', () => ({
  cardRepository: {
    getAll: vi.fn(),
    getById: vi.fn()
  }
}));

describe('PriceUpdateService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Clear the price_points table
    db.price_points.clear();
  });

  describe('syncPriceForCard', () => {
    it('should sync price for a card', async () => {
      const cardId = 'test-card-1';
      
      // Mock card repository
      vi.mocked(cardRepository.getById).mockResolvedValue({
        id: cardId,
        name: 'Test Card'
      });
      
      // Mock ScryfallProvider
      vi.mocked(ScryfallProvider.getPriceById).mockResolvedValue(
        new Money(1500, 'EUR') // 15.00 EUR
      );
      
      // Spy on db.price_points.put
      const putSpy = vi.spyOn(db.price_points, 'put').mockResolvedValue('test-price-point-1');
      
      await PriceUpdateService.syncPriceForCard(cardId);
      
      expect(ScryfallProvider.getPriceById).toHaveBeenCalledWith(cardId);
      expect(putSpy).toHaveBeenCalled();
      
      // Check that the price point was created with correct data
      const callArgs = putSpy.mock.calls[0][0];
      expect(callArgs.cardId).toBe(cardId);
      expect(callArgs.provider).toBe('scryfall');
      expect(callArgs.currency).toBe('EUR');
      expect(callArgs.price).toBe(1500);
      expect(callArgs.asOf).toBeInstanceOf(Date);
    });
    
    it('should not create price point when no price is returned', async () => {
      const cardId = 'test-card-1';
      
      // Mock card repository
      (cardRepository.getById as vi.Mock).mockResolvedValue({
        id: cardId,
        name: 'Test Card'
      });
      
      // Mock ScryfallProvider to return null
      vi.mocked(ScryfallProvider.getPriceById).mockResolvedValue(null);
      
      // Spy on db.price_points.put
      const putSpy = vi.spyOn(db.price_points, 'put').mockResolvedValue('test-price-point-1');
      
      await PriceUpdateService.syncPriceForCard(cardId);
      
      expect(ScryfallProvider.getPriceById).toHaveBeenCalledWith(cardId);
      expect(putSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('needsPriceUpdateForCard', () => {
    it('should return true when no price points exist for a card', async () => {
      const cardId = 'test-card-1';
      
      // Mock pricePointRepository to return empty array
      vi.spyOn(db.price_points, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      } as any);
      
      const needsUpdate = await PriceUpdateService.needsPriceUpdateForCard(cardId);
      expect(needsUpdate).toBe(true);
    });
    
    it('should return true when price points are older than 24 hours', async () => {
      const cardId = 'test-card-1';
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago
      
      // Mock pricePointRepository to return old price point
      vi.spyOn(db.price_points, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              asOf: oldDate
            }
          ])
        })
      } as any);
      
      const needsUpdate = await PriceUpdateService.needsPriceUpdateForCard(cardId);
      expect(needsUpdate).toBe(true);
    });
    
    it('should return false when price points are newer than 24 hours', async () => {
      const cardId = 'test-card-1';
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 23); // 23 hours ago
      
      // Mock pricePointRepository to return recent price point
      vi.spyOn(db.price_points, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              asOf: recentDate
            }
          ])
        })
      } as any);
      
      const needsUpdate = await PriceUpdateService.needsPriceUpdateForCard(cardId);
      expect(needsUpdate).toBe(false);
    });
  });
  
  describe('getLatestPriceForCard', () => {
    it('should return null when no price points exist for a card', async () => {
      const cardId = 'test-card-1';
      
      // Mock pricePointRepository to return empty array
      vi.spyOn(db.price_points, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      } as any);
      
      const latestPrice = await PriceUpdateService.getLatestPriceForCard(cardId);
      expect(latestPrice).toBeNull();
    });
    
    it('should return the latest price when price points exist', async () => {
      const cardId = 'test-card-1';
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48); // 48 hours ago
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 24); // 24 hours ago
      
      // Mock pricePointRepository to return multiple price points
      vi.spyOn(db.price_points, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              price: 1000,
              asOf: oldDate
            },
            {
              price: 1500,
              asOf: recentDate
            }
          ])
        })
      } as any);
      
      const latestPrice = await PriceUpdateService.getLatestPriceForCard(cardId);
      expect(latestPrice).not.toBeNull();
      expect(latestPrice?.price).toBe(1500);
      expect(latestPrice?.asOf).toBe(recentDate);
    });
  });
});*/