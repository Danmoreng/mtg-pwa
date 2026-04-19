import Dexie from 'dexie';
import MtgTrackerDb from './db';

let dbInstance: MtgTrackerDb | null = null;

const initialize = async (): Promise<MtgTrackerDb> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const db = new MtgTrackerDb();
    await db.open();
    dbInstance = db;
    return db;
  } catch (error) {
    // Clean-start mode: when local browser has an older/higher schema, reset DB.
    if (error instanceof Error && error.name === 'VersionError') {
      await Dexie.delete('MtgTrackerDb');
      const db = new MtgTrackerDb();
      await db.open();
      dbInstance = db;
      return db;
    }
    throw error;
  }
};

export const dbPromise = initialize();

export const getDb = (): MtgTrackerDb => {
  if (!dbInstance) {
    // Vitest in a worker environment might not have process.env defined.
    const isVitest = typeof process !== 'undefined' && process.env?.VITEST;
    if (isVitest) {
      throw new Error("Database not initialized. Call setDbForTesting in your test setup.");
    }
    throw new Error("Database not initialized");
  }
  return dbInstance;
}

export function setDbForTesting(testDb: MtgTrackerDb): void {
    dbInstance = testDb;
}
