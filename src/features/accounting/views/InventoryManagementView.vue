<template>
  <div class="container-fluid py-3 inventory-management">
    <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-4">
      <div>
        <h1 class="mb-1">Inventory & Reconciliation</h1>
        <p class="text-muted mb-0">Manual changes are auditable; inventory is never silently overwritten.</p>
      </div>
      <button class="btn btn-outline-secondary" :disabled="busy" @click="reload">Refresh</button>
    </div>

    <div v-if="message" class="alert" :class="messageKind === 'error' ? 'alert-danger' : 'alert-success'">{{ message }}</div>

    <div v-if="portfolio" class="row g-3 mb-4">
      <div class="col-md-3"><div class="card h-100"><div class="card-body"><span class="text-muted small">Physical cards</span><div class="h4 mb-0">{{ portfolio.quantity }}</div></div></div></div>
      <div class="col-md-3"><div class="card h-100"><div class="card-body"><span class="text-muted small">Available</span><div class="h4 mb-0">{{ portfolio.availableQuantity }}</div></div></div></div>
      <div class="col-md-3"><div class="card h-100"><div class="card-body"><span class="text-muted small">In decks</span><div class="h4 mb-0">{{ portfolio.deckReservedQuantity }}</div></div></div></div>
      <div class="col-md-3"><div class="card h-100"><div class="card-body"><span class="text-muted small">Open issues</span><div class="h4 mb-0">{{ portfolio.openIssueCount }}</div></div></div></div>
    </div>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'inventory' }" @click="setTab('inventory')">Inventory</button></li>
      <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'add' }" @click="setTab('add')">Add cards</button></li>
      <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'issues' }" @click="setTab('issues')">Issues <span v-if="openIssueCount" class="badge bg-warning text-dark">{{ openIssueCount }}</span></button></li>
    </ul>

    <div v-if="loading" class="text-center py-5">Loading…</div>

    <section v-else-if="tab === 'inventory'">
      <div class="row g-4">
        <div class="col-xl-7">
          <div class="input-group mb-3">
            <span class="input-group-text">Filter</span>
            <input v-model="inventoryFilter" class="form-control" placeholder="Card, set, language or lot source">
          </div>
          <div v-if="!filteredLots.length" class="alert alert-secondary">No active inventory lots match this filter.</div>
          <div v-else class="table-responsive inventory-table border rounded">
            <table class="table table-hover align-middle mb-0">
              <thead><tr><th>Card</th><th>Lot</th><th class="text-end">Remaining</th><th class="text-end">Decks</th><th>Cost basis</th></tr></thead>
              <tbody>
                <tr v-for="row in filteredLots" :key="row.lot.id" :class="{ 'table-active': selectedLot?.lot.id === row.lot.id }" @click="selectLot(row)">
                  <td><strong>{{ row.card?.name ?? row.lot.cardId }}</strong><br><small class="text-muted">{{ row.card?.setCode }} #{{ row.card?.number }} · {{ row.lot.finish }} · {{ row.lot.language }}</small></td>
                  <td><small>{{ row.lot.origin }}<br>{{ formatDate(row.lot.acquiredAt) }}</small></td>
                  <td class="text-end">{{ row.snapshot.remainingQuantity }}</td>
                  <td class="text-end">{{ row.snapshot.deckReservedQuantity }}</td>
                  <td>{{ formatAccountingMoney(row.snapshot.openCostBasis) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="col-xl-5">
          <div v-if="selectedLot" class="card sticky-xl-top correction-panel"><div class="card-body">
            <h2 class="h5">Correct {{ selectedLot.card?.name }}</h2>
            <p class="small text-muted">Set the quantity that should remain in this lot. Use 0 to remove all uncommitted copies.</p>
            <div v-if="selectedLot.snapshot.deckReservedQuantity" class="alert alert-warning small">
              {{ selectedLot.snapshot.deckReservedQuantity }} copies are reserved in decks. A correction below that level is intentionally blocked.
            </div>
            <form @submit.prevent="submitCorrection">
              <div class="row g-3">
                <div class="col-sm-6"><label class="form-label">Current remaining</label><input class="form-control" :value="selectedLot.snapshot.remainingQuantity" disabled></div>
                <div class="col-sm-6"><label class="form-label">Correct remaining to</label><input v-model.number="correction.target" data-testid="correction-target" type="number" min="0" class="form-control" required></div>
                <div class="col-sm-6"><label class="form-label">Reason</label><select v-model="correction.kind" class="form-select"><option v-for="kind in adjustmentKinds" :key="kind" :value="kind">{{ kind }}</option></select></div>
                <div class="col-sm-6"><label class="form-label">Effective date</label><input v-model="correction.date" type="date" class="form-control" required></div>
                <template v-if="correction.target > selectedLot.snapshot.remainingQuantity">
                  <div class="col-sm-6"><label class="form-label">Added cost status</label><select v-model="correction.costStatus" class="form-select"><option value="unknown">Unknown</option><option value="known">Known</option><option value="estimated">Estimated</option></select></div>
                  <div v-if="correction.costStatus !== 'unknown'" class="col-sm-6"><label class="form-label">Added total cost (€)</label><input v-model="correction.costEuro" inputmode="decimal" class="form-control" required></div>
                </template>
                <div class="col-12"><label class="form-label">Note</label><textarea v-model="correction.note" class="form-control" rows="2" placeholder="Why is this correction needed?"></textarea></div>
              </div>
              <button class="btn btn-primary mt-3" data-testid="apply-correction" :disabled="busy || correction.target === selectedLot.snapshot.remainingQuantity">Apply auditable correction</button>
            </form>

            <div v-if="selectedAdjustments.length" class="mt-4">
              <h3 class="h6">Adjustment history</h3>
              <div v-for="adjustment in selectedAdjustments" :key="adjustment.id" class="border rounded p-2 mb-2 small">
                <div class="d-flex justify-content-between"><strong>{{ adjustment.quantityDelta > 0 ? '+' : '' }}{{ adjustment.quantityDelta }} · {{ adjustment.kind }}</strong><span>{{ formatDate(adjustment.effectiveAt) }}</span></div>
                <div v-if="adjustment.note" class="text-muted">{{ adjustment.note }}</div>
                <button v-if="!adjustment.reversesAdjustmentId && !reversedAdjustmentIds.has(adjustment.id)" class="btn btn-link btn-sm p-0" :disabled="busy" @click="reverseAdjustment(adjustment.id)">Reverse</button>
              </div>
            </div>
          </div></div>
        </div>
      </div>
    </section>

    <section v-else-if="tab === 'add'">
      <div class="row g-4">
        <div class="col-lg-6">
          <div class="card"><div class="card-body">
            <h2 class="h5">1. Select a printing</h2>
            <div class="input-group mb-3"><input v-model="cardSearch" class="form-control" placeholder="Search local cards"><button class="btn btn-outline-primary" @click="searchCards">Search</button></div>
            <div class="list-group local-card-results">
              <button v-for="card in cardResults" :key="card.id" class="list-group-item list-group-item-action" :class="{ active: selectedCard?.id === card.id }" @click="selectedCard = card">
                {{ card.name }} <small>· {{ card.setCode.toUpperCase() }} #{{ card.number }}</small>
              </button>
            </div>
            <hr>
            <button class="btn btn-link px-0" @click="showScryfallLookup = !showScryfallLookup">{{ showScryfallLookup ? 'Hide' : 'Card not found? Resolve another printing via Scryfall' }}</button>
            <div v-if="showScryfallLookup" class="row g-2">
              <div class="col-12"><input v-model="lookup.scryfallId" class="form-control" placeholder="Scryfall ID (most precise)"></div>
              <div class="col-6"><input v-model="lookup.setCode" class="form-control" placeholder="Set code"></div>
              <div class="col-6"><input v-model="lookup.collectorNumber" class="form-control" placeholder="Collector number"></div>
              <div class="col-12"><input v-model="lookup.name" class="form-control" placeholder="Card name"></div>
              <div class="col-12"><button class="btn btn-outline-primary" :disabled="busy" @click="resolveCard">Resolve printing</button></div>
            </div>
          </div></div>
        </div>

        <div class="col-lg-6">
          <div class="card"><div class="card-body">
            <h2 class="h5">2. Add physical inventory</h2>
            <div v-if="!selectedCard" class="alert alert-secondary">Select or resolve a card printing first.</div>
            <form v-else @submit.prevent="submitNewInventory">
              <p><strong>{{ selectedCard.name }}</strong><br><span class="text-muted">{{ selectedCard.set }} #{{ selectedCard.number }}</span></p>
              <div class="row g-3">
                <div class="col-sm-6"><label class="form-label">Quantity</label><input v-model.number="newInventory.quantity" data-testid="new-inventory-quantity" type="number" min="1" class="form-control" required></div>
                <div class="col-sm-6"><label class="form-label">Acquired date</label><input v-model="newInventory.date" type="date" class="form-control" required></div>
                <div class="col-sm-4"><label class="form-label">Finish</label><select v-model="newInventory.finish" class="form-select"><option value="nonfoil">Nonfoil</option><option value="foil">Foil</option><option value="etched">Etched</option></select></div>
                <div class="col-sm-4"><label class="form-label">Language</label><input v-model="newInventory.language" class="form-control" required></div>
                <div class="col-sm-4"><label class="form-label">Condition</label><select v-model="newInventory.condition" class="form-select"><option value="near_mint">Near mint</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="light_played">Light played</option><option value="played">Played</option><option value="poor">Poor</option><option value="unknown">Unknown</option></select></div>
                <div class="col-sm-6"><label class="form-label">Cost basis</label><select v-model="newInventory.costStatus" class="form-select"><option value="unknown">Unknown</option><option value="known">Known</option><option value="estimated">Estimated</option></select></div>
                <div v-if="newInventory.costStatus !== 'unknown'" class="col-sm-6"><label class="form-label">Total cost (€)</label><input v-model="newInventory.costEuro" inputmode="decimal" class="form-control" required></div>
              </div>
              <div class="form-check mt-3"><input id="confirmManual" v-model="newInventory.confirmed" class="form-check-input" type="checkbox"><label for="confirmManual" class="form-check-label">I confirm these are physical cards I own.</label></div>
              <button class="btn btn-primary mt-3" data-testid="add-inventory" :disabled="busy || !newInventory.confirmed">Add inventory</button>
            </form>
          </div></div>
        </div>
      </div>
    </section>

    <section v-else>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="btn-group"><button class="btn btn-outline-secondary" :class="{ active: issueStatus === 'open' }" @click="issueStatus = 'open'">Open</button><button class="btn btn-outline-secondary" :class="{ active: issueStatus === 'resolved' }" @click="issueStatus = 'resolved'">Resolved</button></div>
        <button class="btn btn-outline-primary" :disabled="busy" @click="retryIssues">Retry automatic reconciliation</button>
      </div>
      <div v-if="!visibleIssues.length" class="alert alert-success">No {{ issueStatus }} reconciliation issues.</div>
      <div v-for="issue in visibleIssues" :key="issue.id" class="card mb-3"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3">
          <div class="d-flex gap-3 issue-card-summary">
            <div class="issue-card-image flex-shrink-0">
              <img v-if="issuePresentation(issue).card?.imageUrl" :src="issuePresentation(issue).card?.imageUrl" :alt="issuePresentation(issue).title">
              <div v-else class="issue-card-placeholder">{{ issuePresentation(issue).card?.setCode.toUpperCase() || '?' }}</div>
            </div>
            <div>
              <span class="badge bg-warning-subtle text-warning-emphasis">{{ issue.kind }}</span>
              <h2 class="h5 mt-2 mb-1">{{ issuePresentation(issue).title }}</h2>
              <div class="text-muted small">{{ issuePresentation(issue).printing }}</div>
              <div v-if="issuePresentation(issue).context" class="small mt-1">{{ issuePresentation(issue).context }}</div>
              <small class="text-muted d-block mt-1">Updated {{ formatDateTime(issue.updatedAt) }}</small>
            </div>
          </div>
          <span class="badge align-self-start" :class="issue.status === 'open' ? 'bg-danger' : 'bg-success'">{{ issue.status }}</span>
        </div>
        <details class="technical-details mt-3 mb-3">
          <summary>Technical details</summary>
          <div class="small text-muted mt-2"><strong>Source:</strong> {{ issue.sourceRef }}</div>
          <pre v-if="issue.details" class="issue-details mt-2 mb-0">{{ formatDetails(issue.details) }}</pre>
        </details>
        <p v-if="issue.status === 'open'" class="small text-muted">
          {{ issueGuidance(issue) }}
        </p>

        <div v-if="activeInventoryIssueId === issue.id && missingInventoryContext" class="issue-action-panel border rounded p-3 mb-3">
          <h3 class="h6">Add the missing physical inventory</h3>
          <p class="small mb-3">
            <strong>{{ missingInventoryContext.card.name }}</strong> ·
            {{ missingInventoryContext.card.setCode.toUpperCase() }} #{{ missingInventoryContext.card.number }} ·
            {{ missingInventoryContext.quantity }} × {{ missingInventoryContext.finish }} · {{ missingInventoryContext.language }}
          </p>
          <div class="row g-3">
            <div class="col-sm-4"><label class="form-label">Acquired date</label><input v-model="issueInventory.date" type="date" class="form-control" required></div>
            <div class="col-sm-4"><label class="form-label">Condition</label><select v-model="issueInventory.condition" class="form-select"><option value="near_mint">Near mint</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="light_played">Light played</option><option value="played">Played</option><option value="poor">Poor</option><option value="unknown">Unknown</option></select></div>
            <div class="col-sm-4"><label class="form-label">Cost basis</label><select v-model="issueInventory.costStatus" class="form-select"><option value="unknown">Unknown</option><option value="known">Known</option><option value="estimated">Estimated</option></select></div>
            <div v-if="issueInventory.costStatus !== 'unknown'" class="col-sm-4"><label class="form-label">Total cost (€)</label><input v-model="issueInventory.costEuro" inputmode="decimal" class="form-control" required></div>
          </div>
          <div class="form-check mt-3"><input :id="`confirm-${issue.id}`" v-model="issueInventory.confirmed" class="form-check-input" type="checkbox"><label :for="`confirm-${issue.id}`" class="form-check-label">I confirm that I physically own these {{ missingInventoryContext.quantity }} card(s).</label></div>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-sm btn-primary" :disabled="busy || !issueInventory.confirmed" @click="submitMissingInventory">Add and reconcile</button>
            <button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="closeIssueActions">Cancel</button>
          </div>
        </div>

        <div v-if="activeMappingIssueId === issue.id" class="issue-action-panel border rounded p-3 mb-3">
          <h3 class="h6">Map the imported row to a printing</h3>
          <p class="small text-muted">Choose the exact printing. The import is then projected again automatically.</p>
          <div class="input-group mb-2"><input v-model="mappingSearch" class="form-control" placeholder="Search local cards" @keyup.enter="searchMappingCards"><button class="btn btn-outline-primary" @click="searchMappingCards">Search</button></div>
          <div class="list-group local-card-results mb-2">
            <button v-for="card in mappingCardResults" :key="card.id" class="list-group-item list-group-item-action" :class="{ active: mappingCard?.id === card.id }" @click="mappingCard = card">
              {{ card.name }} <small>· {{ card.setCode.toUpperCase() }} #{{ card.number }}</small>
            </button>
          </div>
          <button class="btn btn-link btn-sm px-0" @click="showMappingLookup = !showMappingLookup">{{ showMappingLookup ? 'Hide Scryfall lookup' : 'Printing not local? Resolve it via Scryfall' }}</button>
          <div v-if="showMappingLookup" class="row g-2 mt-1">
            <div class="col-12"><input v-model="mappingLookup.scryfallId" class="form-control" placeholder="Scryfall ID (most precise)"></div>
            <div class="col-sm-4"><input v-model="mappingLookup.setCode" class="form-control" placeholder="Set code"></div>
            <div class="col-sm-4"><input v-model="mappingLookup.collectorNumber" class="form-control" placeholder="Collector number"></div>
            <div class="col-sm-4"><input v-model="mappingLookup.name" class="form-control" placeholder="Card name"></div>
            <div class="col-12"><button class="btn btn-sm btn-outline-primary" :disabled="busy" @click="resolveMappingCard">Resolve printing</button></div>
          </div>
          <p v-if="mappingCard" class="small mt-3 mb-2">Selected: <strong>{{ mappingCard.name }}</strong> · {{ mappingCard.setCode.toUpperCase() }} #{{ mappingCard.number }}</p>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-sm btn-primary" :disabled="busy || !mappingCard" @click="submitIssueMapping">Save mapping and reconcile</button>
            <button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="closeIssueActions">Cancel</button>
          </div>
        </div>

        <div v-if="issue.status === 'open'" class="d-flex flex-wrap gap-2">
          <button v-if="canAddMissingInventory(issue)" class="btn btn-sm btn-primary" :disabled="busy" @click="openMissingInventory(issue.id)">{{ issue.kind === 'oversold' ? 'Add missing acquisition' : 'Add missing physical card' }}</button>
          <button v-if="issue.kind === 'unmatched'" class="btn btn-sm btn-primary" :disabled="busy" @click="openIssueMapping(issue.id)">Map card printing</button>
          <button v-if="issue.kind === 'possible_duplicate_inventory'" class="btn btn-sm btn-primary" :disabled="busy" @click="mergeIssue(issue.id)">Same physical copy</button>
          <button v-if="issue.kind === 'possible_duplicate_inventory'" class="btn btn-sm btn-outline-success" :disabled="busy" @click="resolveIssue(issue.id, 'additional_copy')">Both are separate copies</button>
          <button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="resolveIssue(issue.id, 'ignored')">Dismiss as intentional</button>
        </div>
        <div v-else>
          <p class="small mb-2">Resolution: <strong>{{ issue.resolution }}</strong></p>
          <button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="reopenIssue(issue.id)">Reopen</button>
        </div>
      </div></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Card, InventoryAdjustment, ReconciliationIssue } from '../../../data/db';
import { getDb } from '../../../data/init';
import type { AccountingMoney, CostBasisStatus } from '../AccountingTypes';
import { AccountingQueryService, type CanonicalLotView, type PortfolioSummary } from '../AccountingQueryService';
import { ManualInventoryService } from '../ManualInventoryService';
import { ReconciliationActionService, type MissingInventoryIssueContext, type ReconciliationIssuePresentation } from '../ReconciliationActionService';

type Tab = 'inventory' | 'add' | 'issues';
type AdjustmentKind = InventoryAdjustment['kind'];

const route = useRoute();
const router = useRouter();
const db = getDb();
const queries = new AccountingQueryService(db);
const inventoryService = new ManualInventoryService(db);
const reconciliation = new ReconciliationActionService(db);
const adjustmentKinds: AdjustmentKind[] = ['correction', 'found', 'lost', 'gifted', 'transferred', 'damaged', 'other'];

const tab = ref<Tab>(route.query.tab === 'issues' || route.query.tab === 'add' ? route.query.tab : 'inventory');
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const messageKind = ref<'success' | 'error'>('success');
const portfolio = ref<PortfolioSummary>();
const lots = ref<CanonicalLotView[]>([]);
const adjustments = ref<InventoryAdjustment[]>([]);
const issues = ref<ReconciliationIssue[]>([]);
const issuePresentationById = ref(new Map<string, ReconciliationIssuePresentation>());
const inventoryFilter = ref('');
const selectedLot = ref<CanonicalLotView>();
const issueStatus = ref<ReconciliationIssue['status']>('open');
const activeInventoryIssueId = ref('');
const missingInventoryContext = ref<MissingInventoryIssueContext>();
const activeMappingIssueId = ref('');
const mappingSearch = ref('');
const mappingCardResults = ref<Card[]>([]);
const mappingCard = ref<Card>();
const showMappingLookup = ref(false);

const cardSearch = ref('');
const cardResults = ref<Card[]>([]);
const selectedCard = ref<Card>();
const showScryfallLookup = ref(false);
const lookup = reactive({ scryfallId: '', name: '', setCode: '', collectorNumber: '' });
const mappingLookup = reactive({ scryfallId: '', name: '', setCode: '', collectorNumber: '' });
const today = () => new Date().toISOString().slice(0, 10);
const newInventory = reactive({ quantity: 1, finish: 'nonfoil' as 'nonfoil' | 'foil' | 'etched', language: 'en', condition: 'near_mint', costStatus: 'unknown' as CostBasisStatus, costEuro: '', date: today(), confirmed: false });
const correction = reactive({ target: 0, kind: 'correction' as AdjustmentKind, costStatus: 'unknown' as CostBasisStatus, costEuro: '', date: today(), note: '' });
const issueInventory = reactive({ costStatus: 'unknown' as CostBasisStatus, costEuro: '', date: today(), condition: 'unknown', confirmed: false });

const filteredLots = computed(() => {
  const query = inventoryFilter.value.trim().toLowerCase();
  return lots.value
    .filter(row => row.snapshot.remainingQuantity > 0)
    .filter(row => !query || [row.card?.name, row.card?.set, row.card?.setCode, row.lot.language, row.lot.finish, row.lot.sourceRef].some(value => String(value ?? '').toLowerCase().includes(query)));
});
const selectedAdjustments = computed(() => adjustments.value.filter(row => row.lotId === selectedLot.value?.lot.id).sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime()));
const reversedAdjustmentIds = computed(() => new Set(adjustments.value.map(row => row.reversesAdjustmentId).filter((id): id is string => Boolean(id))));
const visibleIssues = computed(() => issues.value.filter(row => row.status === issueStatus.value));
const openIssueCount = computed(() => issues.value.filter(row => row.status === 'open').length);

function setTab(value: Tab) {
  tab.value = value;
  void router.replace({ query: value === 'inventory' ? {} : { tab: value } });
}
function selectLot(row: CanonicalLotView) {
  selectedLot.value = row;
  correction.target = row.snapshot.remainingQuantity;
  correction.kind = 'correction'; correction.costStatus = 'unknown'; correction.costEuro = ''; correction.note = ''; correction.date = today();
}
function parseEuro(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Enter a non-negative EUR amount with at most two decimal places.');
  return Math.round(Number(normalized) * 100);
}
const euros = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const formatAccountingMoney = (money: AccountingMoney) => money.status === 'unknown' ? 'Unknown' : `${euros(money.cents)}${money.status === 'estimated' ? ' (estimated)' : ''}`;
const formatDate = (value: Date) => new Date(value).toLocaleDateString();
const formatDateTime = (value: Date) => new Date(value).toLocaleString();
const formatDetails = (details: Record<string, unknown>) => JSON.stringify(details, null, 2);
function announce(text: string, kind: 'success' | 'error' = 'success') { message.value = text; messageKind.value = kind; window.scrollTo({ top: 0, behavior: 'smooth' }); }

function canAddMissingInventory(issue: ReconciliationIssue): boolean {
  const missingQuantity = Number(issue.details?.missingQuantity);
  return Number.isSafeInteger(missingQuantity) && missingQuantity > 0 && (
    issue.kind === 'oversold' ||
    (issue.kind === 'quantity_conflict' && Boolean(issue.details?.deckCardId))
  );
}

function issueGuidance(issue: ReconciliationIssue): string {
  if (issue.kind === 'oversold') return 'This sale cannot be fully allocated because the accounting inventory is short. Add the historically missing acquisition if you really owned the sold copy.';
  if (issue.kind === 'unmatched') return 'The imported row could not be matched to an exact card printing. Map it manually, then the import will be projected again.';
  if (issue.kind === 'possible_duplicate_inventory') return 'Decide whether both imports describe one physical copy or two separate copies.';
  if (issue.kind === 'quantity_conflict' && issue.details?.deckCardId) return 'This deck requires more physical copies than the current inventory can provide. Add the missing card only if you really own it.';
  if (issue.kind === 'quantity_conflict') return 'The imported quantity or a locked allocation is inconsistent. Correct the source/allocation and retry, or dismiss it only when the discrepancy is intentional.';
  return 'Review the candidates or source data, then retry reconciliation. Dismiss only if the discrepancy is intentional.';
}

function issuePresentation(issue: ReconciliationIssue): ReconciliationIssuePresentation {
  return issuePresentationById.value.get(issue.id) ?? {
    issueId: issue.id,
    title: issue.kind,
    printing: 'Card details unavailable',
    context: '',
  };
}

async function reload() {
  loading.value = true;
  try {
    const [loadedPortfolio, loadedLots, loadedAdjustments, loadedIssues] = await Promise.all([
      queries.getPortfolioSummary(), queries.getLotViews(), db.inventory_adjustments.toArray(), reconciliation.getIssues(),
    ]);
    portfolio.value = loadedPortfolio;
    lots.value = loadedLots;
    adjustments.value = loadedAdjustments;
    issues.value = loadedIssues;
    issuePresentationById.value = new Map(
      (await reconciliation.getIssuePresentations(loadedIssues)).map(row => [row.issueId, row])
    );
    if (selectedLot.value) {
      const refreshed = lots.value.find(row => row.lot.id === selectedLot.value?.lot.id);
      if (refreshed) selectLot(refreshed); else selectedLot.value = undefined;
    }
  } finally { loading.value = false; }
}

async function run(action: () => Promise<void>, success: string | (() => string)) {
  busy.value = true; message.value = '';
  try { await action(); await reload(); announce(typeof success === 'function' ? success() : success); }
  catch (cause) { announce(cause instanceof Error ? cause.message : 'The operation failed.', 'error'); }
  finally { busy.value = false; }
}

async function searchCards() { cardResults.value = await inventoryService.findCards(cardSearch.value); }
async function resolveCard() {
  await run(async () => { selectedCard.value = await inventoryService.resolveAndSaveCard({ ...lookup }); cardResults.value = [selectedCard.value]; }, 'Printing resolved. You can now add physical inventory.');
}
async function submitNewInventory() {
  if (!selectedCard.value) return;
  await run(async () => {
    await inventoryService.createInventory({
      cardId: selectedCard.value!.id, quantity: newInventory.quantity, finish: newInventory.finish, language: newInventory.language,
      condition: newInventory.condition, costBasisStatus: newInventory.costStatus,
      totalCostCent: newInventory.costStatus === 'unknown' ? undefined : parseEuro(newInventory.costEuro), occurredAt: new Date(`${newInventory.date}T12:00:00`),
    });
    newInventory.confirmed = false;
  }, 'Physical inventory added and dependent allocations recalculated.');
}
async function submitCorrection() {
  if (!selectedLot.value) return;
  const increasing = correction.target > selectedLot.value.snapshot.remainingQuantity;
  await run(async () => {
    const now = new Date();
    await inventoryService.correctRemainingQuantity({
      lotId: selectedLot.value!.lot.id, targetRemainingQuantity: correction.target,
      addedCostBasisStatus: increasing ? correction.costStatus : undefined,
      addedCostBasisCent: increasing && correction.costStatus !== 'unknown' ? parseEuro(correction.costEuro) : undefined,
      kind: correction.kind, effectiveAt: new Date(`${correction.date}T12:00:00`), confirmedAt: now, note: correction.note.trim() || undefined,
    });
  }, 'Inventory correction recorded.');
}
async function reverseAdjustment(id: string) { await run(async () => { await inventoryService.reverseAdjustment(id, 'Reversed from inventory UI'); }, 'Adjustment reversed.'); }
async function resolveIssue(id: string, resolution: 'additional_copy' | 'ignored') { await run(() => reconciliation.resolve(id, resolution), 'Reconciliation decision saved.'); }
function closeIssueActions() {
  activeInventoryIssueId.value = '';
  missingInventoryContext.value = undefined;
  activeMappingIssueId.value = '';
  mappingCard.value = undefined;
}
async function openMissingInventory(id: string) {
  busy.value = true; message.value = '';
  try {
    const context = await reconciliation.getMissingInventoryContext(id);
    closeIssueActions();
    activeInventoryIssueId.value = id;
    missingInventoryContext.value = context;
    issueInventory.costStatus = 'unknown'; issueInventory.costEuro = ''; issueInventory.confirmed = false;
    issueInventory.condition = context.condition;
    issueInventory.date = context.occurredAt.toISOString().slice(0, 10);
  } catch (cause) { announce(cause instanceof Error ? cause.message : 'Could not prepare this resolution.', 'error'); }
  finally { busy.value = false; }
}
async function submitMissingInventory() {
  if (!activeInventoryIssueId.value || !missingInventoryContext.value) return;
  let resolved = false;
  await run(async () => {
    const result = await reconciliation.createMissingInventory(activeInventoryIssueId.value, {
      costBasisStatus: issueInventory.costStatus,
      totalCostCent: issueInventory.costStatus === 'unknown' ? undefined : parseEuro(issueInventory.costEuro),
      occurredAt: new Date(`${issueInventory.date}T12:00:00`),
      condition: issueInventory.condition,
    });
    resolved = result.resolved;
    closeIssueActions();
  }, () => resolved
    ? 'Missing physical inventory added and the issue was resolved.'
    : 'Inventory was added, but competing sales or deck requirements still leave an open issue. Review the remaining issues.');
}
async function openIssueMapping(id: string) {
  closeIssueActions();
  activeMappingIssueId.value = id;
  mappingSearch.value = '';
  mappingCardResults.value = await inventoryService.findCards('');
  showMappingLookup.value = false;
  Object.assign(mappingLookup, { scryfallId: '', name: '', setCode: '', collectorNumber: '' });
}
async function searchMappingCards() { mappingCardResults.value = await inventoryService.findCards(mappingSearch.value); }
async function resolveMappingCard() {
  await run(async () => {
    mappingCard.value = await inventoryService.resolveAndSaveCard({ ...mappingLookup });
    mappingCardResults.value = [mappingCard.value];
  }, 'Printing resolved. Confirm the mapping to re-run the import.');
}
async function submitIssueMapping() {
  if (!activeMappingIssueId.value || !mappingCard.value) return;
  let resolved = false;
  await run(async () => {
    const result = await reconciliation.mapUnmatchedIssue(activeMappingIssueId.value, mappingCard.value!.id);
    resolved = result.resolved;
    closeIssueActions();
  }, () => resolved ? 'Card printing mapped and the issue was resolved.' : 'Mapping saved, but the issue remains open. Review its updated details.');
}
async function mergeIssue(id: string) {
  if (!window.confirm('Confirm that both records describe the same physical card. The duplicate quantity will be removed and provenance retained.')) return;
  await run(() => reconciliation.resolveAsSamePhysicalCopy(id), 'Duplicate records merged without double counting inventory.');
}
async function reopenIssue(id: string) { await run(() => reconciliation.reopen(id), 'Issue reopened.'); }
async function retryIssues() { await run(() => reconciliation.retryProjections(), 'Automatic reconciliation rerun completed.'); }

onMounted(async () => { await Promise.all([reload(), searchCards()]); });
</script>

<style scoped>
.inventory-management { max-width: 1600px; }
.inventory-table { max-height: 65vh; overflow: auto; }
.inventory-table tbody tr { cursor: pointer; }
.correction-panel { top: 6rem; }
.local-card-results { max-height: 18rem; overflow: auto; }
.issue-details { white-space: pre-wrap; font-size: .8rem; background: rgba(127,127,127,.1); padding: .75rem; border-radius: .5rem; }
.issue-action-panel { background: rgba(13, 110, 253, .04); }
.issue-card-summary { min-width: 0; }
.issue-card-image { width: 92px; aspect-ratio: 5 / 7; border-radius: .5rem; overflow: hidden; background: rgba(127,127,127,.14); }
.issue-card-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.issue-card-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: var(--bs-secondary-color); font-weight: 600; }
.technical-details summary { cursor: pointer; color: var(--bs-secondary-color); font-size: .875rem; }
@media (max-width: 575.98px) { .issue-card-image { width: 68px; } }
</style>
