// Automatic price update service for syncing card prices with TTL and scheduling
import { PriceUpdateService } from './PriceUpdateService';
import { settingRepository } from '../../data/repos';

export class AutomaticPriceUpdateService {
  // Check if we need to update prices based on TTL (24 hours)
  static async needsPriceUpdate(): Promise<boolean> {
    try {
      // Get the last price update timestamp from settings
      const lastUpdateTimestamp = await settingRepository.get('last_price_update_timestamp');
      
      if (!lastUpdateTimestamp) {
        // No previous update, so we need to update
        return true;
      }
      
      // Check if it's been more than 24 hours since the last update
      const now = Date.now();
      const lastUpdate = new Date(lastUpdateTimestamp).getTime();
      const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);
      
      return hoursSinceLastUpdate >= 24;
    } catch (error) {
      console.error('Error checking if price update is needed:', error);
      // If we can't determine, assume we need an update
      return true;
    }
  }

  // Schedule a price update if needed
  static async schedulePriceUpdate(): Promise<void> {
    try {
      // Check if we need to update prices
      const needsUpdate = await this.needsPriceUpdate();
      
      if (needsUpdate) {
        // Perform the price update
        await this.updatePrices();
      }
    } catch (error) {
      console.error('Error scheduling price update:', error);
      throw error;
    }
  }

  // Update prices and record the update time
  static async updatePrices(): Promise<void> {
    try {
      // Perform the price update
      await PriceUpdateService.syncPrices();
      
      // Record the update time
      const now = new Date().toISOString();
      await settingRepository.set('last_price_update_timestamp', now);
      
      console.log(`Prices updated successfully at ${now}`);
    } catch (error) {
      console.error('Error updating prices:', error);
      throw error;
    }
  }

  // Get the last update time
  static async getLastUpdateTime(): Promise<Date | null> {
    try {
      const timestamp = await settingRepository.get('last_price_update_timestamp');
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('Error getting last update time:', error);
      return null;
    }
  }

  // Get the next scheduled update time (24 hours after last update)
  static async getNextUpdateTime(): Promise<Date | null> {
    try {
      const lastUpdate = await this.getLastUpdateTime();
      
      if (!lastUpdate) {
        // If no last update, next update is now
        return new Date();
      }
      
      // Next update is 24 hours after last update
      const nextUpdate = new Date(lastUpdate.getTime() + (24 * 60 * 60 * 1000));
      return nextUpdate;
    } catch (error) {
      console.error('Error calculating next update time:', error);
      return null;
    }
  }
}