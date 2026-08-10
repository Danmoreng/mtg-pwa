<template>
  <div class="deck-import py-3">
    <h1>Import Deck</h1>
    <p class="text-muted">Import requirements and decide explicitly how they interact with physical inventory.</p>

    <div class="card mb-4"><div class="card-body">
      <h2 class="h5">Inventory policy</h2>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Use existing physical inventory?</label>
          <select v-model="existingPolicy" class="form-select" data-testid="deck-existing-policy">
            <option value="allocate_available">Yes — reserve available matching cards</option>
            <option value="requirements_only">No — track requirements only</option>
          </select>
        </div>
        <div v-if="existingPolicy === 'allocate_available'" class="col-md-6">
          <label class="form-label">If cards are still missing</label>
          <select v-model="missingPolicy" class="form-select" data-testid="deck-missing-policy">
            <option value="leave_missing">Leave them missing (safe default)</option>
            <option value="create_deficit">Create physical inventory for deficits</option>
          </select>
        </div>
        <template v-if="existingPolicy === 'allocate_available' && missingPolicy === 'create_deficit'">
          <div class="col-12"><div class="alert alert-warning mb-0">This option creates user-confirmed physical lots only for quantities that remain missing after existing inventory is allocated. A later Cardmarket or ManaBox import may flag possible duplicates for your decision.</div></div>
          <div class="col-md-6"><label class="form-label">Cost basis for created cards</label><select v-model="costPolicy" class="form-select"><option value="unknown">Unknown</option><option value="enter_total">One total for all deficits</option><option value="enter_per_card">Same unit cost per created card</option></select></div>
          <div v-if="costPolicy === 'enter_total'" class="col-md-6"><label class="form-label">Total deficit cost (€)</label><input v-model="deficitCostEuro" class="form-control" inputmode="decimal" required></div>
          <div v-if="costPolicy === 'enter_per_card'" class="col-md-6"><label class="form-label">Unit cost (€)</label><input v-model="deficitUnitCostEuro" class="form-control" inputmode="decimal" required></div>
          <div class="col-md-4"><label class="form-label">Default finish</label><select v-model="defaultFinish" class="form-select"><option value="nonfoil">Nonfoil</option><option value="foil">Foil</option><option value="etched">Etched</option></select></div>
          <div class="col-md-4"><label class="form-label">Default language</label><input v-model="defaultLanguage" class="form-control"></div>
          <div class="col-md-4"><label class="form-label">Default condition</label><select v-model="defaultCondition" class="form-select"><option value="unknown">Unknown</option><option value="near_mint">Near mint</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="played">Played</option></select></div>
          <div class="col-12 form-check ms-2"><input id="confirmDeficit" v-model="confirmDeficitCreation" class="form-check-input" type="checkbox"><label for="confirmDeficit" class="form-check-label">I confirm that every remaining deficit represents a physical card I own.</label></div>
        </template>
      </div>
    </div></div>

    <div class="card"><div class="card-body">
      <h2 class="h5">Moxfield import</h2>
      <div class="mb-3"><label for="deck-name" class="form-label">Deck name (optional for URL import)</label><input id="deck-name" v-model="deckName" class="form-control" placeholder="Override deck name"></div>
      <div class="mb-3"><label for="moxfield-url" class="form-label">Moxfield URL</label><input id="moxfield-url" v-model="moxfieldUrl" type="url" class="form-control" placeholder="https://moxfield.com/decks/..."></div>
      <button class="btn btn-glass-primary mb-4" :disabled="isImporting || !policyConfirmed" @click="importFromUrl">{{ isImporting ? 'Importing…' : 'Import from Moxfield URL' }}</button>
      <hr>
      <h2 class="h5">Text fallback</h2>
      <div class="mb-3"><label for="decklist" class="form-label">Decklist text</label><textarea id="decklist" v-model="decklist" rows="10" class="form-control" placeholder="1 Card Name (SET) 123"></textarea></div>
      <button class="btn btn-glass-primary" :disabled="isImporting || !policyConfirmed" @click="importFromText">{{ isImporting ? 'Importing…' : 'Import from text' }}</button>
      <div v-if="statusMessage" class="alert mt-4" :class="statusType === 'success' ? 'alert-success' : 'alert-danger'">{{ statusMessage }}</div>
    </div></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { DeckImportService } from '../DeckImportService';
import type { DeckAccountingProjectionOptions } from '../DeckAccountingProjectionService';

const deckName = ref('');
const moxfieldUrl = ref('');
const decklist = ref('');
const isImporting = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error'>('success');
const existingPolicy = ref<'allocate_available' | 'requirements_only'>('allocate_available');
const missingPolicy = ref<'leave_missing' | 'create_deficit'>('leave_missing');
const costPolicy = ref<'unknown' | 'enter_total' | 'enter_per_card'>('unknown');
const deficitCostEuro = ref('');
const deficitUnitCostEuro = ref('');
const defaultFinish = ref<'nonfoil' | 'foil' | 'etched'>('nonfoil');
const defaultLanguage = ref('en');
const defaultCondition = ref('unknown');
const confirmDeficitCreation = ref(false);

const createsInventory = computed(() => existingPolicy.value === 'allocate_available' && missingPolicy.value === 'create_deficit');
const policyConfirmed = computed(() => !createsInventory.value || confirmDeficitCreation.value);

function parseEuro(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Enter a non-negative EUR amount with at most two decimal places.');
  return Math.round(Number(normalized) * 100);
}
function options(): DeckAccountingProjectionOptions {
  const result: DeckAccountingProjectionOptions = {
    existingInventoryPolicy: existingPolicy.value,
    missingInventoryPolicy: existingPolicy.value === 'requirements_only' ? 'leave_missing' : missingPolicy.value,
    costBasisPolicy: createsInventory.value ? costPolicy.value : 'unknown',
    defaultFinish: defaultFinish.value,
    defaultLanguage: defaultLanguage.value,
    defaultCondition: defaultCondition.value,
  };
  if (createsInventory.value && costPolicy.value === 'enter_total') result.totalDeficitCostCent = parseEuro(deficitCostEuro.value);
  if (createsInventory.value && costPolicy.value === 'enter_per_card') result.defaultDeficitUnitCostCent = parseEuro(deficitUnitCostEuro.value);
  return result;
}
function setStatus(message: string, type: 'success' | 'error') { statusMessage.value = message; statusType.value = type; }

async function importFromUrl() {
  if (!moxfieldUrl.value.trim()) return setStatus('Please paste a Moxfield URL.', 'error');
  isImporting.value = true; statusMessage.value = '';
  try {
    await DeckImportService.importDeckFromMoxfieldUrl(moxfieldUrl.value.trim(), deckName.value.trim() || undefined, options());
    setStatus('Deck imported and inventory policy applied.', 'success'); moxfieldUrl.value = '';
  } catch (cause) { setStatus(`Failed to import deck: ${cause instanceof Error ? cause.message : String(cause)}`, 'error'); }
  finally { isImporting.value = false; }
}
async function importFromText() {
  if (!deckName.value.trim()) return setStatus('Please enter a deck name for text import.', 'error');
  if (!decklist.value.trim()) return setStatus('Please paste your decklist text.', 'error');
  isImporting.value = true; statusMessage.value = '';
  try {
    await DeckImportService.importDeckFromText(deckName.value.trim(), decklist.value.trim(), options());
    setStatus('Deck imported and inventory policy applied.', 'success'); decklist.value = '';
  } catch (cause) { setStatus(`Failed to import deck: ${cause instanceof Error ? cause.message : String(cause)}`, 'error'); }
  finally { isImporting.value = false; }
}
</script>

<style scoped>
.deck-import { max-width: 900px; margin: 0 auto; padding-inline: var(--space-lg); }
</style>
