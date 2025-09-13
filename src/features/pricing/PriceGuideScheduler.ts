// PriceGuideScheduler handles scheduling of Price Guide sync operations
import { PriceGuideSyncWorker } from './PriceGuideSyncWorker';

export class PriceGuideScheduler {
  private static readonly SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private static timeoutId: number | null = null;
  
  // Schedule periodic Price Guide sync
  static schedulePeriodicSync(): void {
    // Clear any existing timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
    
    // Schedule the next sync
    this.timeoutId = window.setTimeout(async () => {
      try {
        console.log('Starting scheduled Price Guide sync');
        await PriceGuideSyncWorker.syncPriceGuide();
        console.log('Completed scheduled Price Guide sync');
      } catch (error) {
        console.error('Error during scheduled Price Guide sync:', error);
      } finally {
        // Schedule the next sync
        this.schedulePeriodicSync();
      }
    }, this.SYNC_INTERVAL);
  }
  
  // Check if we need to sync based on the last sync time
  static async needsSync(): Promise<boolean> {
    try {
      // In a real implementation, we would check the last sync time
      // For now, we'll just return true to indicate a sync is needed
      return true;
    } catch (error) {
      console.error('Error checking if Price Guide sync is needed:', error);
      // If we can't determine, assume we need a sync
      return true;
    }
  }
  
  // Perform a sync if needed
  static async syncIfNecessary(): Promise<void> {
    if (await this.needsSync()) {
      await PriceGuideSyncWorker.syncPriceGuide();
    }
  }
}