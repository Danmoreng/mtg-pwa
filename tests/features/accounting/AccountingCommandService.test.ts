import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type MtgTrackerDb from '@/data/db';
import { AccountingCommandService } from '@/features/accounting/AccountingCommandService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

let db: MtgTrackerDb;
let service: AccountingCommandService;

beforeEach(async () => {
  db = await createTestDb('accounting-command-service');
  service = new AccountingCommandService(db);
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
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('AccountingCommandService', () => {
  it('creates manual inventory atomically and idempotently', async () => {
    const command = {
      acquisitionId: 'acquisition-manual-1',
      lotId: 'lot-manual-1',
      lotSourceId: 'lot-source-manual-1',
      sourceRef: 'manual:entry:1',
      cardId: 'card-1',
      quantity: 2,
      allocatedCostCent: 500,
      costBasisStatus: 'known' as const,
      finish: 'nonfoil' as const,
      language: 'EN',
      condition: 'near_mint',
      occurredAt: new Date('2026-08-10T12:00:00.000Z'),
    };

    const first = await service.createManualInventory(command);
    const second = await service.createManualInventory(command);

    expect(second).toEqual(first);
    expect(await db.acquisitions.count()).toBe(1);
    expect(await db.inventory_lots.count()).toBe(1);
    expect(await db.inventory_lot_sources.count()).toBe(1);
    expect(first.language).toBe('en');

    await expect(
      service.createManualInventory({ ...command, quantity: 3 })
    ).rejects.toThrow('sourceRef collision');
    expect(await db.inventory_lots.count()).toBe(1);
  });

  it('applies and reverses a removal while preserving an audit trail', async () => {
    await service.createManualInventory({
      acquisitionId: 'acquisition-manual-1',
      lotId: 'lot-manual-1',
      lotSourceId: 'lot-source-manual-1',
      sourceRef: 'manual:entry:1',
      cardId: 'card-1',
      quantity: 2,
      allocatedCostCent: 500,
      costBasisStatus: 'known',
      finish: 'nonfoil',
      language: 'en',
      condition: 'near_mint',
      occurredAt: new Date('2026-08-10T12:00:00.000Z'),
    });

    const removal = await service.applyAdjustment({
      id: 'adjustment-1',
      sourceRef: 'manual:adjustment:1',
      lotId: 'lot-manual-1',
      quantityDelta: -1,
      costBasisDeltaCent: -250,
      costBasisStatus: 'known',
      kind: 'gifted',
      effectiveAt: new Date('2026-08-11T12:00:00.000Z'),
      confirmedAt: new Date('2026-08-11T12:00:00.000Z'),
    });
    expect((await service.getLotSnapshot('lot-manual-1'))?.effectiveQuantity).toBe(1);

    await service.reverseAdjustment(removal.id, {
      id: 'adjustment-2',
      sourceRef: 'manual:adjustment:2',
      effectiveAt: new Date('2026-08-12T12:00:00.000Z'),
      confirmedAt: new Date('2026-08-12T12:00:00.000Z'),
      note: 'Undo gift correction',
    });

    const snapshot = await service.getLotSnapshot('lot-manual-1');
    expect(snapshot?.effectiveQuantity).toBe(2);
    expect(snapshot?.openCostBasis).toEqual({ status: 'known', cents: 500 });
    expect(await db.inventory_adjustments.count()).toBe(2);
  });

  it('rolls back an adjustment that would make inventory negative', async () => {
    await service.createManualInventory({
      acquisitionId: 'acquisition-manual-1',
      lotId: 'lot-manual-1',
      lotSourceId: 'lot-source-manual-1',
      sourceRef: 'manual:entry:1',
      cardId: 'card-1',
      quantity: 1,
      costBasisStatus: 'unknown',
      finish: 'nonfoil',
      language: 'en',
      condition: 'unknown',
      occurredAt: new Date('2026-08-10T12:00:00.000Z'),
    });

    await expect(
      service.applyAdjustment({
        id: 'invalid-adjustment',
        sourceRef: 'manual:adjustment:invalid',
        lotId: 'lot-manual-1',
        quantityDelta: -2,
        costBasisStatus: 'unknown',
        kind: 'lost',
        effectiveAt: new Date('2026-08-11T12:00:00.000Z'),
        confirmedAt: new Date('2026-08-11T12:00:00.000Z'),
      })
    ).rejects.toThrow();

    expect(await db.inventory_adjustments.count()).toBe(0);
  });
});
