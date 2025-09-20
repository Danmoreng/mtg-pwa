// WorkerManager.ts
// Utility class for managing web workers

export class WorkerManager {
  // Create a worker from a path
  static createWorker(workerPath: string): Worker {
    // In a production build, the worker path will be different
    // We need to handle both development and production paths
    const isDev = (import.meta as any).env?.DEV || (globalThis as any).process?.env?.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, use the relative path
      return new Worker(new URL(workerPath, import.meta.url), { type: 'module' });
    } else {
      // In production, the worker will be bundled with a different path
      // This is a simplified approach - in a real app, you might need to handle this differently
      return new Worker(workerPath);
    }
  }
  
  // Terminate a worker
  static terminateWorker(worker: Worker): void {
    worker.terminate();
  }
  
  // Create a price sync worker
  static createPriceSyncWorker(): Worker {
    return this.createWorker('./priceSync.ts');
  }
  
  // Create a price guide sync worker
  static createPriceGuideSyncWorker(): Worker {
    return this.createWorker('./priceGuideSync.ts');
  }
  
  // Create a MTGJSON backfill worker
  static createMTGJSONBackfillWorker(): Worker {
    return this.createWorker('./mtgjsonBackfill.ts');
  }
  
  // Create a Cardmarket CSV worker
  static createCardmarketCsvWorker(): Worker {
    return this.createWorker('./cardmarketCsv.ts');
  }
  
  // Create a reconciler worker
  static createReconcilerWorker(): Worker {
    return this.createWorker('./reconcile.ts');
  }
  
  // Create an allocation worker
  static createAllocationWorker(): Worker {
    return this.createWorker('./allocate.ts');
  }
}