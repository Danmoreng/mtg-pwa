// Price Guide Sync Service
// This service handles the Cardmarket Price Guide sync process

import { WorkerManager } from '../../workers/WorkerManager';

export class PriceGuideSyncService {
  private static readonly WORKER_PATH = './priceGuideSync.ts';
  
  // Sync daily Cardmarket Price Guide data
  static async syncPriceGuide(
    progressCallback?: (processed: number, total: number) => void
  ): Promise<{ success: boolean; message?: string; processedCards?: number }> {
    try {
      // Create worker
      const worker = WorkerManager.createWorker(this.WORKER_PATH);
      
      // Return a promise that resolves when the worker completes
      return new Promise((resolve) => {
        // Handle messages from worker
        worker.onmessage = function(e) {
          const { type, ...result } = e.data;
          
          switch (type) {
            case 'progress':
              // Report progress
              if (progressCallback) {
                progressCallback(result.processed, result.total);
              }
              break;
              
            case 'priceGuideSyncComplete':
              // Clean up worker
              WorkerManager.terminateWorker(worker);
              // Resolve promise with result
              resolve(result);
              break;
              
            default:
              console.warn(`Unknown message type from Price Guide sync worker: ${type}`);
          }
        };
        
        // Handle worker errors
        worker.onerror = function(error) {
          console.error('Price Guide sync worker error:', error);
          WorkerManager.terminateWorker(worker);
          resolve({ 
            success: false, 
            message: error.message || 'Unknown error in Price Guide sync worker' 
          });
        };
        
        // Send sync command to worker
        worker.postMessage({ type: 'syncPriceGuide' });
      });
    } catch (error) {
      console.error('Error starting Price Guide sync process:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}