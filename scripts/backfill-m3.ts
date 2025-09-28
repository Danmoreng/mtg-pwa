import db from '../src/data/db';
import { runReconciler } from '../src/features/scans/ReconcilerService';
import { normalizeFingerprint } from '../src/core/Normalization';

/**
 * This script is intended to be run once to backfill data for the M3 architecture.
 * It finds all unique card identities and runs the reconciler for each one.
 * 
 * How to run (example using ts-node):
 * > ts-node scripts/backfill-m3.ts
 * 
 * Make sure your environment can connect to the Dexie database.
 */

async function backfill() {
  console.log('Starting M3 data backfill...');

  const allTransactions = await db.transactions.toArray();
  const allScans = await db.scans.toArray();
  const allLots = await db.card_lots.toArray();

  const identities = new Map<string, { cardId?: string; fingerprint: string; finish: string; lang?: string }>();

  const identityFromCardId = async (cardId: string) => {
    const card = await db.cards.get(cardId);
    if (!card) return null;
    const normalized = normalizeFingerprint(card);
    return { ...normalized, cardId: card.id, lang: card.lang };
  };

  for (const item of [...allTransactions, ...allScans, ...allLots]) {
    if (item.cardId && !identities.has(item.cardId)) {
      const identity = await identityFromCardId(item.cardId);
      if (identity) {
        identities.set(item.cardId, identity);
      }
    }
  }

  console.log(`Found ${identities.size} unique card identities to process.`);

  let count = 0;
  for (const [cardId, identity] of identities.entries()) {
    count++;
    console.log(`Processing identity ${count}/${identities.size}: ${cardId}...`);
    try {
      await runReconciler(identity);
    } catch (error) {
      console.error(`Failed to reconcile identity ${cardId}:`, error);
    }
  }

  console.log('Backfill complete.');
}

backfill().catch(console.error);
