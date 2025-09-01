import { defineStore } from 'pinia';
import { settingRepository } from '../data/repos';

// Define the state structure for settings
interface SettingsState {
  settings: Record<string, any>;
  loading: boolean;
  error: string | null;
}

// Create the settings store
export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    settings: {},
    loading: false,
    error: null
  }),

  getters: {
    // Get a setting by its key
    getSetting: (state) => {
      return (key: string) => state.settings[key];
    },

    // Get all settings as an object
    getAllSettings: (state) => {
      return state.settings;
    }
  },

  actions: {
    // Load all settings from the database
    async loadSettings() {
      this.loading = true;
      this.error = null;
      
      try {
        const settings = await settingRepository.getAll();
        // Convert array to object for easier lookup
        this.settings = settings.reduce((acc, setting) => {
          acc[setting.k] = setting.v;
          return acc;
        }, {} as Record<string, any>);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load settings';
        console.error('Error loading settings:', error);
      } finally {
        this.loading = false;
      }
    },

    // Set a setting
    async setSetting(key: string, value: any) {
      try {
        await settingRepository.set(key, value);
        // Update the store
        this.settings[key] = value;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to set setting';
        console.error('Error setting setting:', error);
        throw error;
      }
    },

    // Remove a setting
    async removeSetting(key: string) {
      try {
        await settingRepository.delete(key);
        // Update the store
        delete this.settings[key];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove setting';
        console.error('Error removing setting:', error);
        throw error;
      }
    }
  }
});