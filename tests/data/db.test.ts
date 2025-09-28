import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../src/data/init';
import MtgTrackerDb from '../../src/data/db';

let db: MtgTrackerDb;

beforeAll(async () => {
  db = getDb();
});

describe('Database', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.cards.clear();
    await db.card_lots.clear();
    await db.transactions.clear();
    await db.scans.clear();
    await db.decks.clear();
    await db.deck_cards.clear();
    await db.price_points.clear();
    await db.valuations.clear();
    await db.settings.clear();
    await db.scan_sale_links.clear();
  });

  it('should create all tables', async () => {
    // Check that all tables exist by trying to count records
    const tables = [
      'cards',
      'card_lots',
      'transactions',
      'scans',
      'decks',
      'deck_cards',
      'price_points',
      'valuations',
      'settings',
      'scan_sale_links'
    ];

    for (const table of tables) {
      const count = await (db as any)[table].count();
      expect(typeof count).toBe('number');
    }
  });

  it('should add and retrieve a card', async () => {
    const now = new Date();
    const card = {
      id: 'test-card-id',
      name: 'Test Card',
      set: 'Test Set',
      setCode: 'TS',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: now,
      updatedAt: now
    };

    await db.cards.add(card);
    const retrieved = await db.cards.get('test-card-id');
    
    expect(retrieved).toEqual(card);
  });

  it('should add and retrieve a card lot', async () => {
    const now = new Date();
    const cardLot = {
      id: 'test-lot-id',
      cardId: 'test-card-id',
      quantity: 1,
      unitCost: 100,
      source: 'test',
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      currency: 'EUR',
      purchasedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await db.card_lots.add(cardLot);
    const retrieved = await db.card_lots.get('test-lot-id');
    
    expect(retrieved).toEqual(cardLot);
  });

  it('should add and retrieve a transaction', async () => {
    const now = new Date();
    const transaction = {
      id: 'test-transaction-id',
      kind: 'BUY' as const,
      quantity: 1,
      unitPrice: 100,
      fees: 10,
      shipping: 5,
      currency: 'EUR',
      source: 'test',
      externalRef: 'test-ref',
      happenedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await db.transactions.add(transaction);
    const retrieved = await db.transactions.get('test-transaction-id');
    
    expect(retrieved).toEqual(transaction);
  });

  it('should store and query historical prices', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Add price points for a card
    const pricePoints = [
      {
        id: 'price-1',
        cardId: 'test-card-id',
        provider: 'scryfall',
        currency: 'EUR',
        price: 100,
        asOf: yesterday,
        createdAt: yesterday
      },
      {
        id: 'price-2',
        cardId: 'test-card-id',
        provider: 'scryfall',
        currency: 'EUR',
        price: 150,
        asOf: now,
        createdAt: now
      }
    ];

    await db.price_points.bulkAdd(pricePoints);
    
    // Retrieve price points for the card
    const retrieved = await db.price_points.where('cardId').equals('test-card-id').sortBy('asOf');
    
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].price).toBe(100);
    expect(retrieved[1].price).toBe(150);
  });
});

describe('Database', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.cards.clear();
    await db.card_lots.clear();
    await db.transactions.clear();
    await db.scans.clear();
    await db.decks.clear();
    await db.deck_cards.clear();
    await db.price_points.clear();
    await db.valuations.clear();
    await db.settings.clear();
    await db.scan_sale_links.clear();
  });

  it('should create all tables', async () => {
    // Check that all tables exist by trying to count records
    const tables = [
      'cards',
      'card_lots',
      'transactions',
      'scans',
      'decks',
      'deck_cards',
      'price_points',
      'valuations',
      'settings',
      'scan_sale_links'
    ];

    for (const table of tables) {
      const count = await (db as any)[table].count();
      expect(typeof count).toBe('number');
    }
  });

  it('should add and retrieve a card', async () => {
    const now = new Date();
    const card = {
      id: 'test-card-id',
      name: 'Test Card',
      set: 'Test Set',
      setCode: 'TS',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: now,
      updatedAt: now
    };

    await db.cards.add(card);
    const retrieved = await db.cards.get('test-card-id');
    
    expect(retrieved).toEqual(card);
  });

  it('should add and retrieve a card lot', async () => {
    const now = new Date();
    const cardLot = {
      id: 'test-lot-id',
      cardId: 'test-card-id',
      quantity: 1,
      unitCost: 100,
      source: 'test',
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      currency: 'EUR',
      purchasedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await db.card_lots.add(cardLot);
    const retrieved = await db.card_lots.get('test-lot-id');
    
    expect(retrieved).toEqual(cardLot);
  });

  it('should add and retrieve a transaction', async () => {
    const now = new Date();
    const transaction = {
      id: 'test-transaction-id',
      kind: 'BUY' as const,
      quantity: 1,
      unitPrice: 100,
      fees: 10,
      shipping: 5,
      currency: 'EUR',
      source: 'test',
      externalRef: 'test-ref',
      happenedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await db.transactions.add(transaction);
    const retrieved = await db.transactions.get('test-transaction-id');
    
    expect(retrieved).toEqual(transaction);
  });

  it('should store and query historical prices', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Add price points for a card
    const pricePoints = [
      {
        id: 'price-1',
        cardId: 'test-card-id',
        provider: 'scryfall',
        currency: 'EUR',
        price: 100,
        asOf: yesterday,
        createdAt: yesterday
      },
      {
        id: 'price-2',
        cardId: 'test-card-id',
        provider: 'scryfall',
        currency: 'EUR',
        price: 150,
        asOf: now,
        createdAt: now
      }
    ];

    await db.price_points.bulkAdd(pricePoints);
    
    // Retrieve price points for the card
    const retrieved = await db.price_points.where('cardId').equals('test-card-id').sortBy('asOf');
    
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].price).toBe(100);
    expect(retrieved[1].price).toBe(150);
  });
});
