import MtgTrackerDb from './db';

let dbInstance: MtgTrackerDb | null = null;

const initialize = async (): Promise<MtgTrackerDb> => {
  if (dbInstance) {
    return dbInstance;
  }

  const db = new MtgTrackerDb();
  await db.open();
  dbInstance = db;
  return db;
};

export const dbPromise = initialize();

export const getDb = (): MtgTrackerDb => {
  if (!dbInstance) {
    throw new Error("Database not initialized");
  }
  return dbInstance;
}
