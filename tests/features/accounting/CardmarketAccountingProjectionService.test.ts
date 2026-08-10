import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  Card,
  CardmarketOrder,
  CardmarketOrderLine,
  InventoryLot,
} from '@/data/db';
import type MtgTrackerDb from '@/data/db';
import { AccountingRepository } from '@/features/accounting/AccountingRepository';
import { CardmarketAccountingProjectionService } from '@/features/imports/CardmarketAccountingProjectionService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

const now = new Date('2026-08-10T12:00:00.000Z');
let db: MtgTrackerDb;
let service: CardmarketAccountingProjectionService;

function card(id: string, cardmarketId: number): Card {
  return {
    id,
    cardmarketId,
    name: id,
    set: 'Test',
    setCode: 'tst',
    number: String(cardmarketId),
    lang: 'en',
    finish: 'nonfoil',
    createdAt: now,
    updatedAt: now,
  };
}

function order(
  id: string,
  direction: CardmarketOrder['direction'],
  values: Partial<CardmarketOrder> = {}
): CardmarketOrder {
  return {
    id,
    direction,
    orderDate: now,
    currency: 'EUR',
    articleCount: 1,
    merchandiseCents: 0,
    shippingCents: 0,
    totalCents: 0,
    sourceFileId: 'file-1',
    sourceLineNumber: 1,
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

function line(
  id: string,
  orderId: string,
  direction: CardmarketOrderLine['direction'],
  productId: string,
  values: Partial<CardmarketOrderLine> = {}
): CardmarketOrderLine {
  return {
    id,
    orderId,
    lineNo: 1,
    direction,
    purchasedAt: now,
    productId,
    articleName: id,
    quantity: 1,
    unitPriceCents: 0,
    lineTotalCents: 0,
    currency: 'EUR',
    language: 'English',
    condition: 'NM',
    sourceFileId: 'file-1',
    sourceLineNumber: 1,
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

beforeEach(async () => {
  db = await createTestDb('cardmarket-accounting-projection');
  service = new CardmarketAccountingProjectionService(db);
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('CardmarketAccountingProjectionService', () => {
  it('projects purchases before sales with exact cents and is idempotent', async () => {
    await db.cards.bulkAdd([card('card-1', 1001), card('card-2', 1002)]);
    await db.cm_orders.bulkAdd([
      order('purchase-1', 'purchase', {
        articleCount: 3,
        merchandiseCents: 1000,
        shippingCents: 100,
        totalCents: 1100,
      }),
      order('sale-1', 'sale', {
        merchandiseCents: 800,
        shippingCents: 200,
        commissionCents: 80,
        totalCents: 920,
      }),
    ]);
    await db.cm_order_lines.bulkAdd([
      line('purchase-1:1', 'purchase-1', 'purchase', '1001', {
        lineNo: 1,
        quantity: 1,
        unitPriceCents: 400,
        lineTotalCents: 400,
      }),
      line('purchase-1:2', 'purchase-1', 'purchase', '1002', {
        lineNo: 2,
        quantity: 2,
        unitPriceCents: 300,
        lineTotalCents: 600,
      }),
      line('sale-1:1', 'sale-1', 'sale', '1001', {
        quantity: 1,
        unitPriceCents: 800,
        lineTotalCents: 800,
      }),
    ]);

    const firstSummary = await service.projectAll();
    expect(firstSummary).toMatchObject({
      acquisitions: 1,
      inventoryLots: 2,
      sales: 1,
      saleLines: 1,
      lotAllocations: 1,
      openIssues: 0,
    });

    const lots = await db.inventory_lots.orderBy('id').toArray();
    expect(lots.map(row => row.allocatedCostCent)).toEqual([440, 660]);
    const sale = await db.sales.get('sale:cardmarket:sale:sale-1');
    expect(sale?.netProceedsCent).toBe(920);
    const allocation = await db.lot_allocations.toCollection().first();
    expect(allocation).toMatchObject({
      quantity: 1,
      costBasisCentSnapshot: 440,
      netProceedsCentSnapshot: 920,
    });
    const lotSnapshot = await new AccountingRepository(db).getLotSnapshot(lots[0].id);
    expect(lotSnapshot?.remainingQuantity).toBe(0);
    expect(lotSnapshot?.realizedPnL).toEqual({ status: 'known', cents: 480 });

    const beforeSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sales: await db.sales.toArray(),
      saleLines: await db.sale_lines.toArray(),
      allocations: await db.lot_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    await service.projectAll();
    const afterSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sales: await db.sales.toArray(),
      saleLines: await db.sale_lines.toArray(),
      allocations: await db.lot_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    expect(afterSecondRun).toBe(beforeSecondRun);
  });

  it('keeps an unresolved purchase visible without inventing inventory', async () => {
    await db.cm_orders.add(
      order('purchase-unresolved', 'purchase', {
        merchandiseCents: 100,
        totalCents: 100,
      })
    );
    await db.cm_order_lines.add(
      line(
        'purchase-unresolved:1',
        'purchase-unresolved',
        'purchase',
        '999999',
        { unitPriceCents: 100, lineTotalCents: 100 }
      )
    );

    await service.projectAll();

    expect(await db.inventory_lots.count()).toBe(0);
    const issue = await db.reconciliation_issues.toCollection().first();
    expect(issue).toMatchObject({ kind: 'unmatched', status: 'open' });
  });

  it('allocates one sale across multiple FIFO lots with exact cost snapshots', async () => {
    await db.cards.add(card('card-1', 1001));
    await db.acquisitions.add({
      id: 'seed-acquisition',
      kind: 'collection',
      source: 'test',
      sourceRef: 'test:seed-acquisition',
      currency: 'EUR',
      happenedAt: new Date('2026-08-01T12:00:00.000Z'),
      totalCostCent: 500,
      createdAt: now,
      updatedAt: now,
    });
    await db.inventory_lots.bulkAdd([
      {
        id: 'lot-older',
        acquisitionId: 'seed-acquisition',
        cardId: 'card-1',
        initialQuantity: 1,
        allocatedCostCent: 100,
        costBasisStatus: 'known',
        origin: 'purchase',
        ownershipStatus: 'imported',
        condition: 'NM',
        language: 'en',
        finish: 'nonfoil',
        acquiredAt: new Date('2026-08-01T12:00:00.000Z'),
        sourceRef: 'test:lot-older',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lot-newer',
        acquisitionId: 'seed-acquisition',
        cardId: 'card-1',
        initialQuantity: 2,
        allocatedCostCent: 400,
        costBasisStatus: 'known',
        origin: 'purchase',
        ownershipStatus: 'imported',
        condition: 'NM',
        language: 'en',
        finish: 'nonfoil',
        acquiredAt: new Date('2026-08-02T12:00:00.000Z'),
        sourceRef: 'test:lot-newer',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.cm_orders.add(
      order('sale-multi-lot', 'sale', {
        merchandiseCents: 600,
        totalCents: 600,
      })
    );
    await db.cm_order_lines.add(
      line('sale-multi-lot:1', 'sale-multi-lot', 'sale', '1001', {
        quantity: 2,
        unitPriceCents: 300,
        lineTotalCents: 600,
      })
    );

    await service.projectAll();

    const allocations = (await db.lot_allocations.toArray()).sort((left, right) =>
      left.lotId.localeCompare(right.lotId)
    );
    expect(allocations).toHaveLength(2);
    expect(allocations.map(row => ({
      lotId: row.lotId,
      quantity: row.quantity,
      cost: row.costBasisCentSnapshot,
      proceeds: row.netProceedsCentSnapshot,
    }))).toEqual([
      { lotId: 'lot-newer', quantity: 1, cost: 200, proceeds: 300 },
      { lotId: 'lot-older', quantity: 1, cost: 100, proceeds: 300 },
    ]);
    const snapshots = await Promise.all([
      new AccountingRepository(db).getLotSnapshot('lot-older'),
      new AccountingRepository(db).getLotSnapshot('lot-newer'),
    ]);
    const realizedPnLCent = snapshots.reduce(
      (sum, snapshot) =>
        sum + (snapshot?.realizedPnL.status === 'known' ? snapshot.realizedPnL.cents : 0),
      0
    );
    expect(realizedPnLCent).toBe(300);
  });

  it('flags a later purchase that may duplicate a deck-created lot', async () => {
    await db.cards.add(card('card-1', 1001));
    await db.acquisitions.add({
      id: 'deck-acquisition',
      kind: 'deck_gap',
      source: 'deck_import',
      sourceRef: 'deck:gap:1',
      currency: 'EUR',
      happenedAt: now,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const deckLot: InventoryLot = {
      id: 'deck-lot',
      acquisitionId: 'deck-acquisition',
      cardId: 'card-1',
      initialQuantity: 1,
      costBasisStatus: 'unknown',
      origin: 'deck_import',
      ownershipStatus: 'user_confirmed',
      condition: 'unknown',
      language: 'en',
      finish: 'nonfoil',
      acquiredAt: now,
      sourceRef: 'deck:gap:1',
      createdAt: now,
      updatedAt: now,
    };
    await db.inventory_lots.add(deckLot);
    await db.cm_orders.add(
      order('purchase-1', 'purchase', {
        merchandiseCents: 100,
        totalCents: 100,
      })
    );
    await db.cm_order_lines.add(
      line('purchase-1:1', 'purchase-1', 'purchase', '1001', {
        unitPriceCents: 100,
        lineTotalCents: 100,
      })
    );

    await service.projectAll();

    const issue = await db.reconciliation_issues
      .where('kind')
      .equals('possible_duplicate_inventory')
      .first();
    expect(issue).toMatchObject({
      status: 'open',
      candidateLotId: 'deck-lot',
    });
  });

  it('preserves a manual sale allocation during reprojection', async () => {
    await db.cards.add(card('card-1', 1001));
    await db.acquisitions.add({
      id: 'seed-acquisition',
      kind: 'single',
      source: 'test',
      sourceRef: 'test:seed-acquisition',
      currency: 'EUR',
      happenedAt: now,
      totalCostCent: 100,
      createdAt: now,
      updatedAt: now,
    });
    await db.inventory_lots.add({
      id: 'manual-sale-lot',
      acquisitionId: 'seed-acquisition',
      cardId: 'card-1',
      initialQuantity: 1,
      allocatedCostCent: 100,
      costBasisStatus: 'known',
      origin: 'purchase',
      ownershipStatus: 'imported',
      condition: 'NM',
      language: 'en',
      finish: 'nonfoil',
      acquiredAt: now,
      sourceRef: 'test:manual-sale-lot',
      createdAt: now,
      updatedAt: now,
    });
    await db.cm_orders.add(
      order('sale-locked', 'sale', {
        merchandiseCents: 200,
        totalCents: 200,
      })
    );
    await db.cm_order_lines.add(
      line('sale-locked:1', 'sale-locked', 'sale', '1001', {
        unitPriceCents: 200,
        lineTotalCents: 200,
      })
    );
    const saleLineId =
      'sale-line:cardmarket:sale:sale-locked:line:sale-locked:1';
    await db.lot_allocations.add({
      id: 'manual-sale-allocation',
      saleLineId,
      lotId: 'manual-sale-lot',
      quantity: 1,
      costBasisCentSnapshot: 100,
      costBasisStatus: 'known',
      netProceedsCentSnapshot: 200,
      method: 'manual',
      createdAt: now,
    });

    await service.projectAll();

    expect(await db.lot_allocations.count()).toBe(1);
    expect(await db.lot_allocations.get('manual-sale-allocation')).toMatchObject({
      method: 'manual',
      quantity: 1,
      netProceedsCentSnapshot: 200,
    });
    expect(await db.reconciliation_issues.where('status').equals('open').count()).toBe(0);
  });
});
