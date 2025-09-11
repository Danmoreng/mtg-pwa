import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import CardComponent from '../../components/CardComponent.vue';
import { useCardsStore } from '../../stores/cards';
import db from '../../data/db';

// Mock db
vi.mock('../../data/db', () => ({
  default: {
    card_lots: {
      where: vi.fn()
    },
    transactions: {
      where: vi.fn()
    },
    price_points: {
      where: vi.fn()
    }
  }
}));

// Mock reka-ui components
vi.mock('reka-ui', () => ({
  DialogRoot: {
    template: '<div><slot></slot></div>'
  },
  DialogPortal: {
    template: '<div><slot></slot></div>'
  },
  DialogOverlay: {
    template: '<div><slot></slot></div>'
  },
  DialogContent: {
    template: '<div><slot></slot></div>'
  },
  DialogTitle: {
    template: '<div><slot></slot></div>'
  },
  DialogClose: {
    template: '<div><slot></slot></div>'
  }
}));

describe('CardComponent with Progress Tracking', () => {
  const mockCard = {
    id: 'test-card',
    name: 'Test Card',
    set: 'Test Set',
    setCode: 'TS',
    number: '1',
    lang: 'en',
    finish: 'nonfoil',
    layout: 'normal',
    imageUrl: 'https://example.com/card.jpg',
    imageUrlBack: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should render card with image and basic info', async () => {
    const wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      },
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

    // Check that card info is displayed
    expect(wrapper.find('.card-title').text()).toBe('Test Card');
    expect(wrapper.find('.card-text').text()).toBe('Test Set #1');
    expect(wrapper.find('.card-image-container').exists()).toBe(true);
  });

  it('should show placeholder when no image is available', async () => {
    const cardWithoutImage = { ...mockCard, imageUrl: '' };
    
    const wrapper = mount(CardComponent, {
      props: {
        card: cardWithoutImage
      },
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

    // Check that placeholder is displayed
    expect(wrapper.find('.placeholder-image').exists()).toBe(true);
    expect(wrapper.find('.placeholder-image .text-muted').text()).toBe('Missing Image');
  });

  it('should open modal when card is clicked', async () => {
    const wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      },
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

    // Click on the card
    await wrapper.find('.card-item').trigger('click');

    // Check that modal is opened
    expect(wrapper.vm.showModal).toBe(true);
  });

  it('should load card details in background when modal opens', async () => {
    // Mock the database calls
    const mockLots = [{ id: 'lot-1', cardId: 'test-card', quantity: 1 }];
    const mockTransactions = [{ id: 'tx-1', cardId: 'test-card', kind: 'BUY' }];
    
    // Mock the database methods
    db.card_lots.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockLots)
      })
    });
    
    db.transactions.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockTransactions)
      })
    });
    
    db.price_points.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
    });

    const wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Click on the card to open the modal
    await wrapper.find('.card-item').trigger('click');

    // Wait for next tick to allow setTimeout to execute
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check that the lots and transactions were loaded
    expect(db.card_lots.where).toHaveBeenCalledWith('cardId');
    expect(db.transactions.where).toHaveBeenCalledWith('cardId');
  });

  it('should display price when available', async () => {
    const wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {
                  'test-card': {
                    format: vi.fn().mockReturnValue('€50.00')
                  }
                },
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

    // Check that price is displayed
    expect(wrapper.find('.text-success').text()).toBe('€50.00');
  });

  it('should show loading state when prices are loading', async () => {
    const wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              cards: {
                cards: {},
                cardPrices: {},
                loading: false,
                loadingPrices: true,
                error: null
              }
            }
          })
        ]
      }
    });

    // Wait for the component to load
    await wrapper.vm.$nextTick();

    // Check that loading state is displayed
    expect(wrapper.find('.small.text-muted.fst-italic').exists()).toBe(true);
    expect(wrapper.find('.small.text-muted.fst-italic').text()).toBe('Loading...');
  });

  // it('should close modal when close button is clicked', async () => {
  //   const wrapper = mount(CardComponent, {
  //     props: {
  //       card: mockCard
  //     },
  //     global: {
  //       plugins: [
  //         createTestingPinia({
  //           createSpy: vi.fn,
  //           initialState: {
  //             cards: {
  //               cards: {},
  //               cardPrices: {},
  //               loading: false,
  //               loadingPrices: false,
  //               error: null
  //             }
  //           }
  //         })
  //       ]
  //     }
  //   });

  //   // Wait for the component to load
  //   await wrapper.vm.$nextTick();

  //   // Open the modal first
  //   await wrapper.find('.card-item').trigger('click');
  //   expect(wrapper.vm.showModal).toBe(true);

  //   // Find and click the close button - we need to trigger the DialogClose component
  //   const closeButtons = wrapper.findAll('button[aria-label="Close"]');
  //   if (closeButtons.length > 0) {
  //     await closeButtons[0].trigger('click');
  //   }

  //   // Wait for next tick to allow the modal to close
  //   await wrapper.vm.$nextTick();

  //   // Check that modal is closed
  //   expect(wrapper.vm.showModal).toBe(false);
  // });
});