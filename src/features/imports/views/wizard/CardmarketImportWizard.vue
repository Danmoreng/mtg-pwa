<template>
  <div class="cardmarket-wizard">
    <h1>Cardmarket Import Wizard</h1>
    
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
    <div class="wizard-content">
      <!-- File Upload Step -->
      <div v-if="currentStep === 0" class="step-content">
        <h2>Upload CSV Files</h2>
        <p>Please select all Cardmarket CSV export files to import. You can select multiple files at once.</p>
        
        <div class="file-upload-section">
          <div class="file-upload">
            <label for="csv-files" class="file-label">
              Choose CSV Files
            </label>
            <input 
              id="csv-files" 
              type="file" 
              accept=".csv"
              multiple
              @change="handleFileUpload"
              class="file-input"
            />
          </div>
          
          <div v-if="uploadedFiles.length > 0" class="files-info">
            <h3>Uploaded Files</h3>
            <ul class="file-list">
              <li v-for="file in uploadedFiles" :key="file.name" class="file-item">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-type">({{ getFileType(file.name) }})</span>
                <span class="file-size">- {{ formatFileSize(file.size) }}</span>
              </li>
            </ul>
          </div>
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
        
        <div v-for="(fileType, fileTypeKey) in fileTypes" :key="fileTypeKey" class="file-preview">
          <h3>{{ getFileTypeName(fileType) }}</h3>
          
          <div v-if="parsedData[fileType] && parsedData[fileType].length > 0" class="preview-stats">
            <div class="stat">
              <div class="stat-value">{{ parsedData[fileType].length }}</div>
              <div class="stat-label">Total Rows</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ getValidRows(parsedData[fileType], fileType).length }}</div>
              <div class="stat-label">Valid Rows</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ getInvalidRows(parsedData[fileType], fileType).length }}</div>
              <div class="stat-label">Invalid Rows</div>
            </div>
          </div>
          
          <div v-if="parsedData[fileType] && parsedData[fileType].length > 0" class="preview-table-container">
            <h4>Valid Data Preview</h4>
            <div class="preview-table-wrapper">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th v-if="fileType === 'transactions'">Reference</th>
                    <th v-else>Line</th>
                    <th>Date</th>
                    <th v-if="fileType.includes('articles')">Card Name</th>
                    <th v-if="fileType.includes('articles')">Expansion</th>
                    <th v-if="fileType.includes('articles')">Price</th>
                    <th v-if="fileType.includes('articles')">Quantity</th>
                    <th v-if="fileType.includes('articles')">Order ID</th>
                    <th v-if="fileType.includes('orders')">Order ID</th>
                    <th v-if="fileType.includes('orders')">Username</th>
                    <th v-if="fileType.includes('orders')">Article Count</th>
                    <th v-if="fileType.includes('orders')">Merchandise Value</th>
                    <th v-if="fileType === 'transactions'">Category</th>
                    <th v-if="fileType === 'transactions'">Type</th>
                    <th v-if="fileType === 'transactions'">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in getValidRows(parsedData[fileType], fileType).slice(0, 5)" :key="index">
                    <td v-if="fileType === 'transactions'">{{ row.reference }}</td>
                    <td v-else>{{ row.lineNumber }}</td>
                    <td>{{ row.date || row.dateOfPurchase }}</td>
                    <td v-if="fileType.includes('articles')">{{ row.name }}</td>
                    <td v-if="fileType.includes('articles')">{{ row.expansion }}</td>
                    <td v-if="fileType.includes('articles')">{{ formatCurrency(parseFloat(row.price.replace(/[€$£\s]/g, '').replace(',', '.')) * 100) }}</td>
                    <td v-if="fileType.includes('articles')">{{ row.amount }}</td>
                    <td v-if="fileType.includes('articles')">{{ row.shipmentId }}</td>
                    <td v-if="fileType.includes('orders')">{{ row.orderId }}</td>
                    <td v-if="fileType.includes('orders')">{{ row.username }}</td>
                    <td v-if="fileType.includes('orders')">{{ row.articleCount }}</td>
                    <td v-if="fileType.includes('orders')">{{ formatCurrency(parseFloat(row.merchandiseValue.replace(/[€$£\s]/g, '').replace(',', '.')) * 100) }}</td>
                    <td v-if="fileType === 'transactions'">{{ row.category }}</td>
                    <td v-if="fileType === 'transactions'">{{ row.type }}</td>
                    <td v-if="fileType === 'transactions'">{{ formatCurrency(parseFloat(row.amount.replace(/[€$£\s]/g, '').replace(',', '.')) * 100) }}</td>
                  </tr>
                  <tr v-if="getValidRows(parsedData[fileType], fileType).length > 5">
                    <td :colspan="getPreviewColumnCount(fileType)" class="more-rows-cell">
                      ... and {{ getValidRows(parsedData[fileType], fileType).length - 5 }} more rows
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div v-if="getInvalidRows(parsedData[fileType], fileType).length > 0" class="invalid-rows-section">
            <h4>Invalid Rows</h4>
            <p>The following rows have issues and will be skipped:</p>
            
            <div class="invalid-rows">
              <div 
                v-for="(row, index) in getInvalidRows(parsedData[fileType], fileType).slice(0, 3)" 
                :key="index"
                class="invalid-row"
              >
                <div class="row-number">Row {{ row.row.lineNumber || row.row.reference }}</div>
                <div class="row-errors">{{ row.errors.join(', ') }}</div>
              </div>
              <div v-if="getInvalidRows(parsedData[fileType], fileType).length > 3" class="more-rows">
                ... and {{ getInvalidRows(parsedData[fileType], fileType).length - 3 }} more rows
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Conflicts Step -->
      <div v-else-if="currentStep === 2" class="step-content">
        <h2>Resolve Conflicts</h2>
        <p>Check for duplicate imports and resolve any conflicts.</p>
        
        <div v-for="(fileType, fileTypeKey) in fileTypes" :key="fileTypeKey" class="file-conflicts">
          <h3>{{ getFileTypeName(fileType) }}</h3>
        </div>
      </div>
      
      <!-- Summary Step -->
      <div v-else-if="currentStep === 3" class="step-content">
        <h2>Import Summary</h2>
        <p>Review the import summary before finalizing.</p>
        
        <div v-for="(fileType, fileTypeKey) in fileTypes" :key="fileTypeKey" class="file-summary">
          <h3>{{ getFileTypeName(fileType) }}</h3>
          
          <div class="summary-stats">
            <div class="stat">
              <div class="stat-value">{{ getNewRecords(fileType).length }}</div>
              <div class="stat-label">New Records</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ getInvalidRows(parsedData[fileType] || [], fileType).length }}</div>
              <div class="stat-label">Invalid Rows</div>
            </div>
          </div>
        </div>
        
        <div class="summary-details">
          <h3>Import Details</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Files Uploaded</div>
              <div class="summary-value">{{ uploadedFiles.length }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Rows Parsed</div>
              <div class="summary-value">{{ getTotalParsedRows() }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Valid Rows</div>
              <div class="summary-value">{{ getTotalValidRows() }}</div>
            </div>
          </div>
        </div>
        
        <div v-if="importStatus" class="import-status" :class="importStatus.type">
          {{ importStatus.message }}
        </div>
      </div>
    </div>
    
    <!-- Wizard Navigation -->
    <div class="wizard-navigation">
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
        class="btn btn-primary"
        :disabled="!canProceed"
      >
        Next
      </button>
      
      <button 
        v-if="currentStep === steps.length - 1" 
        @click="startImport"
        class="btn btn-primary"
        :disabled="isImporting"
      >
        {{ isImporting ? 'Importing...' : 'Import Data' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// Worker for parsing Cardmarket CSV files
import CardmarketCsvWorker from '../../../../workers/cardmarketCsv?worker';
// Import service for handling data imports
import { ImportService } from '../../ImportService';

// Wizard steps
const steps = [
  { key: 'upload', title: 'Upload' },
  { key: 'preview', title: 'Preview' },
  { key: 'conflicts', title: 'Conflicts' },
  { key: 'summary', title: 'Summary' }
];

// Current step
const currentStep = ref(0);

// File information
const uploadedFiles = ref<File[]>([]);
const fileContents = ref<Record<string, string>>({});
const fileTypes = ref<Record<string, string>>({});

// Parsed data for each file type
const parsedData = ref<Record<string, any[]>>({});

// Errors
const errors = ref<string[]>([]);

// Import status
const importStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const isImporting = ref(false);

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
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount / 100); // Convert from cents
};

// Handle file upload
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) return;
  
  // Reset errors
  errors.value = [];
  
  // Store file info
  uploadedFiles.value = Array.from(files);
  
  try {
    // Read all file contents
    for (const file of uploadedFiles.value) {
      // Check file type
      if (!file.name.endsWith('.csv')) {
        errors.value.push(`File ${file.name} is not a CSV file.`);
        continue;
      }
      
      // Read file content
      const content = await file.text();
      fileContents.value[file.name] = content;
      
      // Determine file type based on file name
      fileTypes.value[file.name] = getFileType(file.name);
    }
    
    // Auto-detect and parse all CSV files
    await autoDetectAndParse();
  } catch (error) {
    errors.value.push('Failed to read the files: ' + (error as Error).message);
  }
};

// Auto-detect CSV format and parse data automatically using worker
const autoDetectAndParse = async () => {
  try {
    // Reset parsed data
    parsedData.value = {};
    
    // Process each file
    for (const [fileName, content] of Object.entries(fileContents.value)) {
      const fileType = fileTypes.value[fileName];
      
      // Skip unknown file types
      if (fileType === 'unknown') {
        console.warn(`Skipping unknown file type: ${fileName}`);
        continue;
      }
      
      // Create worker instance
      const worker = new CardmarketCsvWorker();
      
      // Determine parse type and direction based on file type
      let parseType = '';
      let direction: 'sale' | 'purchase' = 'sale';
      
      switch (fileType) {
        case 'transactions':
          parseType = 'parseTransactions';
          break;
        case 'sold-orders':
          parseType = 'parseOrders';
          direction = 'sale';
          break;
        case 'purchased-orders':
          parseType = 'parseOrders';
          direction = 'purchase';
          break;
        case 'sold-articles':
          parseType = 'parseArticles';
          direction = 'sale';
          break;
        case 'purchased-articles':
          parseType = 'parseArticles';
          direction = 'purchase';
          break;
      }
      
      // Parse CSV using worker
      worker.postMessage({
        type: parseType,
        data: content,
        direction: direction
      });
      
      // Wait for worker response
      const result = await new Promise<any>((resolve, reject) => {
        worker.onmessage = (e) => {
          const { type, result, error } = e.data;
          // Use the type variable to avoid TypeScript error
          console.log('Worker response type:', type);
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }
        };
        
        worker.onerror = (error) => {
          reject(error);
        };
      });
      
      // Store parsed data by file type
      parsedData.value[fileType] = result;
      
      // Clean up worker
      worker.terminate();
    }
  } catch (error) {
    errors.value.push('Failed to parse CSV data: ' + (error as Error).message);
  }
};

// No longer needed since we auto-detect format

// Validate current step
const canProceed = computed(() => {
  // File upload step
  if (currentStep.value === 0) {
    return uploadedFiles.value.length > 0 && errors.value.length === 0;
  }
  
  // Other steps can proceed
  return true;
});

// Navigate to next step
const nextStep = async () => {
  // Validate current step before proceeding
  if (!canProceed.value) return;
  
  // Perform step-specific actions
  if (currentStep.value === 0) {
    // File upload step - auto-detect and parse CSV data
    await autoDetectAndParse();
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
  importStatus.value = null;
  
  try {
    // Import data for each file type
    for (const [fileType, rows] of Object.entries(parsedData.value)) {
      if (!rows || rows.length === 0) continue;
      
      // Filter out invalid rows
      const validRows = getValidRows(rows, fileType);
      
      // Import based on file type
      switch (fileType) {
        case 'transactions':
          await ImportService.importCardmarketTransactions(validRows);
          break;
        case 'sold-orders':
        case 'purchased-orders':
          await ImportService.importCardmarketOrders(validRows);
          break;
        case 'sold-articles':
        case 'purchased-articles':
          await ImportService.importCardmarketArticles(validRows);
          break;
      }
    }
    
    importStatus.value = {
      type: 'success',
      message: 'Successfully imported all data'
    };
  } catch (error) {
    importStatus.value = {
      type: 'error',
      message: 'Failed to import data: ' + (error as Error).message
    };
  } finally {
    isImporting.value = false;
  }
};

// Get new records for a file type
const getNewRecords = (fileType: string): any[] => {
  // In a real implementation, this would filter out duplicates
  // For now, we'll return all valid rows
  return getValidRows(parsedData.value[fileType] || [], fileType);
};

// Get total parsed rows across all file types
const getTotalParsedRows = (): number => {
  return Object.values(parsedData.value).reduce((total, rows) => total + (rows?.length || 0), 0);
};

// Get total valid rows across all file types
const getTotalValidRows = (): number => {
  let total = 0;
  for (const [fileType, rows] of Object.entries(parsedData.value)) {
    if (rows) {
      total += getValidRows(rows, fileType).length;
    }
  }
  return total;
};

// Check if a date is valid
const isValidDate = (dateStr: string): boolean => {
  // Try to parse as DD.MM.YYYY HH:MM:SS
  if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const dateParts = datePart.split('.');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(dateParts[2], 10);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  }
  
  // Try to parse as DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  }
  
  // Try to parse as YYYY-MM-DD HH:MM:SS
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
  
  // Try to parse as YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
  
  return false;
};

// Check if a price is valid
const isValidPrice = (priceStr: string): boolean => {
  // Remove currency symbols and spaces
  const cleanPrice = priceStr.replace(/[€$£\s]/g, '').replace(',', '.');
  return !isNaN(parseFloat(cleanPrice));
};

// Check if a quantity is valid
const isValidQuantity = (quantityStr: string): boolean => {
  const quantity = parseInt(quantityStr, 10);
  return !isNaN(quantity) && quantity > 0;
};

// Get file type name for display
function getFileTypeName(fileType: string) {
  switch (fileType) {
    case 'transactions': return 'Transaction Summary';
    case 'sold-orders': return 'Sold Orders';
    case 'purchased-orders': return 'Purchased Orders';
    case 'sold-articles': return 'Sold Articles';
    case 'purchased-articles': return 'Purchased Articles';
    default: return 'Unknown File Type';
  }
};

// Get preview column count for table colspan
const getPreviewColumnCount = (fileType: string): number => {
  switch (fileType) {
    case 'transactions': return 5;
    case 'sold-orders':
    case 'purchased-orders': return 6;
    case 'sold-articles':
    case 'purchased-articles': return 7;
    default: return 5;
  }
};

// Validate a single row of data
const validateRow = (row: any, fileType: string): string[] => {
  const errors: string[] = [];
  
  // Common validation for all file types
  if (!row.date && !row.dateOfPurchase) {
    errors.push('Date is required');
  } else {
    const dateValue = row.date || row.dateOfPurchase;
    if (!isValidDate(dateValue)) {
      errors.push('Invalid date format (expected DD.MM.YYYY or YYYY-MM-DD)');
    }
  }
  
  // File type specific validation
  if (fileType.includes('articles')) {
    if (!row.name) {
      errors.push('Card name is required');
    }
    
    if (!row.expansion) {
      errors.push('Expansion/Set is required');
    }
    
    if (!row.price) {
      errors.push('Price is required');
    } else if (!isValidPrice(row.price)) {
      errors.push('Invalid price format (expected numeric value)');
    }
    
    if (!row.amount) {
      errors.push('Quantity is required');
    } else if (!isValidQuantity(row.amount)) {
      errors.push('Invalid quantity (expected positive integer)');
    }
    
    if (!row.shipmentId) {
      errors.push('Order ID is required');
    }
  } else if (fileType.includes('orders')) {
    if (!row.dateOfPurchase) {
      errors.push('Date is required');
    } else if (!isValidDate(row.dateOfPurchase)) {
      errors.push('Invalid date format (expected DD.MM.YYYY or YYYY-MM-DD)');
    }
    
    if (!row.orderId) {
      errors.push('Order ID is required');
    }
    
    if (!row.articleCount) {
      errors.push('Article count is required');
    } else if (!isValidQuantity(row.articleCount)) {
      errors.push('Invalid article count (expected positive integer)');
    }
    
    if (!row.merchandiseValue) {
      errors.push('Merchandise value is required');
    } else if (!isValidPrice(row.merchandiseValue)) {
      errors.push('Invalid merchandise value format (expected numeric value)');
    }
  } else if (fileType === 'transactions') {
    if (!row.reference) {
      errors.push('Reference is required');
    }
    
    if (!row.amount) {
      errors.push('Amount is required');
    } else if (!isValidPrice(row.amount)) {
      errors.push('Invalid amount format (expected numeric value)');
    }
    
    if (!row.category) {
      errors.push('Category is required');
    }
    
    if (!row.type) {
      errors.push('Type is required');
    }
  }
  
  return errors;
};

// Get valid rows for a file type
const getValidRows = (rows: any[], fileType: string = 'articles'): any[] => {
  return rows.filter(row => validateRow(row, fileType).length === 0);
};

// Get invalid rows for a file type
const getInvalidRows = (rows: any[], fileType: string = 'articles'): any[] => {
  return rows
    .map((row, index) => ({
      index,
      row,
      errors: validateRow(row, fileType)
    }))
    .filter(item => item.errors.length > 0);
};

// Get file type based on file name
const getFileType = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (name.includes('transaction')) return 'transactions';
  if (name.includes('sold orders')) return 'sold-orders';
  if (name.includes('purchased orders')) return 'purchased-orders';
  if (name.includes('sold articles')) return 'sold-articles';
  if (name.includes('purchased articles')) return 'purchased-articles';
  return 'unknown';
};
</script>

<style scoped>
.cardmarket-wizard {
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
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-md);
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

.file-label {
  display: block;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
  transition: background-color 0.2s;
  max-width: 200px;
}

.file-label:hover {
  background: var(--color-primary-dark);
}

.file-input {
  display: none;
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

.column-mapping {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.mapping-field {
  display: flex;
  flex-direction: column;
}

.mapping-field label {
  margin-bottom: var(--space-xs);
  font-weight: var(--font-weight-medium);
}

.mapping-field select {
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: white;
}

.mapping-field select.error {
  border-color: var(--color-error);
}

.mapping-actions {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.mapping-actions .btn {
  flex: 1;
}

.mapping-actions {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.mapping-actions .btn {
  flex: 1;
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
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

.invalid-rows,
.duplicates {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.invalid-row,
.duplicate {
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

.duplicate-info {
  flex: 1;
}

.duplicate-name {
  font-weight: var(--font-weight-medium);
}

.duplicate-details {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.duplicate-action select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
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

.btn {
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-secondary-dark);
}
</style>