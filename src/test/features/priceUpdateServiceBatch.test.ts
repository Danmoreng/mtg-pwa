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
    getPricesByIds: vi.fn()
  }
}));

vi.mock('../../data/db', () => ({
  default: {
    price_points: {
      put: vi.fn()
    }
  }
}));

describe('PriceUpdateService with Batch Processing', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('syncPrices', () => {
    it('should process cards in batches and call progress callback correctly', async () => {
      // Mock data with more cards than batch size to test batching
      const cards = [
        { id: 'card-1', name: 'Card 1' },
        { id: 'card-2', name: 'Card 2' },
        { id: 'card-3', name: 'Card 3' },
        { id: 'card-4', name: 'Card 4' },
        { id: 'card-5', name: 'Card 5' }
      ];
      
      // Mock batched price responses
      const mockBatchPrices = [
        [
          { 'card-1': { eur: 1.5, eur_foil: 3.0 } },
          { 'card-2': { eur: 2.0 } },
          { 'card-3': { eur: 2.5, eur_foil: 5.0 } },
          { 'card-4': { eur: 3.0 } },
          { 'card-5': { eur: 3.5 } }
        ]
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPricesByIds as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockBatchPrices[0]);
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Progress callback spy
      const progressCallback = vi.fn();

      // Execute the function
      await PriceUpdateService.syncPrices(progressCallback);

      // Verify batching - should be called once (5 cards with batch size of 75)
      expect(ScryfallProvider.getPricesByIds).toHaveBeenCalledTimes(1);
      expect(ScryfallProvider.getPricesByIds).toHaveBeenNthCalledWith(1, ['card-1', 'card-2', 'card-3', 'card-4', 'card-5']);

      // Verify progress callback was called with correct values
      expect(progressCallback).toHaveBeenCalledTimes(5);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 5);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 5);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 5);
      expect(progressCallback).toHaveBeenNthCalledWith(4, 4, 5);
      expect(progressCallback).toHaveBeenNthCalledWith(5, 5, 5);

      // Verify database calls - should be called for each card (5 regular + 2 foil)
      expect(db.price_points.put).toHaveBeenCalledTimes(7);
      
      // Verify the first few calls to check structure
      expect(db.price_points.put).toHaveBeenNthCalledWith(1, {
        id: expect.stringContaining('card-1:scryfall:'),
        cardId: 'card-1',
        provider: 'scryfall',
        currency: 'EUR',
        price: 150, // 1.5 EUR in cents
        asOf: expect.any(Date),
        createdAt: expect.any(Date)
      });
      
      expect(db.price_points.put).toHaveBeenNthCalledWith(2, {
        id: expect.stringContaining('card-1:scryfall:'),
        cardId: 'card-1',
        provider: 'scryfall',
        currency: 'EUR',
        price: 300, // 3.0 EUR in cents (foil)
        asOf: expect.any(Date),
        createdAt: expect.any(Date)
      });
    });

    it('should continue processing even when batch price fetch fails', async () => {
      // Mock data
      const cards = [
        { id: 'card-1', name: 'Card 1' },
        { id: 'card-2', name: 'Card 2' },
        { id: 'card-3', name: 'Card 3' }
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPricesByIds as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error')) // First batch fails
        .mockResolvedValueOnce([{ 'card-2': { eur: 2.0 } }, { 'card-3': { eur: 3.0 } }]); // Second batch succeeds
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
      expect(ScryfallProvider.getPricesByIds).toHaveBeenCalledTimes(2);
      expect(db.price_points.put).toHaveBeenCalledTimes(2);
    });

    it('should not call progress callback when not provided', async () => {
      // Mock data
      const cards = [
        { id: 'card-1', name: 'Card 1' }
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPricesByIds as ReturnType<typeof vi.fn>)
        .mockResolvedValue([{ 'card-1': { eur: 1.0 } }]);
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Execute the function without progress callback
      await PriceUpdateService.syncPrices();

      // Verify database calls
      expect(cardRepository.getAll).toHaveBeenCalled();
      expect(ScryfallProvider.getPricesByIds).toHaveBeenCalledTimes(1);
      expect(db.price_points.put).toHaveBeenCalledTimes(1);
    });

    it('should handle cards with no price data gracefully', async () => {
      // Mock data with a card that has no price
      const cards = [
        { id: 'card-1', name: 'Card 1' },
        { id: 'card-2', name: 'Card 2' }
      ];

      (cardRepository.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cards);
      (ScryfallProvider.getPricesByIds as ReturnType<typeof vi.fn>)
        .mockResolvedValue([{ 'card-1': { eur: 1.0 } }, { 'card-2': {} }]); // Second card has no prices
      (db.price_points.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Progress callback spy
      const progressCallback = vi.fn();

      // Execute the function
      await PriceUpdateService.syncPrices(progressCallback);

      // Verify that put was called only once (for the card with prices)
      expect(ScryfallProvider.getPricesByIds).toHaveBeenCalledTimes(1);
      expect(db.price_points.put).toHaveBeenCalledTimes(1);
    });
  });
});