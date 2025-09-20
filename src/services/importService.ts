// 5) Import pipelines (order-agnostic & idempotent)

import { acquisitionRepository, transactionRepository, deckCardRepository, deckRepository } from '../data/repos';
import { normalizeFingerprint } from '../utils/normalization';
import type { Acquisition, Transaction, Deck, DeckCard } from '../data/db';
import type { Scan } from '../data/db';
import { scanRepository } from '../data/repos';

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
      
      const scan: Omit<Scan, 'id'> = {
        cardFingerprint: normalizedKey.fingerprint,
        cardId: row.id, // assuming row.id is the cardId
        acquisitionId,
        source: row.source,
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
    
    // Insert decks (idempotent on deckId)
    for (const deck of decks) {
      const existingDeck = await deckRepository.getById(deck.id);
      if (!existingDeck) {
        const newDeck: Deck = {
          ...deck,
          id: deck.id,
          createdAt: deck.createdAt || new Date(),
          updatedAt: deck.updatedAt || new Date()
        };
        await deckRepository.add(newDeck);
        deckIds.push(newDeck.id);
      }
    }
    
    // Insert deck_cards (idempotent on deckId+cardId+addedAt)
    for (const deckCard of deckCards) {
      // Check if this combination already exists
      const existingDeckCards = await deckCardRepository.getByDeckId(deckCard.deckId);
      const existingCard = existingDeckCards.find(dc => 
        dc.cardId === deckCard.cardId && 
        dc.addedAt.getTime() === deckCard.addedAt.getTime()
      );
      
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
        
        await deckCardRepository.add(newDeckCard as DeckCard);
        deckCardIds.push(newDeckCard.deckId + '-' + newDeckCard.cardId); // Using composite key as ID
      }
    }
    
    return { deckIds, deckCardIds };
  } catch (error) {
    console.error('Error importing decks:', error);
    throw error;
  }
}