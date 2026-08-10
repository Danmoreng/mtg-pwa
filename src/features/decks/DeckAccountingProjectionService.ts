import type {
  Acquisition,
  DeckCard,
  DeckImportRun,
  DeckInventoryAllocation,
  InventoryLot,
  ReconciliationIssue,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingRepository } from '../accounting/AccountingRepository';
import { allocateIntegerCents } from '../accounting/CentAllocator';

export interface DeckAccountingProjectionOptions {
  existingInventoryPolicy?: DeckImportRun['existingInventoryPolicy'];
  missingInventoryPolicy?: DeckImportRun['missingInventoryPolicy'];
  costBasisPolicy?: DeckImportRun['costBasisPolicy'];
  totalDeficitCostCent?: number;
  unitCostCentByDeckCardId?: Record<string, number>;
  defaultDeficitUnitCostCent?: number;
  defaultFinish?: DeckImportRun['defaultFinish'];
  defaultLanguage?: string;
  defaultCondition?: string;
}

export interface DeckAccountingProjectionSummary {
  requiredQuantity: number;
  allocatedExistingQuantity: number;
  createdDeficitQuantity: number;
  missingQuantity: number;
  openIssues: number;
}

interface NormalizedDeckProjectionOptions {
  existingInventoryPolicy: DeckImportRun['existingInventoryPolicy'];
  missingInventoryPolicy: DeckImportRun['missingInventoryPolicy'];
  costBasisPolicy: DeckImportRun['costBasisPolicy'];
  totalDeficitCostCent?: number;
  unitCostCentByDeckCardId: Record<string, number>;
  defaultDeficitUnitCostCent?: number;
  defaultFinish: DeckImportRun['defaultFinish'];
  defaultLanguage: string;
  defaultCondition: string;
}

interface DeckDeficit {
  deckCard: DeckCard;
  quantity: number;
}

function normalizeOptions(
  options: DeckAccountingProjectionOptions
): NormalizedDeckProjectionOptions {
  const normalized: NormalizedDeckProjectionOptions = {
    existingInventoryPolicy: options.existingInventoryPolicy ?? 'allocate_available',
    missingInventoryPolicy: options.missingInventoryPolicy ?? 'leave_missing',
    costBasisPolicy: options.costBasisPolicy ?? 'unknown',
    totalDeficitCostCent: options.totalDeficitCostCent,
    unitCostCentByDeckCardId: options.unitCostCentByDeckCardId ?? {},
    defaultDeficitUnitCostCent: options.defaultDeficitUnitCostCent,
    defaultFinish: options.defaultFinish ?? 'nonfoil',
    defaultLanguage: String(options.defaultLanguage ?? '').trim().toLowerCase() || 'en',
    defaultCondition: String(options.defaultCondition ?? '').trim() || 'unknown',
  };

  if (
    normalized.missingInventoryPolicy === 'create_deficit' &&
    normalized.existingInventoryPolicy !== 'allocate_available'
  ) {
    throw new Error('Creating deck inventory requires allocate_available mode.');
  }
  if (normalized.costBasisPolicy === 'enter_total') {
    if (
      !Number.isSafeInteger(normalized.totalDeficitCostCent) ||
      (normalized.totalDeficitCostCent ?? -1) < 0
    ) {
      throw new Error('enter_total requires a non-negative integer totalDeficitCostCent.');
    }
  }
  for (const [deckCardId, cents] of Object.entries(normalized.unitCostCentByDeckCardId)) {
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new Error(`Invalid unit cost for deck card ${deckCardId}.`);
    }
  }
  if (
    normalized.defaultDeficitUnitCostCent !== undefined &&
    (!Number.isSafeInteger(normalized.defaultDeficitUnitCostCent) ||
      normalized.defaultDeficitUnitCostCent < 0)
  ) {
    throw new Error('defaultDeficitUnitCostCent must be a non-negative integer.');
  }
  return normalized;
}

export class DeckAccountingProjectionService {
  private readonly db: MtgTrackerDb;
  private readonly accounting: AccountingRepository;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.accounting = new AccountingRepository(db);
  }

  async reprojectStoredDecks(): Promise<DeckAccountingProjectionSummary[]> {
    const runs = (await this.db.deck_import_runs.toArray()).sort((left, right) => {
      const dateDifference = left.createdAt.getTime() - right.createdAt.getTime();
      return dateDifference || left.id.localeCompare(right.id);
    });
    const summaries: DeckAccountingProjectionSummary[] = [];
    for (const run of runs) {
      const deck = await this.db.decks.get(run.targetDeckId);
      if (!deck || deck.status === 'archived') continue;
      summaries.push(
        await this.projectDeck(run.targetDeckId, {
          existingInventoryPolicy: run.existingInventoryPolicy,
          missingInventoryPolicy: run.missingInventoryPolicy,
          costBasisPolicy: run.costBasisPolicy,
          totalDeficitCostCent: run.totalDeficitCostCent,
          unitCostCentByDeckCardId: run.unitCostCentByDeckCardId,
          defaultDeficitUnitCostCent: run.defaultDeficitUnitCostCent,
          defaultFinish: run.defaultFinish,
          defaultLanguage: run.defaultLanguage,
          defaultCondition: run.defaultCondition,
        })
      );
    }
    return summaries;
  }

  async projectDeck(
    deckId: string,
    options: DeckAccountingProjectionOptions = {}
  ): Promise<DeckAccountingProjectionSummary> {
    const normalized = normalizeOptions(options);
    return this.db.transaction(
      'rw',
      [
        this.db.decks,
        this.db.deck_cards,
        this.db.deck_import_runs,
        this.db.acquisitions,
        this.db.inventory_lots,
        this.db.inventory_lot_sources,
        this.db.inventory_adjustments,
        this.db.lot_allocations,
        this.db.deck_inventory_allocations,
        this.db.reconciliation_issues,
      ],
      async () => {
        const deck = await this.db.decks.get(deckId);
        if (!deck) throw new Error(`Deck not found: ${deckId}`);
        const projectionTime = deck.importedAt;
        const deckCards = (await this.db.deck_cards
          .where('deckId')
          .equals(deckId)
          .toArray()).sort((left, right) => left.id.localeCompare(right.id));
        const activeDeckCards = deckCards.filter(row => !row.removedAt);

        await this.releaseUnlockedAllocations(deckCards, projectionTime);
        await this.db.decks.update(deckId, {
          inventoryMode:
            normalized.existingInventoryPolicy === 'allocate_available'
              ? 'physical_exclusive'
              : 'requirements_only',
          status: deck.status ?? 'active',
          updatedAt: projectionTime,
        });
        await this.putRun(deckId, projectionTime, normalized);

        const summary: DeckAccountingProjectionSummary = {
          requiredQuantity: activeDeckCards.reduce((sum, row) => sum + row.quantity, 0),
          allocatedExistingQuantity: 0,
          createdDeficitQuantity: 0,
          missingQuantity: 0,
          openIssues: 0,
        };
        if (normalized.existingInventoryPolicy === 'requirements_only') {
          summary.missingQuantity = summary.requiredQuantity;
          summary.openIssues = await this.openIssueCount();
          return summary;
        }

        const deficits: DeckDeficit[] = [];
        for (const deckCard of activeDeckCards) {
          const missing = await this.allocateExistingInventory(
            deckCard,
            normalized,
            projectionTime,
            summary
          );
          if (missing > 0) deficits.push({ deckCard, quantity: missing });
        }

        if (
          normalized.missingInventoryPolicy === 'create_deficit' &&
          deficits.length > 0
        ) {
          await this.createAndAllocateDeficits(
            deckId,
            deficits,
            normalized,
            projectionTime,
            summary
          );
        } else {
          for (const deficit of deficits) {
            await this.putDeficitIssue(deckId, deficit, projectionTime);
            summary.missingQuantity += deficit.quantity;
          }
        }

        summary.openIssues = await this.openIssueCount();
        return summary;
      }
    );
  }

  private async putRun(
    deckId: string,
    projectionTime: Date,
    options: NormalizedDeckProjectionOptions
  ): Promise<void> {
    const id = `deck-import-run:${deckId}`;
    const existing = await this.db.deck_import_runs.get(id);
    await this.db.deck_import_runs.put({
      id,
      sourceFileId: `deck:${deckId}`,
      targetDeckId: deckId,
      existingInventoryPolicy: options.existingInventoryPolicy,
      missingInventoryPolicy: options.missingInventoryPolicy,
      costBasisPolicy: options.costBasisPolicy,
      totalDeficitCostCent: options.totalDeficitCostCent,
      unitCostCentByDeckCardId: options.unitCostCentByDeckCardId,
      defaultDeficitUnitCostCent: options.defaultDeficitUnitCostCent,
      defaultFinish: options.defaultFinish,
      defaultLanguage: options.defaultLanguage,
      defaultCondition: options.defaultCondition,
      confirmedAt:
        options.missingInventoryPolicy === 'create_deficit' ? projectionTime : undefined,
      confirmedBy:
        options.missingInventoryPolicy === 'create_deficit' ? 'user' : undefined,
      createdAt: existing?.createdAt ?? projectionTime,
    });
  }

  private async releaseUnlockedAllocations(
    deckCards: readonly DeckCard[],
    releasedAt: Date
  ): Promise<void> {
    for (const deckCard of deckCards) {
      const allocations = await this.db.deck_inventory_allocations
        .where('deckCardId')
        .equals(deckCard.id)
        .toArray();
      for (const allocation of allocations) {
        if (allocation.method === 'manual' || allocation.lockedAt || allocation.releasedAt) {
          continue;
        }
        await this.db.deck_inventory_allocations.update(allocation.id, {
          releasedAt,
          updatedAt: releasedAt,
        });
      }
    }
  }

  private async allocateExistingInventory(
    deckCard: DeckCard,
    options: NormalizedDeckProjectionOptions,
    projectionTime: Date,
    summary: DeckAccountingProjectionSummary
  ): Promise<number> {
    const allocations = await this.db.deck_inventory_allocations
      .where('deckCardId')
      .equals(deckCard.id)
      .toArray();
    const lockedQuantity = allocations
      .filter(row => (row.method === 'manual' || row.lockedAt) && !row.releasedAt)
      .reduce((sum, row) => sum + row.quantity, 0);
    let neededQuantity = Math.max(0, deckCard.quantity - lockedQuantity);
    const availableLots = await this.accounting.getAvailableLots(
      deckCard.cardId,
      deckCard.finish ?? options.defaultFinish,
      deckCard.language ?? options.defaultLanguage
    );

    for (const candidate of availableLots) {
      if (neededQuantity === 0) break;
      const quantity = Math.min(
        Math.max(0, candidate.snapshot.availableForDecks),
        neededQuantity
      );
      if (quantity === 0) continue;
      const method: DeckInventoryAllocation['method'] =
        candidate.lot.origin === 'deck_import' &&
        candidate.lot.sourceRef === `deck-gap:${deckCard.id}`
          ? 'created_deficit'
          : 'auto';
      await this.putAllocation(deckCard, candidate.lot, quantity, method, projectionTime);
      if (method === 'created_deficit') {
        summary.createdDeficitQuantity += quantity;
      } else {
        summary.allocatedExistingQuantity += quantity;
      }
      neededQuantity -= quantity;
    }

    if (neededQuantity === 0) {
      await this.resolveDeficitIssue(deckCard.id, projectionTime);
    }
    return neededQuantity;
  }

  private async putAllocation(
    deckCard: DeckCard,
    lot: InventoryLot,
    quantity: number,
    method: DeckInventoryAllocation['method'],
    projectionTime: Date
  ): Promise<void> {
    const id = `deck-allocation:${deckCard.id}:${lot.id}`;
    const existing = await this.db.deck_inventory_allocations.get(id);
    await this.db.deck_inventory_allocations.put({
      id,
      deckCardId: deckCard.id,
      lotId: lot.id,
      quantity,
      method,
      lockedAt: existing?.lockedAt,
      releasedAt: undefined,
      createdAt: existing?.createdAt ?? projectionTime,
      updatedAt: projectionTime,
    });
  }

  private async createAndAllocateDeficits(
    deckId: string,
    deficits: readonly DeckDeficit[],
    options: NormalizedDeckProjectionOptions,
    projectionTime: Date,
    summary: DeckAccountingProjectionSummary
  ): Promise<void> {
    const costByDeckCard = this.allocateDeficitCosts(deficits, options);
    const totalCostCent = [...costByDeckCard.values()].reduce<number>(
      (sum, cents) => sum + (cents ?? 0),
      0
    );
    const acquisitionId = `acquisition:deck-gap:${deckId}`;
    const existingAcquisition = await this.db.acquisitions.get(acquisitionId);
    const acquisition: Acquisition = {
      id: acquisitionId,
      kind: 'deck_gap',
      source: 'deck_import',
      externalRef: deckId,
      sourceRef: `deck-gap:${deckId}`,
      currency: 'EUR',
      happenedAt: projectionTime,
      occurredAt: projectionTime,
      totalPriceCent: options.costBasisPolicy === 'unknown' ? undefined : totalCostCent,
      totalFeesCent: options.costBasisPolicy === 'unknown' ? undefined : 0,
      totalShippingCent: options.costBasisPolicy === 'unknown' ? undefined : 0,
      totalCostCent: options.costBasisPolicy === 'unknown' ? undefined : totalCostCent,
      merchandiseCent: options.costBasisPolicy === 'unknown' ? undefined : totalCostCent,
      feesCent: options.costBasisPolicy === 'unknown' ? undefined : 0,
      shippingCent: options.costBasisPolicy === 'unknown' ? undefined : 0,
      allocationMethod: 'manual',
      allocationAsOf: projectionTime,
      allocationSourceRev: 'deck-import:user-confirmed',
      projectionVersion: 1,
      createdAt: existingAcquisition?.createdAt ?? projectionTime,
      updatedAt: projectionTime,
    };
    await this.db.acquisitions.put(acquisition);

    for (const deficit of deficits) {
      const sourceRef = `deck-gap:${deficit.deckCard.id}`;
      const lotId = `lot:${sourceRef}`;
      const existingLot = await this.db.inventory_lots.get(lotId);
      const allocatedCostCent = costByDeckCard.get(deficit.deckCard.id);
      const lot: InventoryLot = {
        id: lotId,
        acquisitionId,
        cardId: deficit.deckCard.cardId,
        initialQuantity: deficit.quantity,
        allocatedCostCent,
        costBasisStatus:
          options.costBasisPolicy === 'unknown' ? 'unknown' : 'known',
        origin: 'deck_import',
        ownershipStatus: 'user_confirmed',
        condition: deficit.deckCard.condition ?? options.defaultCondition,
        language: deficit.deckCard.language ?? options.defaultLanguage,
        finish: deficit.deckCard.finish ?? options.defaultFinish,
        acquiredAt: projectionTime,
        sourceRef,
        createdAt: existingLot?.createdAt ?? projectionTime,
        updatedAt: projectionTime,
      };
      await this.db.inventory_lots.put(lot);
      await this.db.inventory_lot_sources.put({
        id: `lot-source:${sourceRef}`,
        lotId,
        sourceRef,
        role: 'created_from',
        quantity: deficit.quantity,
        costBasisContributionCent: allocatedCostCent,
        linkedAt: projectionTime,
      });
      await this.putAllocation(
        deficit.deckCard,
        lot,
        deficit.quantity,
        'created_deficit',
        projectionTime
      );
      await this.resolveDeficitIssue(deficit.deckCard.id, projectionTime);
      summary.createdDeficitQuantity += deficit.quantity;
    }
  }

  private allocateDeficitCosts(
    deficits: readonly DeckDeficit[],
    options: NormalizedDeckProjectionOptions
  ): Map<string, number | undefined> {
    if (options.costBasisPolicy === 'unknown') {
      return new Map(deficits.map(row => [row.deckCard.id, undefined]));
    }
    if (options.costBasisPolicy === 'enter_total') {
      return new Map(
        allocateIntegerCents(
          options.totalDeficitCostCent ?? 0,
          deficits.map(row => ({ id: row.deckCard.id, weight: row.quantity }))
        ).map(row => [row.id, row.cents])
      );
    }

    const costs = new Map<string, number | undefined>();
    for (const deficit of deficits) {
      const unitCostCent =
        options.unitCostCentByDeckCardId[deficit.deckCard.id] ??
        options.defaultDeficitUnitCostCent;
      if (!Number.isSafeInteger(unitCostCent) || unitCostCent < 0) {
        throw new Error(
          `enter_per_card requires a non-negative unit cost for ${deficit.deckCard.id}.`
        );
      }
      costs.set(deficit.deckCard.id, unitCostCent * deficit.quantity);
    }
    return costs;
  }

  private async putDeficitIssue(
    deckId: string,
    deficit: DeckDeficit,
    projectionTime: Date
  ): Promise<void> {
    const id = `issue:deck-deficit:${deficit.deckCard.id}`;
    const existing = await this.db.reconciliation_issues.get(id);
    const issue: ReconciliationIssue = {
      id,
      kind: 'quantity_conflict',
      sourceRef: `deck:${deckId}:card:${deficit.deckCard.id}`,
      details: {
        deckId,
        deckCardId: deficit.deckCard.id,
        requiredQuantity: deficit.deckCard.quantity,
        missingQuantity: deficit.quantity,
      },
      status: 'open',
      createdAt: existing?.createdAt ?? projectionTime,
      updatedAt: projectionTime,
    };
    await this.db.reconciliation_issues.put(issue);
  }

  private async resolveDeficitIssue(
    deckCardId: string,
    projectionTime: Date
  ): Promise<void> {
    const id = `issue:deck-deficit:${deckCardId}`;
    const issue = await this.db.reconciliation_issues.get(id);
    if (!issue || issue.status !== 'open') return;
    await this.db.reconciliation_issues.update(id, {
      status: 'resolved',
      resolution: 'other',
      resolutionData: { reason: 'inventory_now_allocated' },
      resolvedAt: projectionTime,
      updatedAt: projectionTime,
    });
  }

  private async openIssueCount(): Promise<number> {
    return this.db.reconciliation_issues.where('status').equals('open').count();
  }
}
