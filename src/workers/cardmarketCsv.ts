// Cardmarket CSV parser worker
// This worker will run in a separate thread to parse large CSV files without blocking the UI

// Type definitions for Cardmarket data
interface CardmarketTransaction {
  reference: string;
  date: string;
  category: string;
  type: string;
  counterpart: string;
  amount: string;
  currency: string;
  balanceAfter: string;
}

interface CardmarketOrder {
  orderId: string;
  dateOfPurchase: string;
  username: string;
  country: string;
  city: string;
  articleCount: string;
  merchandiseValue: string;
  shipmentCosts: string;
  commission: string;
  totalValue: string;
}

interface CardmarketArticle {
  shipmentId: string;
  dateOfPurchase: string;
  productId: string;
  name: string;
  expansion: string;
  category: string;
  amount: string;
  price: string;
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
      }
    }
    
    // Only add articles with a shipment ID
    if (article.shipmentId) {
      article.direction = direction;
      article.currency = 'EUR'; // Assume EUR for now
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