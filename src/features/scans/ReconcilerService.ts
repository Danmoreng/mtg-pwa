// 6) Reconciler (order-agnostic core)

import { cardLotRepository, scanRepository, transactionRepository, sellAllocationRepository, cardRepository } from '../../data/repos';
import { type CardLot } from '../../data/db';
import { getDb, dbPromise } from '../../data/init';
import { v4 as uuidv4 } from 'uuid';

// Add comprehensive logging functionality
function logReconciler(level: 'info' | 'error' | 'debug', message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[ReconcilerService] ${timestamp} ${level.toUpperCase()}: ${message}`;
  if (meta) {
    console.log(logMessage, meta);
  } else {
    console.log(logMessage);
  }
}

function logError(message: string, error: any, meta?: any) {
  logReconciler('error', message, {
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    ...meta
  });
}

// 6.2 Helper APIs

/**
 * Calculate remaining quantity for a lot
 * @param lotId 
 * @returns Promise<number> - remaining quantity
 */
export async function remainingQty(lotId: string): Promise<number> {
  logReconciler('debug', `Calculating remaining quantity for lot: ${lotId}`);
  try {
    const lot = await cardLotRepository.getById(lotId);
    if (!lot) {
      logReconciler('debug', `Lot not found: ${lotId}`);
      return 0;
    }

    const allocations = await sellAllocationRepository.getByLotId(lotId);
    if (!allocations || !Array.isArray(allocations)) {
      logReconciler('debug', `No allocations found for lot: ${lotId}, returning quantity: ${lot.quantity}`);
      return Math.max(0, lot.quantity);
    }
    
    const totalSold = allocations.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);
    logReconciler('debug', `Total sold for lot ${lotId}: ${totalSold}, original quantity: ${lot.quantity}`);

    const remaining = Math.max(0, lot.quantity - totalSold);
    logReconciler('debug', `Remaining quantity for lot ${lotId}: ${remaining}`);
    return remaining;
  } catch (error) {
    logError(`Error calculating remaining quantity for lot ${lotId}`, error);
    throw error;
  }
}

/**
 * Find lots by identity
 * @param identity 
 * @param at 
 * @returns Promise<CardLot[]> - matching lots
 */
export async function findLotsByIdentity(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string },
  at?: Date
): Promise<CardLot[]> {
  logReconciler('debug', `Finding lots by identity: ${JSON.stringify(identity)}, at: ${at}`);
  try {
    // Get all lots for this cardId
    const lots = identity.cardId
      ? await cardLotRepository.getByCardId(identity.cardId)
      : [];
    logReconciler('debug', `Found ${lots.length} lots for cardId: ${identity.cardId}`);

    // Filter by identity characteristics
    const filteredLots = lots.filter(lot => {
      // Filter by date if provided
      if (at && lot.purchasedAt > at) {
        logReconciler('debug', `Lot ${lot.id} filtered out due to date constraint: ${lot.purchasedAt} > ${at}`);
        return false;
      }

      // Filter by finish
      if (lot.finish !== identity.finish) {
        logReconciler('debug', `Lot ${lot.id} filtered out due to finish mismatch: ${lot.finish} !== ${identity.finish}`);
        return false;
      }

      // Filter by language
      const identityLang = identity.lang || 'en';
      if (lot.language.toLowerCase() !== identityLang.toLowerCase()) {
        logReconciler('debug', `Lot ${lot.id} filtered out due to language mismatch: ${lot.language.toLowerCase()} !== ${identityLang.toLowerCase()}`);
        return false;
      }

      logReconciler('debug', `Lot ${lot.id} passed all filters`);
      return true;
    });
    
    logReconciler('debug', `Returning ${filteredLots.length} filtered lots for identity: ${JSON.stringify(identity)}`);
    return filteredLots;
  } catch (error) {
    logError(`Error finding lots by identity: ${JSON.stringify(identity)}`, error);
    throw error;
  }
}

/**
 * Find or create provisional lot
 * @param identity 
 * @param when 
 * @param source 
 * @param acquisitionId 
 * @returns Promise<CardLot> - the provisional lot
 */
export async function findOrCreateProvisionalLot(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string },
  when: Date,
  _source: string,
  acquisitionId?: string
): Promise<CardLot> {
  logReconciler('debug', `Finding or creating provisional lot for identity: ${JSON.stringify(identity)}, at: ${when}`);
  
  // Validate input parameters before processing
  if (!identity) {
    throw new Error('Identity object is required for finding or creating a provisional lot');
  }
  
  if (!identity.cardId) {
    logReconciler('error', 'Cannot create a CardLot without a cardId');
    throw new Error('Cannot create a CardLot without a cardId');
  }
  
  if (!identity.finish) {
    throw new Error(`Cannot create a CardLot without a finish property. Identity: ${JSON.stringify(identity)}`);
  }
  
  if (!when || !(when instanceof Date)) {
    throw new Error(`Invalid date provided for provisional lot creation: ${when}`);
  }
  
  try {
    // Try to find an existing provisional lot
    const existingLots = await findLotsByIdentity(identity, when);
    const provisionalLot = existingLots.find(lot => lot.source === 'provisional');
    
    // If found, return it
    if (provisionalLot) {
      logReconciler('debug', `Found existing provisional lot: ${provisionalLot.id}`);
      return provisionalLot;
    }
    
    logReconciler('debug', `No existing provisional lot found, creating new one`);
    
    // Verify card exists before creating lot
    const card = await cardRepository.getById(identity.cardId);
    if (!card) {
      logReconciler('error', `Cannot create lot for non-existent cardId: ${identity.cardId}, skipping provisional lot creation`);
      // Instead of throwing, we should return a dummy lot or handle this situation gracefully
      // For now, let's return a default lot object to allow the process to continue
      // But this should ideally be handled at a higher level
      throw new Error(`Cannot create lot for non-existent cardId: ${identity.cardId}`);
    }
    
    // Ensure all dates are properly handled as Date objects
    const now = new Date();
    const purchaseDate = when instanceof Date ? when : new Date(when);
    
    const provisionalLotId = `lot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const newLot: CardLot = {
      id: provisionalLotId,
      cardId: identity.cardId,
      quantity: 0, // Starts with 0 quantity
      unitCost: 0, // Default unit cost for provisional lots
      condition: 'NM',
      language: (identity.lang || 'en'), // Ensure language is properly set
      foil: identity.finish === 'foil' || identity.finish === 'etched', // Set foil based on finish
      finish: identity.finish,
      source: 'provisional',
      purchasedAt: purchaseDate,
      acquisitionId: acquisitionId || undefined, // Change null to undefined to match interface
      createdAt: now,
      updatedAt: now,
    };
    
    // Validate the constructed lot before saving
    if (!newLot.id || typeof newLot.id !== 'string') {
      throw new Error(`Invalid id in new lot: ${newLot.id}`);
    }

    if (!newLot.cardId || typeof newLot.cardId !== 'string') {
      throw new Error(`Invalid cardId in new lot: ${newLot.cardId}`);
    }
    
    if (typeof newLot.quantity !== 'number' || newLot.quantity < 0) {
      throw new Error(`Invalid quantity in new lot: ${newLot.quantity}`);
    }
    
    if (typeof newLot.unitCost !== 'number' || newLot.unitCost < 0) {
      throw new Error(`Invalid unitCost in new lot: ${newLot.unitCost}`);
    }
    
    if (!newLot.condition || typeof newLot.condition !== 'string') {
      throw new Error(`Invalid condition in new lot: ${newLot.condition}`);
    }
    
    if (!newLot.language || typeof newLot.language !== 'string') {
      throw new Error(`Invalid language in new lot: ${newLot.language}`);
    }
    
    if (typeof newLot.foil !== 'boolean') {
      throw new Error(`Invalid foil in new lot: ${newLot.foil}`);
    }
    
    if (!newLot.finish || typeof newLot.finish !== 'string') {
      throw new Error(`Invalid finish in new lot: ${newLot.finish}`);
    }
    
    if (!newLot.source || typeof newLot.source !== 'string') {
      throw new Error(`Invalid source in new lot: ${newLot.source}`);
    }
    
    if (!newLot.purchasedAt || !(newLot.purchasedAt instanceof Date)) {
      throw new Error(`Invalid purchasedAt in new lot: ${newLot.purchasedAt}`);
    }
    
    if (newLot.acquisitionId !== undefined && typeof newLot.acquisitionId !== 'string') {
      throw new Error(`Invalid acquisitionId in new lot: ${newLot.acquisitionId}`);
    }
    
    if (!newLot.createdAt || !(newLot.createdAt instanceof Date)) {
      throw new Error(`Invalid createdAt in new lot: ${newLot.createdAt}`);
    }
    
    if (!newLot.updatedAt || !(newLot.updatedAt instanceof Date)) {
      throw new Error(`Invalid updatedAt in new lot: ${newLot.updatedAt}`);
    }
    
    logReconciler('debug', `Creating new provisional lot with cardId: ${identity.cardId}`);
    logReconciler('debug', `Lot details:`, newLot);
    
    // Try to add the new lot to the repository with better error handling
    let savedLotId: string;
    try {
      savedLotId = await cardLotRepository.add(newLot);
    } catch (dbError) {
      logReconciler('error', `Database error when adding new lot:`, {
        error: dbError,
        lotData: newLot,
        cardId: identity.cardId,
        purchaseDateType: typeof newLot.purchasedAt,
        createdAtType: typeof newLot.createdAt,
        updatedAtType: typeof newLot.updatedAt,
        purchaseDateValue: newLot.purchasedAt,
        createdAtValue: newLot.createdAt,
        updatedAtValue: newLot.updatedAt
      });
      
      // Additional debug: Check if there might be an issue with date formatting
      if (newLot.purchasedAt && !(newLot.purchasedAt instanceof Date)) {
        logReconciler('error', `purchasedAt is not a Date object:`, newLot.purchasedAt);
      }
      
      // Re-throw with more context
      throw new Error(`Database error creating provisional lot: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }
    logReconciler('debug', `Created new provisional lot with ID: ${savedLotId}`);
    
    const createdLot = await cardLotRepository.getById(savedLotId) as CardLot;
    logReconciler('debug', `Returning created provisional lot: ${createdLot.id}`);
    
    return createdLot;
  } catch (error) {
    logError(`Error finding or creating provisional lot for identity: ${JSON.stringify(identity)}`, error);
    throw error;
  }
}

/**
 * Link scan to lot
 * @param scanId 
 * @param lotId 
 */
export async function linkScanToLot(scanId: string, lotId: string): Promise<void> {
  await scanRepository.update(scanId, { lotId });
}

/**
 * Reassign SELL transaction to lot
 * @param transactionId 
 * @param lotId 
 */
export async function reassignSellToLot(transactionId: string, lotId: string): Promise<void> {
  await transactionRepository.update(transactionId, { lotId });
}

/**
 * Merge lots (moves scans and transactions)
 * @param targetLotId 
 * @param fromLotId 
 */
export async function mergeLots(targetLotId: string, fromLotId:string): Promise<void> {
  logReconciler('info', `Starting mergeLots: from ${fromLotId} to ${targetLotId}`);
  const startTime = Date.now();
  
  // Validate input parameters before processing
  if (!targetLotId || typeof targetLotId !== 'string') {
    throw new Error(`Invalid targetLotId provided to mergeLots: ${targetLotId}`);
  }
  
  if (!fromLotId || typeof fromLotId !== 'string') {
    throw new Error(`Invalid fromLotId provided to mergeLots: ${fromLotId}`);
  }

  try {
    const db = getDb();
    await db.transaction('rw', db.card_lots, db.scans, db.transactions, async () => {
      const fromLot = await cardLotRepository.getById(fromLotId);
      const targetLot = await cardLotRepository.getById(targetLotId);

      if (!fromLot || !targetLot) {
        logReconciler('error', `Cannot merge lots: one or both lots not found. fromLot=${!!fromLot}, targetLot=${!!targetLot}`);
        throw new Error(`Cannot merge lots: one or both lots not found. fromLot=${!!fromLot}, targetLot=${!!targetLot}`);
      }

      // Ensure lots are for the same card identity
      if (fromLot.cardId !== targetLot.cardId) {
        logReconciler('error', `Cannot merge lots: cardId mismatch. fromLot.cardId=${fromLot.cardId}, targetLot.cardId=${targetLot.cardId}`);
        throw new Error(`Cannot merge lots: cardId mismatch. fromLot.cardId=${fromLot.cardId}, targetLot.cardId=${targetLot.cardId}`);
      }

      logReconciler('debug', `Merging lot ${fromLotId} into ${targetLotId}, quantities: ${fromLot.quantity} + ${targetLot.quantity}`);

      // Merge logic: sum quantities, keep earliest date
      const updatedQuantity = targetLot.quantity + fromLot.quantity;
      const updatedPurchasedAt = fromLot.purchasedAt < targetLot.purchasedAt ? fromLot.purchasedAt : targetLot.purchasedAt;

      await cardLotRepository.update(targetLotId, {
        quantity: updatedQuantity,
        purchasedAt: updatedPurchasedAt,
        updatedAt: new Date(),
      });
      logReconciler('debug', `Updated target lot ${targetLotId} quantity to ${updatedQuantity}`);

      // Move scans from fromLotId to targetLotId
      const scans = await scanRepository.getByLotId(fromLotId);
      logReconciler('debug', `Moving ${scans.length} scans from lot ${fromLotId} to ${targetLotId}`);
      for (const scan of scans) {
        await scanRepository.update(scan.id, { lotId: targetLotId });
      }

      // Move transactions from fromLotId to targetLotId
      const transactions = await transactionRepository.getByLotId(fromLotId);
      logReconciler('debug', `Moving ${transactions.length} transactions from lot ${fromLotId} to ${targetLotId}`);
      for (const transaction of transactions) {
        await transactionRepository.update(transaction.id, { lotId: targetLotId });
      }

      // Delete the source lot
      await cardLotRepository.delete(fromLotId);
      logReconciler('debug', `Deleted source lot ${fromLotId}`);
    });
    
    logReconciler('info', `Completed mergeLots: from ${fromLotId} to ${targetLotId} in ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(`Error in mergeLots: from ${fromLotId} to ${targetLotId}`, error);
    throw error;
  }
}

// 6.3 Algorithm (per identity bucket)

/**
 * Reconcile scans to lots
 * @param identity 
 */
export async function reconcileScansToLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  logReconciler('info', `Starting reconcileScansToLots for identity: ${JSON.stringify(identity)}`);
  const startTime = Date.now();
  
  try {
    // Check if cardId exists in the database first
    if (identity.cardId) {
      const card = await cardRepository.getById(identity.cardId);
      if (!card) {
        logReconciler('info', `Skipping reconcileScansToLots for identity with non-existent cardId: ${identity.cardId}`);
        return; // Skip this identity if the card doesn't exist
      }
    }
    
    // Get all scans for this identity
    const scans = identity.cardId 
      ? await scanRepository.getByCardId(identity.cardId)
      : [];
    
    logReconciler('debug', `Found ${scans.length} scans for identity: ${JSON.stringify(identity)}`);
    
    // Get all lots for this identity
    const lots = await findLotsByIdentity(identity);
    logReconciler('debug', `Found ${lots.length} lots for identity: ${JSON.stringify(identity)}`);
    
    // Process each scan
    for (const scan of scans) {
      // Skip if already linked to a lot
      if (scan.lotId) {
        logReconciler('debug', `Skipping scan ${scan.id}, already linked to lot ${scan.lotId}`);
        continue;
      }
      
      logReconciler('debug', `Processing unlinked scan: ${scan.id}`);
      
      // Prefer lots in the same acquisitionId (if scan has one)
      let targetLot: CardLot | null = null;
      
      // Check if scan has acquisitionId property (it might not in older versions)
      // Since Scan interface doesn't define acquisitionId, we cast to any to check
      if ((scan as any).acquisitionId) {
        targetLot = lots.find(lot => lot.acquisitionId === (scan as any).acquisitionId) || null;
        if (targetLot) {
          logReconciler('debug', `Found lot ${targetLot.id} matching acquisitionId for scan ${scan.id}`);
        }
      }
      
      // Else near in time (± window, bidirectional)
      if (!targetLot) {
        const timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
        const scanTime = scan.scannedAt.getTime();
        
        targetLot = lots.find(lot => {
          const lotTime = lot.purchasedAt.getTime();
          const timeDiff = Math.abs(lotTime - scanTime);
          if (timeDiff <= timeWindow) {
            logReconciler('debug', `Found lot ${lot.id} within time window (${timeDiff}ms) for scan ${scan.id}`);
            return true;
          }
          return false;
        }) || null;
      }
      
      // If none exist: create provisional lot with purchasedAt = scan.scannedAt and source='scan'
      if (!targetLot) {
        logReconciler('debug', `No existing lot found for scan ${scan.id}, creating provisional lot`);
        targetLot = await findOrCreateProvisionalLot(
          { 
            ...identity, 
            lang: identity.lang || 'en'  // Ensure lang is defined
          },
          scan.scannedAt,
          'scan',
          (scan as any).acquisitionId ? (scan as any).acquisitionId : undefined
        );
      }
      
      // Link scan to lot
      await linkScanToLot(scan.id, targetLot.id);
      logReconciler('debug', `Linked scan ${scan.id} to lot ${targetLot.id}`);
    }
    logReconciler('info', `Completed reconcileScansToLots for identity: ${JSON.stringify(identity)} in ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(`Error in reconcileScansToLots for identity: ${JSON.stringify(identity)}`, error);
    throw error;
  }
}

async function snapshotUnitCost(lotId: string, _when: Date): Promise<number> {
  const lot = await cardLotRepository.getById(lotId);
  return lot?.unitCost ?? 0;
}

async function allocateSellAcrossLots(sell: import("../../data/db").Transaction, lots: CardLot[], identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }) {
  let remaining = sell.quantity;

  // clear prior allocations (re-import idempotency)
  await sellAllocationRepository.deleteByTransactionId(sell.id);

  for (const lot of lots) {
    const free = await remainingQty(lot.id);
    if (free <= 0) continue;
    const take = Math.min(free, remaining);

    await sellAllocationRepository.add({
      id: uuidv4(),
      transactionId: sell.id,
      lotId: lot.id,
      quantity: take,
      unitCostCentAtSale: await snapshotUnitCost(lot.id, sell.happenedAt),
      createdAt: new Date()
    });

    remaining -= take;
    if (remaining === 0) break;
  }

  // If still >0, create provisional lot as you do today and allocate the remainder from it
  if (remaining > 0) {
    const prov = await findOrCreateProvisionalLot(identity, sell.happenedAt, 'backfill');
    await sellAllocationRepository.add({
        id: uuidv4(),
        transactionId: sell.id,
        lotId: prov.id,
        quantity: remaining,
        unitCostCentAtSale: await snapshotUnitCost(prov.id, sell.happenedAt),
        createdAt: new Date()
    });
  }

  // (Backward compat) keep sell.lotId:
  // - set to the first allocated lotId (or null if none)
  const first = (await sellAllocationRepository.getByTransactionId(sell.id))[0];
  await transactionRepository.update(sell.id, { lotId: first?.lotId ?? null });
}

/**
 * Reconcile SELLs to lots
 * @param identity 
 */
export async function reconcileSellsToLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  logReconciler('info', `Starting reconcileSellsToLots for identity: ${JSON.stringify(identity)}`);
  const startTime = Date.now();
  
  try {
    // Check if cardId exists in the database first
    if (identity.cardId) {
      const card = await cardRepository.getById(identity.cardId);
      if (!card) {
        logReconciler('info', `Skipping reconcileSellsToLots for identity with non-existent cardId: ${identity.cardId}`);
        return; // Skip this identity if the card doesn't exist
      }
    }
    
    // Get all SELL transactions for this identity
    const sells = identity.cardId
      ? await transactionRepository.getSellTransactionsByCardId(identity.cardId)
      : [];

    logReconciler('debug', `Found ${sells.length} sell transactions for identity: ${JSON.stringify(identity)}`);

    for (const sell of sells) {
      logReconciler('debug', `Processing sell transaction: ${sell.id}`);
      
      // Filter sells to match the exact identity (finish, lang)
      // Check if finish matches, or if one of them is not defined, match with default 'nonfoil'
      const sellFinish = sell.finish || 'nonfoil';
      const identityFinish = identity.finish || 'nonfoil';
      const finishMatches = sellFinish.toLowerCase() === identityFinish.toLowerCase();

      // Check if language matches, or if one of them is not defined, match with default 'en'
      const sellLanguage = sell.language || 'en';
      const identityLanguage = identity.lang || 'en';
      const languageMatches = sellLanguage.toLowerCase() === identityLanguage.toLowerCase();

      if (!finishMatches || !languageMatches) {
        logReconciler('debug', `Sell transaction ${sell.id} does not match finish/language, skipping`);
        continue;
      }

      // Pick a lot with remainingQty > 0 and nearest purchasedAt.
      // The date filter is removed here to allow matching lots even if their purchase date is after the sale date.
      // The subsequent sort by time proximity will still prefer the closest match.
      const lots = await findLotsByIdentity(identity);
      logReconciler('debug', `Found ${lots.length} lots for sell ${sell.id}`);

      const availableLots = [];

      for (const lot of lots) {
        const remaining = await remainingQty(lot.id);
        logReconciler('debug', `Lot ${lot.id} has remaining quantity: ${remaining}`);
        if (remaining > 0) {
          availableLots.push({ lot, remaining });
        }
      }

      if (availableLots.length === 0) {
        logReconciler('debug', `No available lots found for sell ${sell.id}, creating provisional or using existing`);
        // If no available lots are found but we still want to link the transaction to a lot,
        // at least try to link it to an existing lot of the same card for reference
        if (lots.length > 0) {
          // Sort by proximity to happenedAt anyway
          lots.sort((a, b) => {
            const timeA = Math.abs(a.purchasedAt.getTime() - sell.happenedAt.getTime());
            const timeB = Math.abs(b.purchasedAt.getTime() - sell.happenedAt.getTime());
            return timeA - timeB;
          });

          // Allocate to the first lot with quantity 0
          await allocateSellAcrossLots(sell, lots, identity);
        } else {
          // Create a provisional lot for the sell transaction if no lots exist
          const provisionalLot = await findOrCreateProvisionalLot(
            identity,
            sell.happenedAt,
            'sell-backfill',
            undefined
          );
          await allocateSellAcrossLots(sell, [provisionalLot], identity);
        }
        continue;
      }

      // Sort by proximity to happenedAt
      availableLots.sort((a, b) => {
        const timeA = Math.abs(a.lot.purchasedAt.getTime() - sell.happenedAt.getTime());
        const timeB = Math.abs(b.lot.purchasedAt.getTime() - sell.happenedAt.getTime());
        return timeA - timeB;
      });

      await allocateSellAcrossLots(sell, availableLots.map(l => l.lot), identity);
    }
    logReconciler('info', `Completed reconcileSellsToLots for identity: ${JSON.stringify(identity)} in ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(`Error in reconcileSellsToLots for identity: ${JSON.stringify(identity)}`, error);
    throw error;
  }
}

/**
 * Consolidate provisional lots
 * @param identity 
 */
export async function consolidateProvisionalLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  logReconciler('info', `Starting consolidateProvisionalLots for identity: ${JSON.stringify(identity)}`);
  const startTime = Date.now();
  
  try {
    // Check if cardId exists in the database first
    if (identity.cardId) {
      const card = await cardRepository.getById(identity.cardId);
      if (!card) {
        logReconciler('info', `Skipping consolidateProvisionalLots for identity with non-existent cardId: ${identity.cardId}`);
        return; // Skip this identity if the card doesn't exist
      }
    }
    
    // Get all lots for this identity
    const lots = await findLotsByIdentity(identity);
    
    // Find provisional lots
    const provisionalLots = lots.filter(lot => lot.source === 'provisional');
    logReconciler('debug', `Found ${provisionalLots.length} provisional lots for identity: ${JSON.stringify(identity)}`);
    
    // Find real lots (non-provisional)
    const realLots = lots.filter(lot => lot.source !== 'provisional');
    logReconciler('debug', `Found ${realLots.length} real lots for identity: ${JSON.stringify(identity)}`);
    
    // Merge provisional lots into real lots when they match
    for (const provisionalLot of provisionalLots) {
      logReconciler('debug', `Processing consolidation for provisional lot: ${provisionalLot.id}`);
      
      // Look for a real lot that could absorb this provisional lot
      const matchingRealLot = realLots.find(realLot => {
        // Same acquisitionId if both have one
        if (provisionalLot.acquisitionId && realLot.acquisitionId) {
          const match = provisionalLot.acquisitionId === realLot.acquisitionId;
          if (match) {
            logReconciler('debug', `Found matching acquisitionId for lot ${provisionalLot.id} and real lot ${realLot.id}`);
          }
          return match;
        }
        
        // Same time window (within 30 days)
        const timeDiff = Math.abs(
          provisionalLot.purchasedAt.getTime() - realLot.purchasedAt.getTime()
        );
        const timeMatch = timeDiff <= 30 * 24 * 60 * 60 * 1000; // 30 days
        if (timeMatch) {
          logReconciler('debug', `Found time window match for lot ${provisionalLot.id} and real lot ${realLot.id}, diff: ${timeDiff}ms`);
        }
        return timeMatch;
      });
      
      if (matchingRealLot) {
        logReconciler('debug', `Merging provisional lot ${provisionalLot.id} into real lot ${matchingRealLot.id}`);
        // Merge provisional lot into real lot
        await mergeLots(matchingRealLot.id, provisionalLot.id);
      } else {
        logReconciler('debug', `No matching real lot found for provisional lot ${provisionalLot.id}, skipping consolidation`);
      }
    }
    logReconciler('info', `Completed consolidateProvisionalLots for identity: ${JSON.stringify(identity)} in ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(`Error in consolidateProvisionalLots for identity: ${JSON.stringify(identity)}`, error);
    throw error;
  }
}

/**
 * Run the full reconciler for all identities
 */
export async function runFullReconciler(): Promise<void> {
  const db = await dbPromise;
  // Get all unique card identities from scans and transactions
  const allScans = await scanRepository.getAll(db);
  const allTransactions = await transactionRepository.getAll(db);

  const identities = new Map<string, { cardId: string, finish: string, lang: string }>();

  function addIdentity(cardId: string, finish?: string, lang?: string) {
      const f = finish || 'nonfoil';
      const l = lang || 'en';
      const key = `${cardId}:${f}:${l}`;
      if (!identities.has(key)) {
          identities.set(key, { cardId, finish: f, lang: l });
      }
  }

  for (const scan of allScans) {
      if (scan.cardId) {
          addIdentity(scan.cardId, scan.finish, scan.language);
      }
  }

  for (const tx of allTransactions) {
      if (tx.cardId) {
          addIdentity(tx.cardId, tx.finish, tx.language);
      }
  }

  // Process each unique identity
  for (const identity of identities.values()) {
      await runReconciler({
          ...identity,
          fingerprint: `${identity.cardId}:${identity.finish}:${identity.lang}`
      });
  }
}

const reconcilerLocks = new Set<string>();

/**
 * Run the full reconciler for an identity
 * @param identity 
 */
export async function runReconciler(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  const startTime = Date.now();
  logReconciler('info', `Starting reconciliation for identity: ${JSON.stringify(identity)}`, { startTime: new Date(startTime) });
  
  // Validate the identity object before processing
  if (!identity) {
    throw new Error('Identity object is required for reconciliation');
  }
  
  if (!identity.fingerprint) {
    throw new Error('Identity must have a fingerprint property for reconciliation');
  }
  
  if (!identity.finish) {
    throw new Error('Identity must have a finish property for reconciliation');
  }
  
  // If cardId is provided, it should be a valid string
  if (identity.cardId && typeof identity.cardId !== 'string') {
    throw new Error(`Invalid cardId provided to reconciliation: ${identity.cardId}`);
  }
  
  const lockKey = identity.fingerprint || identity.cardId;
  if (!lockKey || reconcilerLocks.has(lockKey)) {
    logReconciler('debug', `Reconciliation for ${lockKey} is already in progress, skipping.`);
    // Optional: A less noisy warning, or telemetry
    // if(lockKey) console.warn(`Reconciliation for ${lockKey} is already in progress.`);
    return;
  }

  reconcilerLocks.add(lockKey);
  try {
    logReconciler('info', 'Starting step 1: Scans → lots');
    const step1Start = Date.now();
    // 1. Scans → lots
    await reconcileScansToLots(identity);
    logReconciler('info', `Completed step 1: Scans → lots in ${Date.now() - step1Start}ms`);
    
    logReconciler('info', 'Starting step 2: SELLs → lots');
    const step2Start = Date.now();
    // 2. SELLs → lots
    await reconcileSellsToLots(identity);
    logReconciler('info', `Completed step 2: SELLs → lots in ${Date.now() - step2Start}ms`);
    
    logReconciler('info', 'Starting step 3: Consolidation');
    const step3Start = Date.now();
    // 3. Consolidation
    await consolidateProvisionalLots(identity);
    logReconciler('info', `Completed step 3: Consolidation in ${Date.now() - step3Start}ms`);
  } catch (error) {
    logError(`Reconciliation failed for identity: ${JSON.stringify(identity)}`, error);
    throw error;
  } finally {
    reconcilerLocks.delete(lockKey);
    logReconciler('info', `Completed reconciliation for identity: ${JSON.stringify(identity)} in ${Date.now() - startTime}ms`);
  }
}
