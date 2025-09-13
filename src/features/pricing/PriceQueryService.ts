// PriceQueryService handles querying price points with provider precedence
import db from '../../data/db';
import { pricePointRepository } from '../../data/repos';
import { Money } from '../../core/Money';

export class PriceQueryService {
  // Source precedence order (highest to lowest)
  private static readonly SOURCE_PRECEDENCE = [
    'cardmarket',  // Highest precedence
    'mtgjson',     // Within ~90 days
    'scryfall'               // Today only (lowest precedence)
  ];
  
  // Get the latest price for a card respecting source precedence
  static async getLatestPriceForCard(cardId: string): Promise<{ price: Money; asOf: Date; source: string } | null> {
    try {
      // Get all price points for this card
      const pricePoints = await pricePointRepository.getByCardId(cardId);
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Sort by precedence and date (most recent first)
      const sortedPricePoints = this.sortPricePointsByPrecedence(pricePoints);
      
      if (sortedPricePoints.length === 0) {
        return null;
      }
      
      // Return the highest precedence, most recent price point
      const latestPricePoint = sortedPricePoints[0];
      
      return {
        price: new Money(latestPricePoint.priceCent, latestPricePoint.currency),
        asOf: latestPricePoint.asOf,
        source: latestPricePoint.source
      };
    } catch (error) {
      console.error(`Error getting latest price for card ${cardId}:`, error);
      return null;
    }
  }
  
  // Get price points for a card with filtering options
  static async getPricePointsForCard(
    cardId: string,
    options?: {
      source?: string;
      finish?: 'nonfoil' | 'foil' | 'etched';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    try {
      let pricePoints = await pricePointRepository.getByCardId(cardId);
      
      // Apply filters
      if (options?.source) {
        pricePoints = pricePoints.filter(pp => pp.source === options.source);
      }
      
      if (options?.finish) {
        pricePoints = pricePoints.filter(pp => pp.finish === options.finish);
      }
      
      if (options?.startDate) {
        pricePoints = pricePoints.filter(pp => new Date(pp.asOf) >= options.startDate!);
      }
      
      if (options?.endDate) {
        pricePoints = pricePoints.filter(pp => new Date(pp.asOf) <= options.endDate!);
      }
      
      // Sort by precedence and date
      pricePoints = this.sortPricePointsByPrecedence(pricePoints);
      
      // Apply limit if specified
      if (options?.limit) {
        pricePoints = pricePoints.slice(0, options.limit);
      }
      
      return pricePoints;
    } catch (error) {
      console.error(`Error getting price points for card ${cardId}:`, error);
      return [];
    }
  }
  
  // Get price for a specific date respecting provider precedence
  static async getPriceForDate(
    cardId: string,
    date: Date
  ): Promise<{ price: Money; provider: string; finish: string } | null> {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      // Get all price points for this card on the specified date
      let pricePoints = await pricePointRepository.getByCardIdAndDate(cardId, dateString);
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Sort by precedence
      pricePoints = this.sortPricePointsByPrecedence(pricePoints);
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Return the highest precedence price point
      const pricePoint = pricePoints[0];
      
      return {
        price: new Money(pricePoint.priceCent, pricePoint.currency),
        source: pricePoint.source,
        finish: pricePoint.finish
      };
    } catch (error) {
      console.error(`Error getting price for card ${cardId} on date ${date.toISOString().split('T')[0]}:`, error);
      return null;
    }
  }
  
  // Get price for a specific date and finish respecting provider precedence
  static async getPriceForDateAndFinish(
    cardId: string,
    date: Date,
    finish: 'nonfoil' | 'foil' | 'etched'
  ): Promise<{ price: Money; provider: string } | null> {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      // Get all price points for this card on the specified date and finish
      let pricePoints = await db.price_points
        .where('[cardId+finish+date]')
        .equals([cardId, finish, dateString])
        .toArray();
      
      if (pricePoints.length === 0) {
        // If no exact finish match, try any finish
        pricePoints = await pricePointRepository.getByCardIdAndDate(cardId, dateString);
      }
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Sort by precedence
      pricePoints = this.sortPricePointsByPrecedence(pricePoints);
      
      if (pricePoints.length === 0) {
        return null;
      }
      
      // Return the highest precedence price point
      const pricePoint = pricePoints[0];
      
      return {
        price: new Money(pricePoint.priceCent, pricePoint.currency),
        provider: pricePoint.provider
      };
    } catch (error) {
      console.error(`Error getting price for card ${cardId} on date ${date.toISOString().split('T')[0]} with finish ${finish}:`, error);
      return null;
    }
  }
  
  // Sort price points by source precedence
  private static sortPricePointsByPrecedence(pricePoints: any[]): any[] {
    return pricePoints.sort((a, b) => {
      // First, sort by source precedence
      const sourceIndexA = this.SOURCE_PRECEDENCE.indexOf(a.source);
      const sourceIndexB = this.SOURCE_PRECEDENCE.indexOf(b.source);
      
      // If one source is not in our precedence list, put it last
      const precedenceA = sourceIndexA === -1 ? Infinity : sourceIndexA;
      const precedenceB = sourceIndexB === -1 ? Infinity : sourceIndexB;
      
      if (precedenceA !== precedenceB) {
        return precedenceA - precedenceB;
      }
      
      // If sources have the same precedence, sort by date (most recent first)
      return new Date(b.asOf).getTime() - new Date(a.asOf).getTime();
    });
  }
  
  // Get the source precedence rank
  static getSourcePrecedence(source: string): number {
    const index = this.SOURCE_PRECEDENCE.indexOf(source);
    return index === -1 ? Infinity : index;
  }
}