import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { getAcquisitionPnL } from '@/features/analytics/PnLService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

describe('PnL Service with canonical price integration', () => {
  let db: MtgTrackerDb;
  const now = new Date('2026-08-10T12:00:00.000Z');

  beforeEach(async () => {
    db = await createTestDb('pnl-price');
    await db.cards.add({ id: 'card123', name: 'Test Card', set: 'Test', setCode: 'tst', number: '1', lang: 'en', finish: 'nonfoil', createdAt: now, updatedAt: now });
    await db.acquisitions.add({ id: 'acq123', kind: 'single', source: 'cardmarket', currency: 'EUR', happenedAt: now, occurredAt: now, totalCostCent: 10800, allocationMethod: 'manual', projectionVersion: 1, createdAt: now, updatedAt: now });
    await db.inventory_lots.add({ id: 'lot123', acquisitionId: 'acq123', cardId: 'card123', initialQuantity: 10, allocatedCostCent: 10800, costBasisStatus: 'known', origin: 'cardmarket', ownershipStatus: 'import_confirmed', condition: 'near_mint', language: 'en', finish: 'nonfoil', acquiredAt: now, sourceRef: 'purchase:1', createdAt: now, updatedAt: now });
    await db.sales.add({ id: 'sale123', occurredAt: now, currency: 'EUR', grossMerchandiseCent: 7500, platformFeesCent: 100, shippingIncomeCent: 200, shippingExpenseCent: 0, netProceedsCent: 7600, sourceRef: 'sale:1', projectionVersion: 1, createdAt: now, updatedAt: now });
    await db.sale_lines.add({ id: 'line123', saleId: 'sale123', cardId: 'card123', quantity: 5, finish: 'nonfoil', language: 'en', grossLineCent: 7500, allocatedFeesCent: 100, allocatedShippingIncomeCent: 200, allocatedShippingExpenseCent: 0, netLineProceedsCent: 7600, sourceRef: 'sale:1:line', createdAt: now, updatedAt: now });
    await db.lot_allocations.add({ id: 'allocation123', saleLineId: 'line123', lotId: 'lot123', quantity: 5, costBasisCentSnapshot: 5400, costBasisStatus: 'known', netProceedsCentSnapshot: 7600, method: 'auto', createdAt: now });
  });

  afterEach(async () => deleteTestDb(db));

  it('calculates realized and unrealized P&L when a current price exists', async () => {
    await db.price_points.add({ id: 'card123:scryfall:nonfoil:2026-08-10', cardId: 'card123', provider: 'scryfall', finish: 'nonfoil', date: '2026-08-10', currency: 'EUR', priceCent: 2000, asOf: now, createdAt: now });
    const result = await getAcquisitionPnL('acq123', now, db);
    expect(result.totalCostCent).toBe(10800);
    expect(result.totalRevenueCent).toBe(7600);
    expect(result.realizedPnLCent).toBe(2200);
    expect(result.unrealizedPnLCent).toBe(4600);
    expect(result.unrealizedPnLStatus).toBe('known');
  });

  it('propagates unknown unrealized P&L when no current price exists', async () => {
    const result = await getAcquisitionPnL('acq123', now, db);
    expect(result.realizedPnLCent).toBe(2200);
    expect(result.unrealizedPnLStatus).toBe('unknown');
  });
});
