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
      
      <div v-if="importProgress !== null" class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
        </div>
        <div class="progress-text">{{ importProgress }}%</div>
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
    
    <div v-if="importStatus" class="status-message" :class="importStatus.type">
      {{ importStatus.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { cardRepository, holdingRepository } from '../../../data/repos';
import { EntityLinker } from '../../linker/EntityLinker';
import { ScryfallProvider } from '../../pricing/ScryfallProvider';
import db from '../../../data/db';

// Reactive state
const deckName = ref('');
const decklist = ref('');
const isImporting = ref(false);
const importStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const importProgress = ref<number | null>(null);

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
  importProgress.value = 0;
  
  try {
    // Split the decklist into lines for progress tracking
    const lines = decklist.value.trim().split('\n').filter(line => line.trim());
    const totalLines = lines.length;
    
    // Create a promise that resolves after a short delay to prevent UI freezing
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Import the deck with progress updates
    const deckId = `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const deck = {
      id: deckId,
      platform: 'csv' as const,
      name: deckName.value.trim(),
      commander: '',
      url: '',
      importedAt: new Date()
    };
    
    // Save deck
    await db.decks.add(deck);
    
    // Process cards from text with progress updates
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Update progress
      importProgress.value = Math.round(((i + 1) / totalLines) * 100);
      
      // Allow UI to update by yielding control
      await delay(0);
      
      console.log('Processing line:', line);
      
      // Parse the line (format: "quantity cardName (setCode) collectorNumber")
      const match = line.match(/^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i);
      
      if (match) {
        const [, quantityStr, cardName, setCode, collectorNumber] = match;
        const quantity = parseInt(quantityStr) || 1;
        
        if (cardName && setCode && collectorNumber) {
          // Create a card fingerprint
          const fingerprint = {
            name: cardName.trim(),
            setCode: setCode.trim(),
            collectorNumber: collectorNumber.trim(),
            finish: 'nonfoil',
            language: 'en'
          };
          
          // Try to resolve to a Scryfall ID
          const cardId = await EntityLinker.resolveFingerprint(fingerprint);
          
          if (cardId) {
            const existingCard = await cardRepository.getById(cardId);
            if (!existingCard) {
              // Get full card data from Scryfall
              const scryfallData = await ScryfallProvider.hydrateCard({
                scryfall_id: cardId,
                name: cardName.trim(),
                setCode: setCode.trim(),
                collectorNumber: collectorNumber.trim()
              });
              
              // Get image URL from Scryfall data
              const imageUrl = scryfallData?.image_uris?.normal || 
                              scryfallData?.image_uris?.large || 
                              scryfallData?.image_uris?.small || 
                              '';
              
              const cardRecord = {
                id: cardId,
                oracleId: scryfallData?.oracle_id || '',
                name: cardName.trim(),
                set: scryfallData?.set_name || setCode.trim(),
                setCode: setCode.trim(),
                number: collectorNumber.trim(),
                lang: scryfallData?.lang || 'en',
                finish: 'nonfoil',
                imageUrl: imageUrl
              };
              
              await cardRepository.add(cardRecord);
            }
            
            // Add card to collection (holdings)
            const existingHoldings = await holdingRepository.getByCardId(cardId);
            const totalOwned = existingHoldings.reduce((sum, holding) => sum + holding.quantity, 0);
            
            if (totalOwned < quantity) {
              const neededQuantity = quantity - totalOwned;
              
              const holding = {
                id: `holding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                cardId: cardId,
                quantity: neededQuantity,
                unitCost: 0,
                source: 'deck_import',
                condition: 'unknown',
                language: 'en',
                foil: false,
                createdAt: new Date()
              };
              
              await holdingRepository.add(holding);
            }
          }
          
          // Create deck card record
          const deckCard = {
            deckId,
            cardId: cardId || '',
            quantity,
            role: 'main' as const
          };
          
          // Save deck card (use put instead of add to handle updates)
          await db.deck_cards.put(deckCard);
        }
      }
    }
    
    showStatus('success', `Successfully imported deck: ${deckName.value}`);
    
    // Reset form
    deckName.value = '';
    decklist.value = '';
  } catch (error) {
    console.error('Error importing deck:', error);
    showStatus('error', 'Failed to import deck: ' + (error as Error).message);
  } finally {
    isImporting.value = false;
    importProgress.value = null;
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

.progress-container {
  margin-bottom: var(--space-lg);
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-xs);
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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