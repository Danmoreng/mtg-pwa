// Snapshot service for creating and managing valuation snapshots
import db from '../../data/db';
import { ValuationEngine } from './ValuationEngine';

export class SnapshotService {
  // Take a snapshot of the current portfolio valuation
  static async takeSnapshot(): Promise<void> {
    try {
      // Get current date
      const asOf = new Date();
      const now = new Date();
      
      // Calculate portfolio metrics
      const totalValue = await ValuationEngine.calculatePortfolioValue();
      const totalCostBasis = await ValuationEngine.calculateTotalCostBasis();
      const realizedPnLToDate = await ValuationEngine.calculateRealizedPnL();
      
      // Create snapshot
      const snapshot = {
        id: asOf.toISOString(),
        asOf,
        totalValue: totalValue.getCents(),
        totalCostBasis: totalCostBasis.getCents(),
        realizedPnLToDate: realizedPnLToDate.getCents(),
        createdAt: now
      };
      
      // Save snapshot to database
      await db.valuations.add(snapshot);
    } catch (error) {
      console.error('Error taking snapshot:', error);
      throw error;
    }
  }

  // Get all snapshots
  static async getAllSnapshots(): Promise<any[]> {
    try {
      return await db.valuations.orderBy('asOf').reverse().toArray();
    } catch (error) {
      console.error('Error getting snapshots:', error);
      throw error;
    }
  }

  // Get snapshot by date
  static async getSnapshotByDate(date: Date): Promise<any | undefined> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      return await db.valuations
        .filter((snapshot: any) => snapshot.asOf.toISOString().split('T')[0] === dateStr)
        .first();
    } catch (error) {
      console.error('Error getting snapshot by date:', error);
      throw error;
    }
  }

  // Delete snapshot
  static async deleteSnapshot(id: string): Promise<void> {
    try {
      await db.valuations.delete(id);
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      throw error;
    }
  }

  // Get snapshot history for charting
  static async getSnapshotHistory(days: number = 30): Promise<any[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      return await db.valuations
        .where('asOf')
        .aboveOrEqual(cutoffDate)
        .toArray();
    } catch (error) {
      console.error('Error getting snapshot history:', error);
      throw error;
    }
  }
}