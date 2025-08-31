<template>
  <div class="deck-import">
    <h1>Import Deck</h1>
    
    <div class="import-section">
      <h2>Moxfield Deck Import</h2>
      <p>Copy and paste your decklist from Moxfield to track which cards you own and which you're missing.</p>
      
      <div class="input-group">
        <label for="deck-name">Deck Name</label>
        <input 
          id="deck-name" 
          v-model="deckName" 
          type="text" 
          placeholder="Enter a name for your deck"
          class="text-input"
        />
      </div>
      
      <div class="input-group">
        <label for="decklist">Decklist</label>
        <textarea 
          id="decklist" 
          v-model="decklist" 
          placeholder="Paste your decklist here (e.g., 4 Lightning Bolt&#10;2 Counterspell)"
          rows="10"
          class="textarea-input"
        ></textarea>
      </div>
      
      <button @click="importDeck" :disabled="isImporting" class="import-button">
        {{ isImporting ? 'Importing...' : 'Import Deck' }}
      </button>
      
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
    
    <div v-if="importStatus" class="status-message" :class="importStatus.type">
      {{ importStatus.message }}
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
const importStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Show status message
const showStatus = (type: 'success' | 'error', message: string) => {
  importStatus.value = { type, message };
  setTimeout(() => {
    importStatus.value = null;
  }, 5000);
};

// Import deck
const importDeck = async () => {
  // Validate inputs
  if (!deckName.value.trim()) {
    showStatus('error', 'Please enter a deck name');
    return;
  }
  
  if (!decklist.value.trim()) {
    showStatus('error', 'Please paste your decklist');
    return;
  }
  
  isImporting.value = true;
  
  try {
    // Import the deck
    await DeckImportService.importDeckFromText(deckName.value.trim(), decklist.value.trim());
    
    showStatus('success', `Successfully imported deck: ${deckName.value}`);
    
    // Reset form
    deckName.value = '';
    decklist.value = '';
  } catch (error) {
    console.error('Error importing deck:', error);
    showStatus('error', 'Failed to import deck: ' + (error as Error).message);
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

.input-group {
  margin-bottom: var(--space-md);
}

.input-group label {
  display: block;
  margin-bottom: var(--space-xs);
  font-weight: var(--font-weight-medium);
}

.text-input,
.textarea-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
}

.text-input:focus,
.textarea-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.textarea-input {
  resize: vertical;
  min-height: 150px;
}

.import-button {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: var(--space-lg);
}

.import-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.import-button:disabled {
  background: var(--color-disabled);
  cursor: not-allowed;
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