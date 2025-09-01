import { defineStore } from 'pinia';
import { deckRepository, deckCardRepository } from '../data/repos';
import type { Deck, DeckCard } from '../data/db';

// Define the state structure for decks
interface DecksState {
  decks: Record<string, Deck>;
  deckCards: Record<string, DeckCard[]>;
  loading: boolean;
  error: string | null;
}

// Create the decks store
export const useDecksStore = defineStore('decks', {
  state: (): DecksState => ({
    decks: {},
    deckCards: {},
    loading: false,
    error: null
  }),

  getters: {
    // Get a deck by its ID
    getDeckById: (state) => {
      return (id: string) => state.decks[id];
    },

    // Get all decks as an array
    getAllDecks: (state) => {
      return Object.values(state.decks);
    },

    // Get deck cards by deck ID
    getDeckCardsByDeckId: (state) => {
      return (deckId: string) => state.deckCards[deckId] || [];
    },

    // Get deck cards by card ID
    getDeckCardsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.deckCards).flat().filter(deckCard => deckCard.cardId === cardId);
      };
    }
  },

  actions: {
    // Load all decks from the database
    async loadDecks() {
      this.loading = true;
      this.error = null;
      
      try {
        const decks = await deckRepository.getAll();
        // Convert array to object for easier lookup
        this.decks = decks.reduce((acc, deck) => {
          acc[deck.id] = deck;
          return acc;
        }, {} as Record<string, Deck>);
        
        // Load deck cards for each deck
        for (const deck of decks) {
          await this.loadDeckCards(deck.id);
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load decks';
        console.error('Error loading decks:', error);
      } finally {
        this.loading = false;
      }
    },

    // Load deck cards for a specific deck
    async loadDeckCards(deckId: string) {
      try {
        const deckCards = await deckCardRepository.getByDeckId(deckId);
        this.deckCards[deckId] = deckCards;
      } catch (error) {
        this.error = error instanceof Error ? error.message : `Failed to load deck cards for deck ${deckId}`;
        console.error(`Error loading deck cards for deck ${deckId}:`, error);
      }
    },

    // Add a new deck
    async addDeck(deck: Deck) {
      try {
        await deckRepository.add(deck);
        // Update the store
        this.decks[deck.id] = deck;
        // Initialize empty deck cards array
        this.deckCards[deck.id] = [];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add deck';
        console.error('Error adding deck:', error);
        throw error;
      }
    },

    // Update an existing deck
    async updateDeck(id: string, deck: Partial<Deck>) {
      try {
        await deckRepository.update(id, deck);
        // Update the store
        if (this.decks[id]) {
          this.decks[id] = { ...this.decks[id], ...deck };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update deck';
        console.error('Error updating deck:', error);
        throw error;
      }
    },

    // Remove a deck
    async removeDeck(id: string) {
      try {
        await deckRepository.delete(id);
        // Update the store
        delete this.decks[id];
        // Also remove deck cards
        delete this.deckCards[id];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove deck';
        console.error('Error removing deck:', error);
        throw error;
      }
    },

    // Add a card to a deck
    async addCardToDeck(deckId: string, deckCard: DeckCard) {
      try {
        await deckCardRepository.add(deckCard);
        // Update the store
        if (!this.deckCards[deckId]) {
          this.deckCards[deckId] = [];
        }
        this.deckCards[deckId].push(deckCard);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add card to deck';
        console.error('Error adding card to deck:', error);
        throw error;
      }
    },

    // Remove all cards from a deck
    async removeCardsFromDeck(deckId: string) {
      try {
        await deckCardRepository.deleteByDeckId(deckId);
        // Update the store
        this.deckCards[deckId] = [];
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove cards from deck';
        console.error('Error removing cards from deck:', error);
        throw error;
      }
    }
  }
});