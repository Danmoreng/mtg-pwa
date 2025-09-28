import { describe, it, expect, beforeEach } from 'vitest';
import { remainingQty } from '../src/features/scans/ReconcilerService';
import MtgTrackerDb from '../src/data/db';
import { cardLotRepository, sellAllocationRepository } from '../src/data/repos';

describe('ReconcilerService2', () => {
  let db: MtgTrackerDb;

  beforeEach(async () => {
    // Use an in-memory database for testing
    db = new MtgTrackerDb();
    await db.open();
    // Clear test data
    await db.card_lots.clear();
    await db.sell_allocations.clear();
  });

  describe('remainingQty', () => {
    it('should return the initial quantity when there are no allocations', async () => {
      const lot = {
        id: 'lot1',
        cardId: 'card1',
        quantity: 10,
        unitCost: 100,
        condition: 'NM',
        language: 'en',
        foil: false,
        finish: 'nonfoil',
        source: 'test',
        purchasedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await cardLotRepository.add(lot as any);

      const remaining = await remainingQty('lot1');
      expect(remaining).toBe(10);
    });

    it('should subtract the allocated quantity', async () => {
        const lot = {
            id: 'lot1',
            cardId: 'card1',
            quantity: 10,
            unitCost: 100,
            condition: 'NM',
            language: 'en',
            foil: false,
            finish: 'nonfoil',
            source: 'test',
            purchasedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        await cardLotRepository.add(lot as any);

        await sellAllocationRepository.add({
            id: 'alloc1',
            transactionId: 'tx1',
            lotId: 'lot1',
            quantity: 3,
            createdAt: new Date(),
        } as any);

        const remaining = await remainingQty('lot1');
        expect(remaining).toBe(7);
    });
  });
});
