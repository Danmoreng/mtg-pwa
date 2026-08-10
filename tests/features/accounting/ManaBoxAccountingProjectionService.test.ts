import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Acquisition, Card, Scan } from '@/data/db';
import type MtgTrackerDb from '@/data/db';
import { ManaBoxAccountingProjectionService } from '@/features/imports/ManaBoxAccountingProjectionService';
import { createTestDb, deleteTestDb } from '../../helpers/createTestDb';

const now = new Date('2026-08-10T12:00:00.000Z');
let db: MtgTrackerDb;
let service: ManaBoxAccountingProjectionService;

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

function acquisition(values: Partial<Acquisition> = {}): Acquisition {
  return {
    id: 'acquisition-1',
    kind: 'box',
    source: 'manabox',
    externalRef: 'box-1',
    currency: 'EUR',
    happenedAt: now,
    totalPriceCent: 250,
    totalFeesCent: 20,
    totalShippingCent: 30,
    totalCostCent: 300,
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

function scan(id: string, values: Partial<Scan> = {}): Scan {
  return {
    id,
    acquisitionId: 'acquisition-1',
    cardFingerprint: `fingerprint:${id}`,
    cardId: `card-${id}`,
    source: 'manabox',
    externalRef: id,
    scannedAt: now,
    quantity: 1,
    finish: 'nonfoil',
    language: 'en',
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

beforeEach(async () => {
  db = await createTestDb('manabox-accounting-projection');
  service = new ManaBoxAccountingProjectionService(db);
});

afterEach(async () => {
  await deleteTestDb(db);
});

describe('ManaBoxAccountingProjectionService', () => {
  it('allocates acquisition cents by scan quantity and is idempotent', async () => {
    await db.cards.bulkAdd([card('card-scan-1'), card('card-scan-2')]);
    await db.acquisitions.add(acquisition());
    await db.scans.bulkAdd([
      scan('scan-1'),
      scan('scan-2', { quantity: 2 }),
    ]);

    const firstSummary = await service.projectAcquisition('acquisition-1');
    expect(firstSummary).toMatchObject({
      acquisitions: 1,
      inventoryLots: 2,
      openIssues: 0,
    });
    const lots = await db.inventory_lots.orderBy('id').toArray();
    expect(lots.map(row => row.allocatedCostCent)).toEqual([100, 200]);
    expect(lots.map(row => row.costBasisStatus)).toEqual(['known', 'known']);

    const beforeSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sources: await db.inventory_lot_sources.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    await service.projectAcquisition('acquisition-1');
    const afterSecondRun = JSON.stringify({
      acquisitions: await db.acquisitions.toArray(),
      lots: await db.inventory_lots.toArray(),
      sources: await db.inventory_lot_sources.toArray(),
      issues: await db.reconciliation_issues.toArray(),
    });
    expect(afterSecondRun).toBe(beforeSecondRun);
  });

  it('keeps unknown cost basis unknown instead of inventing zero cost', async () => {
    await db.cards.add(card('card-scan-1'));
    await db.acquisitions.add(acquisition({
      totalPriceCent: undefined,
      totalFeesCent: undefined,
      totalShippingCent: undefined,
      totalCostCent: undefined,
    }));
    await db.scans.add(scan('scan-1'));

    await service.projectAcquisition('acquisition-1');

    expect(await db.inventory_lots.toCollection().first()).toMatchObject({
      allocatedCostCent: undefined,
      costBasisStatus: 'unknown',
    });
  });

  it('records an unresolved scan as an issue without creating inventory', async () => {
    await db.acquisitions.add(acquisition());
    await db.scans.add(scan('scan-1', { cardId: undefined }));

    await service.projectAcquisition('acquisition-1');

    expect(await db.inventory_lots.count()).toBe(0);
    expect(await db.reconciliation_issues.toCollection().first()).toMatchObject({
      kind: 'unmatched',
      sourceRef: 'manabox:scan:scan-1',
      status: 'open',
    });
  });
});
