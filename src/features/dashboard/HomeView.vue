<template>
  <div class="home">
    <h1>MTG Collection Value Tracker</h1>
    <div class="dashboard-stats">
      <div class="stat-card">
        <h2>Portfolio Value</h2>
        <p class="stat-value">{{ portfolioValue }}</p>
      </div>
      <div class="stat-card">
        <h2>Total Cost</h2>
        <p class="stat-value">{{ totalCost }}</p>
      </div>
      <div class="stat-card">
        <h2>Unrealized P/L</h2>
        <p class="stat-value" :class="parseFloat(unrealizedPL) >= 0 ? 'positive' : 'negative'">
          {{ unrealizedPL }}
        </p>
      </div>
      <div class="stat-card">
        <h2>Realized P/L</h2>
        <p class="stat-value" :class="parseFloat(realizedPL) >= 0 ? 'positive' : 'negative'">
          {{ realizedPL }}
        </p>
      </div>
    </div>
    <div class="actions">
      <button @click="refreshPrices">Refresh Prices</button>
      <button @click="takeSnapshot">Take Snapshot</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCardsStore } from '../../stores/cards';
import { useHoldingsStore } from '../../stores/holdings';
import { useTransactionsStore } from '../../stores/transactions';
import { ValuationEngine } from '../analytics/ValuationEngine.ts';
import { Money } from '../../core/Money';
import { PriceUpdateService } from '../pricing/PriceUpdateService';

// Get the stores
const cardsStore = useCardsStore();
const holdingsStore = useHoldingsStore();
const transactionsStore = useTransactionsStore();

// Reactive state
const portfolioValue = ref('€0.00');
const totalCost = ref('€0.00');
const unrealizedPL = ref('€0.00');
const realizedPL = ref('€0.00');

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
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
};

// Refresh prices
const refreshPrices = async () => {
  try {
    await PriceUpdateService.syncPrices();
    // Reload data to reflect updated prices
    await loadData();
    alert('Prices refreshed successfully');
  } catch (error) {
    console.error('Error refreshing prices:', error);
    alert('Failed to refresh prices: ' + (error as Error).message);
  }
};

// Take snapshot
const takeSnapshot = async () => {
  // In a real implementation, this would create a valuation snapshot
  alert('Snapshot taken');
};

// Load data when component mounts
onMounted(async () => {
  // Check if we need to update prices
  const needsUpdate = await PriceUpdateService.needsPriceUpdate();
  if (needsUpdate) {
    try {
      await PriceUpdateService.syncPrices();
    } catch (error) {
      console.error('Error updating prices on app start:', error);
    }
  }
  
  // Load the dashboard data
  await loadData();
});
</script>

<style scoped>
.home {
  padding: var(--space-lg);
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin: var(--space-xl) 0;
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
}

.stat-card h2 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
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

.actions {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-xl);
}

button {
  padding: var(--space-sm) var(--space-lg);
}

.import-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-top: var(--space-xl);
  box-shadow: var(--shadow-md);
}

.import-section h2 {
  margin-top: 0;
}

.import-buttons {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.import-button {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: background-color 0.2s;
}

.import-button:hover {
  background: var(--color-primary-dark);
}
</style>