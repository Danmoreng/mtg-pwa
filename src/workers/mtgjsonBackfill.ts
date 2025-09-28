// MTGJSON Backfill Worker
// This worker processes MTGJSON AllPricesToday.json(.gz) files to backfill historical prices

import { getDb } from '../data/init';

// Process MTGJSON data and backfill historical prices
async function processMTGJSONBackfill(data: any, progressCallback?: (processed: number, total: number) => void): Promise<{ success: boolean; message?: string; processedPoints?: number }> {
  try {
    // Get all cards in the collection
    const db = getDb();
    const cards = await db.cards.toArray();
    
    // Keep track of processed points
    let processedPoints = 0;
    const totalCards = cards.length;
    
    // Process each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      
      // Check if we have data for this card in the MTGJSON file
      if (data.data && data.data[card.oracleId || '']) {
        const cardData = data.data[card.oracleId || ''];
        
        // Process paper prices from Cardmarket
        if (cardData.paper?.cardmarket) {
          const cmPrices = cardData.paper?.cardmarket;
          const now = new Date();
          
          // Process last 90 days of data
          const dates = Object.keys(cmPrices.retail?.normal || {}).sort().slice(-90);
          
          // Process regular (nonfoil) prices
          if (cmPrices.retail?.normal) {
            for (const date of dates) {
              const priceValue = cmPrices.retail.normal[date];
              if (priceValue !== null && priceValue !== undefined) {
                // Convert to cents (assuming MTGJSON provides prices in EUR)
                const priceCent = Math.round(priceValue * 100);
                
                // Create price point
                const pricePoint = {
                  id: `${card.id}:mtgjson.cardmarket:nonfoil:${date}`,
                  cardId: card.id,
                  provider: 'mtgjson.cardmarket' as const,
                  finish: 'nonfoil' as const,
                  date: date,
                  currency: 'EUR' as const,
                  priceCent: priceCent,
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point
                const db = getDb();
                await db.price_points.put(pricePoint);
                processedPoints++;
              }
            }
          }
          
          // Process foil prices
          if (cmPrices.retail?.foil) {
            for (const date of dates) {
              const priceValue = cmPrices.retail.foil[date];
              if (priceValue !== null && priceValue !== undefined) {
                // Convert to cents (assuming MTGJSON provides prices in EUR)
                const priceCent = Math.round(priceValue * 100);
                
                // Create price point
                const pricePoint = {
                  id: `${card.id}:mtgjson.cardmarket:foil:${date}`,
                  cardId: card.id,
                  provider: 'mtgjson.cardmarket' as const,
                  finish: 'foil' as const,
                  date: date,
                  currency: 'EUR' as const,
                  priceCent: priceCent,
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point
                const db = getDb();
                await db.price_points.put(pricePoint);
                processedPoints++;
              }
            }
          }
        }
      }
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, totalCards);
      }
    }
    
    return { success: true, processedPoints };
  } catch (error) {
    console.error('Error processing MTGJSON backfill:', error);
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// Worker message handler
self.onmessage = async function(e) {
  const { type, data, gzipped } = e.data;
  
  switch (type) {
    case 'processMTGJSONBackfill':
      try {
        let jsonData = data;
        
        // If the data is gzipped, we need to decompress it
        if (gzipped) {
          // For now, we'll assume the data is already decompressed by the main thread
          // In a real implementation, we would use a library like fflate to decompress
          console.warn('GZ decompression not implemented in worker - assuming data is already decompressed');
        } else if (typeof data === 'string') {
          // If it's a string, parse it as JSON
          jsonData = JSON.parse(data);
        }
        
        // Process the MTGJSON data
        const result = await processMTGJSONBackfill(jsonData, (processed, total) => {
          // Send progress updates back to main thread
          self.postMessage({ type: 'progress', processed, total });
        });
        
        // Send result back to main thread
        self.postMessage({ type: 'mtgjsonBackfillComplete', ...result });
      } catch (error) {
        console.error('Error in MTGJSON backfill worker:', error);
        self.postMessage({ 
          type: 'mtgjsonBackfillComplete', 
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