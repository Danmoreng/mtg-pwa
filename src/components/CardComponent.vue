<template>
  <div class="card h-100 card-item" @click="openModal">
    <div class="card-image-container position-relative overflow-hidden rounded" style="padding-bottom: 140%;">
      <div v-if="card.imageUrl" class="card-img-top position-absolute top-0 start-0 w-100 h-100" :style="{ backgroundImage: `url(${card.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
      <div v-else class="placeholder-image card-img-top position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
        <span class="text-muted">Missing Image</span>
      </div>
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
      <DialogOverlay class="modal-backdrop fade show" @click="closeModal" />
      <DialogContent
          class="modal d-block compact-modal"
          @pointer-down-outside="closeModal"
          @escape-key-down="closeModal"
      >
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header py-2">
              <DialogTitle class="modal-title h5 mb-0">{{ card.name }}</DialogTitle>
              <DialogClose as-child>
                <button type="button" class="btn-close" aria-label="Close"></button>
              </DialogClose>
            </div>

            <div class="modal-body py-3">
              <div class="row g-3 align-items-start">
                <!-- Left: compact image + metadata -->
                <div class="col-lg-5">
                  <div class="card-flipper position-relative" :class="{ 'is-flipped': isFlipped }">
                    <div class="card-inner" style="padding-bottom: 140%;">
                      <div class="card-front">
                        <div v-if="card.imageUrl" class="w-100 h-100 rounded-4" :style="{ backgroundImage: `url(${card.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                        <div v-else class="placeholder-image w-100 h-100 rounded-4 position-relative">
                          <div class="position-absolute top-50 start-50 translate-middle">
                            <span class="text-muted">Missing Image</span>
                          </div>
                        </div>
                      </div>
                      <div class="card-back">
                        <div v-if="card.imageUrlBack" class="w-100 h-100 rounded-4" :style="{ backgroundImage: `url(${card.imageUrlBack})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                      </div>
                    </div>
                    <button v-if="card.layout === 'transform' || card.layout === 'modal_dfc' || card.layout === 'reversible_card'" @click="isFlipped = !isFlipped" class="btn btn-sm btn-dark flip-button">
                      Flip
                    </button>
                  </div>
                  <img :src="card.imageUrlBack" style="display: none;" />

                  <dl class="row row-cols-2 g-2 small mt-3 mb-0 meta-grid">
                    <dt class="col text-muted">Set</dt>
                    <dd class="col text-end fw-semibold">{{ card.set }} ({{ card.setCode }})</dd>

                    <dt class="col text-muted">Number</dt>
                    <dd class="col text-end fw-semibold">#{{ card.number }}</dd>

                    <dt class="col text-muted">Language</dt>
                    <dd class="col text-end fw-semibold">{{ card.lang }}</dd>

                    <dt class="col text-muted">Finish</dt>
                    <dd class="col text-end fw-semibold">{{ card.finish }}</dd>
                  </dl>
                </div>

                <!-- Right: price + concise ownership/tx history -->
                <div class="col-lg-7">
                  <!-- Price -->
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="h6 mb-0">Current Price</h3>
                    <span v-if="currentPrice" class="h5 mb-0 text-success fw-bold">
                    {{ currentPrice.format('de-DE') }}
                  </span>
                    <span v-else-if="loadingPrice" class="small text-muted fst-italic">Loading…</span>
                    <span v-else class="small text-muted fst-italic">Price unavailable</span>
                  </div>

                  <!-- Ownership (summary first, expandable details) -->
                  <div v-if="lots && lots.length" class="mb-3">
                    <h3 class="h6 mb-2">Your Collection</h3>
                    <div class="d-flex gap-3 small">
                      <div><span class="text-muted">Lots:</span> <strong>{{ lots.length }}</strong></div>
                      <div><span class="text-muted">Cards:</span> <strong>{{ totalOwnedQuantity }}</strong></div>
                    </div>

                    <button
                        v-if="lots.length > 2"
                        class="btn btn-link btn-sm p-0 mt-1"
                        @click="showLots = !showLots"
                    >
                      {{ showLots ? 'Hide details' : 'Show details' }}
                    </button>

                    <div
                        v-show="showLots"
                        class="mt-2 border rounded-3 p-2 small"
                        style="max-height: 30vh; overflow: auto;"
                    >
                      <div
                          v-for="lot in lots"
                          :key="lot.id"
                          class="border rounded p-2 mb-2"
                      >
                        <div class="row g-2 align-items-center">
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Qty:</span> <span class="fw-medium">{{ lot.quantity }}</span>
                          </div>
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Unit Cost:</span>
                            <span class="fw-medium">{{ formatMoney(lot.unitCost, lot.currency || 'EUR') }}</span>
                          </div>
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Purchased:</span>
                            <span class="fw-medium">{{ formatDate(lot.purchasedAt) }}</span>
                          </div>
                          <div v-if="lot.disposedQuantity" class="col-6 col-md-3">
                            <span class="text-muted">Disposed:</span>
                            <span class="fw-medium">{{ lot.disposedQuantity }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Transactions (show latest at-a-glance, expand for all) -->
                  <div v-if="transactions && transactions.length">
                    <h3 class="h6 mb-2">Transaction History</h3>
                    <div class="mt-2 small" style="max-height: 30vh; overflow: auto;">
                      <div
                          v-for="t in transactionsSorted"
                          :key="t.id"
                          class="tx-item d-flex align-items-center gap-2 p-2 mb-2 rounded border"
                          :class="{
      buy: /buy/i.test(t.kind),
      sell: /sell/i.test(t.kind)
    }"
                      >
    <span
        class="badge me-1"
        :class="/buy/i.test(t.kind) ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'"
    >
      {{ t.kind }}
    </span>

                        <div class="flex-grow-1">
                          <div class="fw-medium">{{ formatDate(t.happenedAt) }}</div>
                          <div class="text-muted">Qty: {{ t.quantity }}</div>
                        </div>

                        <div class="fw-semibold">{{ formatMoney(t.unitPrice, t.currency) }}</div>
                      </div>
                    </div>

                  </div>

                </div> <!-- /right -->
              </div> <!-- /row -->
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import db from '../data/db';
import {Money} from '../core/Money';
import {useCardsStore} from '../stores';
import {DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle} from 'reka-ui';

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
const isFlipped = ref(false);

const showLots = ref(false);

const transactionsSorted = computed(() => {
  if (!transactions.value) return [];
  return [...transactions.value].sort(
      (a: any, b: any) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime()
  );
});

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
    await loadCurrentPrice();

    // Load lots for this card
    lots.value = await db.card_lots.where('cardId').equals(props.card.id).toArray();

    // Load transactions for this card
    transactions.value = await db.transactions.where('cardId').equals(props.card.id).toArray();
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
.placeholder-image {
  background-color: #e9ecef; /* A slightly darker grey */
}

.placeholder-image .text-muted {
  color: #6c757d !important; /* A darker, more visible text color */
}

.card-flipper {
  perspective: 1000px;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.card-flipper.is-flipped .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}

.flip-button {
  position: absolute;
  bottom: -15px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>