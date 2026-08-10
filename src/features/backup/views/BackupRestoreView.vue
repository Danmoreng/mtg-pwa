<template>
  <section class="backup-page">
    <header class="mb-4">
      <h1>Backup &amp; Restore</h1>
      <p class="text-muted mb-0">
        Export or replace the complete local IndexedDB database. Backups include every table in the current schema.
      </p>
    </header>

    <div class="row g-4">
      <div class="col-12 col-lg-6">
        <div class="glass-card h-100 p-4">
          <h2 class="h4">Create backup</h2>
          <p>Download a consistent JSON snapshot of all local collection, price, deck, import, and allocation data.</p>
          <button class="btn btn-glass-primary" :disabled="busy" @click="exportBackup">
            {{ busyAction === 'export' ? 'Creating backup…' : 'Download complete backup' }}
          </button>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="glass-card h-100 p-4">
          <h2 class="h4">Restore backup</h2>
          <p class="text-warning-emphasis">
            Restoring replaces every table in this browser. The operation is validated and committed atomically.
          </p>
          <input
            class="form-control mb-3"
            type="file"
            accept="application/json,.json"
            :disabled="busy"
            @change="selectBackup"
          >
          <button class="btn btn-outline-danger" :disabled="busy || !selectedFile" @click="restoreBackup">
            {{ busyAction === 'restore' ? 'Restoring…' : 'Replace local data from backup' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="alert mt-4" :class="messageClass" role="status">
      <div>{{ message }}</div>
      <button v-if="reloadRequired" class="btn btn-sm btn-primary mt-3" @click="reloadApp">
        Reload application
      </button>
    </div>

    <div class="glass-card mt-4 p-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 class="h4 mb-1">Current local database</h2>
          <p class="text-muted mb-0">{{ databaseName }} · schema {{ schemaVersion }}</p>
        </div>
        <button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="loadCounts">
          Refresh counts
        </button>
      </div>

      <div v-if="countsLoading" class="text-muted">Loading table counts…</div>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col" class="text-end">Records</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tableName in tableNames" :key="tableName">
              <td><code>{{ tableName }}</code></td>
              <td class="text-end">{{ counts[tableName] ?? 0 }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <th class="text-end">{{ totalRecords }}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_TABLE_NAMES,
  type DatabaseTableName,
} from '../../../data/db';
import { BackupService } from '../BackupService';

const databaseName = DATABASE_NAME;
const schemaVersion = DATABASE_SCHEMA_VERSION;
const tableNames = DATABASE_TABLE_NAMES;
const selectedFile = ref<File | null>(null);
const busyAction = ref<'export' | 'restore' | null>(null);
const countsLoading = ref(false);
const counts = ref<Partial<Record<DatabaseTableName, number>>>({});
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const reloadRequired = ref(false);

const busy = computed(() => busyAction.value !== null);
const totalRecords = computed(() => Object.values(counts.value).reduce((sum, count) => sum + (count ?? 0), 0));
const messageClass = computed(() => messageType.value === 'success' ? 'alert-success' : 'alert-danger');

function setMessage(text: string, type: 'success' | 'error'): void {
  message.value = text;
  messageType.value = type;
}

function selectBackup(event: Event): void {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  message.value = '';
  reloadRequired.value = false;
}

async function loadCounts(): Promise<void> {
  countsLoading.value = true;
  try {
    counts.value = await BackupService.getRecordCounts();
  } catch (error) {
    setMessage(`Could not read the local database: ${(error as Error).message}`, 'error');
  } finally {
    countsLoading.value = false;
  }
}

async function exportBackup(): Promise<void> {
  busyAction.value = 'export';
  message.value = '';
  try {
    await BackupService.exportToFile();
    setMessage('The complete local database was exported successfully.', 'success');
  } catch (error) {
    setMessage(`Backup failed: ${(error as Error).message}`, 'error');
  } finally {
    busyAction.value = null;
  }
}

async function restoreBackup(): Promise<void> {
  const file = selectedFile.value;
  if (!file) return;

  const confirmed = window.confirm(
    'Restore this backup? Every table in the current local database will be replaced.'
  );
  if (!confirmed) return;

  busyAction.value = 'restore';
  message.value = '';
  reloadRequired.value = false;
  try {
    await BackupService.importFromFile(file);
    await loadCounts();
    reloadRequired.value = true;
    setMessage('Backup restored successfully. Reload the application to refresh all in-memory state.', 'success');
  } catch (error) {
    setMessage(`Restore failed without changing the current data: ${(error as Error).message}`, 'error');
  } finally {
    busyAction.value = null;
  }
}

function reloadApp(): void {
  window.location.reload();
}

onMounted(loadCounts);
</script>

<style scoped>
.backup-page {
  max-width: 960px;
  margin: 0 auto;
}

.glass-card {
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 1rem;
  background: var(--bs-body-bg);
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 8%);
}
</style>
