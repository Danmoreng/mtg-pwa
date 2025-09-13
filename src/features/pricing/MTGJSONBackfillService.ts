// MTGJSON Backfill Service
// This service handles the MTGJSON historical price backfill process

import { WorkerManager } from '../../workers/WorkerManager';

export class MTGJSONBackfillService {
  private static readonly WORKER_PATH = './mtgjsonBackfill.ts';
  
  // Process MTGJSON data and backfill historical prices
  static async processMTGJSONBackfill(
    data: any, 
    gzipped: boolean = false,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<{ success: boolean; message?: string; processedPoints?: number }> {
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
              
            case 'mtgjsonBackfillComplete':
              // Clean up worker
              WorkerManager.terminateWorker(worker);
              // Resolve promise with result
              resolve(result);
              break;
              
            default:
              console.warn(`Unknown message type from MTGJSON backfill worker: ${type}`);
          }
        };
        
        // Handle worker errors
        worker.onerror = function(error) {
          console.error('MTGJSON backfill worker error:', error);
          WorkerManager.terminateWorker(worker);
          resolve({ 
            success: false, 
            message: error.message || 'Unknown error in MTGJSON backfill worker' 
          });
        };
        
        // Send data to worker
        worker.postMessage({ 
          type: 'processMTGJSONBackfill', 
          data, 
          gzipped 
        });
      });
    } catch (error) {
      console.error('Error starting MTGJSON backfill process:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  // Process MTGJSON file from a File object
  static async processMTGJSONFile(
    file: File,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<{ success: boolean; message?: string; processedPoints?: number }> {
    try {
      // Check if file is gzipped
      const gzipped = file.name.endsWith('.gz');
      
      // Read file content
      const arrayBuffer = await file.arrayBuffer();
      
      // Parse JSON data
      let data;
      if (gzipped) {
        // For gzipped files, we need to decompress first
        // Note: In a real implementation, we would use a library like fflate to decompress
        // For now, we'll pass the raw data and let the worker handle it
        data = arrayBuffer;
      } else {
        // For regular JSON files, parse the content
        const text = new TextDecoder().decode(arrayBuffer);
        data = JSON.parse(text);
      }
      
      // Process the data
      return await this.processMTGJSONBackfill(data, gzipped, progressCallback);
    } catch (error) {
      console.error('Error processing MTGJSON file:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}