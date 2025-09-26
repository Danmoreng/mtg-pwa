// 6) Reconciler (order-agnostic core)

import { cardLotRepository, scanRepository, transactionRepository } from '../../data/repos';
import db, { type CardLot } from '../../data/db';

// 6.2 Helper APIs

/**
 * Calculate remaining quantity for a lot
 * @param lotId 
 * @returns Promise<number> - remaining quantity
 */
export async function remainingQty(lotId: string): Promise<number> {
  const lot = await cardLotRepository.getById(lotId);
  if (!lot) return 0;
  
  const sellTransactions = await transactionRepository.getByLotId(lotId);
  const totalSold = sellTransactions
    .filter(tx => tx.kind === 'SELL')
    .reduce((sum, tx) => sum + (tx.quantity || 0), 0);
  
  return Math.max(0, lot.quantity - totalSold);
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
  // Get all lots for this cardId
  const lots = identity.cardId 
    ? await cardLotRepository.getByCardId(identity.cardId)
    : [];
  
  // Filter by identity characteristics
  return lots.filter(lot => {
    // Filter by date if provided
    if (at && lot.purchasedAt > at) return false;
    
    // Filter by finish and language
    if (lot.finish !== identity.finish) return false;
    if (lot.language !== (identity.lang || 'EN')) return false;  // Handle undefined lang with default
    
    return true;
  });
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
    language: identity.lang as string || 'EN', // Final attempt with type assertion
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
          lang: identity.lang || 'EN'  // Ensure lang is defined
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

/**
 * Reconcile SELLs to lots
 * @param identity 
 */
export async function reconcileSellsToLots(
  identity: { cardId?: string; fingerprint: string; finish: string; lang?: string }
): Promise<void> {
  // Get all SELL transactions for this identity
  const sells = identity.cardId
    ? await transactionRepository.getSellTransactionsByCardId(identity.cardId)
    : [];
  
  // Process each SELL without lotId
  for (const sell of sells) {
    if (sell.lotId) continue;
    
    // Pick a lot with remainingQty > 0 and nearest purchasedAt ≤ or near happenedAt
    const lots = await findLotsByIdentity(identity, sell.happenedAt);
    const availableLots = [];
    
    for (const lot of lots) {
      const remaining = await remainingQty(lot.id);
      if (remaining > 0) {
        availableLots.push({ lot, remaining });
      }
    }
    
    // Sort by proximity to happenedAt
    availableLots.sort((a, b) => {
      const timeA = Math.abs(a.lot.purchasedAt.getTime() - sell.happenedAt.getTime());
      const timeB = Math.abs(b.lot.purchasedAt.getTime() - sell.happenedAt.getTime());
      return timeA - timeB;
    });
    
    let targetLot = availableLots[0]?.lot || null;
    
    // If none exist: create provisional lot (source='backfill', purchasedAt = happenedAt)
    if (!targetLot) {
      targetLot = await findOrCreateProvisionalLot(
        { 
          ...identity, 
          lang: identity.lang || 'EN'  // Ensure lang is defined
        },
        sell.happenedAt,
        'backfill'
      );
    }
    
    // Attach the SELL to the lot
    await reassignSellToLot(sell.id, targetLot.id);
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