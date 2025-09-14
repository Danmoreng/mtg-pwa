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
      <DialogOverlay class="modal-backdrop fade show" @click="closeModal"/>
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
                  <div v-if="pricePoints.length > 0" class="mb-3">
                    <h3 class="h6 mb-2">Price History</h3>
                    <PriceHistoryChart :price-points="pricePoints" :transactions="transactions"/>
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
import {computed, onMounted, ref} from 'vue';
import db from '../data/db';
import {Money} from '../core/Money';
import {DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle} from 'reka-ui';
import PriceHistoryChart from './PriceHistoryChart.vue';

const ID_MAP_SETTING_KEY = 'mtgjson.idMap.v1';
import {settingRepository} from '../data/repos';

async function resolveMtgjsonUuidForCard(card: any): Promise<string | null> {
  try {
    const idMap = await settingRepository.get(ID_MAP_SETTING_KEY);
    if (!idMap) return null;
    const uuid = idMap[card.id] || (card.oracleId ? idMap[card.oracleId] : null);
    return uuid ? String(uuid).toLowerCase() : null;
  } catch {
    return null;
  }
}

onMounted(() => {
  setTimeout(async () => {
    await loadCardDetails();
  }, 0);
})

const currentPriceNonfoil = ref<Money | null>(null);
const currentPriceFoil = ref<Money | null>(null);

// same preference as the chart: MTGJSON > PriceGuide > Scryfall
const providerRank: Record<string, number> = {
  'mtgjson.cardmarket': 3,
  'cardmarket.priceguide': 2,
  'scryfall': 1,
};

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
const currentPrice = ref<Money | null>(null);
const loadingPrice = ref(false);
const lots = ref<any[]>([]);
const transactions = ref<any[]>([]);
const pricePoints = ref<any[]>([]);
const isFlipped = ref(false);

const showLots = ref(false);

const transactionsSorted = computed(() => {
  if (!transactions.value) return [];
  return [...transactions.value].sort(
      (a: any, b: any) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime()
  );
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
  loadingPrice.value = true;
  try {
    // ---- resolve ID(s) and read points ----
    const uuid = await resolveMtgjsonUuidForCard(props.card);
    const idsToQuery = uuid ? [props.card.id, uuid] : [props.card.id];

    // 1) Pull all price points for scryfall id (+ uuid if available)
    const rows = await db.price_points.where('cardId').anyOf(idsToQuery).toArray();

    // 2) Normalize missing .date using .asOf and keep only rows with a date
    const toISO = (d: any) => {
      try {
        return new Date(d).toISOString().slice(0, 10);
      } catch {
        return undefined;
      }
    };

    // normalize date, keep only points that have a date
    const canonical = rows
        .map(pp => ({...pp, date: pp.date ?? (pp.asOf ? toISO(pp.asOf) : undefined)}));

    // sort for chart (optional)
    canonical.sort((a, b) => (a.date as string).localeCompare(b.date as string));
    pricePoints.value = canonical;

    // ---- pick latest per finish, merging providers by preference & latest asOf ----
    function pickLatestForFinish(finish: 'nonfoil' | 'foil'): Money | null {
      // choose best value per date
      const byDate: Record<string, { priceCent: number; currency: string; rank: number; asOfTs: number }> = {};
      for (const p of canonical) {
        if ((p.finish ?? 'nonfoil') !== finish) continue;
        const date = p.date as string;
        const rank = providerRank[p.provider ?? ''] ?? 0;
        const asOfTs = p.asOf ? new Date(p.asOf as any).getTime() : 0;

        const prev = byDate[date];
        if (!prev || rank > prev.rank || (rank === prev.rank && asOfTs > prev.asOfTs)) {
          byDate[date] = {priceCent: p.priceCent, currency: p.currency ?? 'EUR', rank, asOfTs};
        }
      }
      const dates = Object.keys(byDate);
      if (!dates.length) return null;
      const latestDate = dates.sort((a, b) => a.localeCompare(b)).at(-1)!;
      const best = byDate[latestDate];
      return new Money(best.priceCent, best.currency);
    }

    currentPriceNonfoil.value = pickLatestForFinish('nonfoil');
    currentPriceFoil.value = pickLatestForFinish('foil');

    // keep single currentPrice for the small card tile:
    currentPrice.value =
        (props.card.finish === 'foil' ? currentPriceFoil.value : currentPriceNonfoil.value) ||
        currentPriceFoil.value || currentPriceNonfoil.value || null;

    // ---- lots & transactions (as before) ----
    lots.value = await db.card_lots.where('cardId').equals(props.card.id).toArray();
    transactions.value = await db.transactions.where('cardId').equals(props.card.id).toArray();
  } catch (error) {
    console.error('Error loading card details:', error);
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