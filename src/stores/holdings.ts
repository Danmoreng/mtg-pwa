import { defineStore } from 'pinia';
import type { CanonicalHolding } from '../features/accounting/AccountingQueryService';
import { AccountingQueryService } from '../features/accounting/AccountingQueryService';

export type Holding = CanonicalHolding;

interface HoldingsState {
  holdings: Record<string, Holding>;
  loading: boolean;
  error: string | null;
}

export const useHoldingsStore = defineStore('holdings', {
  state: (): HoldingsState => ({
    holdings: {},
    loading: false,
    error: null,
  }),

  getters: {
    getHoldingByCardId: state => (cardId: string) => state.holdings[cardId],
    getAllHoldings: state => Object.values(state.holdings),
    getTotalQuantityByCardId: state => (cardId: string) =>
      state.holdings[cardId]?.quantity ?? 0,
  },

  actions: {
    async loadHoldings() {
      this.loading = true;
      this.error = null;
      try {
        const rows = await new AccountingQueryService().getHoldings();
        this.holdings = Object.fromEntries(rows.map(row => [row.cardId, row]));
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load holdings';
        console.error('Error loading canonical holdings:', error);
      } finally {
        this.loading = false;
      }
    },
  },
});
