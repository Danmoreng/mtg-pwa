// Reconcile worker
// This worker will run the reconciler to match scans to lots and sells to lots

import { runFullReconciler } from '../features/scans/ReconcilerService';
import { dbPromise } from '../data/init';

async function runReconcilerWorker(): Promise<void> {
  try {
    console.log('Reconciler worker: Starting...');
    await dbPromise; // Ensure DB is initialized in the worker context
    console.log('Reconciler worker: DB initialized, executing full reconciler...');
    await runFullReconciler();
    console.log('Reconciler worker: Full reconciler completed successfully');
    self.postMessage({ type: 'reconcilerCompleted', success: true });
  } catch (error) {
    console.error('Reconciler worker: Error running full reconciler:', error);
    self.postMessage({ type: 'reconcilerCompleted', success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

// Worker message handler
self.onmessage = function(e) {
  const { type } = e.data;
  
  console.log('Reconciler worker: Received message type:', type);
  switch (type) {
    case 'runReconciler':
      runReconcilerWorker();
      break;
    default:
      console.warn(`Reconciler worker: Unknown message type: ${type}`);
  }
};

export {};