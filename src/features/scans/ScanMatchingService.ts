// Scan matching service for matching ManaBox scans to Cardmarket sales with lot tracking
import db from '../../data/db';
import { cardLotRepository, transactionRepository, scanRepository } from '../../data/repos';
import type { Scan, Transaction, CardLot } from '../../data/db';

export class ScanMatchingService {
  // Match scans to sales with lot tracking
  static async matchScansToSales(): Promise<void> {
    try {
      // Get all scans that haven't been matched yet
      const unmatchedScans = await db.scans
        .where('cardId')
        .notEqual('')
        .and(scan => !scan.soldTransactionId)
        .toArray();
      
      // Get all SELL transactions
      const sellTransactions = await transactionRepository.getByKind('SELL');
      
      // For each sale, track how many items have been assigned to scans
      const saleAssignments: Record<string, number> = {};
      
      // Initialize assignment tracking for all sales
      for (const sale of sellTransactions) {
        saleAssignments[sale.id] = 0;
      }
      
      // Match scans to sales
      for (const scan of unmatchedScans) {
        // Find matching sales transactions
        const matchingSales = sellTransactions.filter(tx => {
          // Match by card ID
          if (tx.cardId && tx.cardId === scan.cardId) {
            // Check if sale happened after scan
            return tx.happenedAt >= scan.scannedAt;
          }
          
          // If no card ID, match by fingerprint
          if (!tx.cardId && scan.cardFingerprint) {
            // In a real implementation, we would compare fingerprints here
            // For now, we'll skip this as it's more complex
            return false;
          }
          
          return false;
        });
        
        // Sort by date (earliest first)
        matchingSales.sort((a, b) => a.happenedAt.getTime() - b.happenedAt.getTime());
        
        // Greedily assign scans to earliest eligible sales
        let remainingQuantity = scan.quantity;
        
        for (const sale of matchingSales) {
          if (remainingQuantity <= 0) break;
          
          // Calculate how many items from this sale are still available
          const assignedQuantity = saleAssignments[sale.id] || 0;
          const availableQuantity = sale.quantity - assignedQuantity;
          
          if (availableQuantity <= 0) continue;
          
          const soldQuantity = Math.min(remainingQuantity, availableQuantity);
          
          // Update scan with sale information
          await scanRepository.update(scan.id, {
            soldTransactionId: sale.id,
            soldAt: sale.happenedAt,
            soldQuantity: soldQuantity
          });
          
          // Update assignment tracking
          saleAssignments[sale.id] = assignedQuantity + soldQuantity;
          
          // If the scan is linked to a lot, update the lot's disposal information
          if (scan.lotId) {
            const lot = await cardLotRepository.getById(scan.lotId);
            if (lot) {
              // Update the lot with disposal information
              await cardLotRepository.update(scan.lotId, {
                disposedAt: sale.happenedAt,
                disposedQuantity: (lot.disposedQuantity || 0) + soldQuantity,
                saleTransactionId: sale.id
              });
            }
          }
          
          remainingQuantity -= soldQuantity;
        }
      }
    } catch (error) {
      console.error('Error matching scans to sales:', error);
      throw error;
    }
  }

  // Get scan status (sold or still owned)
  static async getScanStatus(scanId: string): Promise<'sold' | 'owned' | 'unknown'> {
    try {
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

  // Link a scan to a specific card lot
  static async linkScanToLot(scanId: string, lotId: string): Promise<void> {
    try {
      // Update the scan with the lot ID
      await scanRepository.update(scanId, {
        lotId: lotId
      });
    } catch (error) {
      console.error(`Error linking scan ${scanId} to lot ${lotId}:`, error);
      throw error;
    }
  }

  // Get all scans for a specific lot
  static async getScansForLot(lotId: string): Promise<Scan[]> {
    try {
      return await db.scans.where('lotId').equals(lotId).toArray();
    } catch (error) {
      console.error(`Error getting scans for lot ${lotId}:`, error);
      throw error;
    }
  }

  // Get all scans for a specific card
  static async getScansForCard(cardId: string): Promise<Scan[]> {
    try {
      return await db.scans.where('cardId').equals(cardId).toArray();
    } catch (error) {
      console.error(`Error getting scans for card ${cardId}:`, error);
      throw error;
    }
  }

  // Get the lot associated with a scan
  static async getLotForScan(scanId: string): Promise<CardLot | undefined> {
    try {
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
}