
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

        <div v-if="isImporting" class="progress">
          <div class="progress-bar" role="progressbar" :style="{ width: progress + '%' }" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">{{ progress }}%</div>
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
            {{ isImporting ? (downloading ? 'Downloading...' : 'Importing...') : 'Import Prices' }}
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
const downloading = ref(false);
const importFinished = ref(false);
const progress = ref(0);
const processedCount = ref(0);
const errors = ref<string[]>([]);

const startImport = async () => {
  if (isImporting.value) return;

  isImporting.value = true;
  downloading.value = true;
  importFinished.value = false;
  errors.value = [];
  progress.value = 0;
  processedCount.value = 0;

  try {
    await MTGJSONUploadService.upload('auto', (processed) => {
      processedCount.value = processed;
      progress.value = 100; // For now, just show 100% when done
    });
    isImporting.value = false;
    downloading.value = false;
    importFinished.value = true;
  } catch (error) {
    errors.value.push('Failed to import MTGJSON data: ' + (error as Error).message);
    isImporting.value = false;
    downloading.value = false;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.mtgjson-wizard {
  padding: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
}
.info-section {
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: var(--space-md);
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
