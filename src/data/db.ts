import Dexie, { type EntityTable, type Table } from 'dexie';

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
}

export interface Transaction {
  id: string;
  kind: 'BUY' | 'SELL';
  cardId?: string;
  quantity: number;
  unitPrice: number; // in cents
  fees: number; // in cents
  shipping: number; // in cents
  currency: string;
  source: string;
  externalRef: string;
  happenedAt: Date;
}

export interface Scan {
  id: string;
  cardFingerprint: string;
  cardId?: string;
  source: string;
  scannedAt: Date;
  quantity: number;
  soldTransactionId?: string;
  soldAt?: Date;
  soldQuantity?: number;
}

export interface Deck {
  id: string;
  platform: 'moxfield' | 'csv';
  name: string;
  commander?: string;
  url?: string;
  importedAt: Date;
}

export interface DeckCard {
  deckId: string;
  cardId: string;
  quantity: number;
  role: 'main' | 'side' | 'maybeboard';
}

export interface PricePoint {
  id: string; // cardId+provider+asOf
  cardId: string;
  provider: string;
  currency: string;
  price: number; // in cents
  asOf: Date;
}

export interface Valuation {
  id: string; // asOf
  asOf: Date;
  totalValue: number; // in cents
  totalCostBasis: number; // in cents
  realizedPnLToDate: number; // in cents
}

export interface Setting {
  k: string;
  v: any;
}

// Create Dexie database
class MtgTrackerDb extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  holdings!: EntityTable<Holding, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  scans!: EntityTable<Scan, 'id'>;
  decks!: EntityTable<Deck, 'id'>;
  deck_cards!: Table<DeckCard, [DeckCard['deckId'], DeckCard['cardId']]>;
  price_points!: EntityTable<PricePoint, 'id'>;
  valuations!: EntityTable<Valuation, 'id'>;
  settings!: EntityTable<Setting, 'k'>;

  constructor() {
    super('MtgTrackerDb');
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
  }
}

const db = new MtgTrackerDb();

export default db;