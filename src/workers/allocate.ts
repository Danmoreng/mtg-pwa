// Allocation worker
// This worker will run cost allocation for acquisitions

import { allocateAcquisitionCosts } from '../features/analytics/CostAllocationService';
import { getDb } from '../data/init';

// Run cost allocation for all acquisitions
async function runAllocationWorker(): Promise<void> {
  try {
    // Get all acquisitions
    const db = getDb();
    const acquisitions = await db.acquisitions.toArray();
    
    // Run allocation for each acquisition that has a method set
    for (const acquisition of acquisitions) {
      if (acquisition.allocationMethod) {
        try {
          await allocateAcquisitionCosts(
            acquisition.id,
            acquisition.allocationMethod,
            {
              provider: acquisition.allocationSourceRev ? acquisition.allocationSourceRev.split(':')[0] as any : undefined,
              date: acquisition.allocationAsOf ? acquisition.allocationAsOf.toISOString().split('T')[0] : undefined
            }
          );
        } catch (error) {
          console.error(`Error allocating costs for acquisition ${acquisition.id}:`, error);
        }
      }
    }
    
    // Send success message back to main thread
    self.postMessage({ type: 'allocationCompleted', success: true });
  } catch (error) {
    console.error('Error running allocation:', error);
    // Send error message back to main thread
    self.postMessage({ type: 'allocationCompleted', success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

// Worker message handler
self.onmessage = function(e) {
  const { type } = e.data;
  
  switch (type) {
    case 'runAllocation':
      runAllocationWorker();
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
  }
};

export {};