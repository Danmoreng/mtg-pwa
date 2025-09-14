
<template>
  <div class="mtgjson-wizard">
    <h1>MTGJSON Price Import</h1>
    <p>Import historical price data from MTGJSON. This will populate the price history for your cards for the last 90 days.</p>

    <div class="alert alert-info">
      <h3 class="alert-heading">Where to get the file</h3>
      <p>You can download the <code>AllPrices.json.gz</code> file from the <a href="https://mtgjson.com/downloads/all-files/" target="_blank" rel="noopener noreferrer">MTGJSON website</a>.</p>
      <p><strong>Note:</strong> The full file is very large (~1.2GB when decompressed). If you encounter memory issues, consider using the smaller "AllPricesToday.json" file instead, which contains only the latest prices.</p>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="file-upload-section">
          <div class="mb-3">
            <label for="mtgjson-file" class="form-label">
              Choose AllPrices.json.gz File
            </label>
            <input
                id="mtgjson-file"
                type="file"
                accept=".json.gz"
                @change="handleFileUpload"
                class="form-control"
            />
          </div>

          <div v-if="uploadedFile" class="files-info">
            <h3>Uploaded File</h3>
            <ul class="file-list">
              <li class="file-item">
                <span class="file-name">{{ uploadedFile.name }}</span>
                <span class="file-size">- {{ formatFileSize(uploadedFile.size) }}</span>
              </li>
            </ul>
            <div v-if="uploadedFile.size > 100 * 1024 * 1024" class="alert alert-warning mt-2">
              <strong>Warning:</strong> This file is quite large ({{ formatFileSize(uploadedFile.size) }}). Processing may take a while and could potentially fail due to memory constraints. Consider using the smaller "AllPricesToday.json" file if available.
            </div>
          </div>
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
              :disabled="!uploadedFile || isImporting"
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

const uploadedFile = ref<File | null>(null);
const isImporting = ref(false);
const importFinished = ref(false);
const progress = ref(0);
const processedCount = ref(0);
const errors = ref<string[]>([]);

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) return;

  uploadedFile.value = files[0];
  importFinished.value = false;
  processedCount.value = 0;
  errors.value = [];
};

const startImport = async () => {
  if (!uploadedFile.value || isImporting.value) return;

  isImporting.value = true;
  importFinished.value = false;
  errors.value = [];
  progress.value = 0;
  processedCount.value = 0;

  try {
    await MTGJSONUploadService.upload(uploadedFile.value, (processed) => {
      processedCount.value = processed;
      progress.value = 100; // For now, just show 100% when done
    });
    isImporting.value = false;
    importFinished.value = true;
  } catch (error) {
    errors.value.push('Failed to import MTGJSON data: ' + (error as Error).message);
    isImporting.value = false;
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
.file-upload-section {
  margin-bottom: var(--space-lg);
}
.files-info {
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-top: var(--space-md);
}
.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
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
  justify-content: flex-end;
}
</style>
