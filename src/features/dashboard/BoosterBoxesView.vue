
<template>
  <div class="container-fluid">
    <h1>Booster Box Analysis</h1>
    <div class="row">
      <div class="col-4">
        <h2>Boxes</h2>
        <ul class="list-group">
          <li
            v-for="box in boxes"
            :key="box.id"
            class="list-group-item"
            @click="selectBox(box.id)"
          >
            {{ box.source }} - {{ new Date(box.happenedAt).toLocaleDateString() }}
          </li>
        </ul>
      </div>
      <div class="col-8">
        <div v-if="selectedBoxValuation">
          <h2>Box Details</h2>
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Valuation</h5>
              <p class="card-text">Box Price: {{ formatCurrency(selectedBoxValuation.boxPrice) }}</p>
              <p class="card-text">Unsold Value: {{ formatCurrency(selectedBoxValuation.unsoldValue) }}</p>
              <p class="card-text">Sold Value: {{ formatCurrency(selectedBoxValuation.soldValue) }}</p>
              <p class="card-text">Total Current Value: {{ formatCurrency(selectedBoxValuation.totalCurrentValue) }}</p>
            </div>
          </div>
        </div>
        <div v-else>
          <p>Select a box to see the details.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MtgTrackerDb, { type Acquisition } from '../../data/db';
import { BoxValuationService } from '../analytics/BoxValuationService';

const db = new MtgTrackerDb();
const boxService = new BoxValuationService(db);

const boxes = ref<Acquisition[]>([]);
const selectedBoxValuation = ref<any>(null);

onMounted(async () => {
  boxes.value = await db.acquisitions.where({ kind: 'box' }).toArray();

  // Debug statement requested by user
  const lotCount = await db.card_lots.count();
  const cardCount = await db.cards.count();
  console.log(`[Debug] Total CardLots: ${lotCount}, Total Cards: ${cardCount}`);
});

async function selectBox(boxId: string) {
  selectedBoxValuation.value = await boxService.calculateBoxValue(boxId);
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
</script>
