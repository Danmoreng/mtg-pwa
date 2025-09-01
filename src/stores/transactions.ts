import { defineStore } from 'pinia';
import { transactionRepository } from '../data/repos';
import type { Transaction } from '../data/db';

// Define the state structure for transactions
interface TransactionsState {
  transactions: Record<string, Transaction>;
  loading: boolean;
  error: string | null;
}

// Create the transactions store
export const useTransactionsStore = defineStore('transactions', {
  state: (): TransactionsState => ({
    transactions: {},
    loading: false,
    error: null
  }),

  getters: {
    // Get a transaction by its ID
    getTransactionById: (state) => {
      return (id: string) => state.transactions[id];
    },

    // Get all transactions as an array
    getAllTransactions: (state) => {
      return Object.values(state.transactions);
    },

    // Get transactions by card ID
    getTransactionsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.transactions).filter(transaction => transaction.cardId === cardId);
      };
    },

    // Get transactions by kind (BUY/SELL)
    getTransactionsByKind: (state) => {
      return (kind: 'BUY' | 'SELL') => {
        return Object.values(state.transactions).filter(transaction => transaction.kind === kind);
      };
    },

    // Get total value of transactions
    getTotalValueByKind: (state) => {
      return (kind: 'BUY' | 'SELL') => {
        return Object.values(state.transactions)
          .filter(transaction => transaction.kind === kind)
          .reduce((sum, transaction) => {
            const value = transaction.unitPrice * transaction.quantity;
            const fees = transaction.fees || 0;
            const shipping = transaction.shipping || 0;
            
            if (kind === 'BUY') {
              return sum + value + fees + shipping;
            } else {
              return sum + value - fees - shipping;
            }
          }, 0);
      };
    }
  },

  actions: {
    // Load all transactions from the database
    async loadTransactions() {
      this.loading = true;
      this.error = null;
      
      try {
        const transactions = await transactionRepository.getAll();
        // Convert array to object for easier lookup
        this.transactions = transactions.reduce((acc, transaction) => {
          acc[transaction.id] = transaction;
          return acc;
        }, {} as Record<string, Transaction>);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load transactions';
        console.error('Error loading transactions:', error);
      } finally {
        this.loading = false;
      }
    },

    // Add a new transaction
    async addTransaction(transaction: Transaction) {
      try {
        await transactionRepository.add(transaction);
        // Update the store
        this.transactions[transaction.id] = transaction;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add transaction';
        console.error('Error adding transaction:', error);
        throw error;
      }
    },

    // Update an existing transaction
    async updateTransaction(id: string, transaction: Partial<Transaction>) {
      try {
        await transactionRepository.update(id, transaction);
        // Update the store
        if (this.transactions[id]) {
          this.transactions[id] = { ...this.transactions[id], ...transaction };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update transaction';
        console.error('Error updating transaction:', error);
        throw error;
      }
    },

    // Remove a transaction
    async removeTransaction(id: string) {
      try {
        await transactionRepository.delete(id);
        // Update the store
        delete this.transactions[id];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove transaction';
        console.error('Error removing transaction:', error);
        throw error;
      }
    }
  }
});