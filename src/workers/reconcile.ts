// Reconcile worker
// This worker will run the reconciler to match scans to lots and sells to lots

import { runReconciler } from '../features/scans/ReconcilerService';
import db from '../data/db';

// Run the reconciler for all identities
async function runReconcilerWorker(): Promise<void> {
  try {
    // Get all unique card identities from scans and transactions
    const scans = await db.scans.toArray();
    const transactions = await db.transactions.toArray();
    
    // Create a set of unique identities
    const identities = new Set<string>();
    const identityMap = new Map<string, { cardId?: string; fingerprint: string; finish: string; lang: string }>();
    
    // Process scans
    for (const scan of scans) {
      if (scan.cardFingerprint) {
        // Extract finish and language from cardFingerprint if possible, otherwise use defaults
        const fingerprintParts = scan.cardFingerprint.split(':');
        const finish = fingerprintParts.length > 3 ? fingerprintParts[3] : 'nonfoil';
        const lang = fingerprintParts.length > 2 ? fingerprintParts[2] : 'EN';
        
        const identityKey = `${scan.cardFingerprint}:${finish}:${lang}`;
        identities.add(identityKey);
        identityMap.set(identityKey, {
          cardId: scan.cardId,
          fingerprint: scan.cardFingerprint,
          finish: finish,
          lang: lang
        });
      }
    }
    
    // Process transactions
    for (const tx of transactions) {
      if (tx.cardId) {
        // Get the card to get its fingerprint info
        const card = await db.cards.get(tx.cardId);
        if (card) {
          // Extract finish and language from cardFingerprint if possible, otherwise use defaults
          const fingerprintParts = scan.cardFingerprint.split(':');
          const finish = fingerprintParts.length > 3 ? fingerprintParts[3] : 'nonfoil';
          const lang = fingerprintParts.length > 2 ? fingerprintParts[2] : 'EN';
          
          const identityKey = `${scan.cardFingerprint}:${finish}:${lang}`;
          identities.add(identityKey);
          identityMap.set(identityKey, {
            cardId: scan.cardId,
            fingerprint: scan.cardFingerprint,
            finish: finish,
            lang: lang
          });
        }
      }
    }
    
    // Run reconciler for each unique identity
    for (const identityKey of identities) {
      const identity = identityMap.get(identityKey);
      if (identity) {
        try {
          await runReconciler(identity);
        } catch (error) {
          console.error(`Error running reconciler for identity ${identityKey}:`, error);
        }
      }
    }
    
    // Send success message back to main thread
    self.postMessage({ type: 'reconcilerCompleted', success: true });
  } catch (error) {
    console.error('Error running reconciler:', error);
    // Send error message back to main thread
    self.postMessage({ type: 'reconcilerCompleted', success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

// Worker message handler
self.onmessage = function(e) {
  const { type } = e.data;
  
  switch (type) {
    case 'runReconciler':
      runReconcilerWorker();
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
  }
};

export {};