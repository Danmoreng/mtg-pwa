import type { InventoryAdjustment, ReconciliationIssue } from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { calculateLotAccounting } from './AccountingKernel';
import { AccountingProjectionCoordinator } from './AccountingProjectionCoordinator';
import { AccountingRepository } from './AccountingRepository';
import { assertAccountingSnapshot } from './AccountingValidation';
import { allocateIntegerCents } from './CentAllocator';

export interface SamePhysicalCopyOptions {
  quantity?: number;
  note?: string;
}

export class ReconciliationActionService {
  private readonly db: MtgTrackerDb;
  private readonly accounting: AccountingRepository;
  private readonly projections: AccountingProjectionCoordinator;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.accounting = new AccountingRepository(db);
    this.projections = new AccountingProjectionCoordinator(db);
  }

  async getIssues(status?: ReconciliationIssue['status']): Promise<ReconciliationIssue[]> {
    const rows = status
      ? await this.db.reconciliation_issues.where('status').equals(status).toArray()
      : await this.db.reconciliation_issues.toArray();
    return rows.sort((left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime() || left.id.localeCompare(right.id)
    );
  }

  async resolve(
    issueId: string,
    resolution: Exclude<NonNullable<ReconciliationIssue['resolution']>, 'same_physical_copy'>,
    resolutionData: Record<string, unknown> = {}
  ): Promise<void> {
    const issue = await this.requireIssue(issueId);
    const now = new Date();
    await this.db.reconciliation_issues.update(issue.id, {
      status: 'resolved',
      resolution,
      resolutionData,
      resolvedAt: now,
      updatedAt: now,
    });
  }

  async reopen(issueId: string): Promise<void> {
    const issue = await this.requireIssue(issueId);
    await this.db.reconciliation_issues.update(issue.id, {
      status: 'open',
      resolution: undefined,
      resolutionData: undefined,
      resolvedAt: undefined,
      updatedAt: new Date(),
    });
  }

  async retryProjections(): Promise<void> {
    await this.projections.projectAfterInventoryChange();
  }

  async resolveAsSamePhysicalCopy(
    issueId: string,
    options: SamePhysicalCopyOptions = {}
  ): Promise<void> {
    const issue = await this.requireIssue(issueId);
    if (issue.status === 'resolved' && issue.resolution === 'same_physical_copy') return;
    if (issue.kind !== 'possible_duplicate_inventory') {
      throw new Error('Only possible duplicate inventory can be merged.');
    }
    const incomingLotId = String(issue.details?.incomingLotId ?? '');
    const candidateLotId = issue.candidateLotId ?? '';
    if (!incomingLotId || !candidateLotId || incomingLotId === candidateLotId) {
      throw new Error('The reconciliation issue has no valid incoming/candidate lot pair.');
    }

    const result = await this.db.transaction(
      'rw',
      [
        this.db.inventory_lots,
        this.db.inventory_lot_sources,
        this.db.inventory_adjustments,
        this.db.lot_allocations,
        this.db.deck_inventory_allocations,
      ],
      async () => {
        const [incomingLot, candidateLot, incomingSnapshot, candidateSnapshot] =
          await Promise.all([
            this.db.inventory_lots.get(incomingLotId),
            this.db.inventory_lots.get(candidateLotId),
            this.accounting.getLotSnapshot(incomingLotId),
            this.accounting.getLotSnapshot(candidateLotId),
          ]);
        if (!incomingLot || !candidateLot || !incomingSnapshot || !candidateSnapshot) {
          throw new Error('One of the duplicate inventory lots no longer exists.');
        }
        if (
          incomingLot.cardId !== candidateLot.cardId ||
          incomingLot.finish !== candidateLot.finish ||
          incomingLot.language !== candidateLot.language
        ) {
          throw new Error('Only matching card printings, finishes and languages can be merged.');
        }

        const maximumQuantity = Math.min(
          incomingSnapshot.availableForDecks,
          candidateSnapshot.remainingQuantity
        );
        const quantity = options.quantity ?? maximumQuantity;
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > maximumQuantity) {
          throw new Error(`Merge quantity must be between 1 and ${maximumQuantity}.`);
        }

        const incomingCost = this.allocateRemovedCost(
          incomingSnapshot.remainingQuantity,
          quantity,
          incomingSnapshot.openCostBasis
        );
        const now = new Date();
        const adjustment: InventoryAdjustment = {
          id: `adjustment:reconciliation:${issue.id}`,
          lotId: incomingLot.id,
          quantityDelta: -quantity,
          costBasisDeltaCent:
            incomingCost.cents === undefined ? undefined : -incomingCost.cents,
          costBasisStatus: incomingCost.status,
          kind: 'correction',
          effectiveAt: now,
          note: options.note ?? `Merged with ${candidateLot.id} as the same physical copy.`,
          sourceRef: `reconciliation:${issue.id}:same-physical-copy`,
          confirmedAt: now,
          createdAt: now,
        };
        const existingAdjustment = await this.db.inventory_adjustments.get(adjustment.id);
        if (!existingAdjustment) {
          const [adjustments, saleAllocations, deckAllocations] = await Promise.all([
            this.db.inventory_adjustments.where('lotId').equals(incomingLot.id).toArray(),
            this.db.lot_allocations.where('lotId').equals(incomingLot.id).toArray(),
            this.db.deck_inventory_allocations.where('lotId').equals(incomingLot.id).toArray(),
          ]);
          const updatedSnapshot = calculateLotAccounting({
            lot: incomingLot,
            adjustments: [...adjustments, adjustment],
            saleAllocations,
            deckAllocations,
          });
          assertAccountingSnapshot(updatedSnapshot);
          await this.db.inventory_adjustments.add(adjustment);
        }

        await this.db.inventory_lot_sources.put({
          id: `lot-source:reconciliation:${issue.id}:confirmed`,
          lotId: candidateLot.id,
          sourceRef: issue.sourceRef,
          role: 'confirmed_by',
          quantity,
          linkedAt: now,
        });

        let adoptedCostBasis = false;
        if (
          !existingAdjustment &&
          candidateSnapshot.openCostBasis.status === 'unknown' &&
          candidateSnapshot.effectiveQuantity === quantity &&
          candidateSnapshot.soldQuantity === 0 &&
          incomingCost.cents !== undefined
        ) {
          await this.db.inventory_lots.update(candidateLot.id, {
            allocatedCostCent: incomingCost.cents,
            costBasisStatus: incomingCost.status,
            updatedAt: now,
          });
          await this.db.inventory_lot_sources.put({
            id: `lot-source:reconciliation:${issue.id}:cost`,
            lotId: candidateLot.id,
            sourceRef: issue.sourceRef,
            role: 'cost_basis_from',
            quantity,
            costBasisContributionCent: incomingCost.cents,
            linkedAt: now,
          });
          adoptedCostBasis = true;
        }
        return { quantity, adoptedCostBasis };
      }
    );

    await this.projections.projectAfterInventoryChange();
    const resolvedAt = new Date();
    await this.db.reconciliation_issues.update(issue.id, {
      status: 'resolved',
      resolution: 'same_physical_copy',
      resolutionData: result,
      resolvedAt,
      updatedAt: resolvedAt,
    });
  }

  private allocateRemovedCost(
    remainingQuantity: number,
    removedQuantity: number,
    money: { status: 'known' | 'estimated'; cents: number } | { status: 'unknown' }
  ): { status: 'known' | 'estimated' | 'unknown'; cents?: number } {
    if (money.status === 'unknown') return { status: 'unknown' };
    const allocation = allocateIntegerCents(money.cents, [
      { id: 'remaining', weight: remainingQuantity - removedQuantity },
      { id: 'removed', weight: removedQuantity },
    ]);
    return {
      status: money.status,
      cents: allocation.find(row => row.id === 'removed')?.cents ?? 0,
    };
  }

  private async requireIssue(issueId: string): Promise<ReconciliationIssue> {
    const issue = await this.db.reconciliation_issues.get(issueId);
    if (!issue) throw new Error(`Reconciliation issue not found: ${issueId}`);
    return issue;
  }
}
