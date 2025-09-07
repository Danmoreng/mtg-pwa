<template>
  <div class="csv-import">
    <h1>Import CSV Files</h1>
    
    <div class="import-section">
      <h2>Cardmarket Data</h2>
      <p>Import your Cardmarket transaction data to track your purchases and sales.</p>
      
      <div class="mb-3">
        <label for="transactions-csv" class="form-label">
          Upload Transactions CSV
        </label>
        <input 
          id="transactions-csv" 
          type="file" 
          accept=".csv" 
          @change="handleTransactionsFileUpload"
          class="form-control"
        />
      </div>
      
      <div class="mb-3">
        <label for="orders-csv" class="form-label">
          Upload Orders CSV
        </label>
        <input 
          id="orders-csv" 
          type="file" 
          accept=".csv" 
          @change="handleOrdersFileUpload"
          class="form-control"
        />
      </div>
      
      <div class="mb-3">
        <label for="articles-csv" class="form-label">
          Upload Articles CSV
        </label>
        <input 
          id="articles-csv" 
          type="file" 
          accept=".csv" 
          @change="handleArticlesFileUpload"
          class="form-control"
        />
      </div>
    </div>
    
    <div class="import-section">
      <h2>ManaBox Scans</h2>
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
    </div>
    
    <div v-if="importStatus" class="status-message" :class="importStatus.type">
      {{ importStatus.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ImportService } from '../ImportService';

// Import status
const importStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Show status message
const showStatus = (type: 'success' | 'error', message: string) => {
  importStatus.value = { type, message };
  setTimeout(() => {
    importStatus.value = null;
  }, 5000);
};

// Handle transactions file upload
const handleTransactionsFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    const transactions: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(';');
      const transaction: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        const value = values[j] ? values[j].trim() : '';
        
        // Map different possible column names to standard properties
        switch (header) {
          case 'reference':
          case 'referenz':
          case 'transaktions-id':
            transaction.reference = value;
            break;
          case 'date':
          case 'datum':
          case 'date paid':
            transaction.date = value;
            break;
          case 'category':
          case 'kategorie':
            transaction.category = value;
            break;
          case 'type':
          case 'typ':
            transaction.type = value;
            break;
          case 'counterpart':
          case 'gegenpartei':
            transaction.counterpart = value;
            break;
          case 'amount':
          case 'betrag':
            transaction.amount = value;
            break;
          case 'closing balance (eur)':
          case 'balance after':
          case 'saldo danach (eur)':
            transaction.balanceAfter = value;
            break;
        }
      }
      
      // Only add transactions with a reference
      if (transaction.reference) {
        transaction.currency = 'EUR'; // Assume EUR for now
        transactions.push(transaction);
      }
    }
    
    // Import transactions
    await ImportService.importCardmarketTransactions(transactions);
    showStatus('success', `Successfully imported ${transactions.length} transactions`);
    
    // Reset file input
    target.value = '';
  } catch (error) {
    console.error('Error importing transactions:', error);
    showStatus('error', 'Failed to import transactions: ' + (error as Error).message);
  }
};

// Handle orders file upload
const handleOrdersFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    // Determine direction based on file name
    const fileName = file.name.toLowerCase();
    const direction = fileName.includes('purchased') ? 'purchase' : 'sale';
    
    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    const orders: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(';');
      const order: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        const value = values[j] ? values[j].trim() : '';
        
        // Map different possible column names to standard properties
        switch (header) {
          case 'order id':
          case 'orderid':
          case 'bestellnummer':
            order.orderId = value;
            break;
          case 'date of purchase':
          case 'date':
          case 'date of payment':
          case 'kaufdatum':
          case 'zahlungsdatum':
            order.dateOfPurchase = value;
            break;
          case 'username':
          case 'benutzername':
            order.username = value;
            break;
          case 'country':
          case 'land':
            order.country = value;
            break;
          case 'city':
          case 'stadt':
            order.city = value;
            break;
          case 'article count':
          case 'items':
          case 'anzahl artikel':
            order.articleCount = value;
            break;
          case 'merchandise value':
          case 'warenwert':
            order.merchandiseValue = value;
            break;
          case 'shipment costs':
          case 'versandkosten':
            order.shipmentCosts = value;
            break;
          case 'commission':
          case 'trustee service fee':
          case 'provision':
            order.commission = value;
            break;
          case 'total value':
          case 'gesamtwert':
            order.totalValue = value;
            break;
        }
      }
      
      // Only add orders with an ID
      if (order.orderId) {
        order.direction = direction;
        order.currency = 'EUR'; // Assume EUR for now
        orders.push(order);
      }
    }
    
    // Import orders
    await ImportService.importCardmarketOrders(orders);
    showStatus('success', `Successfully imported ${orders.length} ${direction} orders`);
    
    // Reset file input
    target.value = '';
  } catch (error) {
    console.error('Error importing orders:', error);
    showStatus('error', 'Failed to import orders: ' + (error as Error).message);
  }
};

// Handle articles file upload
const handleArticlesFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    // Determine direction based on file name
    const fileName = file.name.toLowerCase();
    const direction = fileName.includes('purchased') ? 'purchase' : 'sale';
    
    // Parse CSV file
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    const articles: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(';');
      const article: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        const value = values[j] ? values[j].trim() : '';
        
        // Map different possible column names to standard properties
        switch (header) {
          case 'shipment nr.':
          case 'shipment nr':
          case 'shipment id':
          case 'order id':
          case 'bestellnummer':
            article.shipmentId = value;
            break;
          case 'date of purchase':
          case 'date':
            article.dateOfPurchase = value;
            break;
          case 'product id':
          case 'produkt id':
            article.productId = value;
            break;
          case 'article':
          case 'artikel':
          case 'localized product name':
          case 'produktname':
            article.name = value;
            break;
          case 'expansion':
          case 'erweiterung':
            article.expansion = value;
            break;
          case 'category':
          case 'kategorie':
            article.category = value;
            break;
          case 'amount':
          case 'anzahl':
            article.amount = value;
            break;
          case 'article value':
          case 'price':
          case 'preis':
            article.price = value;
            break;
          case 'total':
            article.total = value;
            break;
          case 'currency':
            article.currency = value;
            break;
          case 'comments':
            article.comments = value;
            break;
        }
      }
      
      // Only add articles with a shipment ID
      if (article.shipmentId) {
        article.direction = direction;
        if (!article.currency) {
          article.currency = 'EUR'; // Assume EUR for now
        }
        articles.push(article);
      }
    }
    
    // Import articles
    await ImportService.importCardmarketArticles(articles);
    showStatus('success', `Successfully imported ${articles.length} ${direction} articles`);
    
    // Reset file input
    target.value = '';
  } catch (error) {
    console.error('Error importing articles:', error);
    showStatus('error', 'Failed to import articles: ' + (error as Error).message);
  }
};

// Handle ManaBox file upload
const handleManaBoxFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  showStatus('success', 'ManaBox import functionality would be implemented here');
  
  // Reset file input
  target.value = '';
};
</script>

<style scoped>
.csv-import {
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

.file-upload {
  margin-bottom: var(--space-md);
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