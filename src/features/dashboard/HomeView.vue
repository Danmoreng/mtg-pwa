<template>
  <div class="home">
    <div class="row">
      <div class="col-12">
        <h1 class="mb-4">MTG Collection Tracker</h1>
      </div>
      <div class="col-lg-9">
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title">Portfolio Value Over Time</h5>
            <PortfolioValueChart />
          </div>
        </div>
      </div>
      <div class="col-lg-3">
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title">Price Updates</h5>
            <div class="small text-muted mb-1">
              Last: {{ formatDate(lastUpdate) }} | Next: {{ formatDate(nextUpdate) }}
            </div>
            <button @click="refreshPrices" class="btn btn-sm btn-link p-0" :disabled="isUpdating">
              {{ isUpdating ? 'Updating...' : 'Refresh Now' }}
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Quick Stats</h5>
            <div class="small">
              <div class="d-flex justify-content-between">
                <span class="text-muted">Portfolio Value:</span>
                <span class="fw-medium">{{ portfolioValue }}</span>
              </div>
              <div class="d-flex justify-content-between">
                <span class="text-muted">Total Cost:</span>
                <span class="fw-medium">{{ totalCost }}</span>
              </div>
              <div class="d-flex justify-content-between">
                <span class="text-muted">Net Profit/Loss:</span>
                <span class="fw-medium" :class="parseFloat(netProfitValue) >= 0 ? 'text-success' : 'text-danger'">{{ netProfitValue }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Unrealized P/L</h5>
            <p class="stat-value" :class="parseFloat(unrealizedPL) >= 0 ? 'positive' : 'negative'">{{ unrealizedPL }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Realized P/L</h5>
            <p class="stat-value" :class="parseFloat(realizedPL) >= 0 ? 'positive' : 'negative'">{{ realizedPL }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Total Revenue</h5>
            <p class="stat-value text-success">{{ totalRevenue }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Total Costs</h5>
            <p class="stat-value text-danger">{{ totalCosts }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useHoldingsStore } from '../../stores/holdings';
import { useTransactionsStore } from '../../stores/transactions';
import { ValuationEngine } from '../analytics/ValuationEngine';
import { FinanceService } from '../analytics/FinanceService';
import { Money } from '../../core/Money';
import PortfolioValueChart from '../../components/PortfolioValueChart.vue';
import {usePriceUpdates} from "../../composables/usePriceUpdates.ts";

// Get the stores
const cardsStore = useCardsStore();
const holdingsStore = useHoldingsStore();
const transactionsStore = useTransactionsStore();

// Get price update composable
const { formatDate, checkAndScheduleUpdate, forceUpdatePrices, lastUpdate, nextUpdate, isUpdating } = usePriceUpdates();

// Reactive state
const portfolioValue = ref('€0.00');
const totalCost = ref('€0.00');
const unrealizedPL = ref('€0.00');
const realizedPL = ref('€0.00');
const totalRevenue = ref('€0.00');
const totalCosts = ref('€0.00');
const netProfitValue = ref('€0.00');
const salesRevenue = ref('€0.00');
const purchaseCosts = ref('€0.00');
const totalFees = ref('€0.00');
const shippingCosts = ref('€0.00');

// Format money values
const formatMoney = (money: Money): string => {
  return money.format('de-DE');
};

// Load initial data
const loadData = async () => {
  try {
    // Load data from stores
    await cardsStore.loadCards();
    await holdingsStore.loadHoldings();
    await transactionsStore.loadTransactions();
    
    const value = await ValuationEngine.calculatePortfolioValue();
    const cost = await ValuationEngine.calculateTotalCostBasis();
    const unrealized = await ValuationEngine.calculateUnrealizedPnL();
    const realized = await ValuationEngine.calculateRealizedPnL();

    portfolioValue.value = formatMoney(value);
    totalCost.value = formatMoney(cost);
    unrealizedPL.value = formatMoney(unrealized);
    realizedPL.value = formatMoney(realized);
    
    // NEW FINANCIAL CALCULATIONS
    const revenue = await FinanceService.getTotalRevenue();
    const costs = await FinanceService.getTotalCosts();
    const fees = await FinanceService.getTotalFees();
    const shipping = await FinanceService.getTotalShippingCosts('purchase');
    const shippingRevenue = await FinanceService.getTotalShippingCosts('sale');
    const netProfit = await FinanceService.getTotalNetProfit();

    totalRevenue.value = formatMoney(revenue);
    totalCosts.value = formatMoney(costs);
    salesRevenue.value = formatMoney(revenue);
    purchaseCosts.value = formatMoney(costs);
    totalFees.value = formatMoney(fees);
    shippingCosts.value = formatMoney(shipping.subtract(shippingRevenue));

    netProfitValue.value = formatMoney(netProfit);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
};

// Refresh prices
const refreshPrices = async () => {
  try {
    await forceUpdatePrices();
    // Reload data to reflect updated prices
    await loadData();
  } catch (error) {
    console.error('Error refreshing prices:', error);
  }
};

// Load data when component mounts
onMounted(async () => {
  // Load the dashboard data immediately without waiting for price updates
  await loadData();
  
  // Check if we need to update prices automatically in the background
  setTimeout(async () => {
    await checkAndScheduleUpdate();
  }, 0);
});
</script>

<style scoped>
.home {
  padding: var(--space-lg);
}

.dashboard-stats {
  margin: var(--space-xl) 0;
}

.stat-value {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.stat-value.positive {
  color: var(--color-success);
}

.stat-value.negative {
  color: var(--color-error);
}

.import-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-top: var(--space-xl);
}

.import-section h2 {
  margin-top: 0;
}

.import-buttons {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}
</style>