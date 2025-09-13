

import db, { 
  type Card, 
  type CardLot,
  type Transaction, 
  type Scan, 
  type Deck, 
  type DeckCard, 
  type PricePoint, 
  type Valuation, 
  type Setting,
  type ScanSaleLink
} from './db';

// Card repository
export const cardRepository = {
  async add(card: Card): Promise<string> {
    return await db.cards.add(card);
  },

  async getById(id: string): Promise<Card | undefined> {
    return await db.cards.get(id);
  },

  async getAll(): Promise<Card[]> {
    return await db.cards.toArray();
  },

  async update(id: string, card: Partial<Card>): Promise<number> {
    return await db.cards.update(id, card);
  },

  async delete(id: string): Promise<void> {
    await db.cards.delete(id);
  }
};

// CardLot repository
export const cardLotRepository = {
  async add(lot: CardLot): Promise<string> {
    return await db.card_lots.add(lot);
  },

  async getById(id: string): Promise<CardLot | undefined> {
    return await db.card_lots.get(id);
  },

  async getAll(): Promise<CardLot[]> {
    return await db.card_lots.toArray();
  },

  async getByCardId(cardId: string): Promise<CardLot[]> {
    return await db.card_lots.where('cardId').equals(cardId).toArray();
  },

  async getByExternalRef(externalRef: string): Promise<CardLot[]> {
    return await db.card_lots.where('externalRef').equals(externalRef).toArray();
  },

  async getActiveLotsByCardId(cardId: string): Promise<CardLot[]> {
    return await db.card_lots
      .where('cardId')
      .equals(cardId)
      .and(lot => !lot.disposedAt)
      .toArray();
  },

  async update(id: string, lot: Partial<CardLot>): Promise<number> {
    return await db.card_lots.update(id, lot);
  },

  async delete(id: string): Promise<void> {
    await db.card_lots.delete(id);
  }
};



// Transaction repository
export const transactionRepository = {
  async add(transaction: Transaction): Promise<string> {
    return await db.transactions.add(transaction);
  },

  async getById(id: string): Promise<Transaction | undefined> {
    return await db.transactions.get(id);
  },

  async getAll(): Promise<Transaction[]> {
    return await db.transactions.toArray();
  },

  async getByCardId(cardId: string): Promise<Transaction[]> {
    return await db.transactions.where('cardId').equals(cardId).toArray();
  },

  async getByLotId(lotId: string): Promise<Transaction[]> {
    return await db.transactions.where('lotId').equals(lotId).toArray();
  },

  async getByKind(kind: 'BUY' | 'SELL'): Promise<Transaction[]> {
    return await db.transactions.where('kind').equals(kind).toArray();
  },

  async getBuyTransactionsByCardId(cardId: string): Promise<Transaction[]> {
    return await db.transactions
      .where('cardId')
      .equals(cardId)
      .and(tx => tx.kind === 'BUY')
      .toArray();
  },

  async getSellTransactionsByCardId(cardId: string): Promise<Transaction[]> {
    return await db.transactions
      .where('cardId')
      .equals(cardId)
      .and(tx => tx.kind === 'SELL')
      .toArray();
  },

  async update(id: string, transaction: Partial<Transaction>): Promise<number> {
    return await db.transactions.update(id, transaction);
  },

  async delete(id: string): Promise<void> {
    await db.transactions.delete(id);
  }
};

// Scan repository
export const scanRepository = {
  async add(scan: Scan): Promise<string> {
    return await db.scans.add(scan);
  },

  async getById(id: string): Promise<Scan | undefined> {
    return await db.scans.get(id);
  },

  async getAll(): Promise<Scan[]> {
    return await db.scans.toArray();
  },

  async getByCardId(cardId: string): Promise<Scan[]> {
    return await db.scans.where('cardId').equals(cardId).toArray();
  },

  async getByLotId(lotId: string): Promise<Scan[]> {
    return await db.scans.where('lotId').equals(lotId).toArray();
  },

  async update(id: string, scan: Partial<Scan>): Promise<number> {
    return await db.scans.update(id, scan);
  },

  async delete(id: string): Promise<void> {
    await db.scans.delete(id);
  }
};

// Deck repository
export const deckRepository = {
  async add(deck: Deck): Promise<string> {
    return await db.decks.add(deck);
  },

  async getById(id: string): Promise<Deck | undefined> {
    return await db.decks.get(id);
  },

  async getAll(): Promise<Deck[]> {
    return await db.decks.toArray();
  },

  async update(id: string, deck: Partial<Deck>): Promise<number> {
    return await db.decks.update(id, deck);
  },

  async delete(id: string): Promise<void> {
    await db.decks.delete(id);
  }
};

// DeckCard repository
export const deckCardRepository = {
  async add(deckCard: DeckCard): Promise<void> {
    // Validate required fields
    if (!deckCard.id) {
      throw new Error('DeckCard id is required');
    }
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
    
    await db.deck_cards.add(deckCard);
  },

  async getById(id: string): Promise<DeckCard | undefined> {
    return await db.deck_cards.get(id);
  },

  async getByDeckId(deckId: string): Promise<DeckCard[]> {
    return await db.deck_cards.where('deckId').equals(deckId).toArray();
  },

  async getByCardId(cardId: string): Promise<DeckCard[]> {
    return await db.deck_cards.where('cardId').equals(cardId).toArray();
  },

  async getByLotId(lotId: string): Promise<DeckCard[]> {
    return await db.deck_cards.where('lotId').equals(lotId).toArray();
  },

  async deleteByDeckId(deckId: string): Promise<void> {
    await db.deck_cards.where('deckId').equals(deckId).delete();
  },

  async update(id: string, deckCard: Partial<DeckCard>): Promise<number> {
    return await db.deck_cards.update(id, deckCard);
  },

  async delete(id: string): Promise<void> {
    await db.deck_cards.delete(id);
  }
};

// PricePoint repository
export const pricePointRepository = {
  async add(pricePoint: PricePoint): Promise<string> {
    return await db.price_points.add(pricePoint);
  },

  async getById(id: string): Promise<PricePoint | undefined> {
    return await db.price_points.get(id);
  },

  async getByCardId(cardId: string): Promise<PricePoint[]> {
    return await db.price_points.where('cardId').equals(cardId).toArray();
  },

  async update(id: string, pricePoint: Partial<PricePoint>): Promise<number> {
    return await db.price_points.update(id, pricePoint);
  },

  async delete(id: string): Promise<void> {
    await db.price_points.delete(id);
  }
};

// Valuation repository
export const valuationRepository = {
  async add(valuation: Valuation): Promise<string> {
    return await db.valuations.add(valuation);
  },

  async getById(id: string): Promise<Valuation | undefined> {
    return await db.valuations.get(id);
  },

  async getAll(): Promise<Valuation[]> {
    return await db.valuations.toArray();
  },

  async update(id: string, valuation: Partial<Valuation>): Promise<number> {
    return await db.valuations.update(id, valuation);
  },

  async delete(id: string): Promise<void> {
    await db.valuations.delete(id);
  }
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
    return await db.settings.put(setting);
  },

  async get(key: string): Promise<any> {
    const setting = await db.settings.get(key);
    return setting?.v;
  },

  async getAll(): Promise<Setting[]> {
    return await db.settings.toArray();
  },

  async delete(key: string): Promise<void> {
    await db.settings.delete(key);
  }
};

// ScanSaleLink repository
export const scanSaleLinkRepository = {
  async add(link: ScanSaleLink): Promise<string> {
    return await db.scan_sale_links.add(link);
  },

  async getByScanId(scanId: string): Promise<ScanSaleLink[]> {
    return await db.scan_sale_links.where('scanId').equals(scanId).toArray();
  },

  async getByTransactionId(transactionId: string): Promise<ScanSaleLink[]> {
    return await db.scan_sale_links.where('transactionId').equals(transactionId).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.scan_sale_links.delete(id);
  }
};