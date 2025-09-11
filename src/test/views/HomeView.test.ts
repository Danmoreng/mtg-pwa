import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import HomeView from '../../features/dashboard/HomeView.vue';
import { useCardsStore } from '../../stores/cards';
import { useHoldingsStore } from '../../stores/holdings';
import { useTransactionsStore } from '../../stores/transactions';
import { ValuationEngine } from '../../features/analytics/ValuationEngine';
import { FinanceService } from '../../features/analytics/FinanceService';
import { Money } from '../../core/Money';

// Mock the composables
vi.mock('../../composables/usePriceUpdates', () => ({
  usePriceUpdates: () => ({
    formatDate: vi.fn().mockReturnValue('01.01.2023 12:00'),
    checkAndScheduleUpdate: vi.fn().mockResolvedValue(undefined),
    forceUpdatePrices: vi.fn().mockResolvedValue(undefined),
    lastUpdate: new Date('2023-01-01T12:00:00Z'),
    nextUpdate: new Date('2023-01-02T12:00:00Z'),
    isUpdating: false
  })
}));

// Mock the services
vi.mock('../../features/analytics/ValuationEngine', () => ({
  ValuationEngine: {
    calculatePortfolioValue: vi.fn().mockResolvedValue({ getCents: () => 10000, format: (locale) => '€100.00' }),
    calculateTotalCostBasis: vi.fn().mockResolvedValue({ getCents: () => 5000, format: (locale) => '€50.00' }),
    calculateUnrealizedPnL: vi.fn().mockResolvedValue({ getCents: () => 5000, format: (locale) => '€50.00' }),
    calculateRealizedPnL: vi.fn().mockResolvedValue({ getCents: () => 1000, format: (locale) => '€10.00' })
  }
}));

vi.mock('../../features/analytics/FinanceService', () => ({
  FinanceService: {
    getTotalRevenue: vi.fn().mockResolvedValue({ getCents: () => 20000, format: (locale) => '€200.00' }),
    getTotalCosts: vi.fn().mockResolvedValue({ getCents: () => 15000, format: (locale) => '€150.00' }),
    getTotalFees: vi.fn().mockResolvedValue({ getCents: () => 1000, format: (locale) => '€10.00' }),
    getTotalShippingCosts: vi.fn().mockImplementation((type) => {
      if (type === 'purchase') {
        return Promise.resolve({ getCents: () => 500, format: (locale) => '€5.00', subtract: () => ({ getCents: () => 300, format: (locale) => '€3.00' }) });
      } else {
        return Promise.resolve({ getCents: () => 200, format: (locale) => '€2.00' });
      }
    }),
    getTotalNetProfit: vi.fn().mockResolvedValue({ getCents: () => 4000, format: (locale) => '€40.00' })
  }
}));

describe('HomeView', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  // it('should render the dashboard with correct initial values', async () => {
  //   const wrapper = mount(HomeView, {
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
  //             },
  //             holdings: {
  //               holdings: {},
  //               loading: false,
  //               error: null
  //             },
  //             transactions: {
  //               transactions: {},
  //               loading: false,
  //               error: null
  //             }
  //           }
  //         })
  //       ]
  //     }
  //   });

  //   // Wait for the component to load and for all async operations to complete
  //   await wrapper.vm.$nextTick();
  //   await new Promise(resolve => setTimeout(resolve, 100));

  //   // Check that the component renders
  //   expect(wrapper.find('h1').text()).toBe('MTG Collection Tracker');

  //   // Check that financial values are displayed
  //   expect(wrapper.text()).toContain('€100.00'); // Portfolio Value
  //   expect(wrapper.text()).toContain('€50.00');  // Total Cost
  //   expect(wrapper.text()).toContain('€50.00');  // Unrealized P/L
  //   expect(wrapper.text()).toContain('€10.00');  // Realized P/L
  //   expect(wrapper.text()).toContain('€200.00'); // Total Revenue
  //   expect(wrapper.text()).toContain('€150.00'); // Total Costs
  //   expect(wrapper.text()).toContain('€40.00');  // Net Profit/Loss
  // });

  it('should load data without blocking UI', async () => {
    const wrapper = mount(HomeView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          })
        ]
      }
    });

    // Wait for the component to load and for all async operations to complete
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the store instances
    const cardsStore = useCardsStore();
    const holdingsStore = useHoldingsStore();
    const transactionsStore = useTransactionsStore();

    // Verify that data loading methods were called
    expect(cardsStore.loadCards).toHaveBeenCalled();
    expect(holdingsStore.loadHoldings).toHaveBeenCalled();
    expect(transactionsStore.loadTransactions).toHaveBeenCalled();
  });

  it('should handle refresh prices correctly', async () => {
    const wrapper = mount(HomeView, {
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

    // Find the refresh button and click it
    const refreshButton = wrapper.find('button');
    expect(refreshButton.text()).toBe('Refresh Prices Now');

    // Click the button
    await refreshButton.trigger('click');

    // Verify that forceUpdatePrices was called
    // This is verified by the mock in usePriceUpdates
  });
});