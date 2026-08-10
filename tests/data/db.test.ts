import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_TABLE_NAMES,
  type Card,
  type CardLot,
  type PricePoint,
  type Transaction,
} from '../../src/data/db';
import MtgTrackerDb from '../../src/data/db';
import { getDb } from '../../src/data/init';

let db: MtgTrackerDb;

beforeAll(() => {
  db = getDb();
});

describe('fresh database baseline', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(table => table.clear()));
    });
  });

  it('uses the dedicated V2 database and current schema version', () => {
    expect(db.name).toBe(DATABASE_NAME);
    expect(db.verno).toBe(DATABASE_SCHEMA_VERSION);
  });

  it('creates every table in the baseline schema', () => {
    expect(db.tables.map(table => table.name).sort()).toEqual([...DATABASE_TABLE_NAMES].sort());
  });

  it('stores cards, lots, transactions, and historical prices', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const card: Card = {
      id: 'test-card-id',
      name: 'Test Card',
      set: 'Test Set',
      setCode: 'tst',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: now,
      updatedAt: now,
    };
    const lot: CardLot = {
      id: 'test-lot-id',
      cardId: card.id,
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
      updatedAt: now,
    };
    const transaction: Transaction = {
      id: 'test-transaction-id',
      kind: 'BUY',
      cardId: card.id,
      lotId: lot.id,
      quantity: 1,
      unitPrice: 100,
      fees: 10,
      shipping: 5,
      currency: 'EUR',
      source: 'test',
      externalRef: 'test-ref',
      happenedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const prices: PricePoint[] = [
      {
        id: `${card.id}:scryfall:nonfoil:2026-08-09`,
        cardId: card.id,
        provider: 'scryfall',
        finish: 'nonfoil',
        date: '2026-08-09',
        currency: 'EUR',
        priceCent: 100,
        asOf: yesterday,
        createdAt: yesterday,
      },
      {
        id: `${card.id}:scryfall:nonfoil:2026-08-10`,
        cardId: card.id,
        provider: 'scryfall',
        finish: 'nonfoil',
        date: '2026-08-10',
        currency: 'EUR',
        priceCent: 150,
        asOf: now,
        createdAt: now,
      },
    ];

    await db.transaction('rw', db.cards, db.card_lots, db.transactions, db.price_points, async () => {
      await db.cards.add(card);
      await db.card_lots.add(lot);
      await db.transactions.add(transaction);
      await db.price_points.bulkAdd(prices);
    });

    expect(await db.cards.get(card.id)).toEqual(card);
    expect(await db.card_lots.get(lot.id)).toEqual(lot);
    expect(await db.transactions.get(transaction.id)).toEqual(transaction);
    const storedPrices = await db.price_points.where('cardId').equals(card.id).sortBy('asOf');
    expect(storedPrices.map(price => price.priceCent)).toEqual([100, 150]);
  });
});
