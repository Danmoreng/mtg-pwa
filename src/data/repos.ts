import db, { type Card, type Holding, type Transaction } from '../data/db';

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

// Holding repository
export const holdingRepository = {
  async add(holding: Holding): Promise<string> {
    return await db.holdings.add(holding);
  },

  async getById(id: string): Promise<Holding | undefined> {
    return await db.holdings.get(id);
  },

  async getAll(): Promise<Holding[]> {
    return await db.holdings.toArray();
  },

  async getByCardId(cardId: string): Promise<Holding[]> {
    return await db.holdings.where('cardId').equals(cardId).toArray();
  },

  async update(id: string, holding: Partial<Holding>): Promise<number> {
    return await db.holdings.update(id, holding);
  },

  async delete(id: string): Promise<void> {
    await db.holdings.delete(id);
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

  async getByKind(kind: 'BUY' | 'SELL'): Promise<Transaction[]> {
    return await db.transactions.where('kind').equals(kind).toArray();
  },

  async update(id: string, transaction: Partial<Transaction>): Promise<number> {
    return await db.transactions.update(id, transaction);
  },

  async delete(id: string): Promise<void> {
    await db.transactions.delete(id);
  }
};