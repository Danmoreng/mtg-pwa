import Dexie, { type EntityTable } from 'dexie';

// Define our data models
export interface Card {
  id: string; // scryfall_id
  oracleId?: string;
  name: string;
  set: string;
  setCode: string;
  number: string;
  lang: string;
  finish: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardLot {
  id: string;
  cardId: string;
  acquisitionId?: string;
  quantity: number;
  unitCost: number; // in cents
  condition: string;
  language: string;
  foil: boolean;
  finish: string;
  source: string;
  purchasedAt: Date;
  disposedAt?: Date;
  disposedQuantity?: number;
  saleTransactionId?: string;
  currency?: string; // Add currency property
  createdAt: Date;
  updatedAt: Date;
}

export interface Holding {
  id: string;
  cardId: string;
  acquisitionId?: string;
  quantity: number;
  unitCost: number; // in cents
  source: string;
  condition: string;
  language: string;
  foil: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  kind: 'BUY' | 'SELL';
  cardId?: string;
  lotId?: string;
  quantity: number;
  unitPrice: number; // in cents
  fees: number; // in cents
  shipping: number; // in cents
  currency: string;
  source: string;
  externalRef: string;
  happenedAt: Date;
  notes?: string;
  relatedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scan {
  id: string;
  cardFingerprint: string;
  cardId?: string;
  lotId?: string;
  source: string;
  scannedAt: Date;
  quantity: number;
  boosterPackId?: string;
  notes?: string;
  soldTransactionId?: string;
  soldAt?: Date;
  soldQuantity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deck {
  id: string;
  platform: 'moxfield' | 'csv';
  name: string;
  commander?: string;
  url?: string;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckCard {
  id: string;
  deckId: string;
  cardId: string;
  lotId?: string;
  quantity: number;
  role: 'main' | 'side' | 'maybeboard';
  addedAt: Date;
  removedAt?: Date;
  createdAt: Date;
}

export interface PricePoint {
  id: string; // cardId+provider+asOf
  cardId: string;
  provider: string;
  currency: string;
  price: number; // in cents
  asOf: Date;
  source?: string;
  createdAt: Date;
}

export interface Valuation {
  id: string; // asOf
  asOf: Date;
  totalValue: number; // in cents
  totalCostBasis: number; // in cents
  realizedPnLToDate: number; // in cents
  createdAt: Date;
}

export interface Setting {
  k: string;
  v: any;
  createdAt: Date;
  updatedAt: Date;
}

// Scan to Sale matching link
export interface ScanSaleLink {
  id: string;
  scanId: string;
  transactionId: string;
  quantity: number;
  matchedAt: Date;
  createdAt: Date;
}

// Create Dexie database
class MtgTrackerDb extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  card_lots!: EntityTable<CardLot, 'id'>;
  holdings!: EntityTable<Holding, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  scans!: EntityTable<Scan, 'id'>;
  decks!: EntityTable<Deck, 'id'>;
  deck_cards!: EntityTable<DeckCard, 'id'>;
  price_points!: EntityTable<PricePoint, 'id'>;
  valuations!: EntityTable<Valuation, 'id'>;
  settings!: EntityTable<Setting, 'k'>;
  scan_sale_links!: EntityTable<ScanSaleLink, 'id'>;

  constructor() {
    super('MtgTrackerDb');
    
    // Version 1 - Initial schema
    this.version(1).stores({
      cards: 'id, oracleId, name, set, setCode, number, lang, finish',
      holdings: 'id, cardId, acquisitionId, source, createdAt',
      transactions: 'id, kind, cardId, source, externalRef, happenedAt',
      scans: 'id, cardFingerprint, cardId, source, scannedAt',
      decks: 'id, platform, name, importedAt',
      deck_cards: '[deckId+cardId], deckId, cardId',
      price_points: 'id, cardId, provider, asOf',
      valuations: 'id, asOf',
      settings: 'k'
    });
    
    // Version 2 - Enhanced schema with better indexing and new tables
    this.version(2).stores({
      cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
      holdings: 'id, cardId, acquisitionId, source, createdAt, updatedAt',
      transactions: 'id, kind, cardId, source, externalRef, happenedAt, createdAt, updatedAt',
      scans: 'id, cardFingerprint, cardId, source, scannedAt, createdAt, updatedAt',
      decks: 'id, platform, name, importedAt, createdAt, updatedAt',
      deck_cards: '[deckId+cardId], deckId, cardId, createdAt',
      price_points: 'id, cardId, provider, asOf, createdAt',
      valuations: 'id, asOf, createdAt',
      settings: 'k, createdAt, updatedAt',
      scan_sale_links: 'id, scanId, transactionId, matchedAt, createdAt'
    }).upgrade(async tx => {
      // Add createdAt and updatedAt to existing records
      const now = new Date();
      
      // Update cards
      await tx.table('cards').toCollection().modify(card => {
        card.createdAt = card.createdAt || now;
        card.updatedAt = card.updatedAt || now;
      });
      
      // Update holdings
      await tx.table('holdings').toCollection().modify(holding => {
        holding.createdAt = holding.createdAt || now;
        holding.updatedAt = holding.updatedAt || now;
      });
      
      // Update transactions
      await tx.table('transactions').toCollection().modify(transaction => {
        transaction.createdAt = transaction.createdAt || now;
        transaction.updatedAt = transaction.updatedAt || now;
      });
      
      // Update scans
      await tx.table('scans').toCollection().modify(scan => {
        scan.createdAt = scan.createdAt || now;
        scan.updatedAt = scan.updatedAt || now;
      });
      
      // Update decks
      await tx.table('decks').toCollection().modify(deck => {
        deck.createdAt = deck.createdAt || now;
        deck.updatedAt = deck.updatedAt || now;
      });
      
      // Update deck_cards
      await tx.table('deck_cards').toCollection().modify(deckCard => {
        deckCard.createdAt = deckCard.createdAt || now;
      });
      
      // Update price_points
      await tx.table('price_points').toCollection().modify(pricePoint => {
        pricePoint.createdAt = pricePoint.createdAt || now;
      });
      
      // Update valuations
      await tx.table('valuations').toCollection().modify(valuation => {
        valuation.createdAt = valuation.createdAt || now;
      });
      
      // Update settings
      await tx.table('settings').toCollection().modify(setting => {
        setting.createdAt = setting.createdAt || now;
        setting.updatedAt = setting.updatedAt || now;
      });
    });
    
    // Version 3 - Enhanced schema for historical pricing
    this.version(3).stores({
      cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
      holdings: 'id, cardId, acquisitionId, source, createdAt, updatedAt',
      transactions: 'id, kind, cardId, source, externalRef, happenedAt, createdAt, updatedAt',
      scans: 'id, cardFingerprint, cardId, source, scannedAt, createdAt, updatedAt',
      decks: 'id, platform, name, importedAt, createdAt, updatedAt',
      deck_cards: '[deckId+cardId], deckId, cardId, createdAt',
      price_points: 'id, cardId, provider, currency, asOf, createdAt, [cardId+asOf], [provider+asOf]',
      valuations: 'id, asOf, createdAt, [asOf+createdAt]',
      settings: 'k, createdAt, updatedAt',
      scan_sale_links: 'id, scanId, transactionId, matchedAt, createdAt'
    });
    
    // Version 4 - Enhanced schema for lot-based tracking
    this.version(4).stores({
      cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
      card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, [cardId+purchasedAt], [acquisitionId+cardId]',
      holdings: 'id, cardId, acquisitionId, source, createdAt, updatedAt',
      transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, [lotId+kind]',
      scans: 'id, cardFingerprint, cardId, lotId, source, scannedAt, boosterPackId, createdAt, updatedAt, [lotId+scannedAt]',
      decks: 'id, platform, name, importedAt, createdAt, updatedAt',
      deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
      price_points: 'id, cardId, provider, currency, asOf, source, createdAt, [cardId+asOf], [provider+asOf]',
      valuations: 'id, asOf, createdAt, [asOf+createdAt]',
      settings: 'k, createdAt, updatedAt',
      scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt'
    }).upgrade(async tx => {
      // Add missing fields to existing deck_cards records
      const now = new Date();
      
      // Update deck_cards
      await tx.table('deck_cards').toCollection().modify(deckCard => {
        try {
          // Add missing fields with default values
          if (!deckCard.id) {
            deckCard.id = `deckcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          if (!deckCard.addedAt) {
            deckCard.addedAt = deckCard.createdAt || now;
          }
          if (!deckCard.role) {
            deckCard.role = 'main';
          }
          // Set cardId to a default value if it's missing or empty
          if (!deckCard.cardId || deckCard.cardId === '') {
            deckCard.cardId = 'unknown-card';
          }
          // Set deckId to a default value if it's missing
          if (!deckCard.deckId) {
            deckCard.deckId = 'unknown-deck';
          }
          // Set quantity to 1 if it's missing
          if (typeof deckCard.quantity !== 'number') {
            deckCard.quantity = 1;
          }
          // Set createdAt if it's missing
          if (!deckCard.createdAt) {
            deckCard.createdAt = now;
          }
        } catch (error) {
          console.error('Error upgrading deck card:', error, deckCard);
          // If we can't upgrade the record, delete it
          return undefined;
        }
      });
    });
  }
}

const db = new MtgTrackerDb();

export default db;