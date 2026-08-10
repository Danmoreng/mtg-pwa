import type { Table } from 'dexie';
import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_TABLE_NAMES,
  type DatabaseTableName,
} from '../../data/db';
import { getDb } from '../../data/init';

const BACKUP_FORMAT = 'mtg-pwa-backup';
export const BACKUP_FORMAT_VERSION = 1;

type BackupRecord = Record<string, unknown>;
type BackupTables = Record<DatabaseTableName, BackupRecord[]>;

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  database: {
    name: typeof DATABASE_NAME;
    schemaVersion: typeof DATABASE_SCHEMA_VERSION;
  };
  tables: BackupTables;
}

function isRecord(value: unknown): value is BackupRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function shouldReviveDate(key: string): boolean {
  return key === 'asOf' || key.endsWith('At');
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => reviveDates(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (shouldReviveDate(key) && typeof nestedValue === 'string') {
        const date = new Date(nestedValue);
        if (!Number.isNaN(date.getTime())) {
          return [key, date];
        }
      }
      return [key, reviveDates(nestedValue)];
    })
  );
}

function getPrimaryKeyPath(table: Table): string {
  const keyPath = table.schema.primKey.keyPath;
  if (typeof keyPath !== 'string') {
    throw new Error(`Table ${table.name} does not use a supported primary key.`);
  }
  return keyPath;
}

function parseAndValidateBackup(jsonData: string): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('The selected file is not an MTG Tracker backup.');
  }
  if (parsed.format !== BACKUP_FORMAT || parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('The backup format or version is not supported.');
  }

  const database = parsed.database;
  if (!isRecord(database) || database.name !== DATABASE_NAME || database.schemaVersion !== DATABASE_SCHEMA_VERSION) {
    throw new Error('The backup was created for a different database schema.');
  }

  const tables = parsed.tables;
  if (!isRecord(tables)) {
    throw new Error('The backup does not contain a tables section.');
  }

  const db = getDb();
  for (const tableName of DATABASE_TABLE_NAMES) {
    const rows = tables[tableName];
    if (!Array.isArray(rows)) {
      throw new Error(`The backup is missing table ${tableName}.`);
    }

    const table = db.table(tableName);
    const primaryKeyPath = getPrimaryKeyPath(table);
    const primaryKeys = new Set<unknown>();
    for (const row of rows) {
      if (!isRecord(row) || row[primaryKeyPath] === undefined || row[primaryKeyPath] === null) {
        throw new Error(`Table ${tableName} contains a record without primary key ${primaryKeyPath}.`);
      }
      const primaryKey = row[primaryKeyPath];
      if (primaryKeys.has(primaryKey)) {
        throw new Error(`Table ${tableName} contains duplicate primary key ${String(primaryKey)}.`);
      }
      primaryKeys.add(primaryKey);
    }
  }

  return parsed as unknown as BackupEnvelope;
}

export class BackupService {
  static async exportData(): Promise<string> {
    const db = getDb();
    const tables = {} as BackupTables;

    await db.transaction('r', db.tables, async () => {
      for (const tableName of DATABASE_TABLE_NAMES) {
        tables[tableName] = await db.table(tableName).toArray() as BackupRecord[];
      }
    });

    const backup: BackupEnvelope = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      database: {
        name: DATABASE_NAME,
        schemaVersion: DATABASE_SCHEMA_VERSION,
      },
      tables,
    };

    return JSON.stringify(backup, null, 2);
  }

  static async importData(jsonData: string): Promise<void> {
    const backup = parseAndValidateBackup(jsonData);
    const restoredTables = reviveDates(backup.tables) as BackupTables;
    const db = getDb();

    await db.transaction('rw', db.tables, async () => {
      for (const tableName of DATABASE_TABLE_NAMES) {
        await db.table(tableName).clear();
      }
      for (const tableName of DATABASE_TABLE_NAMES) {
        const rows = restoredTables[tableName];
        if (rows.length > 0) {
          await db.table(tableName).bulkAdd(rows);
        }
      }
    });
  }

  static async getRecordCounts(): Promise<Record<DatabaseTableName, number>> {
    const db = getDb();
    const counts = {} as Record<DatabaseTableName, number>;

    await db.transaction('r', db.tables, async () => {
      for (const tableName of DATABASE_TABLE_NAMES) {
        counts[tableName] = await db.table(tableName).count();
      }
    });

    return counts;
  }

  static async exportToFile(): Promise<void> {
    const jsonData = await this.exportData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    try {
      link.href = url;
      link.download = `mtg-pwa-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }

  static async importFromFile(file: File): Promise<void> {
    await this.importData(await file.text());
  }
}
