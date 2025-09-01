import { defineStore } from 'pinia';
import { holdingRepository } from '../data/repos';
import type { Holding } from '../data/db';

// Define the state structure for holdings
interface HoldingsState {
  holdings: Record<string, Holding>;
  loading: boolean;
  error: string | null;
}

// Create the holdings store
export const useHoldingsStore = defineStore('holdings', {
  state: (): HoldingsState => ({
    holdings: {},
    loading: false,
    error: null
  }),

  getters: {
    // Get a holding by its ID
    getHoldingById: (state) => {
      return (id: string) => state.holdings[id];
    },

    // Get all holdings as an array
    getAllHoldings: (state) => {
      return Object.values(state.holdings);
    },

    // Get holdings by card ID
    getHoldingsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.holdings).filter(holding => holding.cardId === cardId);
      };
    },

    // Get total quantity of a card held
    getTotalQuantityByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.holdings)
          .filter(holding => holding.cardId === cardId)
          .reduce((sum, holding) => sum + holding.quantity, 0);
      };
    }
  },

  actions: {
    // Load all holdings from the database
    async loadHoldings() {
      this.loading = true;
      this.error = null;
      
      try {
        const holdings = await holdingRepository.getAll();
        // Convert array to object for easier lookup
        this.holdings = holdings.reduce((acc, holding) => {
          acc[holding.id] = holding;
          return acc;
        }, {} as Record<string, Holding>);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load holdings';
        console.error('Error loading holdings:', error);
      } finally {
        this.loading = false;
      }
    },

    // Add a new holding
    async addHolding(holding: Holding) {
      try {
        await holdingRepository.add(holding);
        // Update the store
        this.holdings[holding.id] = holding;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add holding';
        console.error('Error adding holding:', error);
        throw error;
      }
    },

    // Update an existing holding
    async updateHolding(id: string, holding: Partial<Holding>) {
      try {
        await holdingRepository.update(id, holding);
        // Update the store
        if (this.holdings[id]) {
          this.holdings[id] = { ...this.holdings[id], ...holding };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update holding';
        console.error('Error updating holding:', error);
        throw error;
      }
    },

    // Remove a holding
    async removeHolding(id: string) {
      try {
        await holdingRepository.delete(id);
        // Update the store
        delete this.holdings[id];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove holding';
        console.error('Error removing holding:', error);
        throw error;
      }
    }
  }
});