// Scan matching service for matching ManaBox scans to Cardmarket sales with lot tracking
import { getDb } from '../../data/init';
import { cardLotRepository } from '../../data/repos';
import type { Scan, Transaction, CardLot } from '../../data/db';

// Import the new reconciler service
import * as Reconciler from './ReconcilerService';

export class ScanMatchingService {
  // Match scans to sales with lot tracking
  static async matchScansToSales(): Promise<void> {
    // Run the full reconciler across all identities
    // This will handle both scan-to-lot and sell-to-lot reconciliation
    console.info('Running new M3 reconciler');
    await Reconciler.runFullReconciler();
    return;
  }

  // Get scan status (sold or still owned)
  static async getScanStatus(scanId: string): Promise<'sold' | 'owned' | 'unknown'> {
    try {
      const db = getDb();
      const scan = await db.scans.get(scanId);
      
      if (!scan) return 'unknown';
      
      if (scan.soldTransactionId) {
        return 'sold';
      }
      
      // Check if there are any sales after the scan date
      const laterSales = await db.transactions
        .where('kind')
        .equals('SELL')
        .and(tx => tx.happenedAt >= scan.scannedAt)
        .count();
      
      return laterSales > 0 ? 'sold' : 'owned';
    } catch (error) {
      console.error('Error getting scan status:', error);
      return 'unknown';
    }
  }

  // Get all scans for a specific lot
  static async getScansForLot(lotId: string): Promise<Scan[]> {
    try {
      const db = getDb();
      return await db.scans.where('lotId').equals(lotId).toArray();
    } catch (error) {
      console.error(`Error getting scans for lot ${lotId}:`, error);
      throw error;
    }
  }

  // Get all scans for a specific card
  static async getScansForCard(cardId: string): Promise<Scan[]> {
    try {
      const db = getDb();
      return await db.scans.where('cardId').equals(cardId).toArray();
    } catch (error) {
      console.error(`Error getting scans for card ${cardId}:`, error);
      throw error;
    }
  }

  // Get the lot associated with a scan
  static async getLotForScan(scanId: string): Promise<CardLot | undefined> {
    try {
      const db = getDb();
      const scan = await db.scans.get(scanId);
      if (scan?.lotId) {
        return await cardLotRepository.getById(scan.lotId);
      }
      return undefined;
    } catch (error) {
      console.error(`Error getting lot for scan ${scanId}:`, error);
      throw error;
    }
  }

  // Get all sales for a specific card
  static async getSalesForCard(cardId: string): Promise<Transaction[]> {
    try {
      const db = getDb();
      return await db.transactions
        .where('cardId')
        .equals(cardId)
        .and(tx => tx.kind === 'SELL')
        .toArray();
    } catch (error) {
      console.error(`Error getting sales for card ${cardId}:`, error);
      throw error;
    }
  }
  
  // Adapter methods for the new reconciler service
  
  /**
   * Reconcile scans to lots
   * Adapter that delegates to the new implementation
   */
  static async reconcileScansToLots(
    identity: { cardId?: string; fingerprint: string; finish: string; lang: string }
  ): Promise<void> {
    return await Reconciler.reconcileScansToLots(identity);
  }

  /**
   * Reconcile SELLs to lots
   * Adapter that delegates to the new implementation
   */
  static async reconcileSellsToLots(
    identity: { cardId?: string; fingerprint: string; finish: string; lang: string }
  ): Promise<void> {
    return await Reconciler.reconcileSellsToLots(identity);
  }

  /**
   * Run the full reconciler
   * Adapter that delegates to the new implementation
   */
  static async runReconciler(
    identity: { cardId?: string; fingerprint: string; finish: string; lang: string }
  ): Promise<void> {
    return await Reconciler.runReconciler(identity);
  }
  
  /**
   * Link scan to lot
   * Adapter that delegates to the new implementation
   */
  static async linkScanToLot(scanId: string, lotId: string): Promise<void> {
    return await Reconciler.linkScanToLot(scanId, lotId);
  }
  
  /**
   * Reassign SELL transaction to lot
   * Adapter that delegates to the new implementation
   */
  static async reassignSellToLot(transactionId: string, lotId: string): Promise<void> {
    return await Reconciler.reassignSellToLot(transactionId, lotId);
  }
}