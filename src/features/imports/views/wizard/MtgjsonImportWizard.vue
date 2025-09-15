
<template>
  <div class="mtgjson-wizard">
    <h1>MTGJSON Price Import</h1>
    <p>Import historical price data from MTGJSON. This will populate the price history for your cards for the last 90 days.</p>
    <div class="card">
      <div class="card-body">
        <div class="info-section mb-4">
          <p><strong>What happens when you click "Import Prices":</strong></p>
          <ol>
            <li>Download AllIdentifiers.json.gz (~160MB compressed)</li>
            <li>Download AllPrices.json.gz (~130MB compressed)</li>
            <li>Process the files to extract price data for your cards</li>
            <li>Store the price history in your local database</li>
          </ol>
        </div>

        <div v-if="isImporting" class="progress-section">
          <div class="phase-section mb-3">
            <div class="phase-title mb-1">Downloading AllIdentifiers.json.gz</div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" :style="{ width: identifiersProgress + '%' }" :aria-valuenow="identifiersProgress" aria-valuemin="0" aria-valuemax="100">{{ identifiersProgress }}%</div>
            </div>
            <div class="phase-message mt-1">{{ identifiersMessage }}</div>
          </div>
          
          <div class="phase-section mb-3" v-if="currentPhase === 'downloading-all-prices' || currentPhase === 'importing-price-points' || currentPhase === 'completed'">
            <div class="phase-title mb-1">Downloading AllPrices.json.gz</div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" :style="{ width: pricesProgress + '%' }" :aria-valuenow="pricesProgress" aria-valuemin="0" aria-valuemax="100">{{ pricesProgress }}%</div>
            </div>
            <div class="phase-message mt-1">{{ pricesMessage }}</div>
          </div>
          
          <div class="phase-section mb-3" v-if="currentPhase === 'importing-price-points' || currentPhase === 'completed'">
            <div class="phase-title mb-1">Importing Price Points</div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" :style="{ width: importProgress + '%' }" :aria-valuenow="importProgress" aria-valuemin="0" aria-valuemax="100">{{ importProgress }}%</div>
            </div>
            <div class="phase-message mt-1">{{ importMessage }}</div>
          </div>
        </div>

        <div v-if="importFinished" class="alert alert-success">
          Import finished! Processed {{ processedCount }} price points.
        </div>

        <div v-if="errors.length > 0" class="error-messages">
          <div v-for="error in errors" :key="error" class="error-message">
            {{ error }}
            <div v-if="error.includes('Out of Memory') || error.includes('too large')" class="mt-2">
              <strong>Solution:</strong> The MTGJSON file is too large to process in your browser. Please download the smaller "AllPricesToday.json" file from MTGJSON instead, which contains only the latest prices and is much smaller.
            </div>
          </div>
        </div>

        <div class="wizard-navigation pt-3">
          <button
              @click="startImport"
              class="btn btn-primary"
              :disabled="isImporting"
          >
            {{ isImporting ? 'Importing...' : 'Import Prices' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { MTGJSONUploadService } from '../../../pricing/MTGJSONUploadService';

const isImporting = ref(false);
const importFinished = ref(false);
const currentPhase = ref('');
const identifiersProgress = ref(50); // Start with 50% for cached data (download complete)
const identifiersMessage = ref('Using cached AllIdentifiers mapping...');
const pricesProgress = ref(0);
const pricesMessage = ref('');
const importProgress = ref(0);
const importMessage = ref('');
const processedCount = ref(0);
const errors = ref<string[]>([]);

const startImport = async () => {
  if (isImporting.value) return;

  isImporting.value = true;
  importFinished.value = false;
  errors.value = [];
  currentPhase.value = '';
  identifiersProgress.value = 0; // Reset to 0 when starting fresh
  identifiersMessage.value = 'Downloading AllIdentifiers.json.gz...';
  pricesProgress.value = 0;
  pricesMessage.value = '';
  importProgress.value = 0;
  importMessage.value = '';
  processedCount.value = 0;

  try {
    await MTGJSONUploadService.upload('auto', (info) => {
      currentPhase.value = info.type;
      
      switch (info.type) {
        case 'downloading-all-identifiers':
          identifiersProgress.value = info.percentage || 0;
          identifiersMessage.value = info.message;
          break;
        case 'processing-all-identifiers':
          identifiersProgress.value = info.percentage || 0;
          identifiersMessage.value = info.message;
          break;
        case 'downloading-all-prices':
          pricesProgress.value = info.percentage || 0;
          pricesMessage.value = info.message;
          break;
        case 'importing-price-points':
          importProgress.value = info.percentage || 0;
          importMessage.value = info.message;
          break;
        case 'completed':
          importProgress.value = 100;
          importMessage.value = info.message;
          processedCount.value = (info as any).writtenPricePoints ?? 0; // show price points
          isImporting.value = false;
          importFinished.value = true;
          break;
      }
    });
  } catch (error) {
    errors.value.push('Failed to import MTGJSON data: ' + (error as Error).message);
    isImporting.value = false;
  }
};
</script>

<style scoped>
.info-section {
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}
.progress-section {
  margin-bottom: var(--space-md);
}
.phase-section {
  padding: var(--space-sm) 0;
}
.phase-title {
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.9rem;
}
.phase-message {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}
.progress {
  height: 20px;
  margin-bottom: 5px;
  background-color: #e9ecef;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-bar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  background-color: #0d6efd;
  transition: width 0.6s ease;
}
.error-messages {
  margin-top: var(--space-md);
}
.error-message {
  padding: var(--space-sm);
  background: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-xs);
}
.wizard-navigation {
  display: flex;
  justify-content: center;
}
</style>
