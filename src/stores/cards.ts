import { defineStore } from 'pinia';
import { cardRepository } from '../data/repos';
import type { Card } from '../data/db';

// Define the state structure for cards
interface CardsState {
  cards: Record<string, Card>;
  loading: boolean;
  error: string | null;
}

// Create the cards store
export const useCardsStore = defineStore('cards', {
  state: (): CardsState => ({
    cards: {},
    loading: false,
    error: null
  }),

  getters: {
    // Get a card by its ID
    getCardById: (state) => {
      return (id: string) => state.cards[id];
    },

    // Get all cards as an array
    getAllCards: (state) => {
      return Object.values(state.cards);
    },

    // Get cards by set code
    getCardsBySet: (state) => {
      return (setCode: string) => {
        return Object.values(state.cards).filter(card => card.setCode === setCode);
      };
    }
  },

  actions: {
    // Load all cards from the database
    async loadCards() {
      this.loading = true;
      this.error = null;
      
      try {
        const cards = await cardRepository.getAll();
        // Convert array to object for easier lookup
        this.cards = cards.reduce((acc, card) => {
          acc[card.id] = card;
          return acc;
        }, {} as Record<string, Card>);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load cards';
        console.error('Error loading cards:', error);
      } finally {
        this.loading = false;
      }
    },

    // Add a new card
    async addCard(card: Card) {
      try {
        await cardRepository.add(card);
        // Update the store
        this.cards[card.id] = card;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add card';
        console.error('Error adding card:', error);
        throw error;
      }
    },

    // Update an existing card
    async updateCard(id: string, card: Partial<Card>) {
      try {
        await cardRepository.update(id, card);
        // Update the store
        if (this.cards[id]) {
          this.cards[id] = { ...this.cards[id], ...card };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update card';
        console.error('Error updating card:', error);
        throw error;
      }
    },

    // Remove a card
    async removeCard(id: string) {
      try {
        await cardRepository.delete(id);
        // Update the store
        delete this.cards[id];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove card';
        console.error('Error removing card:', error);
        throw error;
      }
    }
  }
});