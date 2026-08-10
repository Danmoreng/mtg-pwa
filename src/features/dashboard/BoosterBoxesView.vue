<template>
  <div class="container-fluid py-3">
    <h1>Booster Box Analysis</h1>
    <p class="text-muted">Values and sold quantities are derived from canonical lots and allocations.</p>
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="list-group">
          <button
            v-for="box in boxes"
            :key="box.id"
            class="list-group-item list-group-item-action"
            :class="{ active: selectedBoxId === box.id }"
            @click="selectBox(box.id)"
          >
            <strong>{{ box.source }}</strong><br>
            <small>{{ new Date(box.happenedAt).toLocaleDateString() }}</small>
          </button>
        </div>
        <div v-if="!boxes.length" class="alert alert-secondary">No imported booster boxes yet.</div>
      </div>
      <div class="col-lg-8">
        <div v-if="loading" class="text-center py-5">Calculating…</div>
        <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-else-if="valuation" class="card"><div class="card-body">
          <h2 class="h5">Box details</h2>
          <div class="row g-3">
            <div class="col-sm-6"><span class="text-muted d-block">Acquisition cost</span><strong>{{ formatAmount(valuation.boxPrice) }}</strong></div>
            <div class="col-sm-6"><span class="text-muted d-block">Unsold market value</span><strong>{{ formatAmount(valuation.unsoldValue) }}</strong></div>
            <div class="col-sm-6"><span class="text-muted d-block">Net sale proceeds</span><strong>{{ euros(valuation.soldNetProceedsCent) }}</strong></div>
            <div class="col-sm-6"><span class="text-muted d-block">Realized P/L</span><strong>{{ formatAmount(valuation.realizedPnL) }}</strong></div>
            <div class="col-sm-6"><span class="text-muted d-block">Unrealized P/L</span><strong>{{ formatAmount(valuation.unrealizedPnL) }}</strong></div>
            <div class="col-sm-6"><span class="text-muted d-block">Cards</span><strong>{{ valuation.remainingQuantity }} remaining · {{ valuation.soldQuantity }} sold</strong></div>
          </div>
        </div></div>
        <div v-else class="alert alert-secondary">Select a box to see its canonical accounting details.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Acquisition } from '../../data/db';
import { getDb } from '../../data/init';
import type { AmountSummary } from '../accounting/AccountingQueryService';
import { BoxValuationService, type BoxValuation } from '../analytics/BoxValuationService';

const db = getDb();
const service = new BoxValuationService(db);
const boxes = ref<Acquisition[]>([]);
const selectedBoxId = ref('');
const valuation = ref<BoxValuation>();
const loading = ref(false);
const error = ref('');

const euros = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const formatAmount = (value: AmountSummary) => value.status === 'unknown'
  ? (value.knownCents ? `${euros(value.knownCents)} + unknown` : 'Unknown')
  : `${euros(value.cents ?? value.knownCents)}${value.status === 'estimated' ? ' (estimated)' : ''}`;

onMounted(async () => {
  boxes.value = await db.acquisitions.where('kind').equals('box').toArray();
});

async function selectBox(boxId: string) {
  selectedBoxId.value = boxId;
  loading.value = true;
  error.value = '';
  try {
    valuation.value = await service.calculateBoxValue(boxId);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not calculate this box.';
  } finally {
    loading.value = false;
  }
}
</script>
