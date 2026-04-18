/// <reference types="vitest/globals" />

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { vi } from 'vitest'

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const current = (globalThis as any)[name];
  if (current && typeof current.getItem === 'function' && typeof current.setItem === 'function') {
    return;
  }

  const fromWindow = (globalThis as any).window?.[name];
  if (fromWindow && typeof fromWindow.getItem === 'function' && typeof fromWindow.setItem === 'function') {
    (globalThis as any)[name] = fromWindow;
    return;
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: createStorageMock(),
  });
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

// keep Dexie quiet in tests
Dexie.debug = false;

// Ensure a clean DB between tests (since we run single-threaded this is safe)
import { setDbForTesting } from '../data/init';
import MtgTrackerDb from '../data/db';

let db: MtgTrackerDb;

beforeAll(async () => {
  const { createPinia, setActivePinia } = await import('pinia');
  setActivePinia(createPinia());

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
