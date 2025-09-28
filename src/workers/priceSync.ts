// Price sync worker
// This worker will periodically sync prices for cards in the collection

import { ScryfallProvider } from '../features/pricing/ScryfallProvider';
import { getDb } from '../data/init';

// Sync prices for all cards in the collection
async function syncPrices(): Promise<void> {
  try {
    // Get all cards with Scryfall IDs
    const db = getDb();
    const cards = await db.cards.where('id').notEqual('').toArray();
    
    // Update prices for each card
    for (const card of cards) {
      try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const db = getDb();

        const prices = await ScryfallProvider.getPricesForCard(card.id);

        if (prices.nonfoil) {
            const pricePointId = `${card.id}:scryfall:nonfoil:${dateStr}`;
            const pricePoint = {
                id: pricePointId,
                cardId: card.id,
                provider: 'scryfall' as const,
                finish: 'nonfoil' as const,
                date: dateStr,
                currency: 'EUR' as const,
                priceCent: prices.nonfoil.getCents(),
                asOf: now,
                createdAt: now
            };
            await db.price_points.put(pricePoint);
        }

        if (prices.foil) {
            const pricePointId = `${card.id}:scryfall:foil:${dateStr}`;
            const pricePoint = {
                id: pricePointId,
                cardId: card.id,
                provider: 'scryfall' as const,
                finish: 'foil' as const,
                date: dateStr,
                currency: 'EUR' as const,
                priceCent: prices.foil.getCents(),
                asOf: now,
                createdAt: now
            };
            await db.price_points.put(pricePoint);
        }
        
        if (prices.etched) {
            const pricePointId = `${card.id}:scryfall:etched:${dateStr}`;
            const pricePoint = {
                id: pricePointId,
                cardId: card.id,
                provider: 'scryfall' as const,
                finish: 'etched' as const,
                date: dateStr,
                currency: 'EUR' as const,
                priceCent: prices.etched.getCents(),
                asOf: now,
                createdAt: now
            };
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