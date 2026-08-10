<template>
  <div class="deck-import">
    <h1>Import Deck</h1>
    
    <div class="import-section">
      <h2>Moxfield Deck Import</h2>
      <p>Paste a public Moxfield deck URL to import directly. Text import is still available as a fallback.</p>
      
      <div class="mb-3">
        <label for="deck-name" class="form-label">Deck Name (optional for URL import)</label>
        <input 
          id="deck-name" 
          v-model="deckName" 
          type="text" 
          placeholder="Override deck name (optional)"
          class="form-control"
        />
      </div>

      <div class="mb-3">
        <label for="moxfield-url" class="form-label">Moxfield URL</label>
        <input
          id="moxfield-url"
          v-model="moxfieldUrl"
          type="url"
          placeholder="https://moxfield.com/decks/..."
          class="form-control"
        />
      </div>

      <button @click="importFromUrl" :disabled="isImporting" class="btn btn-glass-primary mb-4">
        {{ isImporting ? 'Importing...' : 'Import From Moxfield URL' }}
      </button>
      
      <div class="mb-3">
        <label for="decklist" class="form-label">Decklist Text (fallback)</label>
        <textarea 
          id="decklist" 
          v-model="decklist" 
          placeholder="Paste exported list lines like: 1 Card Name (SET) 123"
          rows="10"
          class="form-control"
        ></textarea>
      </div>
      
      <button @click="importFromText" :disabled="isImporting" class="btn btn-glass-primary mb-4">
        {{ isImporting ? 'Importing...' : 'Import From Text' }}
      </button>
      
      <div v-if="statusMessage" class="status-message" :class="statusType || 'error'">
        {{ statusMessage }}
      </div>
      
      <div class="instructions">
        <h3>How to import:</h3>
        <ol>
          <li>Open your deck on Moxfield.com</li>
          <li>Copy the URL from your browser and paste it above</li>
          <li>If URL import fails, export as text and paste into the fallback box</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { DeckImportService } from '../DeckImportService';

// Reactive state
const deckName = ref('');
const moxfieldUrl = ref('');
const decklist = ref('');
const isImporting = ref(false);
const statusMessage = ref<string | null>(null);
const statusType = ref<'success' | 'error' | null>(null);

const setStatus = (message: string, type: 'success' | 'error') => {
  statusMessage.value = message;
  statusType.value = type;
};

const importFromUrl = async () => {
  if (!moxfieldUrl.value.trim()) {
    setStatus('Please paste a Moxfield URL', 'error');
    return;
  }

  isImporting.value = true;
  statusMessage.value = null;
  statusType.value = null;

  try {
    await DeckImportService.importDeckFromMoxfieldUrl(
      moxfieldUrl.value.trim(),
      deckName.value.trim() || undefined
    );
    setStatus('Deck import started successfully! Check the status indicator for progress.', 'success');
    moxfieldUrl.value = '';
  } catch (error) {
    setStatus('Failed to import deck from URL: ' + (error as Error).message, 'error');
  } finally {
    isImporting.value = false;
  }
};

const importFromText = async () => {
  if (!deckName.value.trim()) {
    setStatus('Please enter a deck name for text import', 'error');
    return;
  }

  if (!decklist.value.trim()) {
    setStatus('Please paste your decklist text', 'error');
    return;
  }

  isImporting.value = true;
  statusMessage.value = null;
  statusType.value = null;

  try {
    await DeckImportService.importDeckFromText(deckName.value.trim(), decklist.value.trim());
    setStatus('Deck import started successfully! Check the status indicator for progress.', 'success');
    decklist.value = '';
  } catch (error) {
    setStatus('Failed to import deck from text: ' + (error as Error).message, 'error');
  } finally {
    isImporting.value = false;
  }
};
</script>

<style scoped>
.deck-import {
  padding: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
}

.import-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-md);
}

.import-section h2 {
  margin-top: 0;
}

.instructions {
  background: var(--color-info-bg);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.instructions h3 {
  margin-top: 0;
}

.instructions ol {
  margin-bottom: 0;
  padding-left: var(--space-lg);
}

.status-message {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
  text-align: center;
}

.status-message.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-message.error {
  background: var(--color-error-bg);
  color: var(--color-error);
}
</style>
