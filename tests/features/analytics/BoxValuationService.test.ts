
import { describe, it, expect, beforeEach } from 'vitest';
import MtgTrackerDb from '../../../src/data/db';
import { BoxValuationService } from '../../../src/features/analytics/BoxValuationService';
import 'fake-indexeddb/auto';

describe('BoxValuationService', () => {
  let db: MtgTrackerDb;
  let service: BoxValuationService;

  beforeEach(async () => {
    db = new MtgTrackerDb();
    await db.delete();
    await db.open();

    service = new BoxValuationService(db);

    // Test Data
    const acquisitionId = 'box123';
    await db.acquisitions.add({
      id: acquisitionId,
      kind: 'box',
      source: 'manabox',
      currency: 'EUR',
      happenedAt: new Date(),
      totalCostCent: 5000, // 50 EUR
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.card_lots.bulkAdd([
      { id: 'lot1', cardId: 'card1', acquisitionId, quantity: 10, unitCost: 0, condition: 'NM', language: 'en', foil: false, finish: 'nonfoil', source: 'manabox', purchasedAt: new Date(), disposedQuantity: 5, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lot2', cardId: 'card2', acquisitionId, quantity: 5, unitCost: 0, condition: 'NM', language: 'en', foil: false, finish: 'nonfoil', source: 'manabox', purchasedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 'lot3', cardId: 'card3', acquisitionId, quantity: 1, unitCost: 0, condition: 'NM', language: 'en', foil: true, finish: 'foil', source: 'manabox', purchasedAt: new Date(), disposedQuantity: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    await db.transactions.bulkAdd([
        { id: 'tx1', kind: 'SELL', lotId: 'lot1', quantity: 5, unitPrice: 100, currency: 'EUR', source: 'cardmarket', externalRef: 'ref1', happenedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), fees: 0, shipping: 0 },
        { id: 'tx2', kind: 'SELL', lotId: 'lot3', quantity: 1, unitPrice: 500, currency: 'EUR', source: 'cardmarket', externalRef: 'ref2', happenedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), fees: 0, shipping: 0 },
    ]);

    await db.price_points.bulkAdd([
      { id: 'price1', cardId: 'card1', provider: 'scryfall', finish: 'nonfoil', date: new Date().toISOString().slice(0,10), currency: 'EUR', priceCent: 50, asOf: new Date(), createdAt: new Date() },
      { id: 'price2', cardId: 'card2', provider: 'scryfall', finish: 'nonfoil', date: new Date().toISOString().slice(0,10), currency: 'EUR', priceCent: 200, asOf: new Date(), createdAt: new Date() },
      { id: 'price3', cardId: 'card3', provider: 'scryfall', finish: 'foil', date: new Date().toISOString().slice(0,10), currency: 'EUR', priceCent: 1000, asOf: new Date(), createdAt: new Date() },
    ]);
  });

  it('should calculate box valuation correctly', async () => {
    const valuation = await service.calculateBoxValue('box123');

    expect(valuation.boxPrice).toBe(5000);
    // lot1: 5 remaining * 50 cents = 250
    // lot2: 5 remaining * 200 cents = 1000
    // lot3: 0 remaining
    expect(valuation.unsoldValue).toBe(1250);

    // tx1: 5 sold * 100 cents = 500
    // tx2: 1 sold * 500 cents = 500
    expect(valuation.soldValue).toBe(1000);

    // lot1: 10 * 50 = 500
    // lot2: 5 * 200 = 1000
    // lot3: 1 * 1000 = 1000
    expect(valuation.totalCurrentValue).toBe(2500);
  });
});
