import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';

export class DeckManagementService {
  private readonly db: MtgTrackerDb;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
  }

  async archiveDeck(deckId: string): Promise<void> {
    const now = new Date();
    await this.db.transaction(
      'rw',
      [
        this.db.decks,
        this.db.deck_cards,
        this.db.deck_inventory_allocations,
        this.db.reconciliation_issues,
      ],
      async () => {
        const deck = await this.db.decks.get(deckId);
        if (!deck) throw new Error(`Deck not found: ${deckId}`);
        const deckCards = await this.db.deck_cards.where('deckId').equals(deckId).toArray();
        for (const deckCard of deckCards) {
          const allocations = await this.db.deck_inventory_allocations
            .where('deckCardId')
            .equals(deckCard.id)
            .toArray();
          for (const allocation of allocations.filter(row => !row.releasedAt)) {
            await this.db.deck_inventory_allocations.update(allocation.id, {
              releasedAt: now,
              updatedAt: now,
            });
          }
        }
        const issues = await this.db.reconciliation_issues
          .filter(issue =>
            issue.status === 'open' &&
            (issue.details?.deckId === deckId || issue.sourceRef.startsWith(`deck:${deckId}:`))
          )
          .toArray();
        for (const issue of issues) {
          await this.db.reconciliation_issues.update(issue.id, {
            status: 'resolved',
            resolution: 'other',
            resolutionData: { reason: 'deck_archived' },
            resolvedAt: now,
            updatedAt: now,
          });
        }
        await this.db.decks.update(deckId, { status: 'archived', updatedAt: now });
      }
    );
  }
}
