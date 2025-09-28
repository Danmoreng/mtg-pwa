/// <reference types="vitest/globals" />

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Set up Pinia for tests
setActivePinia(createPinia())

// keep Dexie quiet in tests
Dexie.debug = false;

// Ensure a clean DB between tests (since we run single-threaded this is safe)
import { setDbForTesting } from '../data/init';
import MtgTrackerDb from '../data/db';

let db: MtgTrackerDb;

beforeAll(async () => {
  // Create a new database instance for tests
  db = new MtgTrackerDb();
  setDbForTesting(db);
  // Open the database before running any tests
  await db.open();
});

beforeEach(async () => {
  // Clear all tables before each test
  if (db.tables) {
    await Promise.all(db.tables.map(table => table.clear()));
  } else {
    // If tables aren't available yet, we need to await the database initialization
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  }
});

// restore timers/mocks per test
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Close the database after all tests are done
afterAll(() => {
  db.close();
});