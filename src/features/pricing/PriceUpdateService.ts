// Price update service for syncing card prices
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import db from '../../data/db';
import { cardRepository } from '../../data/repos';

export class PriceUpdateService {
  // Sync prices for all cards in the collection
  static async syncPrices(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all cards with Scryfall IDs
      const cards = await cardRepository.getAll();
      
      // Update prices for each card
      for (const card of cards) {
        try {
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
            
            // Save price point
            await db.price_points.put(pricePoint);
          }
        } catch (error) {
          console.error(`Error syncing price for card ${card.id}:`, error);
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
        
        // Save price point
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
}