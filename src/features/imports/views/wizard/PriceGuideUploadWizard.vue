
<template>
  <div class="price-guide-wizard">
    <h1>Cardmarket Price Guide Import</h1>
    <p>Import historical price data from Cardmarket Price Guide.</p>

    <div class="alert alert-info">
      <h3 class="alert-heading">Where to get the file</h3>
      <p>You can download the Price Guide CSV from your Cardmarket account.</p>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="file-upload-section">
          <div class="mb-3">
            <label for="price-guide-file" class="form-label">
              Choose Price Guide CSV File
            </label>
            <input
                id="price-guide-file"
                type="file"
                accept=".csv"
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
import { PriceGuideUploadService } from '../../../pricing/PriceGuideUploadService';

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

  try {
    await PriceGuideUploadService.upload(uploadedFile.value, (written) => {
      processedCount.value = written;
      progress.value = 100; // For now, just show 100% when done
      isImporting.value = false;
      importFinished.value = true;
    });
  } catch (error) {
    errors.value.push('Failed to import Price Guide data: ' + (error as Error).message);
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
.price-guide-wizard {
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
