<template>
  <div class="home">
    <h1>MTG Collection Tracker</h1>
    
    <!-- Price Update Information -->
    <div class="price-update-info card mb-4">
      <div class="card-body">
        <h2 class="card-title">Price Updates</h2>
        <div class="price-update-details">
          <div class="update-info">
            <span class="label">Last Update:</span>
            <span class="value">{{ formatDate(lastUpdate) }}</span>
          </div>
          <div class="update-info">
            <span class="label">Next Update:</span>
            <span class="value">{{ formatDate(nextUpdate) }}</span>
          </div>
        </div>
        <div class="update-actions">
          <button @click="refreshPrices" class="btn btn-primary" :disabled="isUpdating">
            {{ isUpdating ? 'Updating...' : 'Refresh Prices Now' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="dashboard-stats row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Portfolio Value</h2>
            <p class="stat-value">{{ portfolioValue }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Total Cost</h2>
            <p class="stat-value">{{ totalCost }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Unrealized P/L</h2>
            <p class="stat-value" :class="parseFloat(unrealizedPL) >= 0 ? 'positive' : 'negative'">
              {{ unrealizedPL }}
            </p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Realized P/L</h2>
            <p class="stat-value" :class="parseFloat(realizedPL) >= 0 ? 'positive' : 'negative'">
              {{ realizedPL }}
            </p>
          </div>
        </div>
      </div>
      
      <!-- NEW FINANCIAL STATS -->
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Total Revenue</h2>
            <p class="stat-value text-success">{{ totalRevenue }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Total Costs</h2>
            <p class="stat-value text-danger">{{ totalCosts }}</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="card h-100 border">
          <div class="card-body">
            <h2 class="card-title">Net Profit/Loss</h2>
            <p class="stat-value" :class="parseFloat(netProfitValue) >= 0 ? 'text-success' : 'text-danger'">
              {{ netProfitValue }}
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Detailed breakdown section -->
    <div class="row mt-4">
      <div class="col-12">
        <div class="card border">
          <div class="card-body">
            <h2 class="card-title">Financial Breakdown</h2>
            <div class="row">
              <div class="col-md-3">
                <h3>Sales Revenue</h3>
                <p>{{ salesRevenue }}</p>
              </div>
              <div class="col-md-3">
                <h3>Purchase Costs</h3>
                <p>{{ purchaseCosts }}</p>
              </div>
              <div class="col-md-3">
                <h3>Fees & Commission</h3>
                <p class="text-danger">{{ totalFees }}</p>
              </div>
              <div class="col-md-3">
                <h3>Shipping Costs</h3>
                <p class="text-danger">{{ shippingCosts }}</p>
              </div>
            </div>
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
import { usePriceUpdates } from '../../composables/usePriceUpdates';

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
    alert('Prices refreshed successfully');
  } catch (error) {
    console.error('Error refreshing prices:', error);
    alert('Failed to refresh prices: ' + (error as Error).message);
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

.price-update-info {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.price-update-info .card-title {
  margin-top: 0;
  margin-bottom: var(--space-md);
}

.price-update-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
}

.update-info {
  display: flex;
  flex-direction: column;
}

.update-info .label {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-xs);
}

.update-info .value {
  font-size: var(--font-size-lg);
}

.update-actions {
  display: flex;
  justify-content: flex-start;
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

/* Responsive adjustments */
@media (max-width: 768px) {
  .price-update-details {
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .update-actions {
    justify-content: center;
  }
}
</style>