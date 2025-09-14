// Cardmarket CSV parser worker
// This worker will run in a separate thread to parse large CSV files without blocking the UI

// Helper function to parse currency strings (e.g., "1,23 €") into numbers
function parseCurrency(value: string): number {
  if (!value) return 0;
  // Replace comma with period for decimal conversion, remove currency symbols and thousands separators
  const cleanedValue = value
    .replace(',', '.')
    .replace(/[^0-9.-]+/g, '');
  return parseFloat(cleanedValue);
}

// Type definitions for Cardmarket data
interface CardmarketTransaction {
  reference: string;
  date: string;
  category: string;
  type: string;
  counterpart: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  lineNumber: number;
}

// Type definitions for Cardmarket data
interface CardmarketTransaction {
  reference: string;
  date: string;
  category: string;
  type: string;
  counterpart: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  lineNumber: number;
}

interface CardmarketOrder {
  orderId: string;
  direction: 'sale' | 'purchase';
  merchandiseValue: number;  // Warenwert
  shipmentCosts: number;       // Versandkosten
  commission: number;         // Provision/Gebühren
  totalValue: number;         // Gesamtwert
  // ... other existing fields
  dateOfPurchase: string;
  username: string;
  country: string;
  city: string;
  articleCount: string;
  currency: string;
  lineNumber: number;
}

interface CardmarketArticle {
  shipmentId: string;
  dateOfPurchase: string;
  productId: string;
  name: string;
  expansion: string;
  category: string;
  amount: string;
  price: number;
  total: number;
  currency: string;
  comments: string;
  direction: 'sale' | 'purchase';
  lineNumber: number;
}



// Parse transactions CSV
function parseTransactionsCSV(csvText: string): CardmarketTransaction[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  const transactions: CardmarketTransaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';');
    const transaction: any = {};
    
    // Create a map of header to value for easier lookup
    const rowMap: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] ? values[j].trim() : '';
      rowMap[header] = value;
    }
    
    // Function to get value by trying multiple possible column names (case-insensitive)
    const getValue = (...keys: string[]): string => {
      for (const key of keys) {
        // Try exact match first
        if (rowMap[key] !== undefined && rowMap[key] !== '') {
          return rowMap[key];
        }
        // Try case-insensitive match
        const lowerKey = key.toLowerCase();
        for (const [header, value] of Object.entries(rowMap)) {
          if (header.toLowerCase() === lowerKey && value !== '') {
            return value;
          }
        }
      }
      return '';
    };
    
    // Extract values using flexible matching
    transaction.reference = getValue('Reference', 'Referenz', 'Transaktions-ID');
    transaction.date = getValue('Date', 'Datum', 'Date Paid', 'Date paid', 'Datum Paid');
    transaction.category = getValue('Category', 'Kategorie');
    transaction.type = getValue('Type', 'Typ');
    transaction.counterpart = getValue('Counterpart', 'Gegenpartei');
    transaction.amount = parseCurrency(getValue('Amount', 'Betrag'));
    transaction.balanceAfter = parseCurrency(getValue('Closing balance (EUR)', 'Balance After', 'Saldo danach (EUR)'));
    
    // Only add transactions with a reference
    if (transaction.reference) {
      transaction.lineNumber = i; // Add line number for idempotency
      transaction.currency = 'EUR'; // Assume EUR for now
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

// Parse orders CSV
function parseOrdersCSV(csvText: string, direction: 'sale' | 'purchase'): CardmarketOrder[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  const orders: CardmarketOrder[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';');
    const order: any = {};
    
    // Create a map of header to value for easier lookup
    const rowMap: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] ? values[j].trim() : '';
      rowMap[header] = value;
    }
    
    // Function to get value by trying multiple possible column names (case-insensitive)
    const getValue = (...keys: string[]): string => {
      for (const key of keys) {
        // Try exact match first
        if (rowMap[key] !== undefined && rowMap[key] !== '') {
          return rowMap[key];
        }
        // Try case-insensitive match
        const lowerKey = key.toLowerCase();
        for (const [header, value] of Object.entries(rowMap)) {
          if (header.toLowerCase() === lowerKey && value !== '') {
            return value;
          }
        }
      }
      return '';
    };
    
    // Extract values using flexible matching
    order.orderId = getValue('Order ID', 'OrderID', 'Bestellnummer');
    order.dateOfPurchase = getValue('Date of Purchase', 'Date', 'Date of payment', 'Kaufdatum', 'Zahlungsdatum');
    order.username = getValue('Username', 'Benutzername');
    order.country = getValue('Country', 'Land');
    order.city = getValue('City', 'Stadt');
    order.articleCount = getValue('Article Count', 'Items', 'Anzahl Artikel');
    order.merchandiseValue = parseCurrency(getValue('Merchandise Value', 'Warenwert'));
    order.shipmentCosts = parseCurrency(getValue('Shipment Costs', 'Versandkosten'));
    order.commission = parseCurrency(getValue('Commission', 'Trustee service fee', 'Provision'));
    order.totalValue = parseCurrency(getValue('Total Value', 'Gesamtwert'));
    
    // Only add orders with an ID
    if (order.orderId) {
      order.lineNumber = i; // Add line number for idempotency
      order.direction = direction;
      order.currency = 'EUR'; // Assume EUR for now
      orders.push(order);
    }
  }
  
  return orders;
}

// Parse articles CSV
function parseArticlesCSV(csvText: string, direction: 'sale' | 'purchase'): CardmarketArticle[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  const articles: CardmarketArticle[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';');
    const article: any = {};
    
    // Create a map of header to value for easier lookup
    const rowMap: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] ? values[j].trim() : '';
      rowMap[header] = value;
    }
    
    // Function to get value by trying multiple possible column names (case-insensitive)
    const getValue = (...keys: string[]): string => {
      for (const key of keys) {
        // Try exact match first
        if (rowMap[key] !== undefined && rowMap[key] !== '') {
          return rowMap[key];
        }
        // Try case-insensitive match
        const lowerKey = key.toLowerCase();
        for (const [header, value] of Object.entries(rowMap)) {
          if (header.toLowerCase() === lowerKey && value !== '') {
            return value;
          }
        }
      }
      return '';
    };
    
    // Extract values using flexible matching
    article.shipmentId = getValue('Shipment nr.', 'Shipment nr', 'Shipment ID', 'Order ID', 'Bestellnummer');
    article.dateOfPurchase = getValue('Date of purchase', 'Date');
    article.productId = getValue('Product ID', 'Produkt ID');
    article.name = getValue('Article', 'Artikel', 'Localized Product Name', 'Produktname');
    article.expansion = getValue('Expansion', 'Erweiterung');
    article.category = getValue('Category', 'Kategorie');
    article.amount = getValue('Amount', 'Anzahl');
    article.price = parseCurrency(getValue('Article Value', 'Price', 'Preis'));
    article.total = parseCurrency(getValue('Total'));
    article.currency = getValue('Currency');
    article.comments = getValue('Comments');
    
    // Only add articles with a shipment ID
    if (article.shipmentId) {
      article.lineNumber = i; // Add line number for idempotency
      article.direction = direction;
      if (!article.currency) {
        article.currency = 'EUR'; // Assume EUR for now
      }
      articles.push(article);
    }
  }
  
  return articles;
}

// Worker message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'parseTransactions':
        result = parseTransactionsCSV(data);
        break;
      case 'parseOrders':
        result = parseOrdersCSV(data, e.data.direction);
        break;
      case 'parseArticles':
        result = parseArticlesCSV(data, e.data.direction);
        break;
      default:
        throw new Error(`Unknown parse type: ${type}`);
    }
    
    // Send result back to main thread
    self.postMessage({ type, result });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({ type, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};