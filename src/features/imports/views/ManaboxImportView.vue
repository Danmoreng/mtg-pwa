<template>
  <div class="manabox-import">
    <h2>ManaBox Scans Import</h2>
    <p>Import your ManaBox scan data to track your physical collection.</p>
    
    <div class="mb-3">
      <label for="manabox-csv" class="form-label">
        Upload ManaBox CSV
      </label>
      <input 
        id="manabox-csv" 
        type="file" 
        accept=".csv" 
        @change="handleManaBoxFileUpload"
        class="form-control"
      />
    </div>
    
    <div v-if="importStatus" class="status-message" :class="importStatus.type">
      {{ importStatus.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ImportService } from '../ImportService';
import * as ImportPipelines from '../ImportPipelines';

// Import status
const importStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Show status message
const showStatus = (type: 'success' | 'error', message: string) => {
  importStatus.value = { type, message };
  setTimeout(() => {
    importStatus.value = null;
  }, 5000);
};

// Helper function to parse CSV lines that may contain commas within quoted values
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Double quotes inside a quoted field are treated as a single quote
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle the inQuotes flag
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Comma outside quotes separates fields
      result.push(current);
      current = '';
    } else {
      // Add character to current field
      current += char;
    }
  }

  // Add the last field
  result.push(current);
  return result;
};

// Handle ManaBox file upload
const handleManaBoxFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse rows according to ManaBox format
    const rows: ImportPipelines.ManaboxImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Handle potential comma within quoted values using regex
      const values = parseCSVLine(line);
      if (values.length < headers.length) continue;
      
      const row: any = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        const value = values[j] ? values[j].trim() : '';
        
        switch (header) {
          case 'name':
            row.name = value;
            break;
          case 'set code':
          case 'set':
          case 'expansion':
            row.expansion = value;
            break;
          case 'collector number':
          case 'number':
          case 'card number':
            row.number = value;
            break;
          case 'language':
          case 'sprache':
            row.language = value || 'en';
            break;
          case 'foil':
            row.foil = value.toLowerCase() === 'foil' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
            break;
          case 'quantity':
          case 'qty':
          case 'anzahl':
            row.quantity = parseInt(value) || 1;
            break;
          case 'manabox id':
            row.id = value || `manabox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            break;
          case 'scryfall id':
            row.scryfallId = value;
            break;
          case 'condition':
            row.condition = value;
            break;
          case 'purchase price':
            row.purchasePrice = value;
            break;
          case 'misprint':
            row.misprint = value.toLowerCase() === 'true';
            break;
          case 'altered':
            row.altered = value.toLowerCase() === 'true';
            break;
          case 'purchase price currency':
            row.currency = value || 'EUR';
            break;
          case 'rarity':
            row.rarity = value;
            break;
        }
      }
      
      // Validate required fields
      if (row.name && row.expansion && row.number) {
        rows.push({
          id: row.id || `manabox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: row.name,
          expansion: row.expansion,
          number: row.number,
          language: row.language || 'en',
          foil: row.foil || false,
          quantity: row.quantity || 1,
          scannedAt: new Date(), // Using current date since the CSV doesn't have a scan date
          source: 'manabox',
          externalRef: `manabox-${row.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          scryfallId: row.scryfallId
        });
      }
    }
    
    if (rows.length === 0) {
      showStatus('error', 'No valid rows found in the CSV file');
      return;
    }
    
    // Default box cost - could be configurable in the future
    const boxCost: ImportPipelines.BoxCost = {
      price: 0, // Would need to be provided by user or calculated
      fees: 0,
      shipping: 0
    };
    
    await ImportService.importManaboxScansWithBoxCost(
      rows,
      boxCost,
      new Date(),
      'manabox',
      `manabox-import-${Date.now()}`
    );
    
    showStatus('success', `Successfully imported ${rows.length} ManaBox scans`);
  } catch (error) {
    console.error('Error importing ManaBox scans:', error);
    showStatus('error', 'Failed to import ManaBox scans: ' + (error as Error).message);
  }
  
  // Reset file input
  target.value = '';
};
</script>

<style scoped>
.manabox-import {
  padding: var(--space-lg);
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
