import { beforeEach, describe, expect, it } from 'vitest';
import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_TABLE_NAMES,
} from '../../../src/data/db';
import { getDb } from '../../../src/data/init';
import {
  BACKUP_FORMAT_VERSION,
  BackupService,
  type BackupEnvelope,
} from '../../../src/features/backup/BackupService';

describe('BackupService', () => {
  const db = getDb();

  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(table => table.clear()));
    });
  });

  async function seedEveryTable(): Promise<void> {
    const createdAt = new Date('2026-08-10T12:00:00.000Z');

    await db.transaction('rw', db.tables, async () => {
      for (const tableName of DATABASE_TABLE_NAMES) {
        const table = db.table(tableName);
        const primaryKey = table.schema.primKey.keyPath;
        if (typeof primaryKey !== 'string') {
          throw new Error(`Unexpected compound primary key in ${tableName}`);
        }
        await table.add({
          [primaryKey]: `${tableName}-record`,
          createdAt,
        });
      }
    });
  }

  it('exports and restores every schema table with Date values intact', async () => {
    await seedEveryTable();

    const json = await BackupService.exportData();
    const backup = JSON.parse(json) as BackupEnvelope;

    expect(backup.format).toBe('mtg-pwa-backup');
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.database).toEqual({
      name: DATABASE_NAME,
      schemaVersion: DATABASE_SCHEMA_VERSION,
    });
    expect(Object.keys(backup.tables).sort()).toEqual([...DATABASE_TABLE_NAMES].sort());
    expect(Object.values(backup.tables).every(rows => rows.length === 1)).toBe(true);

    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(table => table.clear()));
    });
    await BackupService.importData(json);

    const counts = await BackupService.getRecordCounts();
    expect(Object.values(counts).every(count => count === 1)).toBe(true);
    for (const tableName of DATABASE_TABLE_NAMES) {
      const restored = await db.table(tableName).toCollection().first();
      expect(restored.createdAt).toBeInstanceOf(Date);
      expect(restored.createdAt.toISOString()).toBe('2026-08-10T12:00:00.000Z');
    }
  });

  it('rejects incomplete backups before replacing existing data', async () => {
    await db.cards.add({
      id: 'existing-card',
      name: 'Existing Card',
      set: 'Test',
      setCode: 'tst',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const backup = JSON.parse(await BackupService.exportData()) as BackupEnvelope;
    delete (backup.tables as Partial<BackupEnvelope['tables']>).sell_allocations;

    await expect(BackupService.importData(JSON.stringify(backup))).rejects.toThrow('sell_allocations');
    expect(await db.cards.get('existing-card')).toBeDefined();
  });

  it('rolls back the whole restore when any table cannot be written', async () => {
    await db.cards.add({
      id: 'existing-card',
      name: 'Existing Card',
      set: 'Test',
      setCode: 'tst',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const backup = JSON.parse(await BackupService.exportData()) as BackupEnvelope;
    backup.tables.cm_import_files = [
      {
        id: 'file-1',
        source: 'cardmarket',
        fileHash: 'duplicate-hash',
      },
      {
        id: 'file-2',
        source: 'cardmarket',
        fileHash: 'duplicate-hash',
      },
    ];

    await expect(BackupService.importData(JSON.stringify(backup))).rejects.toThrow();
    expect(await db.cards.get('existing-card')).toBeDefined();
    expect(await db.cm_import_files.count()).toBe(0);
  });
});
