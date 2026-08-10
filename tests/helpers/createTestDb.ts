import Dexie from 'dexie';
import MtgTrackerDb from '@/data/db';

let databaseCounter = 0;

export async function createTestDb(label: string): Promise<MtgTrackerDb> {
  databaseCounter += 1;
  const safeLabel = label.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const db = new MtgTrackerDb(`MtgTrackerDbTest-${safeLabel}-${databaseCounter}`);
  await db.open();
  return db;
}

export async function deleteTestDb(db: MtgTrackerDb): Promise<void> {
  const databaseName = db.name;
  db.close();
  await Dexie.delete(databaseName);
}
