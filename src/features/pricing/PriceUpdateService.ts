// Price update service for syncing card prices
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import { getDb } from '../../data/init';
import { cardRepository } from '../../data/repos';
import { Money } from '../../core/Money';
import { PriceQueryService } from '../pricing/PriceQueryService';
import { ValuationEngine } from '../../features/analytics/ValuationEngine';

export class PriceUpdateService {
  // Batch size for price fetching
  private static readonly BATCH_SIZE = 75; // Scryfall recommends batches of 75 or less

  // Sync prices for all cards in the collection using batch fetching
  static async syncPrices(progressCallback?: (processed: number, total: number) => void): Promise<void> {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // Get all cards with Scryfall IDs
      const cards = await cardRepository.getAll();
      const totalCards = cards.length;
      
      // Keep track of processed cards for progress reporting
      let processedCards = 0;
      
      // Process cards in batches to improve performance
      for (let i = 0; i < cards.length; i += this.BATCH_SIZE) {
        // Get the current batch
        const batch = cards.slice(i, i + this.BATCH_SIZE);
        const batchIds = batch.map(card => card.id);
        
        try {
          // Get prices for the batch from Scryfall
          const priceResults = await ScryfallProvider.getPricesByIds(batchIds);
          
          // Process each price result
          for (const priceResult of priceResults) {
            for (const [cardId, prices] of Object.entries(priceResult)) {
              // Process regular (nonfoil) price
              if (prices.eur !== undefined) {
                const price = Money.parse(prices.eur.toString(), 'EUR');
                const finish = 'nonfoil';
                
                // Create price point ID with new format
                const pricePointId = `${cardId}:scryfall:${finish}:${dateStr}`;
                
                // Create price point
                const pricePoint = {
                  id: pricePointId,
                  cardId: cardId,
                  provider: 'scryfall' as const,
                  finish: finish as 'nonfoil' | 'foil',
                  date: dateStr,
                  currency: 'EUR' as const,
                  priceCent: price.getCents(),
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point (use put to update if exists)
                const db = getDb();
                await db.price_points.put(pricePoint);
              }
              
              // Process foil price if available
              if (prices.eur_foil !== undefined) {
                const price = Money.parse(prices.eur_foil.toString(), 'EUR');
                
                // Create price point ID with new format
                const pricePointId = `${cardId}:scryfall:foil:${dateStr}`;
                
                // Create price point
                const pricePoint = {
                  id: pricePointId,
                  cardId: cardId,
                  provider: 'scryfall' as const,
                  finish: 'foil' as const,
                  date: dateStr,
                  currency: 'EUR' as const,
                  priceCent: price.getCents(),
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point (use put to update if exists)
                const db = getDb();
                await db.price_points.put(pricePoint);
              }
              
              // Update processed cards count and report progress
              processedCards++;
              if (progressCallback) {
                progressCallback(processedCards, totalCards);
              }
            }
          }
        } catch (error) {
          console.error(`Error syncing prices for batch starting at index ${i}:`, error);
          // Continue with the next batch even if one fails
          // Still update progress for the cards in this batch
          for (let j = 0; j < batch.length; j++) {
            processedCards++;
            if (progressCallback) {
              progressCallback(processedCards, totalCards);
            }
          }
        }
      }
      
      // Create a valuation snapshot after successful price update
      try {
        await ValuationEngine.createValuationSnapshot();
        console.log('Valuation snapshot created after price update');
      } catch (error) {
        console.error('Error creating valuation snapshot after price update:', error);
      }
    } catch (error) {
      console.error('Error syncing prices:', error);
      throw error;
    }
  }

  // Sync prices for a specific card
  static async syncPriceForCard(cardId: string): Promise<void> {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // Get the card
      const card = await cardRepository.getById(cardId);
      if (!card) {
        console.warn(`Card with ID ${cardId} not found`);
        return;
      }
      
      // Get prices from Scryfall
      const priceResults = await ScryfallProvider.getPricesByIds([card.id]);
      
      if (priceResults.length > 0) {
        const priceResult = priceResults[0];
        const prices = priceResult[card.id];
        
        // Process regular (nonfoil) price
        if (prices.eur !== undefined) {
          const price = Money.parse(prices.eur.toString(), 'EUR');
          
          // Create price point ID with new format
          const pricePointId = `${card.id}:scryfall:nonfoil:${dateStr}`;
          
          // Create price point
          const pricePoint = {
            id: pricePointId,
            cardId: card.id,
            provider: 'scryfall' as const,
            finish: 'nonfoil' as const,
            date: dateStr,
            currency: 'EUR' as const,
            priceCent: price.getCents(),
            asOf: now,
            createdAt: now
          };
          
          // Save price point (use put to update if exists)
          const db = getDb();
          await db.price_points.put(pricePoint);
        }
        
        // Process foil price if available
        if (prices.eur_foil !== undefined) {
          const price = Money.parse(prices.eur_foil.toString(), 'EUR');
          
          // Create price point ID with new format
          const pricePointId = `${card.id}:scryfall:foil:${dateStr}`;
          
          // Create price point
          const pricePoint = {
            id: pricePointId,
            cardId: card.id,
            provider: 'scryfall' as const,
            finish: 'foil' as const,
            date: dateStr,
            currency: 'EUR' as const,
            priceCent: price.getCents(),
            asOf: now,
            createdAt: now
          };
          
          // Save price point (use put to update if exists)
          const db = getDb();
          await db.price_points.put(pricePoint);
        }
      }
    } catch (error) {
      console.error(`Error syncing price for card ${cardId}:`, error);
      throw error;
    }
  }

  // Check if we need to update prices (more than 24 hours since last update)
  static async needsPriceUpdate(): Promise<boolean> {
    try {
      // Get the most recent price point
      const db = getDb();
      const latestPricePoint = await db.price_points.orderBy('asOf').last();
      
      if (!latestPricePoint) {
        // No price points exist, so we need to update
        return true;
      }
      
      // Check if it's been more than 24 hours since the last update
      const now = new Date();
      const lastUpdate = new Date(latestPricePoint.asOf);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastUpdate >= 24;
    } catch (error) {
      console.error('Error checking if price update is needed:', error);
      // If we can't determine, assume we need an update
      return true;
    }
  }

  // Check if we need to update prices for a specific card
  static async needsPriceUpdateForCard(cardId: string): Promise<boolean> {
    try {
      // Use the new PriceQueryService to get the latest price respecting precedence
      const latestPrice = await PriceQueryService.getLatestPriceForCard(cardId);
      
      if (!latestPrice) {
        // No price points exist for this card, so we need to update
        return true;
      }
      
      // Check if it's been more than 24 hours since the last update
      const now = new Date();
      const lastUpdate = new Date(latestPrice.asOf);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastUpdate >= 24;
    } catch (error) {
      console.error(`Error checking if price update is needed for card ${cardId}:`, error);
      // If we can't determine, assume we need an update
      return true;
    }
  }

  // Get the latest price for a card respecting provider precedence
  static async getLatestPriceForCard(cardId: string): Promise<{ price: number; asOf: Date; provider: string } | null> {
    try {
      // Use the new PriceQueryService to get the latest price respecting precedence
      const latestPrice = await PriceQueryService.getLatestPriceForCard(cardId);
      
      if (!latestPrice) {
        return null;
      }
      
      return {
        price: latestPrice.price.getCents(),
        asOf: latestPrice.asOf,
        provider: latestPrice.provider
      };
    } catch (error) {
      console.error(`Error getting latest price for card ${cardId}:`, error);
      return null;
    }
  }
}