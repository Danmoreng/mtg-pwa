<template>
  <div class="card h-100 card-item" @click="!props.disableModal && openModal()">
    <div class="card-image-container position-relative overflow-hidden rounded" style="padding-bottom: 140%;">
      <div v-if="card.imageUrl" class="card-img-top position-absolute top-0 start-0 w-100 h-100"
           :style="{ backgroundImage: `url(${card.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
      <div v-else
           class="placeholder-image card-img-top position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
        <span class="text-muted">Missing Image</span>
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-title fs-6 fw-medium mb-1">{{ card.name }}</h3>
      <p class="card-text small text-muted mb-2">{{ card.set }} #{{ card.number }}</p>
      <span v-if="ownedQuantity" class="badge bg-secondary-subtle text-secondary-emphasis mb-2">
        Owned: {{ ownedQuantity }}<template v-if="reservedQuantity"> · {{ reservedQuantity }} in decks</template>
      </span>
      <div class="ms-auto">
                    <span v-if="currentPriceNonfoil" class="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                      Regular: {{ currentPriceNonfoil.format('de-DE') }}
                    </span>
        <span v-if="currentPriceFoil" class="badge rounded-pill bg-success-subtle text-success-emphasis">
                      Foil: {{ currentPriceFoil.format('de-DE') }}
                    </span>
        <span v-if="!currentPriceNonfoil && !currentPriceFoil && loadingPrice" class="small text-muted fst-italic">
                      Loading…
                    </span>
        <span v-else-if="!currentPriceNonfoil && !currentPriceFoil" class="small text-muted fst-italic">
                      Price unavailable
                    </span>
      </div>
    </div>
  </div>
  <!-- Modal Dialog using Reka UI -->
  <DialogRoot v-model:open="showModal">
    <DialogPortal>
      <DialogOverlay class="modal-backdrop fade show" />
      <DialogContent
          class="modal d-block compact-modal"
          @click="handleBackdropClick"
          @escape-key-down="closeModal"
      >
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content glass">
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
                        <div v-if="card.imageUrl" class="w-100 h-100 rounded-4"
                             :style="{ backgroundImage: `url(${card.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                        <div v-else class="placeholder-image w-100 h-100 rounded-4 position-relative">
                          <div class="position-absolute top-50 start-50 translate-middle">
                            <span class="text-muted">Missing Image</span>
                          </div>
                        </div>
                      </div>
                      <div class="card-back">
                        <div v-if="card.imageUrlBack" class="w-100 h-100 rounded-4"
                             :style="{ backgroundImage: `url(${card.imageUrlBack})`, backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                      </div>
                    </div>
                    <button
                        v-if="card.layout === 'transform' || card.layout === 'modal_dfc' || card.layout === 'reversible_card' || card.imageUrl && card.imageUrlBack"
                        @click="isFlipped = !isFlipped" class="btn btn-sm btn-dark flip-button">
                      Flip
                    </button>
                  </div>
                  <img :src="card.imageUrlBack" style="display: none;"/>

                  <dl class="row row-cols-2 g-2 small mt-3 mb-0 meta-grid">
                    <dt class="col text-muted">Set</dt>
                    <dd class="col text-end fw-semibold">{{ card.set }} ({{ card.setCode }})</dd>

                    <dt class="col text-muted">Number</dt>
                    <dd class="col text-end fw-semibold">#{{ card.number }}</dd>

                    <dt class="col text-muted">Language</dt>
                    <dd class="col text-end fw-semibold">{{ card.lang }}</dd>

                    <dt class="col text-muted">Finish</dt>
                    <dd class="col text-end fw-semibold">{{ card.finish }}</dd>

                    <!-- External Links -->
                    <dt class="col text-muted">Links</dt>
                    <dd class="col text-end">
                      <a 
                        :href="`https://scryfall.com/card/${card.setCode}/${card.number}`" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="link-primary text-decoration-none me-2"
                      >
                        Scryfall
                      </a>
                      <a
                        href="#"
                        @click.prevent="openCardmarketLink"
                        class="link-warning text-decoration-none"
                      >
                        Cardmarket
                      </a>
                    </dd>
                  </dl>
                </div>

                <!-- Right: price + concise ownership/tx history -->
                <div class="col-lg-7">
                  <!-- Price -->
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="h6 mb-0">Current Price</h3>
                    <div class="ms-auto d-flex gap-2 align-items-center">
                    <span v-if="currentPriceNonfoil" class="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                      Regular: {{ currentPriceNonfoil.format('de-DE') }}
                    </span>
                    <span v-if="currentPriceFoil" class="badge rounded-pill bg-success-subtle text-success-emphasis">
                      Foil: {{ currentPriceFoil.format('de-DE') }}
                    </span>
                      <span v-if="!currentPriceNonfoil && !currentPriceFoil && loadingPrice" class="small text-muted fst-italic">
                      Loading…
                    </span>
                      <span v-else-if="!currentPriceNonfoil && !currentPriceFoil" class="small text-muted fst-italic">
                      Price unavailable
                    </span>
                    </div>
                  </div>

                  <!-- Historic Price Chart -->
                  <div v-if="pricePoints && pricePoints.length > 0" class="mb-3">
                    <h3 class="h6 mb-2">Price History</h3>
                    <PriceHistoryChart :price-points="pricePoints" :transactions="[]"/>
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
                          :key="lot.lot.id"
                          class="border rounded p-2 mb-2"
                      >
                        <div class="row g-2 align-items-center">
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Remaining:</span> <span class="fw-medium">{{ lot.snapshot.remainingQuantity }}</span>
                          </div>
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Unit Cost:</span>
                            <span class="fw-medium">{{ formatAccountingMoney(lot.snapshot.openCostBasis) }}</span>
                          </div>
                          <div class="col-6 col-md-3">
                            <span class="text-muted">Purchased:</span>
                            <span class="fw-medium">{{ formatDate(lot.lot.acquiredAt) }}</span>
                          </div>
                          <div v-if="lot.snapshot.deckReservedQuantity" class="col-6 col-md-3">
                            <span class="text-muted">In decks:</span>
                            <span class="fw-medium">{{ lot.snapshot.deckReservedQuantity }}</span>
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
                          :key="t.line.id"
                          class="tx-item sell d-flex align-items-center gap-2 p-2 mb-2 rounded border"
                      >
    <span
        class="badge me-1 bg-danger-subtle text-danger-emphasis"
    >
      Sale
    </span>

                        <div class="flex-grow-1">
                          <div class="fw-medium">{{ formatDate(t.sale.occurredAt) }}</div>
                          <div class="text-muted">Qty: {{ t.line.quantity }}</div>
                        </div>

                        <div class="fw-semibold">{{ formatMoney(t.line.netLineProceedsCent, 'EUR') }}</div>
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
import {Money} from '../core/Money';
import {DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle} from 'reka-ui';
import PriceHistoryChart from './PriceHistoryChart.vue';
import { useCardsStore } from '../stores';
import { ScryfallProvider } from '../features/pricing/ScryfallProvider';
import { AccountingQueryService, type CardAccountingActivity } from '../features/accounting/AccountingQueryService';
import type { AccountingMoney } from '../features/accounting/AccountingTypes';
import { useHoldingsStore } from '../stores/holdings';

const cardsStore = useCardsStore();
const holdingsStore = useHoldingsStore();
const accountingQueries = new AccountingQueryService();

const currentPriceNonfoil = computed(() => cardsStore.getLatestNonfoil(props.card.id));
const currentPriceFoil    = computed(() => cardsStore.getLatestFoil(props.card.id));

// Enable attribute inheritance
defineOptions({
  inheritAttrs: true
});

// Props
const props = defineProps<{
  card: any;
  disableModal?: boolean;
}>();

// Reactive state
const showModal = ref(false);
const loadingPrice = computed(() => cardsStore.loadingPrices);
const activity = ref<CardAccountingActivity>({ lots: [], sales: [] });
const lots = computed(() => activity.value.lots.filter(row => row.snapshot.remainingQuantity > 0));
const transactions = computed(() => activity.value.sales);
const pricePoints = ref<any[]>([]);
const isFlipped = ref(false);

const showLots = ref(false);
const resolvedCardmarketUrl = ref<string | null>(null);
const resolvingCardmarketUrl = ref(false);

const transactionsSorted = computed(() => {
  if (!transactions.value) return [];
  return [...transactions.value].sort(
      (a, b) => b.sale.occurredAt.getTime() - a.sale.occurredAt.getTime()
  );
});

// Computed
const totalOwnedQuantity = computed(() => {
  if (!lots.value || lots.value.length === 0) return 0;

  return lots.value.reduce((total, lot) => total + lot.snapshot.remainingQuantity, 0);
});
const ownedQuantity = computed(() => holdingsStore.getTotalQuantityByCardId(props.card.id));
const reservedQuantity = computed(() => holdingsStore.getHoldingByCardId(props.card.id)?.deckReservedQuantity ?? 0);

// Methods
const openModal = async () => {
  showModal.value = true;
  await loadCardDetails();
  pricePoints.value = await cardsStore.getPriceHistory(props.card.id);
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

const handleBackdropClick = (event: MouseEvent) => {
  // Close modal only if the click is on the container itself (the backdrop)
  // and not on a child element (the modal content).
  if (event.target === event.currentTarget) {
    closeModal();
  }
};

const loadCardDetails = async () => {
  try{
    activity.value = await accountingQueries.getCardActivity(props.card.id);

    if (props.card.cardmarketId) {
      await resolveCardmarketUrl();
    }
  } catch (error) {
    console.error('Error loading card details:', error);
  }
};

const formatAccountingMoney = (money: AccountingMoney) =>
  money.status === 'unknown' ? 'Unknown' : `${formatMoney(money.cents, 'EUR')} (${money.status})`;

// Helper methods for external links
const formatSetNameForCardmarket = (setName: string) => {
  return String(setName || '')
    .replace(/[:/()]/g, ' ')
    .replace(/[^A-Za-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const formatCardNameForCardmarket = (cardName: string) => {
  return String(cardName || '')
    .replace(/\((V\.\d+)\)/gi, '$1')
    .replace(/[:/]/g, ' ')
    .replace(/[^A-Za-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const getCardmarketProductUrl = (): string | null => {
  if (!props.card.cardmarketId) return null;
  return `https://www.cardmarket.com/en/Magic/Products/Singles?idProduct=${encodeURIComponent(String(props.card.cardmarketId))}&idGame=1&language=1&minCondition=3`;
};

const getLegacyCardmarketUrl = (): string => {
  const productUrl = getCardmarketProductUrl();
  if (productUrl) return productUrl;
  return `https://www.cardmarket.com/en/Magic/Products/Singles/${formatSetNameForCardmarket(props.card.set)}/${formatCardNameForCardmarket(props.card.name)}?language=1&minCondition=3`;
};

const resolveCardmarketUrl = async (): Promise<string> => {
  if (resolvedCardmarketUrl.value) return resolvedCardmarketUrl.value;
  if (!props.card.cardmarketId) {
    try {
      if (props.card.id && !String(props.card.id).startsWith('cm:')) {
        const scryfallCard = await ScryfallProvider.hydrateCard({
          scryfall_id: props.card.id,
          name: props.card.name,
          setCode: props.card.setCode,
          collectorNumber: props.card.number
        });
        const marketUrl = scryfallCard?.purchase_uris?.cardmarket;
        if (typeof marketUrl === 'string' && marketUrl.length > 0) {
          resolvedCardmarketUrl.value = marketUrl;
          return marketUrl;
        }
      }
    } catch (error) {
      console.warn('Unable to resolve Cardmarket URL from Scryfall card data, falling back to slug URL.', error);
    }
    return getLegacyCardmarketUrl();
  }

  if (!resolvingCardmarketUrl.value) {
    resolvingCardmarketUrl.value = true;
    try {
      const scryfallCard = await ScryfallProvider.getByCardmarketId(String(props.card.cardmarketId));
      const marketUrl = scryfallCard?.purchase_uris?.cardmarket;
      if (typeof marketUrl === 'string' && marketUrl.length > 0) {
        resolvedCardmarketUrl.value = marketUrl;
      }
    } catch (error) {
      console.warn('Unable to resolve Cardmarket URL from Scryfall, falling back to slug URL.', error);
    } finally {
      resolvingCardmarketUrl.value = false;
    }
  }

  return resolvedCardmarketUrl.value || getLegacyCardmarketUrl();
};

const openCardmarketLink = async () => {
  const url = await resolveCardmarketUrl();
  window.open(url, '_blank', 'noopener,noreferrer');
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
