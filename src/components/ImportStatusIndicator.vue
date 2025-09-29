<template>
  <div v-if="currentImport" class="import-status-indicator" style="width: 200px">
    <div class="d-flex justify-content-between align-items-baseline">
      <span class="fw-medium small text-truncate" :title="currentImport.name">{{ currentImport.name }}</span>
      <span class="small text-muted flex-shrink-0 ms-2">{{ currentImport.processedItems }} / {{ currentImport.totalItems }}</span>
    </div>
    <div class="progress mt-1">
      <div
        class="progress-bar"
        role="progressbar"
        :style="{ width: currentImport.progress + '%' }"
        :aria-valuenow="currentImport.progress"
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useImportStatusStore, type ImportStatus } from '../stores/importStatus';
import { useAlertStore } from '../stores/alerts';

const importStatusStore = useImportStatusStore();
const alertStore = useAlertStore();

const activeImports = computed(() => importStatusStore.getActiveImports());

// Get the first active import to display
const currentImport = computed<ImportStatus | null>(() => {
  return activeImports.value.length > 0 ? activeImports.value[0] : null;
});

// Watch for completed imports to fire alerts
watch(() => [...importStatusStore.imports], (newImports, oldImports) => {
  newImports.forEach(newImport => {
    const oldImport = oldImports.find(o => o.id === newImport.id);
    // If the status just changed to completed or failed
    if (oldImport && (oldImport.status !== 'completed' && oldImport.status !== 'failed') && (newImport.status === 'completed' || newImport.status === 'failed')) {
      if (newImport.status === 'completed') {
        alertStore.addAlert({
          type: 'success',
          message: `<strong>${newImport.name}</strong> import completed successfully!`,
        });
      } else {
        alertStore.addAlert({
          type: 'danger',
          message: `<strong>${newImport.name}</strong> import failed. ${newImport.errorMessage || ''}`,
        });
      }
      // Remove the completed/failed import from the list after a short delay
      setTimeout(() => importStatusStore.removeImport(newImport.id), 5000);
    }
  });
});

</script>

<style scoped>
.import-status-indicator {
  margin-right: 1rem;
}

.progress {
  height: 5px;
}
</style>