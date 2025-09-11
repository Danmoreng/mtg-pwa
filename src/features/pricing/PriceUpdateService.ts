// Price update service for syncing card prices
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import db from '../../data/db';
import { cardRepository } from '../../data/repos';
import { pricePointRepository } from '../../data/repos';

export class PriceUpdateService {
  // Sync prices for all cards in the collection
  static async syncPrices(progressCallback?: (processed: number, total: number) => void): Promise<void> {
    try {
      const now = new Date();
      
      // Get all cards with Scryfall IDs
      const cards = await cardRepository.getAll();
      const totalCards = cards.length;
      
      // Update prices for each card
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
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
            
            // Save price point (use put to update if exists)
            await db.price_points.put(pricePoint);
          }
        } catch (error) {
          console.error(`Error syncing price for card ${card.id}:`, error);
        }
        
        // Report progress if callback provided
        if (progressCallback) {
          progressCallback(i + 1, totalCards);
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