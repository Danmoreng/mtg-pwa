<template>
  <div class="container py-4">
    <div v-if="loading" class="text-center py-5">Loading deck…</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-else-if="!summary" class="text-center py-5"><p>Deck not found.</p><router-link to="/decks" class="btn btn-outline-secondary">Back to decks</router-link></div>
    <template v-else>
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <router-link to="/decks" class="btn btn-link px-0">← Back to decks</router-link>
        <div class="d-flex gap-2"><button class="btn" :class="selectingFaceCard ? 'btn-warning' : 'btn-outline-primary'" @click="selectingFaceCard = !selectingFaceCard">{{ selectingFaceCard ? 'Cancel face-card selection' : 'Select face card' }}</button><button class="btn btn-outline-danger" @click="showArchiveModal = true">Archive deck</button></div>
      </div>

      <div class="card mb-4"><div class="card-body">
        <div v-if="editingTitle" class="input-group mb-2 title-editor"><input ref="titleInput" v-model="editedTitle" class="form-control form-control-lg" @keyup.enter="saveTitle" @keyup.esc="editingTitle = false"><button class="btn btn-primary" @click="saveTitle">Save</button><button class="btn btn-outline-secondary" @click="editingTitle = false">Cancel</button></div>
        <h1 v-else class="h3 editable" @click="startTitleEdit">{{ summary.deck.name }} <small class="text-muted">✏️</small></h1>
        <div class="d-flex flex-wrap gap-2 mb-3"><span v-if="summary.deck.platform" class="badge bg-info text-dark text-uppercase">{{ summary.deck.platform }}</span><span class="badge" :class="summary.trackedPhysicalInventory ? 'bg-primary' : 'bg-secondary'">{{ summary.trackedPhysicalInventory ? 'Physical exclusive inventory' : 'Requirements only' }}</span><span v-if="summary.missingQuantity" class="badge bg-warning text-dark">{{ summary.missingQuantity }} missing</span><span v-else class="badge bg-success">Fully allocated</span></div>
        <div class="d-flex justify-content-between small"><span>{{ summary.allocatedQuantity }} of {{ summary.requiredQuantity }} cards allocated</span><span>{{ Math.round(summary.coveragePercentage) }}%</span></div>
        <div class="progress mt-2"><div class="progress-bar" :class="summary.missingQuantity ? 'bg-warning' : 'bg-success'" :style="{ width: `${summary.coveragePercentage}%` }"></div></div>
        <div v-if="summary.openIssues.length" class="alert alert-warning mt-3 mb-0"><router-link to="/inventory?tab=issues">{{ summary.openIssues.length }} issue{{ summary.openIssues.length === 1 ? '' : 's' }} for this deck need attention.</router-link></div>
        <div v-if="selectingFaceCard" class="alert alert-info mt-3 mb-0">Click one of the cards below to use it as the deck image.</div>
      </div></div>

      <h2 class="h5 mb-3">Cards in deck</h2>
      <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 row-cols-xxl-6 g-3">
        <div v-for="row in summary.rows" :key="row.deckCard.id" class="col">
          <div class="h-100 position-relative" :class="{ 'face-select': selectingFaceCard }" @click="selectingFaceCard ? setFaceCard(row.deckCard.cardId) : undefined">
            <CardComponent :card="row.card ?? fallbackCard(row.deckCard.cardId)" :disable-modal="selectingFaceCard" />
            <div class="coverage-overlay p-2 rounded-bottom">
              <div class="d-flex justify-content-between small"><strong>{{ row.deckCard.quantity }}× · {{ row.deckCard.role }}</strong><span :class="row.missingQuantity ? 'text-warning' : 'text-success'">{{ row.allocatedQuantity }}/{{ row.requiredQuantity }}</span></div>
              <div v-if="row.missingQuantity" class="small text-warning">{{ row.missingQuantity }} missing</div>
            </div>
            <span v-if="row.deckCard.cardId === summary.deck.faceCardId" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success">★</span>
          </div>
        </div>
      </div>

      <div v-if="showArchiveModal" class="modal d-block" tabindex="-1" role="dialog" @click.self="showArchiveModal = false"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h2 class="modal-title h5">Archive this deck?</h2><button class="btn-close" @click="showArchiveModal = false"></button></div><div class="modal-body"><p>Archiving releases all physical inventory reservations. The deck and its accounting history remain in the database.</p></div><div class="modal-footer"><button class="btn btn-outline-secondary" @click="showArchiveModal = false">Cancel</button><button class="btn btn-danger" :disabled="archiving" @click="archiveDeck">{{ archiving ? 'Archiving…' : 'Archive and release inventory' }}</button></div></div></div></div>
      <div v-if="showArchiveModal" class="modal-backdrop show"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CardComponent from '../../../components/CardComponent.vue';
import { getDb } from '../../../data/init';
import { AccountingQueryService, type DeckCoverageSummary } from '../../accounting/AccountingQueryService';
import { DeckManagementService } from '../DeckManagementService';

const route = useRoute();
const router = useRouter();
const db = getDb();
const queries = new AccountingQueryService(db);
const summary = ref<DeckCoverageSummary>();
const loading = ref(true);
const error = ref('');
const editingTitle = ref(false);
const editedTitle = ref('');
const titleInput = ref<HTMLInputElement>();
const selectingFaceCard = ref(false);
const showArchiveModal = ref(false);
const archiving = ref(false);

const fallbackCard = (id: string) => ({ id, name: 'Unknown card', set: 'Unknown set', setCode: '???', number: '???', lang: 'en', finish: 'nonfoil' });
async function load() {
  summary.value = await queries.getDeckSummary(String(route.params.id));
}
function startTitleEdit() { if (!summary.value) return; editedTitle.value = summary.value.deck.name; editingTitle.value = true; void nextTick(() => titleInput.value?.focus()); }
async function saveTitle() {
  if (!summary.value || !editedTitle.value.trim()) return;
  const now = new Date();
  await db.decks.update(summary.value.deck.id, { name: editedTitle.value.trim(), updatedAt: now });
  summary.value.deck.name = editedTitle.value.trim(); editingTitle.value = false;
}
async function setFaceCard(cardId: string) {
  if (!summary.value) return;
  const now = new Date();
  await db.decks.update(summary.value.deck.id, { faceCardId: cardId, updatedAt: now });
  summary.value.deck.faceCardId = cardId; selectingFaceCard.value = false;
}
async function archiveDeck() {
  if (!summary.value) return;
  archiving.value = true;
  try { await new DeckManagementService(db).archiveDeck(summary.value.deck.id); await router.push('/decks'); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not archive deck.'; showArchiveModal.value = false; }
  finally { archiving.value = false; }
}
onMounted(async () => { try { await load(); } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load deck.'; } finally { loading.value = false; } });
</script>

<style scoped>
.editable, .face-select { cursor: pointer; }
.title-editor { max-width: 42rem; }
.coverage-overlay { background: rgba(20, 20, 20, .88); color: white; margin-top: -.25rem; position: relative; z-index: 2; }
</style>
