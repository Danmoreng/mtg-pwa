<template>
  <div class="manabox-wizard">
    <h1>ManaBox Import Wizard</h1>

    <!-- Wizard Progress -->
    <div class="wizard-progress">
      <div
          v-for="(step, index) in steps"
          :key="step.key"
          class="step"
          :class="{ active: currentStep === index, completed: index < currentStep }"
      >
        <div class="step-number">{{ index + 1 }}</div>
        <div class="step-label">{{ step.title }}</div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="card">
      <div class="card-body">
        <div class="wizard-content">
          <!-- File Upload Step -->
          <div v-if="currentStep === 0" class="step-content">
            <h2>Upload ManaBox CSV</h2>
            <p>Import your ManaBox scan data to track your physical collection.</p>

            <div class="mb-3">
              <label for="manabox-csv" class="form-label">
                Choose CSV File
              </label>
              <input
                  id="manabox-csv"
                  type="file"
                  accept=".csv"
                  @change="handleManaBoxFileUpload"
                  class="form-control"
              />
            </div>
            
            <!-- Box Price Input -->
            <div class="mb-3">
              <label for="box-price" class="form-label">
                Box Price (€)
              </label>
              <input
                  id="box-price"
                  type="number"
                  step="0.01"
                  v-model.number="boxPrice"
                  class="form-control"
                  placeholder="Enter the total price of the box"
              />
              <div class="form-text">
                Enter the total price paid for the entire box of cards (optional).
              </div>
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

            <div v-if="errors.length > 0" class="error-messages">
              <div v-for="error in errors" :key="error" class="error-message">
                {{ error }}
              </div>
            </div>
          </div>

          <!-- Preview Step -->
          <div v-else-if="currentStep === 1" class="step-content">
            <h2>Preview Data</h2>
            <p>Review the data that will be imported. Check for any issues before proceeding.</p>

            <div v-if="parsedRows.length > 0" class="preview-stats">
              <div class="stat">
                <div class="stat-value">{{ parsedRows.length }}</div>
                <div class="stat-label">Total Rows</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ validRows.length }}</div>
                <div class="stat-label">Valid Rows</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ invalidRows.length }}</div>
                <div class="stat-label">Invalid Rows</div>
              </div>
            </div>

            <div v-if="parsedRows.length > 0" class="preview-table-container">
              <h4>Valid Data Preview</h4>
              <div class="preview-table-wrapper">
                <table class="preview-table">
                  <thead>
                  <tr>
                    <th>Name</th>
                    <th>Expansion</th>
                    <th>Number</th>
                    <th>Language</th>
                    <th>Foil</th>
                    <th>Quantity</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="(row, index) in validRows.slice(0, 5)" :key="index">
                    <td>{{ row.name }}</td>
                    <td>{{ row.expansion }}</td>
                    <td>{{ row.number }}</td>
                    <td>{{ row.language }}</td>
                    <td>{{ row.foil ? 'Yes' : 'No' }}</td>
                    <td>{{ row.quantity }}</td>
                  </tr>
                  <tr v-if="validRows.length > 5">
                    <td :colspan="6" class="more-rows-cell">
                      ... and {{ validRows.length - 5 }} more rows
                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="invalidRows.length > 0" class="invalid-rows-section">
              <h4>Invalid Rows</h4>
              <p>The following rows have issues and will be skipped:</p>

              <div class="invalid-rows">
                <div
                    v-for="(item, index) in invalidRows.slice(0, 3)"
                    :key="index"
                    class="invalid-row"
                >
                  <div class="row-number">Row {{ index + 1 }}</div>
                  <div class="row-errors">{{ item.errors.join(', ') }}</div>
                </div>
                <div v-if="invalidRows.length > 3" class="more-rows">
                  ... and {{ invalidRows.length - 3 }} more rows
                </div>
              </div>
            </div>
          </div>

          <!-- Summary Step -->
          <div v-else-if="currentStep === 2" class="step-content">
            <h2>Import Summary</h2>
            <p>Review the import summary before finalizing.</p>

            <div class="summary-stats">
              <div class="stat">
                <div class="stat-value">{{ validRows.length }}</div>
                <div class="stat-label">Cards to Import</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ invalidRows.length }}</div>
                <div class="stat-label">Invalid Rows</div>
              </div>
              <div class="stat" v-if="boxPrice > 0">
                <div class="stat-value">{{ formatCurrency(boxPriceInCents) }}</div>
                <div class="stat-label">Box Price</div>
              </div>
            </div>

            <div class="summary-details">
              <h3>Import Details</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-label">File Uploaded</div>
                  <div class="summary-value">{{ uploadedFile?.name }}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Total Rows</div>
                  <div class="summary-value">{{ parsedRows.length }}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Valid Rows</div>
                  <div class="summary-value">{{ validRows.length }}</div>
                </div>
              </div>
            </div>

            <div v-if="importError" class="import-status error">
              {{ importError }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Wizard Navigation -->
    <div class="wizard-navigation pt-3">
      <button
          v-if="currentStep > 0"
          @click="previousStep"
          class="btn btn-secondary"
      >
        Previous
      </button>

      <button
          v-if="currentStep < steps.length - 1"
          @click="nextStep"
          class="btn btn-glass-primary"
          :disabled="!canProceed"
      >
        Next
      </button>

      <button
          v-if="currentStep === steps.length - 1"
          @click="startImport"
          class="btn btn-glass-primary"
          :disabled="isImporting"
      >
        {{ isImporting ? 'Importing...' : 'Import Data' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// Import service for handling data imports
import { ImportService } from '../../ImportService';
import * as ImportPipelines from '../../ImportPipelines';

// Wizard steps
const steps = [
  {key: 'upload', title: 'Upload'},
  {key: 'preview', title: 'Preview'},
  {key: 'summary', title: 'Summary'}
];

// Current step
const currentStep = ref(0);

// File information
const uploadedFile = ref<File | null>(null);
const fileContent = ref<string>('');
const boxPrice = ref<number>(0);

// Parsed data
const parsedRows = ref<ImportPipelines.ManaboxImportRow[]>([]);
const errors = ref<string[]>([]);

// Import status
const isImporting = ref(false);
const importError = ref<string | null>(null);

// Wizard steps
// Validate current step
const canProceed = computed(() => {
  if (currentStep.value === 0) {
    return uploadedFile.value !== null && errors.value.length === 0;
  }
  return true;
});

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount / 100); // Convert from cents
};

// Parse CSV - helper function to handle commas within quoted values
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

// Validate a single row of data
const validateRow = (row: any): string[] => {
  const errors: string[] = [];

  if (!row.name) {
    errors.push('Card name is required');
  }

  if (!row.expansion && !row.scryfallId) {
    errors.push('Either Expansion or Scryfall ID is required');
  }

  if (row.quantity && (typeof row.quantity !== 'number' || row.quantity <= 0)) {
    errors.push('Quantity must be a positive number');
  }

  return errors;
};

// Handle ManaBox file upload
const handleManaBoxFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  // Reset errors
  errors.value = [];

  // Store file info
  uploadedFile.value = file;

  try {
    // Read file content
    fileContent.value = await file.text();
    const lines = fileContent.value.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());

    // Parse rows according to ManaBox format
    const rows: ImportPipelines.ManaboxImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Handle potential comma within quoted values
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

      // Validate required fields and add to rows
      if (row.name && (row.expansion || row.scryfallId)) {
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
      errors.value.push('No valid rows found in the CSV file');
      return;
    }

    parsedRows.value = rows;
  } catch (error) {
    errors.value.push('Failed to read the file: ' + (error as Error).message);
  }
};

// Get valid rows
const validRows = computed(() => {
  return parsedRows.value.filter(row => validateRow(row).length === 0);
});

// Get invalid rows with errors
const invalidRows = computed(() => {
  return parsedRows.value
    .map((row, index) => ({
      index,
      row,
      errors: validateRow(row)
    }))
    .filter(item => item.errors.length > 0);
});

// Get box price in cents
const boxPriceInCents = computed(() => {
  return Math.round(boxPrice.value * 100);
});

// Navigate to next step
const nextStep = async () => {
  if (!canProceed.value) return;

  // Perform step-specific actions
  if (currentStep.value === 0) {
    // File upload step - parse and validate CSV data
    // This is already done in handleManaBoxFileUpload
  }

  if (currentStep.value < steps.length - 1) {
    currentStep.value++;
  }
};

// Navigate to previous step
const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

// Start import process
const startImport = async () => {
  if (isImporting.value) return;

  isImporting.value = true;
  importError.value = null;

  try {
    // Default box cost - using user input
    const boxCost: ImportPipelines.BoxCost = {
      price: boxPriceInCents.value,
      fees: 0,  // Box cost doesn't include fees
      shipping: 0  // Box cost doesn't include shipping
    };

    await ImportService.importManaboxScansWithBoxCost(
      validRows.value,
      boxCost,
      new Date(),
      'manabox',
      `manabox-import-${Date.now()}`
    );

    // Show success message in UI
    importError.value = 'Import completed successfully! Check the status indicator in the top right for details.';
    
    // Reset form after successful import
    setTimeout(() => {
      currentStep.value = 0;
      uploadedFile.value = null;
      fileContent.value = '';
      boxPrice.value = 0;
      parsedRows.value = [];
      errors.value = [];
      isImporting.value = false;
      importError.value = null;
    }, 3000);
  } catch (error) {
    importError.value = 'Failed to import data: ' + (error as Error).message;
    isImporting.value = false;
  }
};
</script>

<style scoped>
.manabox-wizard {
  padding: var(--space-lg);
  max-width: 1000px;
  margin: 0 auto;
}

.wizard-progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
  position: relative;
}

.wizard-progress::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-border);
  z-index: 1;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-xs);
}

.step-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.step.active .step-number {
  background: var(--color-primary);
  color: white;
}

.step.active .step-label {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.step.completed .step-number {
  background: var(--color-success);
  color: white;
}

.step.completed .step-label {
  color: var(--color-success);
}

.wizard-content {
  margin-bottom: var(--space-lg);
}

.step-content h2 {
  margin-top: 0;
}

.file-upload-section {
  margin-bottom: var(--space-lg);
}

.file-upload {
  margin-bottom: var(--space-md);
}

.file-info {
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-top: var(--space-md);
}

.file-info h3 {
  margin-top: 0;
}

.preview-table-container {
  margin: var(--space-lg) 0;
}

.preview-table-container h3 {
  margin-bottom: var(--space-sm);
}

.preview-table-wrapper {
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-md);
}

.preview-table th,
.preview-table td {
  padding: var(--space-sm);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.preview-table th {
  background: var(--color-background);
  font-weight: var(--font-weight-medium);
}

.preview-table tbody tr:hover {
  background: var(--color-background);
}

.more-rows-cell {
  text-align: center;
  font-style: italic;
  color: var(--color-text-secondary);
}

.summary-details {
  margin: var(--space-lg) 0;
}

.summary-grid {
  margin-top: var(--space-md);
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.summary-value {
  font-weight: var(--font-weight-medium);
}

.invalid-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.invalid-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm);
  background: var(--color-background);
  border-radius: var(--radius-md);
}

.row-number {
  font-weight: var(--font-weight-medium);
  min-width: 80px;
}

.row-errors {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.more-rows {
  text-align: center;
  padding: var(--space-sm);
  color: var(--color-text-secondary);
  font-style: italic;
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

.import-status {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
  text-align: center;
}

.import-status.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.import-status.error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.wizard-navigation {
  display: flex;
  justify-content: space-between;
}
</style>