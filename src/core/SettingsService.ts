// Settings service for managing application settings
import db from '../data/db';

export class SettingsService {
  // Get a setting value
  static async get(key: string, defaultValue: any = null): Promise<any> {
    try {
      const setting = await db.settings.get(key);
      return setting ? setting.v : defaultValue;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  }

  // Set a setting value
  static async set(key: string, value: any): Promise<void> {
    try {
      const now = new Date();
      await db.settings.put({ 
        k: key, 
        v: value,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
    }
  }

  // Delete a setting
  static async delete(key: string): Promise<void> {
    try {
      await db.settings.delete(key);
    } catch (error) {
      console.error(`Error deleting setting ${key}:`, error);
    }
  }

  // Get all settings
  static async getAll(): Promise<{ [key: string]: any }> {
    try {
      const settings = await db.settings.toArray();
      const result: { [key: string]: any } = {};
      settings.forEach(setting => {
        result[setting.k] = setting.v;
      });
      return result;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }
}

// Default settings
export const DEFAULT_SETTINGS = {
  currency: 'EUR',
  locale: 'de-DE',
  priceProvider: 'scryfall'
};