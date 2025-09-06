/*import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckImportService } from '../../features/decks/DeckImportService';
import { cardRepository, cardLotRepository } from '../../data/repos';
import db from '../../data/db';

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
  holdingRepository: {
    getByCardId: vi.fn()
  },
  transactionRepository: {
    getByLotId: vi.fn()
  }
}));

// Mock EntityLinker
vi.mock('../features/linker/EntityLinker', () => ({
  EntityLinker: {
    resolveFingerprint: vi.fn().mockResolvedValue('test-card-id')
  }
}));

// Mock ScryfallProvider
vi.mock('../features/pricing/ScryfallProvider', () => ({
  ScryfallProvider: {
    hydrateCard: vi.fn().mockResolvedValue({
      oracle_id: 'test-oracle-id',
      set_name: 'Test Set',
      lang: 'en',
      image_uris: {
        normal: 'https://example.com/image.jpg'
      }
    }),
    getImageUrlById: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
    getPriceById: vi.fn().mockResolvedValue({
      getCurrency: vi.fn().mockReturnValue('EUR'),
      getCents: vi.fn().mockReturnValue(1000)
    })
  }
}));

describe('DeckImportService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Clear the database tables
    db.cards.clear();
    db.card_lots.clear();
    db.deck_cards.clear();
  });

  describe('importDeckFromText', () => {
    it('should import a deck and create lots for new cards', async () => {
      // Mock that the card doesn't exist yet
      vi.mocked(cardRepository.getById).mockResolvedValue(undefined);
      
      // Mock that there are no existing lots for this card
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([]);
      
      const deckName = 'Test Deck';
      const deckText = '1 Test Card (TS) 1';
      
      await DeckImportService.importDeckFromText(deckName, deckText);
      
      // Verify that a card was created
      expect(cardRepository.add).toHaveBeenCalled();
      
      // Verify that a lot was created
      expect(cardLotRepository.add).toHaveBeenCalled();
      
      // Verify that a deck card was created
      const deckCards = await db.deck_cards.toArray();
      expect(deckCards).toHaveLength(1);
      expect(deckCards[0].cardId).toBe('test-card-id');
      expect(deckCards[0].quantity).toBe(1);
    });

    it('should link deck cards to existing lots when possible', async () => {
      // Mock that the card already exists
      vi.mocked(cardRepository.getById).mockResolvedValue({
        id: 'test-card-id',
        name: 'Test Card'
      });
      
      // Mock that there is an existing lot for this card
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([
        {
          id: 'existing-lot-id',
          cardId: 'test-card-id',
          quantity: 2,
          disposedQuantity: 0
        }
      ]);
      
      const deckName = 'Test Deck';
      const deckText = '1 Test Card (TS) 1';
      
      await DeckImportService.importDeckFromText(deckName, deckText);
      
      // Verify that no new lot was created (card already exists)
      expect(cardLotRepository.add).not.toHaveBeenCalled();
      
      // Verify that a deck card was created and linked to the existing lot
      const deckCards = await db.deck_cards.toArray();
      expect(deckCards).toHaveLength(1);
      expect(deckCards[0].cardId).toBe('test-card-id');
      expect(deckCards[0].lotId).toBe('existing-lot-id');
      expect(deckCards[0].quantity).toBe(1);
    });

    it('should create new lots only when needed quantity exceeds existing lots', async () => {
      // Mock that the card already exists
      vi.mocked(cardRepository.getById).mockResolvedValue({
        id: 'test-card-id',
        name: 'Test Card'
      });
      
      // Mock that there is an existing lot for this card with quantity 1
      vi.mocked(cardLotRepository.getByCardId).mockResolvedValue([
        {
          id: 'existing-lot-id',
          cardId: 'test-card-id',
          quantity: 1,
          disposedQuantity: 0
        }
      ]);
      
      const deckName = 'Test Deck';
      const deckText = '2 Test Card (TS) 1'; // Requesting 2 cards but only have 1
      
      await DeckImportService.importDeckFromText(deckName, deckText);
      
      // Verify that a new lot was created for the additional card needed
      expect(cardLotRepository.add).toHaveBeenCalled();
      
      // Verify that deck cards were created
      const deckCards = await db.deck_cards.toArray();
      expect(deckCards).toHaveLength(1);
      expect(deckCards[0].cardId).toBe('test-card-id');
      expect(deckCards[0].quantity).toBe(2);
    });
  });
});*/