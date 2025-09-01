import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMtgStore } from './mtg';

describe('MTG Store', () => {
  beforeEach(() => {
    // Create a new pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should initialize with empty state', () => {
    const store = useMtgStore();
    
    // Check cards state
    expect(store.cards).toEqual({});
    expect(store.cardsLoading).toBe(false);
    expect(store.cardsError).toBeNull();
    
    // Check holdings state
    expect(store.holdings).toEqual({});
    expect(store.holdingsLoading).toBe(false);
    expect(store.holdingsError).toBeNull();
    
    // Check transactions state
    expect(store.transactions).toEqual({});
    expect(store.transactionsLoading).toBe(false);
    expect(store.transactionsError).toBeNull();
    
    // Check decks state
    expect(store.decks).toEqual({});
    expect(store.decksLoading).toBe(false);
    expect(store.decksError).toBeNull();
    
    // Check settings state
    expect(store.settings).toEqual({});
    expect(store.settingsLoading).toBe(false);
    expect(store.settingsError).toBeNull();
  });
});