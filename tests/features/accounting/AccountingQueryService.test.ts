import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { AccountingQueryService } from '@/features/accounting/AccountingQueryService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

const now = new Date('2026-08-10T12:00:00.000Z');
let db: MtgTrackerDb;
let service: AccountingQueryService;

beforeEach(async () => {
  db = await createTestDb('accounting-query-service');
  service = new AccountingQueryService(db);
  await db.cards.bulkAdd([
    {
      id: 'card-1',
      name: 'Alpha',
      set: 'Test',
      setCode: 'tst',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'card-2',
      name: 'Beta',
      set: 'Test',
      setCode: 'tst',
      number: '2',
      lang: 'en',
      finish: 'foil',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.acquisitions.add({
    id: 'box-1',
    kind: 'box',
    source: 'manabox',
    sourceRef: 'manabox:box-1',
    currency: 'EUR',
    happenedAt: now,
    totalCostCent: 500,
    feesCent: 20,
    shippingCent: 30,
    createdAt: now,
    updatedAt: now,
  });
  await db.inventory_lots.bulkAdd([
    {
      id: 'lot-1',
      acquisitionId: 'box-1',
      cardId: 'card-1',
      initialQuantity: 2,
      allocatedCostCent: 300,
      costBasisStatus: 'known',
      origin: 'scan',
      ownershipStatus: 'imported',
      condition: 'NM',
      language: 'en',
      finish: 'nonfoil',
      acquiredAt: now,
      sourceRef: 'scan:1',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lot-2',
      acquisitionId: 'box-1',
      cardId: 'card-2',
      initialQuantity: 1,
      costBasisStatus: 'unknown',
      origin: 'scan',
      ownershipStatus: 'imported',
      condition: 'unknown',
      language: 'en',
      finish: 'foil',
      acquiredAt: now,
      sourceRef: 'scan:2',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.sales.add({
    id: 'sale-1',
    occurredAt: now,
    currency: 'EUR',
    grossMerchandiseCent: 400,
    platformFeesCent: 40,
    shippingIncomeCent: 50,
    shippingExpenseCent: 0,
    netProceedsCent: 410,
    sourceRef: 'sale:1',
    projectionVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  await db.sale_lines.add({
    id: 'sale-line-1',
    saleId: 'sale-1',
    cardId: 'card-1',
    quantity: 1,
    finish: 'nonfoil',
    language: 'en',
    grossLineCent: 400,
    allocatedFeesCent: 40,
    allocatedShippingIncomeCent: 50,
    allocatedShippingExpenseCent: 0,
    netLineProceedsCent: 410,
    sourceRef: 'sale:1:line:1',
    createdAt: now,
    updatedAt: now,
  });
  await db.lot_allocations.add({
    id: 'allocation-1',
    saleLineId: 'sale-line-1',
    lotId: 'lot-1',
    quantity: 1,
    costBasisCentSnapshot: 150,
    costBasisStatus: 'known',
    netProceedsCentSnapshot: 410,
    method: 'auto',
    createdAt: now,
  });
  await db.price_points.bulkAdd([
    {
      id: 'card-1:scryfall:nonfoil:2026-08-10',
      cardId: 'card-1',
      provider: 'scryfall',
      finish: 'nonfoil',
      date: '2026-08-10',
      currency: 'EUR',
      priceCent: 200,
      asOf: now,
      createdAt: now,
    },
    {
      id: 'card-1:priceguide:nonfoil:2026-08-09',
      cardId: 'card-1',
      provider: 'cardmarket.priceguide',
      finish: 'nonfoil',
      date: '2026-08-09',
      currency: 'EUR',
      priceCent: 250,
      asOf: new Date('2026-08-09T12:00:00.000Z'),
      createdAt: now,
    },
  ]);
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('AccountingQueryService', () => {
  it('builds canonical holdings with finish-aware provider precedence', async () => {
    const holdings = await service.getHoldings();

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      cardId: 'card-1',
      quantity: 1,
      marketValue: { status: 'known', cents: 250 },
      totalCostBasis: { status: 'known', cents: 150 },
      realizedPnL: { status: 'known', cents: 260 },
    });
    expect(holdings[0].lots[0]).toMatchObject({
      unitMarketPriceCent: 250,
      priceProvider: 'cardmarket.priceguide',
    });
    expect(holdings[1].marketValue.status).toBe('unknown');
    expect(holdings[1].totalCostBasis.status).toBe('unknown');
  });

  it('reports partial unknown totals explicitly in the portfolio summary', async () => {
    const summary = await service.getPortfolioSummary();

    expect(summary).toMatchObject({
      cardCount: 2,
      lotCount: 2,
      quantity: 2,
      grossSalesCent: 400,
      netSalesCent: 410,
      salesFeesCent: 40,
      openIssueCount: 0,
      unpricedLotCount: 1,
      unknownCostLotCount: 1,
    });
    expect(summary.marketValue).toMatchObject({
      status: 'unknown',
      knownCents: 250,
      unknownItems: 1,
    });
    expect(summary.realizedPnL).toEqual({
      status: 'known',
      cents: 260,
      knownCents: 260,
      unknownItems: 0,
      estimatedItems: 0,
    });
  });

  it('derives physical deck coverage and box analytics from canonical allocations', async () => {
    await db.decks.add({
      id: 'deck-1',
      platform: 'csv',
      name: 'Deck',
      inventoryMode: 'physical_exclusive',
      status: 'active',
      importedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.deck_cards.add({
      id: 'deck-card-1',
      deckId: 'deck-1',
      cardId: 'card-1',
      quantity: 2,
      role: 'main',
      addedAt: now,
      createdAt: now,
    });
    await db.deck_inventory_allocations.add({
      id: 'deck-allocation-1',
      deckCardId: 'deck-card-1',
      lotId: 'lot-1',
      quantity: 1,
      method: 'auto',
      createdAt: now,
      updatedAt: now,
    });

    const deck = await service.getDeckSummary('deck-1');
    expect(deck).toMatchObject({
      trackedPhysicalInventory: true,
      requiredQuantity: 2,
      allocatedQuantity: 1,
      missingQuantity: 1,
      coveragePercentage: 50,
    });

    const box = await service.getAcquisitionSummary('box-1');
    expect(box).toMatchObject({
      initialQuantity: 3,
      remainingQuantity: 2,
      soldQuantity: 1,
      netSaleProceedsCent: 410,
      acquisitionCost: { status: 'known', cents: 500 },
      realizedPnL: { status: 'known', cents: 260 },
    });
  });
});
