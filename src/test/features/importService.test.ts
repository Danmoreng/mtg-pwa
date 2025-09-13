import { describe, it, expect, beforeEach } from 'vitest';
import { ImportService } from '../../features/imports/ImportService';
import db from '../../data/db';

const article = {
    shipmentId: '123',
    dateOfPurchase: '2025-01-01',
    productId: '12345',
    name: 'Black Lotus',
    expansion: 'Alpha',
    category: 'Magic Single',
    amount: '1',
    price: '1000',
    total: '1000',
    currency: 'EUR',
    comments: '',
    direction: 'purchase',
    lineNumber: 1,
};

describe('ImportService', () => {
  beforeEach(async () => {
    await db.transactions.clear();
    await db.card_lots.clear();
    await db.cards.clear();
  });

  it('should be idempotent when importing articles', async () => {
    // First import
    await ImportService.importCardmarketArticles([article]);

    const transactionsCount1 = await db.transactions.count();
    const lotsCount1 = await db.card_lots.count();
    const cardsCount1 = await db.cards.count();

    // Second import
    await ImportService.importCardmarketArticles([article]);

    const transactionsCount2 = await db.transactions.count();
    const lotsCount2 = await db.card_lots.count();
    const cardsCount2 = await db.cards.count();

    expect(transactionsCount2).toBe(transactionsCount1);
    expect(lotsCount2).toBe(lotsCount1);
    expect(cardsCount2).toBe(cardsCount1);
  });
});
