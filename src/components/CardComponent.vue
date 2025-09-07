<template>
  <div class="card h-100 card-item" @click="openModal">
    <div class="card-image-container position-relative overflow-hidden rounded" style="padding-bottom: 140%;">
      <img
          :src="card.imageUrl || 'https://placehold.co/200x280?text=Card+Image'"
          :alt="card.name"
          class="card-img-top position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
          @error="handleImageError"
      />
    </div>
    <div class="card-body">
      <h3 class="card-title fs-6 fw-medium mb-1">{{ card.name }}</h3>
      <p class="card-text small text-muted mb-2">{{ card.set }} #{{ card.number }}</p>
      <div v-if="displayPrice" class="d-flex justify-content-between small">
        <span class="text-muted">Current:</span>
        <span class="text-success fw-medium">{{ displayPrice.format('de-DE') }}</span>
      </div>
      <div v-else-if="loadingPrice || cardsStore.loadingPrices" class="small text-muted fst-italic">
        Loading...
      </div>
    </div>
  </div>
  <!-- Modal Dialog using Reka UI -->
  <DialogRoot v-model:open="showModal">
    <DialogPortal>
      <DialogOverlay class="modal-backdrop fade show"/>
      <DialogContent class="modal d-block" @pointer-down-outside="closeModal" @escape-key-down="closeModal">
        <div class="modal-dialog modal-dialog-centered modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <DialogTitle class="modal-title h2">{{ card.name }}</DialogTitle>
              <DialogClose as-child>
                <button class="btn-close" @click="closeModal"></button>
              </DialogClose>
            </div>

            <div class="modal-body">
              <div class="card-details-section d-flex flex-wrap gap-4 mb-4">
                <div class="card-image-large flex-shrink-0" style="flex: 0 0 300px;">
                  <img
                      :src="card.imageUrl || 'https://placehold.co/300x420?text=Card+Image'"
                      :alt="card.name"
                      @error="handleImageError"
                      class="img-fluid rounded"
                  />
                </div>

                <div class="card-metadata flex-grow-1 min-w-250">
                  <div class="metadata-item d-flex justify-content-between py-2 border-bottom border-light">
                    <span class="text-muted fw-medium">Set:</span>
                    <span class="fw-medium">{{ card.set }} ({{ card.setCode }})</span>
                  </div>
                  <div class="metadata-item d-flex justify-content-between py-2 border-bottom border-light">
                    <span class="text-muted fw-medium">Collector Number:</span>
                    <span class="fw-medium">#{{ card.number }}</span>
                  </div>
                  <div class="metadata-item d-flex justify-content-between py-2 border-bottom border-light">
                    <span class="text-muted fw-medium">Language:</span>
                    <span class="fw-medium">{{ card.lang }}</span>
                  </div>
                  <div class="metadata-item d-flex justify-content-between py-2">
                    <span class="text-muted fw-medium">Finish:</span>
                    <span class="fw-medium">{{ card.finish }}</span>
                  </div>
                </div>
              </div>

              <div class="price-section mb-4">
                <h3 class="fs-5 mb-2">Current Price</h3>
                <div v-if="currentPrice" class="current-price h2 text-success fw-bold">
                  {{ currentPrice.format('de-DE') }}
                </div>
                <div v-else-if="loadingPrice" class="price-loading small text-muted fst-italic">
                  Loading price...
                </div>
                <div v-else class="price-unavailable small text-muted fst-italic">
                  Price unavailable
                </div>
              </div>

              <div v-if="lots && lots.length > 0" class="ownership-section mb-4">
                <h3 class="fs-5 mb-2">Your Collection</h3>
                <div class="lots-summary d-flex gap-4 p-3 bg-light rounded mb-3">
                  <div class="summary-item">
                    <span class="label small text-muted">Total Lots:</span>
                    <span class="value h5">{{ lots.length }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label small text-muted">Total Cards:</span>
                    <span class="value h5">{{ totalOwnedQuantity }}</span>
                  </div>
                </div>

                <div class="lots-list">
                  <div
                      v-for="lot in lots"
                      :key="lot.id"
                      class="lot-item border rounded p-3 mb-2"
                  >
                    <div class="lot-details row">
                      <div class="lot-quantity col-md-3">
                        <span class="label small text-muted">Quantity:</span>
                        <span class="value fw-medium">{{ lot.quantity }}</span>
                      </div>
                      <div class="lot-cost col-md-3">
                        <span class="label small text-muted">Unit Cost:</span>
                        <span class="value fw-medium">{{ formatMoney(lot.unitCost, lot.currency || 'EUR') }}</span>
                      </div>
                      <div class="lot-date col-md-3">
                        <span class="label small text-muted">Purchased:</span>
                        <span class="value fw-medium">{{ formatDate(lot.purchasedAt) }}</span>
                      </div>
                      <div v-if="lot.disposedQuantity" class="lot-disposed col-md-3">
                        <span class="label small text-muted">Disposed:</span>
                        <span class="value fw-medium">{{ lot.disposedQuantity }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="transactions && transactions.length > 0" class="transactions-section">
                <h3 class="fs-5 mb-2">Transaction History</h3>
                <div class="transactions-list">
                  <div
                      v-for="transaction in transactions"
                      :key="transaction.id"
                      class="transaction-item border rounded p-3 mb-2"
                      :class="transaction.kind.toLowerCase()"
                  >
                    <div class="transaction-details row">
                      <div class="transaction-type col-md-3 fw-bold">{{ transaction.kind }}</div>
                      <div class="transaction-date col-md-3 text-muted">{{ formatDate(transaction.happenedAt) }}</div>
                      <div class="transaction-quantity col-md-3 fw-medium">Qty: {{ transaction.quantity }}</div>
                      <div class="transaction-price col-md-3 fw-medium">
                        {{ formatMoney(transaction.unitPrice, transaction.currency) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {ref, computed} from 'vue';
import db from '../data/db';
import {Money} from '../core/Money';
import { useCardsStore } from '../stores/cards';
import { 
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose
} from 'reka-ui';

// Enable attribute inheritance
defineOptions({
  inheritAttrs: true
});

// Props
const props = defineProps<{
  card: any;
}>();

// Use the cards store
const cardsStore = useCardsStore();

// Reactive state
const showModal = ref(false);
const currentPrice = ref<Money | null>(null);
const loadingPrice = ref(false);
const lots = ref<any[]>([]);
const transactions = ref<any[]>([]);

// Computed
const displayPrice = computed(() => {
  // First try to get price from the store
  const storePrice = cardsStore.getCardPrice(props.card.id);
  if (storePrice) {
    return storePrice;
  }
  // Fallback to the price loaded in the modal
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
</script>

<style scoped>
/* We're using Bootstrap classes now, so most of these custom styles are no longer needed */
/* Keeping only the essential custom styles that aren't covered by Bootstrap */

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

.price-loading {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Card Details Section */
.card-details-section {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.card-image-large {
  flex: 0 0 300px;
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
}
</style>