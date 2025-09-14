import { defineStore } from 'pinia';
import { cardRepository } from '../data/repos';
import db from '../data/db';
import { Money } from '../core/Money';
import type { Card } from '../data/db';
import { PriceQueryService } from '../features/pricing/PriceQueryService';

// Define the state structure for cards
interface CardsState {
  cards: Record<string, Card>;
  cardPrices: Record<string, Money>;
  loading: boolean;
  loadingPrices: boolean;
  error: string | null;
}

// Create the cards store
export const useCardsStore = defineStore('cards', {
  state: (): CardsState => ({
    cards: {},
    cardPrices: {},
    loading: false,
    loadingPrices: false,
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
    },

    // Get price for a specific card
    getCardPrice: (state) => {
      return (cardId: string) => state.cardPrices[cardId] || null;
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

    // Load prices for all cards from the database
    async loadCardPrices() {
      this.loadingPrices = true;
      this.error = null;
      
      try {
        // Get all cards to know which card IDs we need prices for
        const allCards = await cardRepository.getAll();
        const pricesMap: Record<string, Money> = {};
        
        // Get latest price for each card using PriceQueryService (respects provider precedence)
        for (const card of allCards) {
          const priceResult = await PriceQueryService.getLatestPriceForCard(card.id);
          if (priceResult) {
            pricesMap[card.id] = priceResult.price;
          }
        }
        
        this.cardPrices = pricesMap;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load card prices';
        console.error('Error loading card prices:', error);
      } finally {
        this.loadingPrices = false;
      }
    },

    // Load both cards and prices
    async loadCardsAndPrices() {
      await Promise.all([
        this.loadCards(),
        this.loadCardPrices()
      ]);
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
        // Also remove the price
        delete this.cardPrices[id];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove card';
        console.error('Error removing card:', error);
        throw error;
      }
    }
  }
});