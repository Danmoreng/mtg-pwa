import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportService } from '../../features/imports/ImportService';
import db from '../../data/db';
import { ScryfallProvider } from '../../features/pricing/ScryfallProvider';

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

const transaction = {
    reference: 'abc',
    date: '2025-01-01',
    category: 'payout',
    type: 'payout',
    counterpart: 'Cardmarket',
    amount: '-100',
    balanceAfter: '1000',
    lineNumber: 1,
};

const order = {
    orderId: '123',
    dateOfPurchase: '2025-01-01',
    username: 'testuser',
    country: 'DE',
    city: 'Berlin',
    articleCount: '1',
    merchandiseValue: '1000',
    shipmentCosts: '10',
    commission: '5',
    totalValue: '1015',
    direction: 'purchase',
    lineNumber: 1,
};

describe('ImportService', () => {
  beforeEach(async () => {
    await db.transactions.clear();
    await db.card_lots.clear();
    await db.cards.clear();
    vi.spyOn(ScryfallProvider, 'getByCardmarketId').mockResolvedValue({ id: 'scryfall-id-12345' } as any);
    vi.spyOn(ScryfallProvider, 'hydrateCard').mockResolvedValue({ id: 'scryfall-id-12345' } as any);
    vi.spyOn(ScryfallProvider, 'getPriceById').mockResolvedValue({ getCurrency: () => 'EUR', getCents: () => 100000 });
    vi.spyOn(ScryfallProvider, 'getImageUrlById').mockResolvedValue({ front: '', back: '', layout: 'normal' });
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

  it('should be idempotent when importing transactions', async () => {
    // First import
    await ImportService.importCardmarketTransactions([transaction]);
    const count1 = await db.transactions.count();

    // Second import
    await ImportService.importCardmarketTransactions([transaction]);
    const count2 = await db.transactions.count();

    expect(count2).toBe(count1);
  });

  it('should be idempotent when importing orders', async () => {
    // First import
    await ImportService.importCardmarketOrders([order]);
    const count1 = await db.transactions.count();

    // Second import
    await ImportService.importCardmarketOrders([order]);
    const count2 = await db.transactions.count();

    expect(count2).toBe(count1);
  });

  it('should use product ID to resolve card', async () => {
    await ImportService.importCardmarketArticles([article]);
    const card = await db.cards.get('scryfall-id-12345');
    expect(card).toBeDefined();
    expect(ScryfallProvider.getByCardmarketId).toHaveBeenCalledWith('12345');
  });

  it('should fallback to name/set resolution if product ID fails', async () => {
    vi.spyOn(ScryfallProvider, 'getByCardmarketId').mockResolvedValue(null);
    const articleWithoutProductId = { ...article, productId: '' };
    await ImportService.importCardmarketArticles([articleWithoutProductId]);
    const card = await db.cards.get('scryfall-id-12345');
    expect(card).toBeDefined();
    expect(ScryfallProvider.hydrateCard).toHaveBeenCalled();
  });
});