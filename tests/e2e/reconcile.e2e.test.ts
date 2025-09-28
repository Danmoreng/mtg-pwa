import { describe, it, expect, beforeEach } from 'vitest';
import db from '../src/data/db';
import { runReconciler } from '../src/features/scans/ReconcilerService';
import { allocateAcquisitionCosts } from '../src/features/analytics/CostAllocationService';
import { getAcquisitionPnL } from '../src/features/analytics/PnLService';
import { normalizeFingerprint } from '../src/core/Normalization';

describe('E2E Reconciliation Flow', () => {
  beforeEach(async () => {
    await db.acquisitions.clear();
    await db.card_lots.clear();
    await db.scans.clear();
    await db.transactions.clear();
    await db.price_points.clear();
  });

  it('should correctly process scans, sells, allocate costs, and calculate P&L idempotently', async () => {
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
      { id: 'scan1', cardFingerprint: normalized.fingerprint, cardId: cardIdentity.cardId, acquisitionId, source: 'test', scannedAt: new Date('2025-09-26'), quantity: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'scan2', cardFingerprint: normalized.fingerprint, cardId: cardIdentity.cardId, acquisitionId, source: 'test', scannedAt: new Date('2025-09-26'), quantity: 3, createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Create Sells (total 3 quantity)
    await db.transactions.add({
      id: 'sell1',
      kind: 'SELL',
      cardId: cardIdentity.cardId,
      quantity: 3,
      unitPrice: 500, // 5 EUR
      fees: 50,
      shipping: 0,
      currency: 'EUR',
      source: 'test',
      externalRef: 'sell-ref-1',
      happenedAt: new Date('2025-09-27'),
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
    expect(pnl.realizedPnLCent).not.toBe(0);
    expect(pnl.unrealizedPnLCent).not.toBe(0);

    // 4. Idempotency Run
    const initialLotCount = await db.card_lots.count();
    const initialTxCount = await db.transactions.count();
    const initialScanCount = await db.scans.count();

    await runReconciler(identityForReconciler); // Run again

    expect(await db.card_lots.count()).toBe(initialLotCount);
    expect(await db.transactions.count()).toBe(initialTxCount);
    expect(await db.scans.count()).toBe(initialScanCount);
  });
});
