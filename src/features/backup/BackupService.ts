// Backup service for exporting and importing data
import { getDb } from '../../data/init';

export class BackupService {
  // Export all data as JSON
  static async exportData(): Promise<string> {
    try {
      // Get all data from each table
      const db = getDb();
      const data: any = {};
      
      data.cards = await db.cards.toArray();
      
      data.transactions = await db.transactions.toArray();
      data.scans = await db.scans.toArray();
      data.decks = await db.decks.toArray();
      data.deck_cards = await db.deck_cards.toArray();
      data.price_points = await db.price_points.toArray();
      data.valuations = await db.valuations.toArray();
      data.settings = await db.settings.toArray();
      data.card_lots = await db.card_lots.toArray();            // add card_lots
      data.scan_sale_links = await db.scan_sale_links.toArray();  // add scan_sale_links
      
      // Return as JSON string
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // Import data from JSON
  static async importData(jsonData: string): Promise<void> {
    try {
      // Parse the JSON data
      const data = JSON.parse(jsonData);
      
      // Clear existing data
      const db = getDb();
      await db.cards.clear();
      
      await db.transactions.clear();
      await db.scans.clear();
      await db.decks.clear();
      await db.deck_cards.clear();
      await db.price_points.clear();
      await db.valuations.clear();
      await db.settings.clear();
      await db.card_lots.clear();             // add card_lots
      await db.scan_sale_links.clear();         // add scan_sale_links
      
      // Import data into each table
      if (data.cards) await db.cards.bulkAdd(data.cards);
      
      if (data.transactions) await db.transactions.bulkAdd(data.transactions);
      if (data.scans) await db.scans.bulkAdd(data.scans);
      if (data.decks) await db.decks.bulkAdd(data.decks);
      if (data.deck_cards) await db.deck_cards.bulkAdd(data.deck_cards);
      if (data.price_points) await db.price_points.bulkAdd(data.price_points);
      if (data.valuations) await db.valuations.bulkAdd(data.valuations);
      if (data.settings) await db.settings.bulkAdd(data.settings);
      if (data.card_lots) await db.card_lots.bulkAdd(data.card_lots);             // add card_lots
      if (data.scan_sale_links) await db.scan_sale_links.bulkAdd(data.scan_sale_links); // add scan_sale_links
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  // Export data to file
  static async exportToFile(): Promise<void> {
    try {
      const jsonData = await this.exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and click it to download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `mtg-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to file:', error);
      throw error;
    }
  }

  // Import data from file
  static async importFromFile(file: File): Promise<void> {
    try {
      const reader = new FileReader();
      const promise = new Promise<void>((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const jsonData = e.target?.result as string;
            if (jsonData) {
              await this.importData(jsonData);
              resolve();
            } else {
              reject(new Error('Failed to read file'));
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
      
      reader.readAsText(file);
      await promise;
    } catch (error) {
      console.error('Error importing from file:', error);
      throw error;
    }
  }
}