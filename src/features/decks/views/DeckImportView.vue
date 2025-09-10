<template>
  <div class="deck-import">
    <h1>Import Deck</h1>
    
    <div class="import-section">
      <h2>Moxfield Deck Import</h2>
      <p>Copy and paste your decklist from Moxfield to track which cards you own and which you're missing.</p>
      
      <div class="mb-3">
        <label for="deck-name" class="form-label">Deck Name</label>
        <input 
          id="deck-name" 
          v-model="deckName" 
          type="text" 
          placeholder="Enter a name for your deck"
          class="form-control"
        />
      </div>
      
      <div class="mb-3">
        <label for="decklist" class="form-label">Decklist</label>
        <textarea 
          id="decklist" 
          v-model="decklist" 
          placeholder="Paste your decklist here (e.g., 4 Lightning Bolt&#10;2 Counterspell)"
          rows="10"
          class="form-control"
        ></textarea>
      </div>
      
      <button @click="importDeck" :disabled="isImporting" class="btn btn-primary mb-4">
        {{ isImporting ? 'Importing...' : 'Import Deck' }}
      </button>
      
      <div v-if="importError" class="status-message error">
        {{ importError }}
      </div>
      
      <div class="instructions">
        <h3>How to copy from Moxfield:</h3>
        <ol>
          <li>Open your deck on Moxfield.com</li>
          <li>Click the "Export" button</li>
          <li>Select "Text" format</li>
          <li>Copy the text and paste it here</li>
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
const decklist = ref('');
const isImporting = ref(false);
const importError = ref<string | null>(null);

// Import deck
const importDeck = async () => {
  // Validate inputs
  if (!deckName.value.trim()) {
    importError.value = 'Please enter a deck name';
    return;
  }
  
  if (!decklist.value.trim()) {
    importError.value = 'Please paste your decklist';
    return;
  }
  
  isImporting.value = true;
  importError.value = null;
  
  try {
    // Import the deck using the service
    await DeckImportService.importDeckFromText(deckName.value.trim(), decklist.value.trim());
    
    // Show success message
    importError.value = 'Deck import started successfully! Check the status indicator in the top right for progress.';
    
    // Reset form after successful import
    setTimeout(() => {
      deckName.value = '';
      decklist.value = '';
      isImporting.value = false;
      importError.value = null;
    }, 3000);
  } catch (error) {
    importError.value = 'Failed to import deck: ' + (error as Error).message;
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