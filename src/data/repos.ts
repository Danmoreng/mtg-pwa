import { getDb } from './init';
import type { 
  Card, 
  CardLot,
  Acquisition,
  Transaction, 
  Scan, 
  Deck, 
  DeckCard, 
  PricePoint, 
  Valuation, 
  Setting,
  ScanSaleLink
} from './db';

// Card repository
export const cardRepository = {
  async add(card: Card): Promise<string> {
    return await getDb().cards.add(card);
  },

  async getById(id: string): Promise<Card | undefined> {
    return await getDb().cards.get(id);
  },

  async getAll(): Promise<Card[]> {
    return await getDb().cards.toArray();
  },

  async getByCardmarketIds(ids: number[]): Promise<Card[]> {
    return await getDb().cards.where('cardmarketId').anyOf(ids).toArray();
  },

  async update(id: string, card: Partial<Card>): Promise<number> {
    return await getDb().cards.update(id, card);
  },

  async delete(id: string): Promise<void> {
    await getDb().cards.delete(id);
  }
};

// CardLot repository
export const cardLotRepository = {
  async add(lot: CardLot): Promise<string> {
    return await getDb().card_lots.add(lot);
  },

  async getById(id: string): Promise<CardLot | undefined> {
    return await getDb().card_lots.get(id);
  },

  async getAll(): Promise<CardLot[]> {
    return await getDb().card_lots.toArray();
  },

  async getByCardId(cardId: string): Promise<CardLot[]> {
    return await getDb().card_lots.where('cardId').equals(cardId).toArray();
  },

  async getByExternalRef(externalRef: string): Promise<CardLot[]> {
    return await getDb().card_lots.where('externalRef').equals(externalRef).toArray();
  },

  async getByAcquisitionId(acquisitionId: string): Promise<CardLot[]> {
    return await getDb().card_lots.where('acquisitionId').equals(acquisitionId).toArray();
  },

  async getActiveLotsByCardId(cardId: string): Promise<CardLot[]> {
    return await getDb().card_lots
      .where('cardId')
      .equals(cardId)
      .and(lot => !lot.disposedAt)
      .toArray();
  },

  async update(id: string, lot: Partial<CardLot>): Promise<number> {
    return await getDb().card_lots.update(id, lot);
  },

  async delete(id: string): Promise<void> {
    await getDb().card_lots.delete(id);
  }
};



// Transaction repository
export const transactionRepository = {
  async add(transaction: Transaction): Promise<string> {
    return await getDb().transactions.add(transaction);
  },

  async getById(id: string): Promise<Transaction | undefined> {
    return await getDb().transactions.get(id);
  },

  async getAll(): Promise<Transaction[]> {
    return await getDb().transactions.toArray();
  },

  async getByCardId(cardId: string): Promise<Transaction[]> {
    return await getDb().transactions.where('cardId').equals(cardId).toArray();
  },

  async getByLotId(lotId: string): Promise<Transaction[]> {
    return await getDb().transactions.where('lotId').equals(lotId).toArray();
  },

  async getByKind(kind: 'BUY' | 'SELL'): Promise<Transaction[]> {
    return await getDb().transactions.where('kind').equals(kind).toArray();
  },

  async getBuyTransactionsByCardId(cardId: string): Promise<Transaction[]> {
    return await getDb().transactions
      .where('cardId')
      .equals(cardId)
      .and(tx => tx.kind === 'BUY')
      .toArray();
  },

  async getSellTransactionsByCardId(cardId: string): Promise<Transaction[]> {
    return await getDb().transactions
      .where('cardId')
      .equals(cardId)
      .and(tx => tx.kind === 'SELL')
      .toArray();
  },

  // 3.3 Transaction repo idempotency helper
  async getBySourceRef(source: string, externalRef: string): Promise<Transaction[]> {
    return await getDb().transactions.where('[source+externalRef]').equals([source, externalRef]).toArray();
  },

  async update(id: string, transaction: Partial<Transaction>): Promise<number> {
    return await getDb().transactions.update(id, transaction);
  },

  async delete(id: string): Promise<void> {
    await getDb().transactions.delete(id);
  }
};

// Scan repository
export const scanRepository = {
  async add(scan: Scan): Promise<string> {
    return await getDb().scans.add(scan);
  },

  async getById(id: string): Promise<Scan | undefined> {
    return await getDb().scans.get(id);
  },

  async getAll(): Promise<Scan[]> {
    return await getDb().scans.toArray();
  },

  async getByCardId(cardId: string): Promise<Scan[]> {
    return await getDb().scans.where('cardId').equals(cardId).toArray();
  },

  async getByLotId(lotId: string): Promise<Scan[]> {
    return await getDb().scans.where('lotId').equals(lotId).toArray();
  },

  // 3.2 Scan repo additions
  async getByAcquisitionId(acquisitionId: string): Promise<Scan[]> {
    return await getDb().scans.where('acquisitionId').equals(acquisitionId).toArray();
  },

  async getByAcquisitionAndExternalRef(acquisitionId: string, externalRef: string): Promise<Scan | undefined> {
    return await getDb().scans.where('[acquisitionId+externalRef]').equals([acquisitionId, externalRef]).first();
  },

  async update(id: string, scan: Partial<Scan>): Promise<number> {
    return await getDb().scans.update(id, scan);
  },

  async delete(id: string): Promise<void> {
    await getDb().scans.delete(id);
  }
};

// Deck repository
export const deckRepository = {
  async add(deck: Deck): Promise<string> {
    return await getDb().decks.add(deck);
  },

  async getById(id: string): Promise<Deck | undefined> {
    return await getDb().decks.get(id);
  },

  async getAll(): Promise<Deck[]> {
    return await getDb().decks.toArray();
  },

  async update(id: string, deck: Partial<Deck>): Promise<number> {
    return await getDb().decks.update(id, deck);
  },

  async delete(id: string): Promise<void> {
    await getDb().decks.delete(id);
  }
};

// DeckCard repository
export const deckCardRepository = {
  async add(deckCard: DeckCard): Promise<[string, string]> {
    // Validate required fields
    if (!deckCard.deckId) {
      throw new Error('DeckCard deckId is required');
    }
    if (!deckCard.cardId) {
      throw new Error('DeckCard cardId is required');
    }
    if (typeof deckCard.quantity !== 'number' || deckCard.quantity <= 0) {
      throw new Error('DeckCard quantity must be a positive number');
    }
    if (!deckCard.role) {
      throw new Error('DeckCard role is required');
    }
    if (!deckCard.addedAt) {
      throw new Error('DeckCard addedAt is required');
    }
    if (!deckCard.createdAt) {
      throw new Error('DeckCard createdAt is required');
    }
    
    return await getDb().deck_cards.add(deckCard);
  },

  async getById(id: string): Promise<DeckCard | undefined> {
    return await getDb().deck_cards.get(id);
  },

  async getByDeckId(deckId: string): Promise<DeckCard[]> {
    return await getDb().deck_cards.where('deckId').equals(deckId).toArray();
  },

  async getByCardId(cardId: string): Promise<DeckCard[]> {
    return await getDb().deck_cards.where('cardId').equals(cardId).toArray();
  },

  async getByDeckIdAndCardId(deckId: string, cardId: string): Promise<DeckCard | undefined> {
    return await getDb().deck_cards.where('[deckId+cardId]').equals([deckId, cardId]).first();
  },

  async getByLotId(lotId: string): Promise<DeckCard[]> {
    return await getDb().deck_cards.where('lotId').equals(lotId).toArray();
  },

  async deleteByDeckId(deckId: string): Promise<void> {
    await getDb().deck_cards.where('deckId').equals(deckId).delete();
  },

  async update(id: string, deckCard: Partial<DeckCard>): Promise<number> {
    return await getDb().deck_cards.update(id, deckCard);
  },

  async delete(id: string): Promise<void> {
    await getDb().deck_cards.delete(id);
  }
};

// PricePoint repository
export const pricePointRepository = {
  async add(pricePoint: PricePoint): Promise<string> {
    return await getDb().price_points.add(pricePoint);
  },

  async getById(id: string): Promise<PricePoint | undefined> {
    return await getDb().price_points.get(id);
  },

  async getByCardId(cardId: string): Promise<PricePoint[]> {
    return await getDb().price_points.where('cardId').equals(cardId).toArray();
  },

  async getByCardIdAndDate(cardId: string, date: string): Promise<PricePoint[]> {
    return await getDb().price_points
      .where('[cardId+date]')
      .equals([cardId, date])
      .toArray();
  },

  // 3.4 Fix pricePointRepository method name/index
  async getByCardIdAndProviderAndFinishAndDate(
    cardId: string,
    provider: string,
    finish: string,
    date: string
  ): Promise<PricePoint[]> {
    return await getDb().price_points
      .where('[cardId+provider+finish+date]')
      .equals([cardId, provider, finish, date])
      .toArray();
  },

  async update(id: string, pricePoint: Partial<PricePoint>): Promise<number> {
    return await getDb().price_points.update(id, pricePoint);
  },

  async bulkPut(pricePoints: PricePoint[]): Promise<void> {
    await getDb().price_points.bulkPut(pricePoints);
  },

  async delete(id: string): Promise<void> {
    await getDb().price_points.delete(id);
  }
};

// Valuation repository
export const valuationRepository = {
  async add(valuation: Valuation): Promise<string> {
    return await getDb().valuations.add(valuation);
  },

  async getById(id: string): Promise<Valuation | undefined> {
    return await getDb().valuations.get(id);
  },

  async getAll(): Promise<Valuation[]> {
    return await getDb().valuations.toArray();
  },

  async update(id: string, valuation: Partial<Valuation>): Promise<number> {
    return await getDb().valuations.update(id, valuation);
  },

  async delete(id: string): Promise<void> {
    await getDb().valuations.delete(id);
  }
};

// 3.1 New acquisition repository
export const acquisitionRepository = {
  async add(a: Acquisition): Promise<string> { return getDb().acquisitions.add(a); },
  async getById(id: string) { return getDb().acquisitions.get(id); },
  async getByExternalRef(source: string, externalRef: string) {
    return getDb().acquisitions.where('[source+externalRef]').equals([source, externalRef]).first();
  },
  async update(id: string, patch: Partial<Acquisition>) { return getDb().acquisitions.update(id, patch); },
};

// Setting repository
export const settingRepository = {
  async set(key: string, value: any): Promise<string> {
    const setting = {
      k: key,
      v: value,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return await getDb().settings.put(setting);
  },

  async get(key: string): Promise<any> {
    const setting = await getDb().settings.get(key);
    return setting?.v;
  },

  async getAll(): Promise<Setting[]> {
    return await getDb().settings.toArray();
  },

  async delete(key: string): Promise<void> {
    await getDb().settings.delete(key);
  }
};

// ScanSaleLink repository
export const scanSaleLinkRepository = {
  async add(link: ScanSaleLink): Promise<string> {
    return await getDb().scan_sale_links.add(link);
  },

  async getByScanId(scanId: string): Promise<ScanSaleLink[]> {
    return await getDb().scan_sale_links.where('scanId').equals(scanId).toArray();
  },

  async getByTransactionId(transactionId: string): Promise<ScanSaleLink[]> {
    return await getDb().scan_sale_links.where('transactionId').equals(transactionId).toArray();
  },

  async delete(id: string): Promise<void> {
    await getDb().scan_sale_links.delete(id);
  }
};