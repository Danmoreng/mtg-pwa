// 6) Reconciler (order-agnostic core)

import { cardLotRepository, scanRepository, transactionRepository, sellAllocationRepository } from '../../data/repos';
import { type CardLot } from '../../data/db';
import { getDb } from '../../data/init';
import { v4 as uuidv4 } from 'uuid';

// 6.2 Helper APIs

/**
 * Calculate remaining quantity for a lot
 * @param lotId 
 * @returns Promise<number> - remaining quantity
 */
export async function remainingQty(lotId: string): Promise<number> {
  console.debug(`[remainingQty] Calculating for lotId: ${lotId}`);
  const lot = await cardLotRepository.getById(lotId);
  if (!lot) {
    console.debug(`[remainingQty]   -> Lot not found.`);
    return 0;
  }

  const allocations = await sellAllocationRepository.getByLotId(lotId);
  if (!allocations || !Array.isArray(allocations)) {
    console.debug(`[remainingQty]   -> No allocations found. Returning lot quantity: ${lot.quantity}`);
    return Math.max(0, lot.quantity);
  }
  const totalSold = allocations.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);
  console.debug(`[remainingQty]   -> Lot quantity: ${lot.quantity}, Total sold from allocations: ${totalSold}`);

  const remaining = Math.max(0, lot.quantity - totalSold);
  console.debug(`[remainingQty]   -> Returning remaining quantity: ${remaining}`);
  return remaining;
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
  console.debug(`[findLotsByIdentity] Finding lots for identity:`, JSON.parse(JSON.stringify(identity)), `at:`, at);
  // Get all lots for this cardId
  const lots = identity.cardId 
    ? await cardLotRepository.getByCardId(identity.cardId)
    : [];
  console.debug(`[findLotsByIdentity]   -> Found ${lots.length} lots for cardId ${identity.cardId} from repository.`);
  
  // Filter by identity characteristics
  const filteredLots = lots.filter(lot => {
    // Filter by date if provided
    if (at && lot.purchasedAt > at) {
      console.debug(`[findLotsByIdentity]   -> Filtering out lot ${lot.id} due to date (purchased ${lot.purchasedAt} > at ${at})`);
      return false;
    }
    
    // Filter by finish
    if (lot.finish !== identity.finish) {
      console.debug(`[findLotsByIdentity]   -> Filtering out lot ${lot.id} due to finish (lot: ${lot.finish}, identity: ${identity.finish})`);
      return false;
    }

    // Filter by language
    if (lot.language.toLowerCase() !== (identity.lang || 'en').toLowerCase()) {
      console.debug(`[findLotsByIdentity]   -> Filtering out lot ${lot.id} due to language (lot: ${lot.language}, identity: ${identity.lang})`);
      return false;
    }
    
    return true;
  });
  console.debug(`[findLotsByIdentity]   -> Returning ${filteredLots.length} lots after filtering.`);
  return filteredLots;
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
  // Try to find an existing provisional lot
  const existingLots = await findLotsByIdentity(identity, when);
  const provisionalLot = existingLots.find(lot => lot.source === 'provisional');
  
  // If found, return it
  if (provisionalLot) return provisionalLot;
  
  // Otherwise create a new provisional lot
  if (!identity.cardId) {
    throw new Error('Cannot create a CardLot without a cardId');
  }
  
  const newLot: Omit<CardLot, 'id'> = {
    cardId: identity.cardId,
    quantity: 0, // Starts with 0 quantity
    unitCost: 0, // Default unit cost for provisional lots
    condition: 'Near Mint', // Default condition
    language: identity.lang as string || 'en', // Final attempt with type assertion
    foil: identity.finish === 'foil' || identity.finish === 'etched', // Set foil based on finish
    finish: identity.finish,
    source: 'provisional',
    purchasedAt: when,
    acquisitionId: acquisitionId || undefined, // Change null to undefined to match interface
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Save the new lot to the repository
  const savedLotId = await cardLotRepository.add(newLot as CardLot);
  return await cardLotRepository.getById(savedLotId) as CardLot;
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
  const db = getDb();
  return db.transaction('rw', db.card_lots, db.scans, db.transactions, async () => {
    const fromLot = await cardLotRepository.getById(fromLotId);
    const targetLot = await cardLotRepository.getById(targetLotId);

    if (!fromLot || !targetLot) {
      console.error("Cannot merge lots: one or both lots not found.");
      return;
    }

    // Ensure lots are for the same card identity
    if (fromLot.cardId !== targetLot.cardId) {
      console.error("Cannot merge lots: cardId mismatch.");
      return;
    }

    // Merge logic: sum quantities, keep earliest date
    const updatedQuantity = targetLot.quantity + fromLot.quantity;
    const updatedPurchasedAt = fromLot.purchasedAt < targetLot.purchasedAt ? fromLot.purchasedAt : targetLot.purchasedAt;

    await cardLotRepository.update(targetLotId, {
      quantity: updatedQuantity,
      purchasedAt: updatedPurchasedAt,
      updatedAt: new Date(),
    });

    // Move scans from fromLotId to targetLotId
    const scans = await scanRepository.getByLotId(fromLotId);
    for (const scan of scans) {
      await scanRepository.update(scan.id, { lotId: targetLotId });
    }

    // Move transactions from fromLotId to targetLotId
    const transactions = await transactionRepository.getByLotId(fromLotId);
    for (const transaction of transactions) {
      await transactionRepository.update(transaction.id, { lotId: targetLotId });
    }

    // Delete the source lot
    await cardLotRepository.delete(fromLotId);
  });
}

// 6.3 Algorithm (per identity bucket)

/**
 * Reconcile scans to lots
 * @param identity 
 */
export async function reconcileScansToLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  // Get all scans for this identity
  const scans = identity.cardId 
    ? await scanRepository.getByCardId(identity.cardId)
    : [];
  
  // Get all lots for this identity
  const lots = await findLotsByIdentity(identity);
  
  // Process each scan
  for (const scan of scans) {
    // Skip if already linked to a lot
    if (scan.lotId) continue;
    
    // Prefer lots in the same acquisitionId (if scan has one)
    let targetLot: CardLot | null = null;
    
    // Check if scan has acquisitionId property (it might not in older versions)
    // Since Scan interface doesn't define acquisitionId, we cast to any to check
    if ((scan as any).acquisitionId) {
      targetLot = lots.find(lot => lot.acquisitionId === (scan as any).acquisitionId) || null;
    }
    
    // Else near in time (± window, bidirectional)
    if (!targetLot) {
      const timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
      const scanTime = scan.scannedAt.getTime();
      
      targetLot = lots.find(lot => {
        const lotTime = lot.purchasedAt.getTime();
        return Math.abs(lotTime - scanTime) <= timeWindow;
      }) || null;
    }
    
    // If none exist: create provisional lot with purchasedAt = scan.scannedAt and source='scan'
    if (!targetLot) {
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
  console.debug(`[reconcileSellsToLots] Processing identity:`, JSON.parse(JSON.stringify(identity)));
  // Get all SELL transactions for this identity
  const sells = identity.cardId
    ? await transactionRepository.getSellTransactionsByCardId(identity.cardId)
    : [];
  console.debug(`[reconcileSellsToLots] Found ${sells.length} total sells for cardId ${identity.cardId}`);

  for (const sell of sells) {
    console.debug(`[reconcileSellsToLots] Processing sell transaction:`, JSON.parse(JSON.stringify(sell)));
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
      console.debug(`[reconcileSellsToLots]   -> SKIPPING sell, does not match identity finish/lang. Sell: ${sellFinish}/${sellLanguage}, Identity: ${identityFinish}/${identityLanguage}`);
      continue;
    }

    // Pick a lot with remainingQty > 0 and nearest purchasedAt.
    // The date filter is removed here to allow matching lots even if their purchase date is after the sale date.
    // The subsequent sort by time proximity will still prefer the closest match.
    const lots = await findLotsByIdentity(identity);
    console.debug(`[reconcileSellsToLots]   -> Found ${lots.length} candidate lots from findLotsByIdentity.`);

    const availableLots = [];

    for (const lot of lots) {
      const remaining = await remainingQty(lot.id);
      if (remaining > 0) {
        availableLots.push({ lot, remaining });
      }
    }
    console.debug(`[reconcileSellsToLots]   -> Found ${availableLots.length} available lots with remaining > 0.`);

    if (availableLots.length === 0) {
      console.debug(`[reconcileSellsToLots]   -> No available lots found with remaining quantity. Attempting to link to any existing lot of the same card.`);
      
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
        console.debug(`[reconcileSellsToLots]   -> No lots of this card exist at all. Creating provisional lot for sell transaction.`);
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
    console.debug(`[reconcileSellsToLots]   -> Sorted available lots by time proximity:`, JSON.parse(JSON.stringify(availableLots.map(l => l.lot))));

    await allocateSellAcrossLots(sell, availableLots.map(l => l.lot), identity);
  }
}

/**
 * Consolidate provisional lots
 * @param identity 
 */
export async function consolidateProvisionalLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  // Get all lots for this identity
  const lots = await findLotsByIdentity(identity);
  
  // Find provisional lots
  const provisionalLots = lots.filter(lot => lot.source === 'provisional');
  
  // Find real lots (non-provisional)
  const realLots = lots.filter(lot => lot.source !== 'provisional');
  
  // Merge provisional lots into real lots when they match
  for (const provisionalLot of provisionalLots) {
    // Look for a real lot that could absorb this provisional lot
    const matchingRealLot = realLots.find(realLot => {
      // Same acquisitionId if both have one
      if (provisionalLot.acquisitionId && realLot.acquisitionId) {
        return provisionalLot.acquisitionId === realLot.acquisitionId;
      }
      
      // Same time window (within 30 days)
      const timeDiff = Math.abs(
        provisionalLot.purchasedAt.getTime() - realLot.purchasedAt.getTime()
      );
      return timeDiff <= 30 * 24 * 60 * 60 * 1000; // 30 days
    });
    
    if (matchingRealLot) {
      // Merge provisional lot into real lot
      await mergeLots(matchingRealLot.id, provisionalLot.id);
    }
  }
}

/**
 * Run the full reconciler for all identities
 */
import { getDb, dbPromise } from '../../data/init';

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
  const lockKey = identity.fingerprint || identity.cardId;
  if (!lockKey || reconcilerLocks.has(lockKey)) {
    if(lockKey) console.warn(`Reconciliation for ${lockKey} is already in progress.`);
    return;
  }

  reconcilerLocks.add(lockKey);
  try {
    // 1. Scans → lots
    await reconcileScansToLots(identity);
    
    // 2. SELLs → lots
    await reconcileSellsToLots(identity);
    
    // 3. Consolidation
    await consolidateProvisionalLots(identity);
  } finally {
    reconcilerLocks.delete(lockKey);
  }
}