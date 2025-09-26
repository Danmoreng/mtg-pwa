<template>
  <div class=\"manabox-import\">
    <h2>ManaBox Scans Import</h2>
    <p>Import your ManaBox scan data to track your physical collection.</p>
    
    <div class=\"mb-3\">
      <label for=\"manabox-csv\" class=\"form-label\">
        Upload ManaBox CSV
      </label>
      <input 
        id=\"manabox-csv\" 
        type=\"file\" 
        accept=\".csv\" 
        @change=\"handleManaBoxFileUpload\"
        class=\"form-control\"
      />
    </div>
    
    <div v-if=\"importStatus\" class=\"status-message\" :class=\"importStatus.type\">
      {{ importStatus.message }}
    </div>
  </div>
</template>

<script setup lang=\"ts\">
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

// Handle ManaBox file upload
const handleManaBoxFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    // Parse rows according to ManaBox format
    const rows: ImportPipelines.ManaboxImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map(v => v.trim());
      if (values.length < headers.length) continue;
      
      const row: any = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        const value = values[j];
        
        switch (header) {
          case 'id':
            row.id = value;
            break;
          case 'name':
          case 'card name':
            row.name = value;
            break;
          case 'set':
          case 'expansion':
            row.expansion = value;
            break;
          case 'number':
          case 'card number':
            row.number = value;
            break;
          case 'language':
          case 'sprache':
            row.language = value || 'EN';
            break;
          case 'foil':
          case 'foil?':
            row.foil = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1';
            break;
          case 'quantity':
          case 'anzahl':
            row.quantity = parseInt(value) || 1;
            break;
          case 'scanned at':
          case 'gescannt am':
            row.scannedAt = new Date(value);
            break;
          case 'source':
            row.source = value || 'manabox';
            break;
          case 'external ref':
            row.externalRef = value;
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
          language: row.language || 'EN',
          foil: row.foil || false,
          quantity: row.quantity || 1,
          scannedAt: row.scannedAt || new Date(),
          source: row.source || 'manabox',
          externalRef: row.externalRef || `manabox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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