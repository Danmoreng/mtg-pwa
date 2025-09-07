<template>
  <div class="card-component" @click="openModal">
    <div class="card-image-container">
      <img
          :src="card.imageUrl || 'https://placehold.co/200x280?text=Card+Image'"
          :alt="card.name"
          class="card-image"
          @error="handleImageError"
      />
    </div>
    <div class="card-info">
      <h3 class="card-name">{{ card.name }}</h3>
      <p class="card-set">{{ card.set }} #{{ card.number }}</p>
      <div v-if="displayPrice" class="card-price">
        <span class="price-label">Current:</span>
        <span class="price-value">{{ displayPrice.format('de-DE') }}</span>
      </div>
      <div v-else-if="loadingPrice" class="price-loading">
        Loading...
      </div>
    </div>
  </div>
  <!-- Modal Dialog -->
  <div v-if="showModal" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ card.name }}</h2>
        <button class="close-button" @click="closeModal">×</button>
      </div>

      <div class="modal-body">
        <div class="card-details-section">
          <div class="card-image-large">
            <img
                :src="card.imageUrl || 'https://placehold.co/300x420?text=Card+Image'"
                :alt="card.name"
                @error="handleImageError"
            />
          </div>

          <div class="card-metadata">
            <div class="metadata-item">
              <span class="label">Set:</span>
              <span class="value">{{ card.set }} ({{ card.setCode }})</span>
            </div>
            <div class="metadata-item">
              <span class="label">Collector Number:</span>
              <span class="value">#{{ card.number }}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Language:</span>
              <span class="value">{{ card.lang }}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Finish:</span>
              <span class="value">{{ card.finish }}</span>
            </div>
          </div>
        </div>

        <div class="price-section">
          <h3>Current Price</h3>
          <div v-if="currentPrice" class="current-price">
            {{ currentPrice.format('de-DE') }}
          </div>
          <div v-else-if="loadingPrice" class="price-loading">
            Loading price...
          </div>
          <div v-else class="price-unavailable">
            Price unavailable
          </div>
        </div>

        <div v-if="lots && lots.length > 0" class="ownership-section">
          <h3>Your Collection</h3>
          <div class="lots-summary">
            <div class="summary-item">
              <span class="label">Total Lots:</span>
              <span class="value">{{ lots.length }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Total Cards:</span>
              <span class="value">{{ totalOwnedQuantity }}</span>
            </div>
          </div>

          <div class="lots-list">
            <div
                v-for="lot in lots"
                :key="lot.id"
                class="lot-item"
            >
              <div class="lot-details">
                <div class="lot-quantity">
                  <span class="label">Quantity:</span>
                  <span class="value">{{ lot.quantity }}</span>
                </div>
                <div class="lot-cost">
                  <span class="label">Unit Cost:</span>
                  <span class="value">{{ formatMoney(lot.unitCost, lot.currency || 'EUR') }}</span>
                </div>
                <div class="lot-date">
                  <span class="label">Purchased:</span>
                  <span class="value">{{ formatDate(lot.purchasedAt) }}</span>
                </div>
                <div v-if="lot.disposedQuantity" class="lot-disposed">
                  <span class="label">Disposed:</span>
                  <span class="value">{{ lot.disposedQuantity }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="transactions && transactions.length > 0" class="transactions-section">
          <h3>Transaction History</h3>
          <div class="transactions-list">
            <div
                v-for="transaction in transactions"
                :key="transaction.id"
                class="transaction-item"
                :class="transaction.kind.toLowerCase()"
            >
              <div class="transaction-details">
                <div class="transaction-type">{{ transaction.kind }}</div>
                <div class="transaction-date">{{ formatDate(transaction.happenedAt) }}</div>
                <div class="transaction-quantity">Qty: {{ transaction.quantity }}</div>
                <div class="transaction-price">
                  {{ formatMoney(transaction.unitPrice, transaction.currency) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import db from '../data/db';
import {Money} from '../core/Money';

// Enable attribute inheritance
defineOptions({
  inheritAttrs: true
});

// Props
const props = defineProps<{
  card: any;
  price?: any; // Optional price prop
}>();

// Reactive state
const showModal = ref(false);
const currentPrice = ref<Money | null>(null);
const loadingPrice = ref(false);
const lots = ref<any[]>([]);
const transactions = ref<any[]>([]);

// Computed
const displayPrice = computed(() => {
  // If price prop is provided, use it
  if (props.price) {
    return props.price;
  }
  // Otherwise, use the price loaded in the modal
  return currentPrice.value;
});

// Computed
const totalOwnedQuantity = computed(() => {
  if (!lots.value || lots.value.length === 0) return 0;

  return lots.value.reduce((total, lot) => {
    // Only count lots that haven't been fully disposed
    if (!lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity)) {
      const remainingQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
      return total + remainingQuantity;
    }
    return total;
  }, 0);
});

// Methods
const openModal = () => {
  showModal.value = true;
  loadCardDetails();
};

const closeModal = () => {
  showModal.value = false;
};

const handleImageError = (event: any) => {
  event.target.src = 'https://placehold.co/200x280?text=Card+Image';
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString();
};

const formatMoney = (cents: number, currency: string) => {
  const money = new Money(cents, currency);
  return money.format('de-DE');
};

const loadCardDetails = async () => {
  try {
    // Load current price
    loadCurrentPrice();

    // Load lots for this card
    const cardLots = await db.card_lots.where('cardId').equals(props.card.id).toArray();
    lots.value = cardLots;

    // Load transactions for this card
    const cardTransactions = await db.transactions.where('cardId').equals(props.card.id).toArray();
    transactions.value = cardTransactions;
  } catch (error) {
    console.error('Error loading card details:', error);
  }
};

const loadCurrentPrice = async () => {
  loadingPrice.value = true;
  try {
    // Fetch price points from database
    const pricePoints = await db.price_points.where('cardId').equals(props.card.id).toArray();

    // Find the most recent price point
    if (pricePoints.length > 0) {
      // Sort by date descending to get the most recent price
      pricePoints.sort((a: any, b: any) => b.asOf.getTime() - a.asOf.getTime());
      const latestPricePoint = pricePoints[0];

      currentPrice.value = new Money(latestPricePoint.price, latestPricePoint.currency);
    }
  } catch (error) {
    console.error('Error loading current price:', error);
  } finally {
    loadingPrice.value = false;
  }
};

// Close modal when pressing Escape key
onMounted(() => {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  };

  document.addEventListener('keydown', handleEscape);

  // Clean up event listener
  return () => {
    document.removeEventListener('keydown', handleEscape);
  };
});
</script>

<style scoped>
.card-component {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.card-component:hover {
  transform: translateY(-2px);
}

.card-image-container {
  position: relative;
  width: 100%;
  padding-bottom: 140%; /* Aspect ratio for card images (roughly 2.5:3.5) */
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-background);
}

.card-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-md);
}

.card-info {
  padding: var(--space-sm);
}

.card-name {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
}

.card-set {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.card-price {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
}

.price-label {
  color: var(--color-text-secondary);
}

.price-value {
  font-weight: var(--font-weight-medium);
  color: var(--color-success);
}

.price-loading {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-md);
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-2xl);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-lg);
}

.card-details-section {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.card-image-large {
  flex: 0 0 300px;
}

.card-image-large img {
  width: 100%;
  border-radius: var(--radius-md);
}

.card-metadata {
  flex: 1;
  min-width: 250px;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.metadata-item:last-child {
  border-bottom: none;
}

.label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.value {
  font-weight: var(--font-weight-medium);
}

.price-section {
  margin-bottom: var(--space-xl);
}

.price-section h3 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-lg);
}

.current-price {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-success);
}

.price-unavailable {
  color: var(--color-text-secondary);
  font-style: italic;
}

.ownership-section {
  margin-bottom: var(--space-xl);
}

.ownership-section h3 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-lg);
}

.lots-summary {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background: var(--color-background);
  border-radius: var(--radius-md);
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-item .label {
  font-size: var(--font-size-sm);
}

.summary-item .value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.lots-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.lot-item {
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.lot-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-sm);
}

.lot-quantity,
.lot-cost,
.lot-date,
.lot-disposed {
  display: flex;
  flex-direction: column;
}

.transactions-section h3 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-lg);
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.transaction-item {
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.transaction-item.buy {
  border-left: 4px solid var(--color-success);
}

.transaction-item.sell {
  border-left: 4px solid var(--color-error);
}

.transaction-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-sm);
}

.transaction-type {
  font-weight: var(--font-weight-bold);
}

.transaction-date {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.transaction-quantity,
.transaction-price {
  font-weight: var(--font-weight-medium);
}

@media (max-width: 768px) {
  .card-details-section {
    flex-direction: column;
  }

  .card-image-large {
    flex: 0 0 auto;
  }

  .modal-content {
    margin: var(--space-sm);
  }

  .modal-body {
    padding: var(--space-md);
  }
}
</style>