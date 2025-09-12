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

  <!-- Alerts for completed imports -->
  <div class="import-alerts position-fixed top-0 end-0 p-3" style="z-index: 1050">
    <transition-group name="alert" tag="div">
      <div 
        v-for="importItem in completedImports" 
        :key="importItem.id"
        class="alert"
        :class="importItem.status === 'completed' ? 'alert-success' : 'alert-danger'"
        role="alert"
      >
        <div class="d-flex justify-content-between">
          <div>
            <strong>{{ importItem.name }}</strong> 
            {{ importItem.status === 'completed' ? 'import completed successfully!' : 'import failed.' }}
            <div v-if="importItem.errorMessage" class="small">{{ importItem.errorMessage }}</div>
          </div>
          <button 
            type="button" 
            class="btn-close" 
            @click="removeImport(importItem.id)"
          ></button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useImportStatusStore } from '../stores/importStatus';
import type { ImportStatus } from '../stores/importStatus';

const importStatusStore = useImportStatusStore();

const activeImports = computed(() => importStatusStore.getActiveImports());
const completedImports = computed(() => importStatusStore.getCompletedImports());

// Get the first active import to display
const currentImport = computed<ImportStatus | null>(() => {
  return activeImports.value.length > 0 ? activeImports.value[0] : null;
});

const removeImport = (id: string) => {
  importStatusStore.removeImport(id);
};

// Auto-remove completed imports after 5 seconds
let cleanupInterval: number | null = null;

onMounted(() => {
  cleanupInterval = window.setInterval(() => {
    const now = new Date();
    importStatusStore.imports.forEach((importItem: ImportStatus) => {
      if ((importItem.status === 'completed' || importItem.status === 'failed') && importItem.completedAt) {
        const completedAt = new Date(importItem.completedAt);
        // Remove imports that completed more than 5 seconds ago
        if (now.getTime() - completedAt.getTime() > 5000) {
          importStatusStore.removeImport(importItem.id);
        }
      }
    });
  }, 1000);
});

onUnmounted(() => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
});
</script>

<style scoped>
.import-status-indicator {
  margin-right: 1rem;
}

.import-alerts {
  z-index: 1050;
}

.alert-enter-active,
.alert-leave-active {
  transition: all 0.3s ease;
}

.alert-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.alert-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.progress {
  height: 5px;
}
</style>