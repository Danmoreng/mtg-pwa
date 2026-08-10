import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  Acquisition,
  Card,
  Deck,
  DeckCard,
  InventoryLot,
} from '@/data/db';
import type MtgTrackerDb from '@/data/db';
import { DeckAccountingProjectionService } from '@/features/decks/DeckAccountingProjectionService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

const now = new Date('2026-08-10T12:00:00.000Z');
let db: MtgTrackerDb;
let service: DeckAccountingProjectionService;

function card(id: string): Card {
  return {
    id,
    name: id,
    set: 'Test',
    setCode: 'tst',
    number: id,
    lang: 'en',
    finish: 'nonfoil',
    createdAt: now,
    updatedAt: now,
  };
}

function deck(values: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    platform: 'csv',
    name: 'Test Deck',
    importedAt: now,
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

function deckCard(id: string, cardId: string, quantity: number): DeckCard {
  return {
    id,
    deckId: 'deck-1',
    cardId,
    quantity,
    role: 'main',
    addedAt: now,
    createdAt: now,
  };
}

function acquisition(): Acquisition {
  return {
    id: 'purchase-1',
    kind: 'single',
    source: 'test',
    externalRef: 'purchase-1',
    sourceRef: 'test:purchase-1',
    currency: 'EUR',
    happenedAt: now,
    occurredAt: now,
    totalCostCent: 100,
    createdAt: now,
    updatedAt: now,
  };
}

function lot(cardId: string, quantity: number): InventoryLot {
  return {
    id: `lot-${cardId}`,
    acquisitionId: 'purchase-1',
    cardId,
    initialQuantity: quantity,
    allocatedCostCent: 100,
    costBasisStatus: 'known',
    origin: 'purchase',
    ownershipStatus: 'imported',
    condition: 'NM',
    language: 'en',
    finish: 'nonfoil',
    acquiredAt: now,
    sourceRef: `test:lot:${cardId}`,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(async () => {
  db = await createTestDb('deck-accounting-projection');
  service = new DeckAccountingProjectionService(db);
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('DeckAccountingProjectionService', () => {
  it('allocates existing inventory, leaves the deficit visible, and is idempotent', async () => {
    await db.cards.add(card('card-1'));
    await db.decks.add(deck());
    await db.deck_cards.add(deckCard('deck-card-1', 'card-1', 2));
    await db.acquisitions.add(acquisition());
    await db.inventory_lots.add(lot('card-1', 1));

    const firstSummary = await service.projectDeck('deck-1');
    expect(firstSummary).toMatchObject({
      requiredQuantity: 2,
      allocatedExistingQuantity: 1,
      createdDeficitQuantity: 0,
      missingQuantity: 1,
      openIssues: 1,
    });
    expect(await db.inventory_lots.count()).toBe(1);
    expect(await db.deck_inventory_allocations.toCollection().first()).toMatchObject({
      deckCardId: 'deck-card-1',
      lotId: 'lot-card-1',
      quantity: 1,
      method: 'auto',
      releasedAt: undefined,
    });
    expect(await db.reconciliation_issues.toCollection().first()).toMatchObject({
      kind: 'quantity_conflict',
      status: 'open',
      details: { missingQuantity: 1 },
    });
    expect(await db.decks.get('deck-1')).toMatchObject({
      inventoryMode: 'physical_exclusive',
      status: 'active',
    });

    const beforeSecondRun = JSON.stringify({
      deck: await db.decks.get('deck-1'),
      runs: await db.deck_import_runs.toArray(),
      lots: await db.inventory_lots.toArray(),
      allocations: await db.deck_inventory_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    await service.projectDeck('deck-1');
    const afterSecondRun = JSON.stringify({
      deck: await db.decks.get('deck-1'),
      runs: await db.deck_import_runs.toArray(),
      lots: await db.inventory_lots.toArray(),
      allocations: await db.deck_inventory_allocations.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    expect(afterSecondRun).toBe(beforeSecondRun);
  });

  it('creates only confirmed deficits and allocates entered total cost exactly', async () => {
    await db.cards.bulkAdd([card('card-1'), card('card-2')]);
    await db.decks.add(deck());
    await db.deck_cards.bulkAdd([
      deckCard('deck-card-1', 'card-1', 1),
      deckCard('deck-card-2', 'card-2', 2),
    ]);

    const options = {
      missingInventoryPolicy: 'create_deficit' as const,
      costBasisPolicy: 'enter_total' as const,
      totalDeficitCostCent: 101,
    };
    const firstSummary = await service.projectDeck('deck-1', options);
    expect(firstSummary).toMatchObject({
      requiredQuantity: 3,
      allocatedExistingQuantity: 0,
      createdDeficitQuantity: 3,
      missingQuantity: 0,
      openIssues: 0,
    });
    const lots = await db.inventory_lots.orderBy('id').toArray();
    expect(lots.map(row => row.initialQuantity)).toEqual([1, 2]);
    expect(lots.map(row => row.allocatedCostCent)).toEqual([34, 67]);
    expect(lots.map(row => row.ownershipStatus)).toEqual([
      'user_confirmed',
      'user_confirmed',
    ]);
    expect(await db.acquisitions.get('acquisition:deck-gap:deck-1')).toMatchObject({
      kind: 'deck_gap',
      totalCostCent: 101,
    });
    expect(await db.deck_import_runs.get('deck-import-run:deck-1')).toMatchObject({
      missingInventoryPolicy: 'create_deficit',
      costBasisPolicy: 'enter_total',
      confirmedBy: 'user',
    });

    const beforeSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      runs: await db.deck_import_runs.toArray(),
      lots: await db.inventory_lots.toArray(),
      sources: await db.inventory_lot_sources.toArray(),
      allocations: await db.deck_inventory_allocations.toArray(),
    });
    await service.projectDeck('deck-1', options);
    const afterSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      runs: await db.deck_import_runs.toArray(),
      lots: await db.inventory_lots.toArray(),
      sources: await db.inventory_lot_sources.toArray(),
      allocations: await db.deck_inventory_allocations.toArray(),
    });
    expect(afterSecondRun).toBe(beforeSecondRun);
  });

  it('keeps a requirements-only deck separate from physical inventory', async () => {
    await db.cards.add(card('card-1'));
    await db.decks.add(deck());
    await db.deck_cards.add(deckCard('deck-card-1', 'card-1', 1));

    const summary = await service.projectDeck('deck-1', {
      existingInventoryPolicy: 'requirements_only',
    });

    expect(summary).toMatchObject({
      requiredQuantity: 1,
      allocatedExistingQuantity: 0,
      createdDeficitQuantity: 0,
      missingQuantity: 1,
    });
    expect(await db.deck_inventory_allocations.count()).toBe(0);
    expect(await db.reconciliation_issues.count()).toBe(0);
    expect(await db.decks.get('deck-1')).toMatchObject({
      inventoryMode: 'requirements_only',
    });
  });

  it('preserves a manual allocation during reprojection', async () => {
    await db.cards.add(card('card-1'));
    await db.decks.add(deck());
    await db.deck_cards.add(deckCard('deck-card-1', 'card-1', 1));
    await db.acquisitions.add(acquisition());
    await db.inventory_lots.add(lot('card-1', 2));
    await db.deck_inventory_allocations.add({
      id: 'manual-allocation-1',
      deckCardId: 'deck-card-1',
      lotId: 'lot-card-1',
      quantity: 1,
      method: 'manual',
      createdAt: now,
      updatedAt: now,
    });

    await service.projectDeck('deck-1');

    expect(await db.deck_inventory_allocations.count()).toBe(1);
    const manualAllocation = await db.deck_inventory_allocations.get('manual-allocation-1');
    expect(manualAllocation).toMatchObject({
      method: 'manual',
    });
    expect(manualAllocation?.releasedAt).toBeUndefined();
  });

  it('applies a confirmed default unit cost to every created deficit', async () => {
    await db.cards.bulkAdd([card('card-1'), card('card-2')]);
    await db.decks.add(deck());
    await db.deck_cards.bulkAdd([
      deckCard('deck-card-1', 'card-1', 2),
      deckCard('deck-card-2', 'card-2', 1),
    ]);

    await service.projectDeck('deck-1', {
      missingInventoryPolicy: 'create_deficit',
      costBasisPolicy: 'enter_per_card',
      defaultDeficitUnitCostCent: 125,
    });

    const lots = await db.inventory_lots.orderBy('id').toArray();
    expect(lots.map(row => row.allocatedCostCent)).toEqual([250, 125]);
    expect(await db.deck_import_runs.get('deck-import-run:deck-1')).toMatchObject({
      defaultDeficitUnitCostCent: 125,
      confirmedBy: 'user',
    });
  });
});
