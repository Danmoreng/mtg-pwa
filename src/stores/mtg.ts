import { defineStore } from 'pinia';
import { cardRepository } from '../data/repos';
import { holdingRepository } from '../data/repos';
import { transactionRepository } from '../data/repos';
import { deckRepository, deckCardRepository } from '../data/repos';
import { settingRepository } from '../data/repos';
import type { Card, Holding, Transaction, Deck, DeckCard } from '../data/db';

// Create a root store that combines all individual stores
export const useMtgStore = defineStore('mtg', {
  state: () => ({
    // Cards
    cards: {} as Record<string, Card>,
    cardsLoading: false,
    cardsError: null as string | null,
    
    // Holdings
    holdings: {} as Record<string, Holding>,
    holdingsLoading: false,
    holdingsError: null as string | null,
    
    // Transactions
    transactions: {} as Record<string, Transaction>,
    transactionsLoading: false,
    transactionsError: null as string | null,
    
    // Decks
    decks: {} as Record<string, Deck>,
    deckCards: {} as Record<string, DeckCard[]>,
    decksLoading: false,
    decksError: null as string | null,
    
    // Settings
    settings: {} as Record<string, any>,
    settingsLoading: false,
    settingsError: null as string | null,
  }),

  getters: {
    // Cards
    getCardById: (state) => {
      return (id: string) => state.cards[id];
    },
    getAllCards: (state) => {
      return Object.values(state.cards);
    },
    getCardsBySet: (state) => {
      return (setCode: string) => {
        return Object.values(state.cards).filter(card => card.setCode === setCode);
      };
    },

    // Holdings
    getHoldingById: (state) => {
      return (id: string) => state.holdings[id];
    },
    getAllHoldings: (state) => {
      return Object.values(state.holdings);
    },
    getHoldingsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.holdings).filter(holding => holding.cardId === cardId);
      };
    },
    getTotalQuantityByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.holdings)
          .filter(holding => holding.cardId === cardId)
          .reduce((sum, holding) => sum + holding.quantity, 0);
      };
    },

    // Transactions
    getTransactionById: (state) => {
      return (id: string) => state.transactions[id];
    },
    getAllTransactions: (state) => {
      return Object.values(state.transactions);
    },
    getTransactionsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.transactions).filter(transaction => transaction.cardId === cardId);
      };
    },
    getTransactionsByKind: (state) => {
      return (kind: 'BUY' | 'SELL') => {
        return Object.values(state.transactions).filter(transaction => transaction.kind === kind);
      };
    },
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
    },

    // Decks
    getDeckById: (state) => {
      return (id: string) => state.decks[id];
    },
    getAllDecks: (state) => {
      return Object.values(state.decks);
    },
    getDeckCardsByDeckId: (state) => {
      return (deckId: string) => state.deckCards[deckId] || [];
    },
    getDeckCardsByCardId: (state) => {
      return (cardId: string) => {
        return Object.values(state.deckCards).flat().filter(deckCard => deckCard.cardId === cardId);
      };
    }
  },

  actions: {
    // Cards
    async loadCards() {
      this.cardsLoading = true;
      this.cardsError = null;
      
      try {
        const cards = await cardRepository.getAll();
        // Convert array to object for easier lookup
        this.cards = cards.reduce((acc, card) => {
          acc[card.id] = card;
          return acc;
        }, {} as Record<string, Card>);
      } catch (error) {
        this.cardsError = error instanceof Error ? error.message : 'Failed to load cards';
        console.error('Error loading cards:', error);
      } finally {
        this.cardsLoading = false;
      }
    },

    async addCard(card: Card) {
      try {
        await cardRepository.add(card);
        // Update the store
        this.cards[card.id] = card;
      } catch (error) {
        this.cardsError = error instanceof Error ? error.message : 'Failed to add card';
        console.error('Error adding card:', error);
        throw error;
      }
    },

    async updateCard(id: string, card: Partial<Card>) {
      try {
        await cardRepository.update(id, card);
        // Update the store
        if (this.cards[id]) {
          this.cards[id] = { ...this.cards[id], ...card };
        }
      } catch (error) {
        this.cardsError = error instanceof Error ? error.message : 'Failed to update card';
        console.error('Error updating card:', error);
        throw error;
      }
    },

    async removeCard(id: string) {
      try {
        await cardRepository.delete(id);
        // Update the store
        delete this.cards[id];
      } catch (error) {
        this.cardsError = error instanceof Error ? error.message : 'Failed to remove card';
        console.error('Error removing card:', error);
        throw error;
      }
    },

    // Holdings
    async loadHoldings() {
      this.holdingsLoading = true;
      this.holdingsError = null;
      
      try {
        const holdings = await holdingRepository.getAll();
        // Convert array to object for easier lookup
        this.holdings = holdings.reduce((acc, holding) => {
          acc[holding.id] = holding;
          return acc;
        }, {} as Record<string, Holding>);
      } catch (error) {
        this.holdingsError = error instanceof Error ? error.message : 'Failed to load holdings';
        console.error('Error loading holdings:', error);
      } finally {
        this.holdingsLoading = false;
      }
    },

    async addHolding(holding: Holding) {
      try {
        await holdingRepository.add(holding);
        // Update the store
        this.holdings[holding.id] = holding;
      } catch (error) {
        this.holdingsError = error instanceof Error ? error.message : 'Failed to add holding';
        console.error('Error adding holding:', error);
        throw error;
      }
    },

    async updateHolding(id: string, holding: Partial<Holding>) {
      try {
        await holdingRepository.update(id, holding);
        // Update the store
        if (this.holdings[id]) {
          this.holdings[id] = { ...this.holdings[id], ...holding };
        }
      } catch (error) {
        this.holdingsError = error instanceof Error ? error.message : 'Failed to update holding';
        console.error('Error updating holding:', error);
        throw error;
      }
    },

    async removeHolding(id: string) {
      try {
        await holdingRepository.delete(id);
        // Update the store
        delete this.holdings[id];
      } catch (error) {
        this.holdingsError = error instanceof Error ? error.message : 'Failed to remove holding';
        console.error('Error removing holding:', error);
        throw error;
      }
    },

    // Transactions
    async loadTransactions() {
      this.transactionsLoading = true;
      this.transactionsError = null;
      
      try {
        const transactions = await transactionRepository.getAll();
        // Convert array to object for easier lookup
        this.transactions = transactions.reduce((acc, transaction) => {
          acc[transaction.id] = transaction;
          return acc;
        }, {} as Record<string, Transaction>);
      } catch (error) {
        this.transactionsError = error instanceof Error ? error.message : 'Failed to load transactions';
        console.error('Error loading transactions:', error);
      } finally {
        this.transactionsLoading = false;
      }
    },

    async addTransaction(transaction: Transaction) {
      try {
        await transactionRepository.add(transaction);
        // Update the store
        this.transactions[transaction.id] = transaction;
      } catch (error) {
        this.transactionsError = error instanceof Error ? error.message : 'Failed to add transaction';
        console.error('Error adding transaction:', error);
        throw error;
      }
    },

    async updateTransaction(id: string, transaction: Partial<Transaction>) {
      try {
        await transactionRepository.update(id, transaction);
        // Update the store
        if (this.transactions[id]) {
          this.transactions[id] = { ...this.transactions[id], ...transaction };
        }
      } catch (error) {
        this.transactionsError = error instanceof Error ? error.message : 'Failed to update transaction';
        console.error('Error updating transaction:', error);
        throw error;
      }
    },

    async removeTransaction(id: string) {
      try {
        await transactionRepository.delete(id);
        // Update the store
        delete this.transactions[id];
      } catch (error) {
        this.transactionsError = error instanceof Error ? error.message : 'Failed to remove transaction';
        console.error('Error removing transaction:', error);
        throw error;
      }
    },

    // Decks
    async loadDecks() {
      this.decksLoading = true;
      this.decksError = null;
      
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
        this.decksError = error instanceof Error ? error.message : 'Failed to load decks';
        console.error('Error loading decks:', error);
      } finally {
        this.decksLoading = false;
      }
    },

    async loadDeckCards(deckId: string) {
      try {
        const deckCards = await deckCardRepository.getByDeckId(deckId);
        this.deckCards[deckId] = deckCards;
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : `Failed to load deck cards for deck ${deckId}`;
        console.error(`Error loading deck cards for deck ${deckId}:`, error);
      }
    },

    async addDeck(deck: Deck) {
      try {
        await deckRepository.add(deck);
        // Update the store
        this.decks[deck.id] = deck;
        // Initialize empty deck cards array
        this.deckCards[deck.id] = [];
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : 'Failed to add deck';
        console.error('Error adding deck:', error);
        throw error;
      }
    },

    async updateDeck(id: string, deck: Partial<Deck>) {
      try {
        await deckRepository.update(id, deck);
        // Update the store
        if (this.decks[id]) {
          this.decks[id] = { ...this.decks[id], ...deck };
        }
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : 'Failed to update deck';
        console.error('Error updating deck:', error);
        throw error;
      }
    },

    async removeDeck(id: string) {
      try {
        await deckRepository.delete(id);
        // Update the store
        delete this.decks[id];
        // Also remove deck cards
        delete this.deckCards[id];
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : 'Failed to remove deck';
        console.error('Error removing deck:', error);
        throw error;
      }
    },

    async addCardToDeck(deckId: string, deckCard: DeckCard) {
      try {
        await deckCardRepository.add(deckCard);
        // Update the store
        if (!this.deckCards[deckId]) {
          this.deckCards[deckId] = [];
        }
        this.deckCards[deckId].push(deckCard);
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : 'Failed to add card to deck';
        console.error('Error adding card to deck:', error);
        throw error;
      }
    },

    async removeCardsFromDeck(deckId: string) {
      try {
        await deckCardRepository.deleteByDeckId(deckId);
        // Update the store
        this.deckCards[deckId] = [];
      } catch (error) {
        this.decksError = error instanceof Error ? error.message : 'Failed to remove cards from deck';
        console.error('Error removing cards from deck:', error);
        throw error;
      }
    },

    // Settings
    async loadSettings() {
      this.settingsLoading = true;
      this.settingsError = null;
      
      try {
        const settings = await settingRepository.getAll();
        // Convert array to object for easier lookup
        this.settings = settings.reduce((acc, setting) => {
          acc[setting.k] = setting.v;
          return acc;
        }, {} as Record<string, any>);
      } catch (error) {
        this.settingsError = error instanceof Error ? error.message : 'Failed to load settings';
        console.error('Error loading settings:', error);
      } finally {
        this.settingsLoading = false;
      }
    },

    async setSetting(key: string, value: any) {
      try {
        await settingRepository.set(key, value);
        // Update the store
        this.settings[key] = value;
      } catch (error) {
        this.settingsError = error instanceof Error ? error.message : 'Failed to set setting';
        console.error('Error setting setting:', error);
        throw error;
      }
    },

    async removeSetting(key: string) {
      try {
        await settingRepository.delete(key);
        // Update the store
        delete this.settings[key];
      } catch (error) {
        this.settingsError = error instanceof Error ? error.message : 'Failed to remove setting';
        console.error('Error removing setting:', error);
        throw error;
      }
    }
  }
});