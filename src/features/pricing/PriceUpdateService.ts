// Price update service for syncing card prices
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import db from '../../data/db';
import { cardRepository } from '../../data/repos';
import { pricePointRepository } from '../../data/repos';
import { Money } from '../../core/Money';

export class PriceUpdateService {
  // Batch size for price fetching
  private static readonly BATCH_SIZE = 75; // Scryfall recommends batches of 75 or less

  // Sync prices for all cards in the collection using batch fetching
  static async syncPrices(progressCallback?: (processed: number, total: number) => void): Promise<void> {
    try {
      const now = new Date();
      
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
              // Process regular (non-foil) price
              if (prices.eur !== undefined) {
                const price = Money.parse(prices.eur.toString(), 'EUR');
                
                // Create price point ID with date
                const dateStr = now.toISOString().split('T')[0];
                const pricePointId = `${cardId}:scryfall:${dateStr}`;
                
                // Create price point
                const pricePoint = {
                  id: pricePointId,
                  cardId: cardId,
                  provider: 'scryfall',
                  currency: price.getCurrency(),
                  price: price.getCents(),
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point (use put to update if exists)
                await db.price_points.put(pricePoint);
              }
              
              // Process foil price if available
              if (prices.eur_foil !== undefined) {
                const price = Money.parse(prices.eur_foil.toString(), 'EUR');
                
                // Create price point ID with date and foil indicator
                const dateStr = now.toISOString().split('T')[0];
                const pricePointId = `${cardId}:scryfall:${dateStr}:foil`;
                
                // Create price point
                const pricePoint = {
                  id: pricePointId,
                  cardId: cardId,
                  provider: 'scryfall',
                  currency: price.getCurrency(),
                  price: price.getCents(),
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point (use put to update if exists)
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
          processedCards += batch.length;
          if (progressCallback) {
            progressCallback(processedCards, totalCards);
          }
        }
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
      
      // Get the card
      const card = await cardRepository.getById(cardId);
      if (!card) {
        console.warn(`Card with ID ${cardId} not found`);
        return;
      }
      
      // Get price from Scryfall
      const price = await ScryfallProvider.getPriceById(card.id);
      
      if (price) {
        // Create price point ID with date
        const dateStr = now.toISOString().split('T')[0];
        const pricePointId = `${card.id}:scryfall:${dateStr}`;
        
        // Create price point
        const pricePoint = {
          id: pricePointId,
          cardId: card.id,
          provider: 'scryfall',
          currency: price.getCurrency(),
          price: price.getCents(),
          asOf: now,
          createdAt: now
        };
        
        // Save price point (use put to update if exists)
        await db.price_points.put(pricePoint);
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
      // Get the most recent price point for this card
      const pricePoints = await pricePointRepository.getByCardId(cardId);
      
      if (pricePoints.length === 0) {
        // No price points exist for this card, so we need to update
        return true;
      }
      
      // Sort by date descending to get the most recent price
      pricePoints.sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
      const latestPricePoint = pricePoints[0];
      
      // Check if it's been more than 24 hours since the last update
      const now = new Date();
      const lastUpdate = new Date(latestPricePoint.asOf);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastUpdate >= 24;
    } catch (error) {
      console.error(`Error checking if price update is needed for card ${cardId}:`, error);
      // If we can't determine, assume we need an update
      return true;
    }
  }

  // Get the latest price for a card
  static async getLatestPriceForCard(cardId: string): Promise<{ price: number; asOf: Date } | null> {
    try {
      const pricePoints = await pricePointRepository.getByCardId(cardId);
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Sort by date descending to get the most recent price
      pricePoints.sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
      const latestPricePoint = pricePoints[0];
      
      return {
        price: latestPricePoint.price,
        asOf: latestPricePoint.asOf
      };
    } catch (error) {
      console.error(`Error getting latest price for card ${cardId}:`, error);
      return null;
    }
  }
}