import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCardsStore } from '../../src/stores/cards';

describe('Cards Store', () => {
  beforeEach(() => {
    // Create a new pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should initialize with empty state', () => {
    const store = useCardsStore();
    expect(store.cards).toEqual({});
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('should add a card', async () => {
    const store = useCardsStore();
    const card = {
      id: 'test-card',
      name: 'Test Card',
      set: 'Test Set',
      setCode: 'TS',
      number: '1',
      lang: 'en',
      finish: 'nonfoil',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await store.addCard(card);
    expect(store.cards).toHaveProperty('test-card');
    expect(store.cards['test-card']).toEqual(card);
  });
});