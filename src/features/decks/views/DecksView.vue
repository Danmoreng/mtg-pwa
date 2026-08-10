<template>
  <div class="container py-4">
    <div class="d-flex align-items-center justify-content-between mb-4"><div><h1 class="h3 mb-1">Decks</h1><p class="text-muted mb-0">Requirements and physical inventory coverage</p></div><router-link to="/import/deck" class="btn btn-glass-primary">Import deck</router-link></div>
    <div v-if="loading" class="text-center py-5">Loading decks…</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-else-if="!summaries.length" class="text-center py-5"><p class="text-muted">You haven't imported any decks yet.</p><router-link to="/import/deck" class="btn btn-glass-primary">Import your first deck</router-link></div>
    <div v-else class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
      <div v-for="summary in summaries" :key="summary.deck.id" class="col">
        <div class="card h-100 shadow-sm border-0 overflow-hidden position-relative">
          <div class="card-aspect position-relative overflow-hidden bg-body-secondary">
            <img v-if="faceCard(summary)" :src="faceCard(summary)?.imageUrl" :alt="faceCard(summary)?.name" class="w-100 h-100 d-block img-fit-cover rounded-4">
            <div v-else class="w-100 h-100 d-flex align-items-center justify-content-center text-muted">No face card</div>
          </div>
          <div class="card-body">
            <h2 class="h5 text-truncate">{{ summary.deck.name }}</h2>
            <div class="d-flex justify-content-between align-items-center mb-2"><span v-if="summary.deck.platform" class="badge bg-info text-dark text-uppercase">{{ summary.deck.platform }}</span><small class="text-muted">{{ formatDate(summary.deck.importedAt) }}</small></div>
            <div class="d-flex justify-content-between small"><span>{{ summary.requiredQuantity }} required</span><span>{{ summary.allocatedQuantity }} allocated</span></div>
            <div class="progress mt-2" role="progressbar" :aria-valuenow="summary.coveragePercentage" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" :class="summary.missingQuantity ? 'bg-warning' : 'bg-success'" :style="{ width: `${summary.coveragePercentage}%` }">{{ Math.round(summary.coveragePercentage) }}%</div></div>
            <div class="mt-2"><span v-if="!summary.trackedPhysicalInventory" class="badge bg-secondary">Requirements only</span><span v-else-if="summary.missingQuantity" class="badge bg-warning text-dark">{{ summary.missingQuantity }} missing</span><span v-else class="badge bg-success">Fully allocated</span></div>
            <router-link class="stretched-link" :to="`/decks/${summary.deck.id}`" aria-label="Open deck" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountingQueryService, type DeckCoverageSummary } from '../../accounting/AccountingQueryService';
import type { Card } from '../../../data/db';

const summaries = ref<DeckCoverageSummary[]>([]);
const loading = ref(true);
const error = ref('');
const formatDate = (date?: Date) => date ? new Date(date).toLocaleDateString() : '—';
function faceCard(summary: DeckCoverageSummary): Card | undefined {
  return summary.rows.find(row => row.card?.id === summary.deck.faceCardId)?.card ?? summary.rows.find(row => row.card?.imageUrl)?.card;
}
onMounted(async () => {
  try { summaries.value = (await new AccountingQueryService().getDeckSummaries()).filter(row => row.deck.status !== 'archived'); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load decks.'; }
  finally { loading.value = false; }
});
</script>

<style scoped>
.card-aspect { aspect-ratio: 63 / 88; }
.img-fit-cover { object-fit: cover; }
</style>
