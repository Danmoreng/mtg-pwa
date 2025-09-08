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
import db from '../data/db';

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
});

// restore timers/mocks per test
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});