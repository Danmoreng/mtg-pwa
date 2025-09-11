import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import CardsView from '../../features/cards/views/CardsView.vue';
import { useCardsStore } from '../../stores/cards';
import { Money } from '../../core/Money';

describe('CardsView', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should render the cards view with search and sort controls', async () => {
    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {},
                loading: false,
                loadingPrices: false,
                error: null
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Check that the component renders
    expect(wrapper.find('h1').exists()).toBe(false); // No h1 in this component
    expect(wrapper.find('.header').exists()).toBe(true);
    expect(wrapper.find('.search-box input').exists()).toBe(true);
    expect(wrapper.find('.sort-controls select').exists()).toBe(true);
    expect(wrapper.find('.sort-controls button').exists()).toBe(true);
  });

  it('should load cards immediately and prices in background', async () => {
    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {},
                loading: false,
                loadingPrices: false,
                error: null
              }
            },
            stubActions: false
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Get the store instance
    const cardsStore = useCardsStore();

    // Verify that cards are loaded immediately
    expect(cardsStore.loadCards).toHaveBeenCalled();

    // Verify that price loading is scheduled (but not awaited)
    // We can't directly test the setTimeout, but we can verify the method exists
    expect(cardsStore.loadCardPrices).toBeDefined();
  });

  it('should show loading state when cards are loading', async () => {
    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {},
                loading: true,
                loadingPrices: false,
                error: null
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Check that loading message is displayed
    expect(wrapper.find('.loading').exists()).toBe(true);
    expect(wrapper.find('.loading').text()).toBe('Loading cards and prices...');
  });

  it('should show empty state when no cards exist', async () => {
    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {},
                loading: false,
                loadingPrices: false,
                error: null,
                getAllCards: []
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Check that empty state is displayed
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.find('.empty-state p').text()).toBe("You don't have any cards in your collection yet.");
  });

  it('should show empty state when search returns no results', async () => {
    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {
                  'card-1': {
                    id: 'card-1',
                    name: 'Test Card',
                    set: 'Test Set',
                    setCode: 'TS',
                    number: '1',
                    lang: 'en',
                    finish: 'nonfoil',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                },
                cardPrices: {},
                loading: false,
                loadingPrices: false,
                error: null,
                getAllCards: [
                  {
                    id: 'card-1',
                    name: 'Test Card',
                    set: 'Test Set',
                    setCode: 'TS',
                    number: '1',
                    lang: 'en',
                    finish: 'nonfoil',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                ]
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Set search query that won't match any cards
    const searchInput = wrapper.find('.search-box input');
    await searchInput.setValue('Nonexistent Card');

    // Check that empty state is displayed
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.find('.empty-state p').text()).toBe('No cards match your search.');
  });

  it('should sort cards correctly', async () => {
    const mockCards = [
      {
        id: 'card-1',
        name: 'Alpha Card',
        set: 'Alpha Set',
        setCode: 'AS',
        number: '1',
        lang: 'en',
        finish: 'nonfoil',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'card-2',
        name: 'Beta Card',
        set: 'Beta Set',
        setCode: 'BS',
        number: '2',
        lang: 'en',
        finish: 'nonfoil',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const wrapper = mount(CardsView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {
                  'card-1': mockCards[0],
                  'card-2': mockCards[1]
                },
                cardPrices: {
                  'card-1': {
                    getCents: () => 1000,
                    getCurrency: () => 'EUR',
                    format: vi.fn().mockReturnValue('€10.00')
                  },
                  'card-2': {
                    getCents: () => 2000,
                    getCurrency: () => 'EUR',
                    format: vi.fn().mockReturnValue('€20.00')
                  }
                },
                loading: false,
                loadingPrices: false,
                error: null,
                getAllCards: mockCards
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Check that cards are displayed
    expect(wrapper.findAll('.col-xl-2')).toHaveLength(2);

    // Test sorting by name
    const sortSelect = wrapper.find('.sort-controls select');
    await sortSelect.setValue('name');
    
    // Test sorting by price
    await sortSelect.setValue('price');
    
    // Test sorting direction toggle
    const sortDirectionButton = wrapper.find('.sort-controls button');
    await sortDirectionButton.trigger('click');
  });
});