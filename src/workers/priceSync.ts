// Price sync worker
// This worker will periodically sync prices for cards in the collection

import { ScryfallProvider } from '../features/pricing/ScryfallProvider';
import { getDb } from '../data/init';

// Sync prices for all cards in the collection
async function syncPrices(): Promise<void> {
  try {
    const now = new Date();
    
    // Get all cards with Scryfall IDs
    const db = getDb();
    const cards = await db.cards.where('id').notEqual('').toArray();
    
    // Update prices for each card
    for (const card of cards) {
      try {
        // Get price from Scryfall
        const price = await ScryfallProvider.getPriceById(card.id);
        
        if (price) {
          // Create price point ID with date
          const dateStr = now.toISOString().split('T')[0];
          
          // Create price point
          const pricePoint = {
            id: `${card.id}:scryfall:nonfoil:${dateStr}`,
            cardId: card.id,
            provider: 'scryfall' as const,
            finish: 'nonfoil' as const,
            date: dateStr,
            currency: 'EUR' as const,
            priceCent: price.getCents(),
            asOf: new Date(),
            createdAt: now
          };
          
          // Save price point (use put instead of add to handle updates)
          const db = getDb();
          await db.price_points.put(pricePoint);
        }
      } catch (error) {
        console.error(`Error syncing price for card ${card.id}:`, error);
      }
    }
    
    // Send success message back to main thread
    self.postMessage({ type: 'pricesSynced', success: true });
  } catch (error) {
    console.error('Error syncing prices:', error);
    // Send error message back to main thread
    self.postMessage({ type: 'pricesSynced', success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

// Worker message handler
self.onmessage = function(e) {
  const { type } = e.data;
  
  switch (type) {
    case 'syncPrices':
      syncPrices();
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
  }
};

export {};