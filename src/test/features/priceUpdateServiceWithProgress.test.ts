import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceUpdateService } from '../../features/pricing/PriceUpdateService';
import { cardRepository } from '../../data/repos';
import { ScryfallProvider } from '../../features/pricing/ScryfallProvider';
import db from '../../data/db';
import { Money } from '../../core/Money';

// Mock the dependencies
vi.mock('../../data/repos', () => ({
  cardRepository: {
    getAll: vi.fn()
  }
}));

vi.mock('../../features/pricing/ScryfallProvider', () => ({
  ScryfallProvider: {
    getPriceById: vi.fn()
  }
}));

vi.mock('../../data/db', () => ({
  default: {
    price_points: {
      put: vi.fn()
    }
  }
}));

describe('PriceUpdateService with Progress Tracking', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('syncPrices', () => {
    it('should call progress callback with correct values during price sync', async () => {
      // Mock data
      const cards = [
        { id: 'card-1', name: 'Card 1' },
        { id: 'card-2', name: 'Card 2' },
        { id: 'card-3', name: 'Card 3' }
      ];
      
      const mockPrices = [
        new Money(100, 'EUR'),
        new Money(200, 'EUR'),
        new Money(300, 'EUR')
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPriceById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockPrices[0])
        .mockResolvedValueOnce(mockPrices[1])
        .mockResolvedValueOnce(mockPrices[2]);
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Progress callback spy
      const progressCallback = vi.fn();

      // Execute the function
      await PriceUpdateService.syncPrices(progressCallback);

      // Verify progress callback was called with correct values
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3); // 1 out of 3
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3); // 2 out of 3
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3); // 3 out of 3

      // Verify other calls
      expect(cardRepository.getAll).toHaveBeenCalled();
      expect(ScryfallProvider.getPriceById).toHaveBeenCalledTimes(3);
      expect(db.price_points.put).toHaveBeenCalledTimes(3);
    });

    it('should continue processing even when individual card price fetch fails', async () => {
      // Mock data
      const cards = [
        { id: 'card-1', name: 'Card 1' },
        { id: 'card-2', name: 'Card 2' },
        { id: 'card-3', name: 'Card 3' }
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPriceById as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error')) // First card fails
        .mockResolvedValueOnce(new Money(200, 'EUR')) // Second card succeeds
        .mockResolvedValueOnce(new Money(300, 'EUR')); // Third card succeeds
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Progress callback spy
      const progressCallback = vi.fn();

      // Execute the function
      await PriceUpdateService.syncPrices(progressCallback);

      // Verify progress callback was called for all cards
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3);

      // Verify that put was called only twice (for successful cards)
      expect(ScryfallProvider.getPriceById).toHaveBeenCalledTimes(3);
      expect(db.price_points.put).toHaveBeenCalledTimes(2);
    });

    it('should not call progress callback when not provided', async () => {
      // Mock data
      const cards = [
        { id: 'card-1', name: 'Card 1' }
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPriceById as ReturnType<typeof vi.fn>)
        .mockResolvedValue(new Money(100, 'EUR'));
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Progress callback spy
      const progressCallback = vi.fn();

      // Execute the function without progress callback
      await PriceUpdateService.syncPrices();

      // Verify progress callback was never called
      expect(progressCallback).not.toHaveBeenCalled();

      // Verify other calls
      expect(cardRepository.getAll).toHaveBeenCalled();
      expect(ScryfallProvider.getPriceById).toHaveBeenCalledTimes(1);
      expect(db.price_points.put).toHaveBeenCalledTimes(1);
    });
  });
});