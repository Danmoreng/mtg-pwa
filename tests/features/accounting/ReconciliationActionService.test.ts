import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { AccountingRepository } from '@/features/accounting/AccountingRepository';
import { ReconciliationActionService } from '@/features/accounting/ReconciliationActionService';
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
});
