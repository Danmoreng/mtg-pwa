<template>
  <div class="home">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <h1 class="mb-1">MTG Collection Tracker</h1>
        <p class="text-muted mb-0">Canonical inventory, cost basis and profit/loss</p>
      </div>
      <router-link v-if="summary?.openIssueCount" to="/inventory?tab=issues" class="btn btn-warning">
        {{ summary.openIssueCount }} issue{{ summary.openIssueCount === 1 ? '' : 's' }} need attention
      </router-link>
    </div>

    <div v-if="loading" class="text-center py-5">Loading accounting summary…</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
    <template v-else-if="summary">
      <div class="row g-3 mb-4">
        <div v-for="stat in headlineStats" :key="stat.label" class="col-xl-3 col-md-6">
          <div class="card h-100"><div class="card-body">
            <div class="small text-muted">{{ stat.label }}</div>
            <div class="stat-value" :class="stat.className">{{ stat.value }}</div>
            <div v-if="stat.detail" class="small text-muted mt-1">{{ stat.detail }}</div>
          </div></div>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-lg-8">
          <div class="card h-100"><div class="card-body">
            <h2 class="h5">Portfolio Value Over Time</h2>
            <PortfolioValueChart />
          </div></div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100"><div class="card-body">
            <h2 class="h5">Inventory health</h2>
            <dl class="row small mb-3">
              <dt class="col-7 text-muted">Unique printings</dt><dd class="col-5 text-end">{{ summary.cardCount }}</dd>
              <dt class="col-7 text-muted">Physical cards</dt><dd class="col-5 text-end">{{ summary.quantity }}</dd>
              <dt class="col-7 text-muted">Reserved in decks</dt><dd class="col-5 text-end">{{ summary.deckReservedQuantity }}</dd>
              <dt class="col-7 text-muted">Available</dt><dd class="col-5 text-end">{{ summary.availableQuantity }}</dd>
              <dt class="col-7 text-muted">Unpriced lots</dt><dd class="col-5 text-end">{{ summary.unpricedLotCount }}</dd>
              <dt class="col-7 text-muted">Unknown-cost lots</dt><dd class="col-5 text-end">{{ summary.unknownCostLotCount }}</dd>
            </dl>
            <router-link to="/inventory" class="btn btn-outline-primary w-100">Manage inventory</router-link>
          </div></div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-lg-8">
          <div class="card"><div class="card-body">
            <h2 class="h5">Financial breakdown</h2>
            <div class="row g-3 small">
              <div class="col-md-4"><span class="text-muted d-block">Gross sales</span><strong>{{ euros(summary.grossSalesCent) }}</strong></div>
              <div class="col-md-4"><span class="text-muted d-block">Net sales</span><strong>{{ euros(summary.netSalesCent) }}</strong></div>
              <div class="col-md-4"><span class="text-muted d-block">Sales fees</span><strong>{{ euros(summary.salesFeesCent) }}</strong></div>
              <div class="col-md-4"><span class="text-muted d-block">Purchase fees</span><strong>{{ euros(summary.purchaseFeesCent) }}</strong></div>
              <div class="col-md-4"><span class="text-muted d-block">Purchase shipping</span><strong>{{ euros(summary.purchaseShippingCent) }}</strong></div>
              <div class="col-md-4"><span class="text-muted d-block">Shipping result</span><strong>{{ euros(summary.shippingIncomeCent - summary.shippingExpenseCent) }}</strong></div>
            </div>
          </div></div>
        </div>
        <div class="col-lg-4">
          <div class="card"><div class="card-body">
            <h2 class="h5">Price updates</h2>
            <div class="small text-muted mb-3">Last: {{ formatDate(lastUpdate) }}<br>Next: {{ formatDate(nextUpdate) }}</div>
            <button @click="refreshPrices" class="btn btn-glass-primary" :disabled="isUpdating">
              {{ isUpdating ? 'Updating…' : 'Refresh now' }}
            </button>
          </div></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PortfolioValueChart from '../../components/PortfolioValueChart.vue';
import { usePriceUpdates } from '../../composables/usePriceUpdates';
import {
  AccountingQueryService,
  type AmountSummary,
  type PortfolioSummary,
} from '../accounting/AccountingQueryService';

const queries = new AccountingQueryService();
const summary = ref<PortfolioSummary>();
const loading = ref(true);
const error = ref('');
const { formatDate, checkAndScheduleUpdate, forceUpdatePrices, lastUpdate, nextUpdate, isUpdating } = usePriceUpdates();

const euros = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const amount = (value: AmountSummary) => {
  if (value.status === 'unknown') {
    return value.knownCents ? `${euros(value.knownCents)} + unknown` : 'Unknown';
  }
  return `${euros(value.cents ?? value.knownCents)}${value.status === 'estimated' ? ' (estimated)' : ''}`;
};
const amountClass = (value: AmountSummary) => {
  const cents = value.cents ?? value.knownCents;
  return cents > 0 ? 'text-success' : cents < 0 ? 'text-danger' : '';
};

const headlineStats = computed(() => summary.value ? [
  { label: 'Market value', value: amount(summary.value.marketValue), detail: `${summary.value.quantity} cards`, className: '' },
  { label: 'Open cost basis', value: amount(summary.value.openCostBasis), detail: 'Remaining inventory', className: '' },
  { label: 'Unrealized P/L', value: amount(summary.value.unrealizedPnL), detail: 'Market value minus open costs', className: amountClass(summary.value.unrealizedPnL) },
  { label: 'Realized P/L', value: amount(summary.value.realizedPnL), detail: 'Net proceeds minus sold costs', className: amountClass(summary.value.realizedPnL) },
] : []);

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    summary.value = await queries.getPortfolioSummary();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not load accounting data.';
  } finally {
    loading.value = false;
  }
}

async function refreshPrices() {
  await forceUpdatePrices();
  await loadData();
}

onMounted(async () => {
  await loadData();
  setTimeout(() => void checkAndScheduleUpdate(), 0);
});
</script>

<style scoped>
.home { padding: var(--space-lg); }
.stat-value { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); }
</style>
