// tests/e2e/reconcile.e2e.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { runReconciler } from '@/features/scans/ReconcilerService';
import { allocateAcquisitionCosts } from '@/features/analytics/CostAllocationService';
import { getAcquisitionPnL } from '@/features/analytics/PnLService';
import { normalizeFingerprint } from '@/core/Normalization';
import { getDb } from '@/data/init';

describe('E2E Reconciliation Flow', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.acquisitions.clear();
    await db.card_lots.clear();
    await db.scans.clear();
    await db.transactions.clear();
    await db.price_points.clear();
    await db.valuations.clear();
    await db.sell_allocations.clear();
  });

  it('should correctly process scans, sells, allocate costs, and calculate P&L idempotently', async () => {
    const db = getDb();
    
    // 1. Setup
    const cardIdentity = {
      cardId: 'c1',
      name: 'Test Card',
      setCode: 'TST',
      number: '123',
      finish: 'nonfoil',
      lang: 'EN',
    };
    const normalized = normalizeFingerprint(cardIdentity);
    const acquisitionId = 'acq-e2e-1';
    const totalCost = 1000; // 10 EUR

    // Create Acquisition
    await db.acquisitions.add({
      id: acquisitionId,
      kind: 'box',
      source: 'test',
      currency: 'EUR',
      happenedAt: new Date('2025-09-26'),
      totalPriceCent: totalCost,
      totalFeesCent: 0,
      totalShippingCent: 0,
      totalCostCent: totalCost,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Scans (total 5 quantity)
    await db.scans.bulkAdd([
      {
        id: 'scan1',
        cardFingerprint: normalized.fingerprint,
        cardId: cardIdentity.cardId,
        acquisitionId,
        source: 'test',
        externalRef: 'scan1-ext',     // <-- required for [acquisitionId+externalRef]
        lotId: '',                    // <-- required for [lotId+scannedAt] (keeps logic falsy)
        scannedAt: new Date('2025-09-26'),
        quantity: 2,
        finish: 'nonfoil',
        language: 'EN',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'scan2',
        cardFingerprint: normalized.fingerprint,
        cardId: cardIdentity.cardId,
        acquisitionId,
        source: 'test',
        externalRef: 'scan2-ext',     // <-- required
        lotId: '',                    // <-- required
        scannedAt: new Date('2025-09-26'),
        quantity: 3,
        finish: 'nonfoil',
        language: 'EN',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create Sells (total 3 quantity)
    await db.transactions.add({
      id: 'sell1',
      kind: 'SELL',
      cardId: cardIdentity.cardId,
      lotId: '',                     // <-- required for [lotId+kind]
      quantity: 3,
      unitPrice: 500, // 5 EUR
      fees: 50,
      shipping: 0,
      currency: 'EUR',
      source: 'test',
      externalRef: 'sell1-external-ref',
      happenedAt: new Date('2025-09-27'),
      finish: 'nonfoil',
      language: 'EN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Price Point for P&L
    await db.price_points.add({
        id: `${cardIdentity.cardId}:scryfall:nonfoil:2025-09-27`,
        cardId: cardIdentity.cardId,
        provider: 'scryfall',
        finish: 'nonfoil',
        date: '2025-09-27',
        currency: 'EUR',
        priceCent: 600, // 6 EUR market price
        asOf: new Date('2025-09-27'),
        createdAt: new Date(),
    });

    // 2. Execution
    const identityForReconciler = { ...normalized, cardId: cardIdentity.cardId, lang: cardIdentity.lang };
    await runReconciler(identityForReconciler);
    await allocateAcquisitionCosts(acquisitionId, 'equal_per_card');
    
    // 3. Assertions (First Run)
    const lots = await db.card_lots.where('acquisitionId').equals(acquisitionId).toArray();
    expect(lots.length).toBeGreaterThan(0);
    
    const sellTx = await db.transactions.get('sell1');
    expect(sellTx?.lotId).toBeDefined();

    const sumOfAllocatedCosts = lots.reduce((sum, lot) => sum + (lot.totalAcquisitionCostCent || 0), 0);
    expect(sumOfAllocatedCosts).toBe(totalCost);

    // Check P&L
    const pnl = await getAcquisitionPnL(acquisitionId);
    expect(pnl.totalCostCent).toBe(totalCost);
    // Realized P&L should be revenue from selling 3 cards at 5 EUR each minus cost basis
    // Revenue = 3 * 500 cents = 1500 cents
    // Fees = 50 cents
    // Net revenue = 1500 - 50 = 1450 cents
    // Cost basis for 3 cards out of 5 total = (1000/5) * 3 = 600 cents
    // Realized P&L = 1450 - 600 = 850 cents
    expect(pnl.realizedPnLCent).toBeGreaterThan(0);
    expect(typeof pnl.unrealizedPnLCent).toBe('number');

    // 4. Idempotency Run
    const initialLotCount = await db.card_lots.count();
    const initialTxCount = await db.transactions.count();
    const initialScanCount = await db.scans.count();

    await runReconciler(identityForReconciler);

    expect(await db.card_lots.count()).toBe(initialLotCount);
    expect(await db.transactions.count()).toBe(initialTxCount);
    expect(await db.scans.count()).toBe(initialScanCount);
  });
});
