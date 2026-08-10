import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  Acquisition,
  Card,
  CardmarketOrder,
  CardmarketOrderLine,
  Deck,
  DeckCard,
  Scan,
} from '@/data/db';
import type MtgTrackerDb from '@/data/db';
import { AccountingProjectionCoordinator } from '@/features/accounting/AccountingProjectionCoordinator';
import { AccountingRepository } from '@/features/accounting/AccountingRepository';
import { DeckAccountingProjectionService } from '@/features/decks/DeckAccountingProjectionService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

const acquiredAt = new Date('2026-08-01T12:00:00.000Z');
const deckImportedAt = new Date('2026-08-05T12:00:00.000Z');
const soldAt = new Date('2026-08-10T12:00:00.000Z');
let db: MtgTrackerDb;

beforeEach(async () => {
  db = await createTestDb('accounting-golden-path');
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('accounting projection golden path', () => {
  it('converges independent import order to sale-first inventory and deck reservations', async () => {
    const card: Card = {
      id: 'card-1',
      cardmarketId: 1001,
      name: 'Test Card',
      set: 'Test',
      setCode: 'tst',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: acquiredAt,
      updatedAt: acquiredAt,
    };
    const deck: Deck = {
      id: 'deck-1',
      platform: 'csv',
      name: 'Physical Deck',
      importedAt: deckImportedAt,
      createdAt: deckImportedAt,
      updatedAt: deckImportedAt,
    };
    const deckCard: DeckCard = {
      id: 'deck-card-1',
      deckId: deck.id,
      cardId: card.id,
      quantity: 1,
      finish: 'nonfoil',
      language: 'en',
      role: 'main',
      addedAt: deckImportedAt,
      createdAt: deckImportedAt,
    };
    await db.cards.add(card);
    await db.decks.add(deck);
    await db.deck_cards.add(deckCard);

    await new DeckAccountingProjectionService(db).projectDeck(deck.id);
    expect(await db.reconciliation_issues.where('status').equals('open').count()).toBe(1);

    const saleOrder: CardmarketOrder = {
      id: 'sale-1',
      direction: 'sale',
      orderDate: soldAt,
      currency: 'EUR',
      articleCount: 1,
      merchandiseCents: 450,
      shippingCents: 0,
      totalCents: 400,
      commissionCents: 50,
      sourceFileId: 'sale-file-1',
      sourceLineNumber: 1,
      createdAt: soldAt,
      updatedAt: soldAt,
    };
    const saleLine: CardmarketOrderLine = {
      id: 'sale-1:1',
      orderId: saleOrder.id,
      lineNo: 1,
      direction: 'sale',
      purchasedAt: soldAt,
      productId: '1001',
      articleName: card.name,
      quantity: 1,
      unitPriceCents: 450,
      lineTotalCents: 450,
      currency: 'EUR',
      language: 'English',
      condition: 'NM',
      sourceFileId: 'sale-file-1',
      sourceLineNumber: 1,
      createdAt: soldAt,
      updatedAt: soldAt,
    };
    await db.cm_orders.add(saleOrder);
    await db.cm_order_lines.add(saleLine);
    const coordinator = new AccountingProjectionCoordinator(db);
    await coordinator.projectAfterCardmarketImport();
    expect(
      await db.reconciliation_issues
        .where('[status+kind]')
        .equals(['open', 'oversold'])
        .count()
    ).toBe(1);

    const acquisition: Acquisition = {
      id: 'manabox-acquisition-1',
      kind: 'box',
      source: 'manabox',
      externalRef: 'box-1',
      currency: 'EUR',
      happenedAt: acquiredAt,
      totalPriceCent: 500,
      totalFeesCent: 0,
      totalShippingCent: 0,
      totalCostCent: 500,
      createdAt: acquiredAt,
      updatedAt: acquiredAt,
    };
    const scan: Scan = {
      id: 'scan-1',
      acquisitionId: acquisition.id,
      cardFingerprint: 'tst:1:en:nonfoil',
      cardId: card.id,
      source: 'manabox',
      externalRef: 'scan-1',
      scannedAt: acquiredAt,
      quantity: 2,
      finish: 'nonfoil',
      language: 'en',
      createdAt: acquiredAt,
      updatedAt: acquiredAt,
    };
    await db.acquisitions.add(acquisition);
    await db.scans.add(scan);

    await coordinator.projectAfterManaBoxImport(acquisition.id);

    expect(await db.reconciliation_issues.where('status').equals('open').count()).toBe(0);
    const canonicalLot = await db.inventory_lots.get('lot:manabox:scan:scan-1');
    expect(canonicalLot).toBeDefined();
    const snapshot = await new AccountingRepository(db).getLotSnapshot(canonicalLot!.id);
    expect(snapshot).toMatchObject({
      effectiveQuantity: 2,
      soldQuantity: 1,
      remainingQuantity: 1,
      deckReservedQuantity: 1,
      availableForDecks: 0,
      openCostBasis: { status: 'known', cents: 250 },
      realizedPnL: { status: 'known', cents: 150 },
      issues: [],
    });

    const beforeReimport = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sales: await db.sales.toArray(),
      saleLines: await db.sale_lines.toArray(),
      saleAllocations: await db.lot_allocations.toArray(),
      deckAllocations: await db.deck_inventory_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    await coordinator.projectAfterManaBoxImport(acquisition.id);
    const afterReimport = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sales: await db.sales.toArray(),
      saleLines: await db.sale_lines.toArray(),
      saleAllocations: await db.lot_allocations.toArray(),
      deckAllocations: await db.deck_inventory_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    expect(afterReimport).toBe(beforeReimport);
  });
});
