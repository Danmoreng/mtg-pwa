// Scan matching service for matching ManaBox scans to Cardmarket sales
import db from '../../data/db';

export class ScanMatchingService {
  // Match scans to sales
  static async matchScansToSales(): Promise<void> {
    try {
      // Get all scans that haven't been matched yet
      const unmatchedScans = await db.scans
        .where('cardId')
        .notEqual('')
        .and(scan => !scan.soldTransactionId)
        .toArray();
      
      // Get all SELL transactions
      const sellTransactions = await db.transactions
        .where('kind')
        .equals('SELL')
        .toArray();
      
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
          
          // In a real implementation, we would need to track how many items
          // from each sale have already been assigned to other scans
          // For now, we'll assume all items in a sale are available
          
          const soldQuantity = Math.min(remainingQuantity, sale.quantity);
          
          // Update scan with sale information
          await db.scans.update(scan.id, {
            soldTransactionId: sale.id,
            soldAt: sale.happenedAt,
            soldQuantity: soldQuantity
          });
          
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
}