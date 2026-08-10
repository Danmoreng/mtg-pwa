import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { DeckAccountingProjectionService } from '../decks/DeckAccountingProjectionService';
import { CardmarketAccountingProjectionService } from '../imports/CardmarketAccountingProjectionService';
import { ManaBoxAccountingProjectionService } from '../imports/ManaBoxAccountingProjectionService';

/**
 * Reprojects dependent accounting views in priority order. Sales consume stock
 * before unlocked deck reservations; decks are then recomputed from what remains.
 */
export class AccountingProjectionCoordinator {
  private readonly db: MtgTrackerDb;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
  }

  async projectAfterCardmarketImport(): Promise<void> {
    await new CardmarketAccountingProjectionService(this.db).projectAll();
    await new DeckAccountingProjectionService(this.db).reprojectStoredDecks();
  }

  async projectAfterManaBoxImport(acquisitionId: string): Promise<void> {
    await new ManaBoxAccountingProjectionService(this.db).projectAcquisition(
      acquisitionId
    );
    await new CardmarketAccountingProjectionService(this.db).projectAll();
    await new DeckAccountingProjectionService(this.db).reprojectStoredDecks();
  }
}
