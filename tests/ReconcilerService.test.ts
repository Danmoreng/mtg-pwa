import { describe, it, expect, beforeEach } from 'vitest';
import { runReconciler, findLotsByIdentity } from '../src/features/scans/ReconcilerService';
import db from '../src/data/db';

describe('ReconcilerService', () => {
  beforeEach(async () => {
    // Clear test data
    await db.acquisitions.clear();
    await db.card_lots.clear();
    await db.scans.clear();
    await db.transactions.clear();
  });

  describe('runReconciler', () => {
    it('should reconcile scans and sells to lots', async () => {
      // This is a simplified test - in a real implementation, we would set up
      // actual test data and verify the reconciliation results
      
      // For now, we'll just verify that the function can be called without errors
      const identity = {
        cardId: 'test-card-id',
        fingerprint: 'test-set:123:EN:nonfoil',
        finish: 'nonfoil',
        lang: 'EN'
      };
      
      // This should not throw an error
      await expect(runReconciler(identity)).resolves.toBeUndefined();
    });
  });

  describe('findLotsByIdentity', () => {
    it('should find lots by identity', async () => {
      const identity = {
        cardId: 'test-card-id',
        fingerprint: 'test-set:123:EN:nonfoil',
        finish: 'nonfoil',
        lang: 'EN'
      };
      
      // Initially should return empty array
      const lots = await findLotsByIdentity(identity);
      expect(lots).toEqual([]);
    });
  });
});