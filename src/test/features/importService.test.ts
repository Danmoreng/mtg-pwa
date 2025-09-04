import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportService } from '../../features/imports/ImportService';
import { cardRepository, cardLotRepository, transactionRepository } from '../../data/repos';
import db from '../../data/db';
import { Money } from '../../core/Money';

// Mock the repositories
vi.mock('../data/repos', () => ({
  cardRepository: {
    getById: vi.fn(),
    add: vi.fn()
  },
  cardLotRepository: {
    getByCardId: vi.fn(),
    add: vi.fn(),
    update: vi.fn()
  },
  transactionRepository: {
    getByLotId: vi.fn(),
    add: vi.fn()
  }
}));

// Mock ScryfallProvider
vi.mock('../features/pricing/ScryfallProvider', () => ({
  ScryfallProvider: {
    hydrateCard: vi.fn().mockResolvedValue({
      id: 'test-card-id',
      oracle_id: 'test-oracle-id',
      set_name: 'Test Set',
      lang: 'en'
    }),
    getImageUrlById: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
    getPriceById: vi.fn().mockResolvedValue(new Money(1000, 'EUR')) // 10.00 EUR
  }
}));

// Mock resolveSetCode
vi.mock('../features/pricing/SetCodeResolver', () => ({
  resolveSetCode: vi.fn().mockResolvedValue('TS')
}));

describe('ImportService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Clear the database tables
    db.cards.clear();
    db.card_lots.clear();
    db.transactions.clear();
  });

  describe('importCardmarketArticles', () => {
    it('should import Cardmarket articles and create new lots', async () => {
      const articles = [
        {
          name: 'Test Card',
          expansion: 'Test Set',
          amount: '1',
          price: '10.00',
          shipmentId: '12345',
          lineNumber: 1,
          direction: 'purchase',
          dateOfPurchase: '2023-01-01'
        }
      ];
      
      // Mock that the card doesn't exist yet
      vi.mocked(cardRepository.getById).mockResolvedValue(null);
      
      // Mock that there are no existing lots for this card
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([]);
      
      await ImportService.importCardmarketArticles(articles);
      
      // Verify that a card was created
      expect(cardRepository.add).toHaveBeenCalled();
      
      // Verify that a lot was created
      expect(cardLotRepository.add).toHaveBeenCalled();
      
      // Verify that a transaction was created
      expect(transactionRepository.add).toHaveBeenCalled();
    });

    it('should link Cardmarket purchases to existing lots without purchase transactions', async () => {
      const articles = [
        {
          name: 'Test Card',
          expansion: 'Test Set',
          amount: '1',
          price: '10.00',
          shipmentId: '12345',
          lineNumber: 1,
          direction: 'purchase',
          dateOfPurchase: '2023-01-01'
        }
      ];
      
      // Mock that the card already exists
      vi.mocked(cardRepository.getById).mockResolvedValue({
        id: 'test-card-id',
        name: 'Test Card'
      });
      
      // Mock that there is an existing lot for this card without purchase transactions
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([
        {
          id: 'existing-lot-id',
          cardId: 'test-card-id',
          quantity: 1,
          unitCost: 0, // No purchase transaction yet
          purchasedAt: null
        }
      ]);
      
      // Mock that the existing lot has no purchase transactions
      vi.mocked(transactionRepository.getByLotId).mockResolvedValue([]);
      
      await ImportService.importCardmarketArticles(articles);
      
      // Verify that the existing lot was updated with purchase information
      expect(cardLotRepository.update).toHaveBeenCalledWith('existing-lot-id', {
        unitCost: 1000, // 10.00 EUR in cents
        source: 'cardmarket',
        purchasedAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
      
      // Verify that no new lot was created
      expect(cardLotRepository.add).not.toHaveBeenCalled();
      
      // Verify that a transaction was created and linked to the existing lot
      expect(transactionRepository.add).toHaveBeenCalled();
      const transactionCall = (transactionRepository.add as vi.Mock).mock.calls[0][0];
      expect(transactionCall.lotId).toBe('existing-lot-id');
    });

    it('should create new lots when existing lots already have purchase transactions', async () => {
      const articles = [
        {
          name: 'Test Card',
          expansion: 'Test Set',
          amount: '1',
          price: '10.00',
          shipmentId: '12345',
          lineNumber: 1,
          direction: 'purchase',
          dateOfPurchase: '2023-01-01'
        }
      ];
      
      // Mock that the card already exists
      vi.mocked(cardRepository.getById).mockResolvedValue({
        id: 'test-card-id',
        name: 'Test Card'
      });
      
      // Mock that there is an existing lot for this card with a purchase transaction
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([
        {
          id: 'existing-lot-id',
          cardId: 'test-card-id',
          quantity: 1,
          unitCost: 500, // Already has purchase info
          purchasedAt: new Date()
        }
      ]);
      
      // Mock that the existing lot already has a purchase transaction
      vi.mocked(transactionRepository.getByLotId).mockResolvedValue([
        {
          id: 'existing-transaction-id',
          kind: 'BUY',
          lotId: 'existing-lot-id'
        }
      ]);
      
      await ImportService.importCardmarketArticles(articles);
      
      // Verify that a new lot was created (existing lot already has purchase transaction)
      expect(cardLotRepository.add).toHaveBeenCalled();
      
      // Verify that a transaction was created and linked to the new lot
      expect(transactionRepository.add).toHaveBeenCalled();
      const transactionCall = (transactionRepository.add as vi.Mock).mock.calls[0][0];
      expect(transactionCall.lotId).not.toBe('existing-lot-id');
    });
  });
});