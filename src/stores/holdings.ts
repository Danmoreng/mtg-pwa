import { defineStore } from 'pinia';
import { cardLotRepository, cardRepository } from '../data/repos';
import type { Card } from '../data/db';

export interface Holding {
  cardId: string;
  quantity: number;
  totalCost: number; // in cents
  averageCost: number; // in cents
  card: Card;
}

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
    // Get a holding by its card ID
    getHoldingByCardId: (state) => {
      return (cardId: string) => state.holdings[cardId];
    },

    // Get all holdings as an array
    getAllHoldings: (state) => {
      return Object.values(state.holdings);
    },

    // Get total quantity of a card held
    getTotalQuantityByCardId: (state) => {
      return (cardId: string) => {
        return state.holdings[cardId]?.quantity || 0;
      };
    }
  },

  actions: {
    // Load all holdings from the database
    async loadHoldings() {
      this.loading = true;
      this.error = null;
      
      try {
        const lots = await cardLotRepository.getAll();
        const cards = await cardRepository.getAll();
        const cardMap = cards.reduce((acc, card) => {
          acc[card.id] = card;
          return acc;
        }, {} as Record<string, Card>);

        const holdings: Record<string, Holding> = {};

        for (const lot of lots) {
          if (lot.disposedAt) continue;

          const holding = holdings[lot.cardId];
          const quantity = lot.quantity - (lot.disposedQuantity || 0);

          if (holding) {
            holding.quantity += quantity;
            holding.totalCost += lot.totalAcquisitionCostCent || (lot.unitCost * quantity);
            holding.averageCost = holding.totalCost / holding.quantity;
          } else {
            holdings[lot.cardId] = {
              cardId: lot.cardId,
              quantity: quantity,
              totalCost: lot.totalAcquisitionCostCent || (lot.unitCost * quantity),
              averageCost: lot.totalAcquisitionCostCent ? (lot.totalAcquisitionCostCent / lot.quantity) : lot.unitCost,
              card: cardMap[lot.cardId]
            };
          }
        }

        this.holdings = holdings;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load holdings';
        console.error('Error loading holdings:', error);
      } finally {
        this.loading = false;
      }
    },
  }
});