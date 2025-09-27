// 5) Import pipelines (order-agnostic & idempotent)

import { acquisitionRepository, transactionRepository, deckCardRepository, deckRepository } from '../../data/repos';
import { normalizeFingerprint } from '../../core/Normalization';
import type { Transaction, Deck, DeckCard } from '../../data/db';
import type { Scan } from '../../data/db';
import { scanRepository } from '../../data/repos';

// 5.1 Manabox scans with box cost
// Input: CSV rows + total cost (price/fees/shipping) + date.

export interface ManaboxImportRow {
  id: string;
  name: string;
  expansion: string;
  number: string;
  language: string;
  foil: boolean;
  quantity: number;
  acquisitionId?: string;
  scannedAt: Date;
  source: string;
  externalRef: string;
  scryfallId?: string;
}

export interface BoxCost {
  price: number; // in cents
  fees: number;  // in cents
  shipping: number; // in cents
}

/**
 * Import Manabox scans with box cost
 * 
 * Steps:
 * 1. getOrCreate Acquisition by [source+externalRef]; persist total costs & happenedAt.
 * 2. Parse rows → build normalized keys → insert Scan rows with acquisitionId = A.id.
 * 3. (Optional same pass) Materialize lots from scans (see §6) and linkScanToLot().
 */
export async function importManaboxScansWithBoxCost(
  rows: ManaboxImportRow[],
  boxCost: BoxCost,
  happenedAt: Date,
  source: string,
  externalRef: string
): Promise<{ acquisitionId: string; scanIds: string[] }> {
  try {
    // 1. getOrCreate Acquisition by [source+externalRef]; persist total costs & happenedAt.
    let acquisition = await acquisitionRepository.getByExternalRef(source, externalRef);
    if (!acquisition) {
      acquisition = {
        id: `acq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        kind: 'box',
        source,
        externalRef,
        currency: 'EUR',
        happenedAt,
        totalPriceCent: boxCost.price,
        totalFeesCent: boxCost.fees,
        totalShippingCent: boxCost.shipping,
        totalCostCent: boxCost.price + boxCost.fees + boxCost.shipping,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await acquisitionRepository.add(acquisition);
    }
    
    const acquisitionId = acquisition.id;
    
    // 2. Parse rows → build normalized keys → insert Scan rows with acquisitionId = A.id.
    const scans: Omit<Scan, 'id'>[] = [];
    for (const row of rows) {
      const normalizedKey = normalizeFingerprint({
        name: row.name,
        setCode: row.expansion,
        number: row.number,
        lang: row.language,
        finish: row.foil,
      });
      
      const existingScan = await scanRepository.getByAcquisitionAndExternalRef(acquisitionId, row.externalRef);

      if (existingScan) {
        continue;
      }

      const scan: Omit<Scan, 'id'> & { acquisitionId?: string } = {
        cardFingerprint: normalizedKey.fingerprint,
        cardId: row.scryfallId, // Use scryfallId from the CSV if available
        acquisitionId,
        source: row.source,
        externalRef: row.externalRef,
        scannedAt: row.scannedAt,
        quantity: row.quantity,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      scans.push(scan);
    }
    
    // Batch insert scans
    const scanIds: string[] = [];
    for (const scan of scans) {
      const id = await scanRepository.add(scan as Scan);
      scanIds.push(id);
    }
    
    return { acquisitionId, scanIds };
  } catch (error) {
    console.error('Error importing Manabox scans with box cost:', error);
    throw error;
  }
}

// 5.2 Cardmarket SELLs
// Input: Order lines (each with card identity, qty, unit price, fees, shipping, refs, happenedAt).

export interface CardmarketSellOrderLine {
  id: string;
  cardId?: string;              // useful at import time
  lotId?: string;               // set by reconciler
  quantity: number;
  unitPrice: number;            // cents
  fees: number;                 // cents
  shipping: number;             // cents
  currency: 'EUR';
  source: string;               // 'cardmarket'
  externalRef: string;          // order+line id etc. (idempotency)
  happenedAt: Date;
  notes?: string;
  relatedTransactionId?: string;
}

/**
 * Import Cardmarket SELLs
 * 
 * Steps:
 * 1. For each line, check idempotency via [source+externalRef]; insert Transaction(kind='SELL').
 * 2. Reconciler later attaches lotId and optionally ScanSaleLinks.
 */
export async function importCardmarketSells(orderLines: CardmarketSellOrderLine[]): Promise<string[]> {
  try {
    const transactionIds: string[] = [];
    
    for (const line of orderLines) {
      // 1. For each line, check idempotency via [source+externalRef]
      const existingTransactions = await transactionRepository.getBySourceRef(line.source, line.externalRef);
      
      if (existingTransactions.length === 0) {
        // Insert Transaction(kind='SELL')
        const transaction: Omit<Transaction, 'id' | 'kind' | 'createdAt' | 'updatedAt'> = {
          cardId: line.cardId,
          lotId: line.lotId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          fees: line.fees,
          shipping: line.shipping,
          currency: line.currency,
          source: line.source,
          externalRef: line.externalRef,
          happenedAt: line.happenedAt,
          notes: line.notes,
          relatedTransactionId: line.relatedTransactionId
        };
        
        const id = await transactionRepository.add({
          ...transaction,
          id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          kind: 'SELL',
          createdAt: new Date(),
          updatedAt: new Date()
        } as Transaction);
        
        transactionIds.push(id);
      }
    }
    
    return transactionIds;
  } catch (error) {
    console.error('Error importing Cardmarket SELLs:', error);
    throw error;
  }
}

// 5.3 Deck imports
// Insert deck_cards; dedupe on deckId+cardId+addedAt. Reconciler will attach lotId when a suitable lot exists as of addedAt.

export interface DeckImportRow {
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

/**
 * Import decks
 * Insert deck_cards; dedupe on deckId+cardId+addedAt. 
 * Reconciler will attach lotId when a suitable lot exists as of addedAt.
 */
export async function importDecks(decks: Omit<Deck, 'id'>[], deckCards: DeckImportRow[]): Promise<{ deckIds: string[]; deckCardIds: string[] }> {
  try {
    const deckIds: string[] = [];
    const deckCardIds: string[] = [];
    
    // Insert decks idempotently - check if a deck with the same name already exists
    for (const deck of decks) {
      // Idempotency check for decks: use a combination of name and platform for better uniqueness.
      const allDecks = await deckRepository.getAll();
      const existingDeck = allDecks.find(d => d.name === deck.name && d.platform === deck.platform);
      
      if (!existingDeck) {
        // Generate a new ID for the new deck
        const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newDeck: Deck = {
          ...deck,
          id: newDeckId,
          createdAt: deck.createdAt || new Date(),
          updatedAt: deck.updatedAt || new Date()
        };
        
        await deckRepository.add(newDeck);
        deckIds.push(newDeck.id);
      } else {
        // If deck exists, we still add its ID to the result
        deckIds.push(existingDeck.id);
      }
    }
    
    // Insert deck_cards (idempotent on deckId+cardId)
    for (const deckCard of deckCards) {
      // Check if this combination already exists using the new repository method
      const existingCard = await deckCardRepository.getByDeckIdAndCardId(deckCard.deckId, deckCard.cardId);
      
      if (!existingCard) {
        const newDeckCard: Omit<DeckCard, 'id'> = {
          deckId: deckCard.deckId,
          cardId: deckCard.cardId,
          lotId: deckCard.lotId,
          quantity: deckCard.quantity,
          role: deckCard.role,
          addedAt: deckCard.addedAt,
          removedAt: deckCard.removedAt,
          createdAt: deckCard.createdAt || new Date()
        };
        
        // The id for deck_cards is not auto-incrementing, so we need to create one.
        // A composite key is not a real primary key in Dexie, so we create a synthetic one.
        const syntheticId = `${deckCard.deckId}-${deckCard.cardId}-${deckCard.addedAt.getTime()}`;

        await deckCardRepository.add({ ...newDeckCard, id: syntheticId } as DeckCard);
        deckCardIds.push(syntheticId);
      }
    }
    
    return { deckIds, deckCardIds };
  } catch (error) {
    console.error('Error importing decks:', error);
    throw error;
  }
}