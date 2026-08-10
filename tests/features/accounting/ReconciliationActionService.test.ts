import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardmarketOrder, CardmarketOrderLine } from '@/data/db';
import type MtgTrackerDb from '@/data/db';
import { AccountingRepository } from '@/features/accounting/AccountingRepository';
import { ReconciliationActionService } from '@/features/accounting/ReconciliationActionService';
import { DeckAccountingProjectionService } from '@/features/decks/DeckAccountingProjectionService';
import { CardmarketAccountingProjectionService } from '@/features/imports/CardmarketAccountingProjectionService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

let db: MtgTrackerDb;
let service: ReconciliationActionService;

beforeEach(async () => {
  db = await createTestDb('reconciliation-action-service');
  service = new ReconciliationActionService(db);
  const now = new Date('2026-08-10T12:00:00.000Z');
  await db.cards.add({
    id: 'card-1',
    name: 'Test Card',
    set: 'Test Set',
    setCode: 'tst',
    number: '1',
    lang: 'en',
    finish: 'nonfoil',
    createdAt: now,
    updatedAt: now,
  });
  await db.acquisitions.bulkAdd([
    {
      id: 'acquisition-deck',
      kind: 'deck_gap',
      source: 'deck_import',
      sourceRef: 'deck-gap:1',
      currency: 'EUR',
      happenedAt: now,
      occurredAt: now,
      allocationMethod: 'manual',
      projectionVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acquisition-cardmarket',
      kind: 'cardmarket_order',
      source: 'cardmarket',
      sourceRef: 'cardmarket:purchase:1',
      currency: 'EUR',
      happenedAt: now,
      occurredAt: now,
      totalCostCent: 600,
      allocationMethod: 'equal_per_item',
      projectionVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.inventory_lots.bulkAdd([
    {
      id: 'lot-deck',
      acquisitionId: 'acquisition-deck',
      cardId: 'card-1',
      initialQuantity: 1,
      costBasisStatus: 'unknown',
      origin: 'deck_import',
      ownershipStatus: 'user_confirmed',
      condition: 'unknown',
      language: 'en',
      finish: 'nonfoil',
      acquiredAt: now,
      sourceRef: 'deck-gap:1',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lot-incoming',
      acquisitionId: 'acquisition-cardmarket',
      cardId: 'card-1',
      initialQuantity: 2,
      allocatedCostCent: 600,
      costBasisStatus: 'known',
      origin: 'cardmarket',
      ownershipStatus: 'import_confirmed',
      condition: 'near_mint',
      language: 'en',
      finish: 'nonfoil',
      acquiredAt: now,
      sourceRef: 'cardmarket:purchase:1:line:1',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.reconciliation_issues.add({
    id: 'issue-1',
    kind: 'possible_duplicate_inventory',
    sourceRef: 'cardmarket:purchase:1:line:1',
    candidateLotId: 'lot-deck',
    details: { incomingLotId: 'lot-incoming' },
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('ReconciliationActionService', () => {
  it('merges the same physical copy without double counting inventory', async () => {
    await service.resolveAsSamePhysicalCopy('issue-1');

    const accounting = new AccountingRepository(db);
    expect((await accounting.getLotSnapshot('lot-incoming'))?.remainingQuantity).toBe(1);
    expect((await accounting.getLotSnapshot('lot-incoming'))?.openCostBasis).toEqual({
      status: 'known',
      cents: 300,
    });
    expect((await accounting.getLotSnapshot('lot-deck'))?.openCostBasis).toEqual({
      status: 'known',
      cents: 300,
    });
    expect(await db.inventory_adjustments.count()).toBe(1);
    expect((await db.reconciliation_issues.get('issue-1'))?.resolution).toBe(
      'same_physical_copy'
    );

    await service.resolveAsSamePhysicalCopy('issue-1');
    expect(await db.inventory_adjustments.count()).toBe(1);
  });

  it('records a user decision and allows it to be reopened', async () => {
    await service.resolve('issue-1', 'additional_copy', { note: 'Both copies exist.' });
    expect((await db.reconciliation_issues.get('issue-1'))?.status).toBe('resolved');

    await service.reopen('issue-1');
    const issue = await db.reconciliation_issues.get('issue-1');
    expect(issue?.status).toBe('open');
    expect(issue?.resolution).toBeUndefined();
  });

  it('creates canonical inventory from a deck deficit and resolves the issue', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    await db.cards.add({
      id: 'card-deck-gap', name: 'Missing Commander', set: 'Test Set', setCode: 'tst',
      number: '2', lang: 'de', finish: 'foil', createdAt: now, updatedAt: now,
    });
    await db.decks.add({
      id: 'deck-1', platform: 'csv', name: 'Test Deck', importedAt: now,
      createdAt: now, updatedAt: now,
    });
    await db.deck_cards.add({
      id: 'deck-card-gap', deckId: 'deck-1', cardId: 'card-deck-gap', quantity: 1,
      finish: 'foil', language: 'de', condition: 'excellent', role: 'main',
      addedAt: now, createdAt: now,
    });
    await new DeckAccountingProjectionService(db).projectDeck('deck-1');

    const issueId = 'issue:deck-deficit:deck-card-gap';
    const context = await service.getMissingInventoryContext(issueId);
    expect(context).toMatchObject({
      quantity: 1, finish: 'foil', language: 'de', condition: 'excellent',
      reason: 'deck_deficit', card: { id: 'card-deck-gap' },
    });
    expect(await service.getIssuePresentations([context.issue])).toMatchObject([{
      issueId,
      title: 'Missing Commander',
      printing: 'Test Set · (TST) · #2 · DE · foil',
      context: 'Deck: Test Deck · 1 missing of 1',
      card: { id: 'card-deck-gap' },
    }]);

    const result = await service.createMissingInventory(issueId, {
      costBasisStatus: 'unknown',
      occurredAt: now,
    });

    expect(result.resolved).toBe(true);
    expect(await db.inventory_lots.get(`lot:reconciliation:${issueId}:inventory`)).toMatchObject({
      cardId: 'card-deck-gap', initialQuantity: 1, origin: 'manual',
      ownershipStatus: 'user_confirmed', costBasisStatus: 'unknown',
    });
    expect(await db.deck_inventory_allocations.where('deckCardId').equals('deck-card-gap').count()).toBe(1);
    expect((await db.reconciliation_issues.get(issueId))?.status).toBe('resolved');
  });

  it('adds a historical acquisition for an oversold sale and allocates it', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    await db.cards.add({
      id: 'card-oversold', cardmarketId: 2002, name: 'Sold Card', set: 'Test Set',
      setCode: 'tst', number: '3', lang: 'en', finish: 'nonfoil', createdAt: now, updatedAt: now,
    });
    const order: CardmarketOrder = {
      id: 'sale-oversold', direction: 'sale', orderDate: now, currency: 'EUR', articleCount: 1,
      merchandiseCents: 500, shippingCents: 0, totalCents: 450, commissionCents: 50,
      sourceFileId: 'sales-file', sourceLineNumber: 1, createdAt: now, updatedAt: now,
    };
    const line: CardmarketOrderLine = {
      id: 'sale-oversold:1', orderId: order.id, lineNo: 1, direction: 'sale', purchasedAt: now,
      productId: '2002', articleName: 'Sold Card', quantity: 1, unitPriceCents: 500,
      lineTotalCents: 500, currency: 'EUR', language: 'English', condition: 'NM',
      sourceFileId: 'sales-file', sourceLineNumber: 1, createdAt: now, updatedAt: now,
    };
    await db.cm_orders.add(order);
    await db.cm_order_lines.add(line);
    await new CardmarketAccountingProjectionService(db).projectAll();
    const issue = await db.reconciliation_issues.where('kind').equals('oversold').first();
    expect(issue).toBeDefined();

    const result = await service.createMissingInventory(issue!.id, {
      costBasisStatus: 'estimated', totalCostCent: 175, occurredAt: now,
    });

    expect(result.resolved).toBe(true);
    const saleLine = await db.sale_lines.where('cardId').equals('card-oversold').first();
    const allocation = saleLine
      ? await db.lot_allocations.where('saleLineId').equals(saleLine.id).first()
      : undefined;
    expect(allocation).toMatchObject({ quantity: 1, costBasisCentSnapshot: 175 });
    expect((await db.reconciliation_issues.get(issue!.id))?.status).toBe('resolved');
  });

  it('maps an unmatched Cardmarket product and reprojects the purchase', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    await db.cards.add({
      id: 'card-unmatched', name: 'Mapped Card', set: 'Test Set', setCode: 'tst',
      number: '4', lang: 'en', finish: 'nonfoil', createdAt: now, updatedAt: now,
    });
    const order: CardmarketOrder = {
      id: 'purchase-unmatched', direction: 'purchase', orderDate: now, currency: 'EUR',
      articleCount: 1, merchandiseCents: 250, shippingCents: 0, totalCents: 250,
      sourceFileId: 'purchases-file', sourceLineNumber: 1, createdAt: now, updatedAt: now,
    };
    const line: CardmarketOrderLine = {
      id: 'purchase-unmatched:1', orderId: order.id, lineNo: 1, direction: 'purchase',
      purchasedAt: now, productId: '3003', articleName: 'Mapped Card', quantity: 1,
      unitPriceCents: 250, lineTotalCents: 250, currency: 'EUR', language: 'English',
      condition: 'NM', sourceFileId: 'purchases-file', sourceLineNumber: 1,
      createdAt: now, updatedAt: now,
    };
    await db.cm_orders.add(order);
    await db.cm_order_lines.add(line);
    await new CardmarketAccountingProjectionService(db).projectAll();
    const issue = await db.reconciliation_issues.where('kind').equals('unmatched').first();
    expect(issue).toBeDefined();

    const result = await service.mapUnmatchedIssue(issue!.id, 'card-unmatched');

    expect(result.resolved).toBe(true);
    expect((await db.cards.get('card-unmatched'))?.cardmarketId).toBe(3003);
    expect(await db.inventory_lots.where('cardId').equals('card-unmatched').count()).toBe(1);
  });

  it('keeps an intentionally dismissed deck deficit resolved during retries', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    await db.cards.add({
      id: 'card-dismissed', name: 'Intentional Proxy', set: 'Test Set', setCode: 'tst',
      number: '5', lang: 'en', finish: 'nonfoil', createdAt: now, updatedAt: now,
    });
    await db.decks.add({
      id: 'deck-dismissed', platform: 'csv', name: 'Proxy Deck', importedAt: now,
      createdAt: now, updatedAt: now,
    });
    await db.deck_cards.add({
      id: 'deck-card-dismissed', deckId: 'deck-dismissed', cardId: 'card-dismissed',
      quantity: 1, role: 'main', addedAt: now, createdAt: now,
    });
    const projector = new DeckAccountingProjectionService(db);
    await projector.projectDeck('deck-dismissed');
    const issueId = 'issue:deck-deficit:deck-card-dismissed';
    await service.resolve(issueId, 'ignored');

    await service.retryProjections();

    expect(await db.reconciliation_issues.get(issueId)).toMatchObject({
      status: 'resolved', resolution: 'ignored',
    });
  });
});
