import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { BoxValuationService } from '@/features/analytics/BoxValuationService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

describe('BoxValuationService', () => {
  let db: MtgTrackerDb;
  let service: BoxValuationService;

  beforeEach(async () => {
    db = await createTestDb('box-valuation-service');
    service = new BoxValuationService(db);
    const now = new Date('2026-08-10T12:00:00.000Z');
    await db.cards.bulkAdd(['card1', 'card2', 'card3'].map((id, index) => ({
      id, name: `Card ${index + 1}`, set: 'Test Set', setCode: 'tst', number: String(index + 1), lang: 'en', finish: index === 2 ? 'foil' as const : 'nonfoil' as const, createdAt: now, updatedAt: now,
    })));
    await db.acquisitions.add({
      id: 'box123', kind: 'box', source: 'manabox', currency: 'EUR', happenedAt: now, occurredAt: now,
      totalCostCent: 5000, allocationMethod: 'manual', projectionVersion: 1, createdAt: now, updatedAt: now,
    });
    await db.inventory_lots.bulkAdd([
      { id: 'lot1', cardId: 'card1', acquisitionId: 'box123', initialQuantity: 10, allocatedCostCent: 3000, costBasisStatus: 'known', condition: 'near_mint', language: 'en', finish: 'nonfoil', origin: 'manabox', ownershipStatus: 'import_confirmed', sourceRef: 'box:1', acquiredAt: now, createdAt: now, updatedAt: now },
      { id: 'lot2', cardId: 'card2', acquisitionId: 'box123', initialQuantity: 5, allocatedCostCent: 1500, costBasisStatus: 'known', condition: 'near_mint', language: 'en', finish: 'nonfoil', origin: 'manabox', ownershipStatus: 'import_confirmed', sourceRef: 'box:2', acquiredAt: now, createdAt: now, updatedAt: now },
      { id: 'lot3', cardId: 'card3', acquisitionId: 'box123', initialQuantity: 1, allocatedCostCent: 500, costBasisStatus: 'known', condition: 'near_mint', language: 'en', finish: 'foil', origin: 'manabox', ownershipStatus: 'import_confirmed', sourceRef: 'box:3', acquiredAt: now, createdAt: now, updatedAt: now },
    ]);
    await db.sales.bulkAdd([
      { id: 'sale1', occurredAt: now, currency: 'EUR', grossMerchandiseCent: 500, platformFeesCent: 0, shippingIncomeCent: 0, shippingExpenseCent: 0, netProceedsCent: 500, sourceRef: 'sale:1', projectionVersion: 1, createdAt: now, updatedAt: now },
      { id: 'sale2', occurredAt: now, currency: 'EUR', grossMerchandiseCent: 500, platformFeesCent: 0, shippingIncomeCent: 0, shippingExpenseCent: 0, netProceedsCent: 500, sourceRef: 'sale:2', projectionVersion: 1, createdAt: now, updatedAt: now },
    ]);
    await db.sale_lines.bulkAdd([
      { id: 'line1', saleId: 'sale1', cardId: 'card1', quantity: 5, finish: 'nonfoil', language: 'en', grossLineCent: 500, allocatedFeesCent: 0, allocatedShippingIncomeCent: 0, allocatedShippingExpenseCent: 0, netLineProceedsCent: 500, sourceRef: 'sale:1:line', createdAt: now, updatedAt: now },
      { id: 'line2', saleId: 'sale2', cardId: 'card3', quantity: 1, finish: 'foil', language: 'en', grossLineCent: 500, allocatedFeesCent: 0, allocatedShippingIncomeCent: 0, allocatedShippingExpenseCent: 0, netLineProceedsCent: 500, sourceRef: 'sale:2:line', createdAt: now, updatedAt: now },
    ]);
    await db.lot_allocations.bulkAdd([
      { id: 'allocation1', saleLineId: 'line1', lotId: 'lot1', quantity: 5, costBasisCentSnapshot: 1500, costBasisStatus: 'known', netProceedsCentSnapshot: 500, method: 'auto', createdAt: now },
      { id: 'allocation2', saleLineId: 'line2', lotId: 'lot3', quantity: 1, costBasisCentSnapshot: 500, costBasisStatus: 'known', netProceedsCentSnapshot: 500, method: 'auto', createdAt: now },
    ]);
    await db.price_points.bulkAdd([
      { id: 'card1:scryfall:nonfoil:2026-08-10', cardId: 'card1', provider: 'scryfall', finish: 'nonfoil', date: '2026-08-10', currency: 'EUR', priceCent: 50, asOf: now, createdAt: now },
      { id: 'card2:scryfall:nonfoil:2026-08-10', cardId: 'card2', provider: 'scryfall', finish: 'nonfoil', date: '2026-08-10', currency: 'EUR', priceCent: 200, asOf: now, createdAt: now },
      { id: 'card3:scryfall:foil:2026-08-10', cardId: 'card3', provider: 'scryfall', finish: 'foil', date: '2026-08-10', currency: 'EUR', priceCent: 1000, asOf: now, createdAt: now },
    ]);
  });

  afterEach(async () => deleteTestDb(db));

  it('calculates box valuation from canonical lots and sale allocations', async () => {
    const valuation = await service.calculateBoxValue('box123');
    expect(valuation.boxPrice).toMatchObject({ status: 'known', cents: 5000 });
    expect(valuation.unsoldValue).toMatchObject({ status: 'known', cents: 1250 });
    expect(valuation.soldNetProceedsCent).toBe(1000);
    expect(valuation.realizedPnL).toMatchObject({ status: 'known', cents: -1000 });
    expect(valuation.unrealizedPnL).toMatchObject({ status: 'known', cents: -1750 });
    expect(valuation.remainingQuantity).toBe(10);
    expect(valuation.soldQuantity).toBe(6);
  });
});
