// Cardmarket Price Guide Sync Worker
// This worker handles daily Cardmarket Price Guide ingestion in a background thread

import db from '../data/db';

// Process Cardmarket Price Guide data for all cards
async function syncPriceGuide(progressCallback?: (processed: number, total: number) => void): Promise<{ success: boolean; message?: string; processedCards?: number }> {
  try {
    console.log('Starting Cardmarket Price Guide sync...');
    
    // Get all cards in the collection
    const cards = await db.cards.toArray();
    const totalCards = cards.length;
    let processedCards = 0;
    
    console.log(`Found ${totalCards} cards to sync Price Guide data for`);
    
    // Process each card
    for (const card of cards) {
      processedCards++;
      if (progressCallback) {
        progressCallback(processedCards, totalCards);
      }
      
      try {
        // Process Price Guide data for this card
        await processCardPriceGuideData(card);
      } catch (error) {
        console.error(`Error processing Price Guide data for card ${card.id}:`, error);
        // Continue with other cards
      }
    }
    
    console.log(`Cardmarket Price Guide sync completed for ${processedCards} cards`);
    return { success: true, processedCards };
  } catch (error) {
    console.error('Error during Cardmarket Price Guide sync:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Process Price Guide data for a single card
async function processCardPriceGuideData(card: any): Promise<void> {
  try {
    // In a real implementation, we would:
    // 1. Fetch Price Guide data from Cardmarket API using product ID
    // 2. Extract the current price data and averages
    // 3. Create price points with the data
    
    // For now, we'll simulate the process
    if (!card.cardmarketId) {
      console.log(`Card ${card.name} has no Cardmarket product ID, skipping`);
      return;
    }
    
    // Generate simulated Price Guide data
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Create price point for current price
    const pricePoint = createPricePoint(
      card.id,
      currentDate,
      'nonfoil',
      Math.random() * 50 + 5, // Random price between 5-55 EUR
      'cardmarket.priceguide'
    );
    
    // Add average data if available
    if (Math.random() > 0.3) { // 70% chance of having average data
      pricePoint.avg1dCent = Math.round(pricePoint.priceCent * (0.95 + Math.random() * 0.1)); // ±5%
      pricePoint.avg7dCent = Math.round(pricePoint.priceCent * (0.9 + Math.random() * 0.2));  // ±10%
      pricePoint.avg30dCent = Math.round(pricePoint.priceCent * (0.85 + Math.random() * 0.3)); // ±15%
    }
    
    await db.price_points.put(pricePoint);
    
    // Occasionally create foil price point
    if (Math.random() > 0.7) { // 30% chance of having foil data
      const foilPricePoint = createPricePoint(
        card.id,
        currentDate,
        'foil',
        pricePoint.priceCent * 1.5, // Foil is typically 50% more expensive
        'cardmarket.priceguide'
      );
      
      // Add average data for foil
      foilPricePoint.avg1dCent = Math.round(foilPricePoint.priceCent * (0.95 + Math.random() * 0.1));
      foilPricePoint.avg7dCent = Math.round(foilPricePoint.priceCent * (0.9 + Math.random() * 0.2));
      foilPricePoint.avg30dCent = Math.round(foilPricePoint.priceCent * (0.85 + Math.random() * 0.3));
      
      await db.price_points.put(foilPricePoint);
    }
    
    console.log(`Processed Price Guide data for card ${card.name}`);
  } catch (error) {
    console.error(`Error processing Price Guide data for card ${card.id}:`, error);
    throw error;
  }
}

// Create a price point from raw data
function createPricePoint(
  cardId: string,
  date: string,
  finish: 'nonfoil' | 'foil' | 'etched',
  price: number,
  provider: 'cardmarket.priceguide'
): any {
  const pricePointId = `${cardId}:${provider}:${finish}:${date}`;
  
  return {
    id: pricePointId,
    cardId: cardId,
    provider: provider,
    finish: finish,
    date: date,
    currency: 'EUR',
    priceCent: Math.round(price * 100),
    asOf: new Date(),
    createdAt: new Date()
  };
}

// Worker message handler
self.onmessage = async function(e) {
  const { type } = e.data;
  
  switch (type) {
    case 'syncPriceGuide':
      try {
        // Process the Price Guide sync
        const result = await syncPriceGuide((processed, total) => {
          // Send progress updates back to main thread
          self.postMessage({ type: 'progress', processed, total });
        });
        
        // Send result back to main thread
        self.postMessage({ type: 'priceGuideSyncComplete', ...result });
      } catch (error) {
        console.error('Error in Price Guide sync worker:', error);
        self.postMessage({ 
          type: 'priceGuideSyncComplete', 
          success: false, 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
  }
};

export {};