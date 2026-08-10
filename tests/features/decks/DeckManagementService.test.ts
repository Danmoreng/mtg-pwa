import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { DeckManagementService } from '@/features/decks/DeckManagementService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

describe('DeckManagementService', () => {
  let db: MtgTrackerDb;
  const now = new Date('2026-08-10T12:00:00.000Z');

  beforeEach(async () => {
    db = await createTestDb('deck-management-service');
    await db.decks.add({ id: 'deck-1', platform: 'csv', name: 'Deck', importedAt: now, createdAt: now, updatedAt: now });
    await db.cards.add({ id: 'card-1', name: 'Card', set: 'Test', setCode: 'tst', number: '1', lang: 'en', finish: 'nonfoil', createdAt: now, updatedAt: now });
    await db.deck_cards.add({ id: 'deck-card-1', deckId: 'deck-1', cardId: 'card-1', quantity: 1, role: 'main', addedAt: now, createdAt: now });
    await db.acquisitions.add({ id: 'acquisition-1', kind: 'single', source: 'manual', currency: 'EUR', happenedAt: now, sourceRef: 'manual:1', createdAt: now, updatedAt: now });
    await db.inventory_lots.add({ id: 'lot-1', acquisitionId: 'acquisition-1', cardId: 'card-1', initialQuantity: 1, costBasisStatus: 'unknown', origin: 'manual', ownershipStatus: 'user_confirmed', condition: 'unknown', language: 'en', finish: 'nonfoil', acquiredAt: now, sourceRef: 'manual:1', createdAt: now, updatedAt: now });
    await db.deck_inventory_allocations.add({ id: 'allocation-1', deckCardId: 'deck-card-1', lotId: 'lot-1', quantity: 1, method: 'auto', createdAt: now, updatedAt: now });
    await db.reconciliation_issues.add({ id: 'issue-1', kind: 'quantity_conflict', sourceRef: 'deck:deck-1:card:deck-card-1', details: { deckId: 'deck-1' }, status: 'open', createdAt: now, updatedAt: now });
  });

  afterEach(async () => deleteTestDb(db));

  it('archives a deck while releasing reservations and preserving history', async () => {
    await new DeckManagementService(db).archiveDeck('deck-1');
    expect(await db.decks.get('deck-1')).toMatchObject({ status: 'archived' });
    expect((await db.deck_inventory_allocations.get('allocation-1'))?.releasedAt).toBeInstanceOf(Date);
    expect(await db.deck_cards.count()).toBe(1);
    expect(await db.inventory_lots.count()).toBe(1);
    expect(await db.reconciliation_issues.get('issue-1')).toMatchObject({ status: 'resolved', resolutionData: { reason: 'deck_archived' } });
  });
});
