import type {
  InventoryAdjustment,
  InventoryLot,
  InventoryLotSource,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { AccountingRepository } from './AccountingRepository';
import { calculateLotAccounting } from './AccountingKernel';
import { assertAccountingSnapshot } from './AccountingValidation';
import type { CostBasisStatus } from './AccountingTypes';
import { allocateIntegerCents } from './CentAllocator';

export interface CreateManualInventoryCommand {
  acquisitionId: string;
  lotId: string;
  lotSourceId: string;
  sourceRef: string;
  cardId: string;
  quantity: number;
  allocatedCostCent?: number;
  costBasisStatus: CostBasisStatus;
  finish: InventoryLot['finish'];
  language: string;
  condition: string;
  occurredAt: Date;
}

export interface ApplyInventoryAdjustmentCommand {
  id: string;
  sourceRef: string;
  lotId: string;
  quantityDelta: number;
  costBasisDeltaCent?: number;
  costBasisStatus: CostBasisStatus;
  kind: InventoryAdjustment['kind'];
  effectiveAt: Date;
  note?: string;
  confirmedAt: Date;
  reversesAdjustmentId?: string;
}

export interface CorrectInventoryQuantityCommand {
  id: string;
  sourceRef: string;
  lotId: string;
  targetRemainingQuantity: number;
  addedCostBasisCent?: number;
  addedCostBasisStatus?: CostBasisStatus;
  kind: InventoryAdjustment['kind'];
  effectiveAt: Date;
  note?: string;
  confirmedAt: Date;
}

function assertSafeInteger(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(fieldName + ' must be a safe integer.');
  }
}

function assertCostBasis(
  status: CostBasisStatus,
  cents: number | undefined,
  fieldName: string
): void {
  if (status === 'unknown') {
    if (cents !== undefined) {
      throw new Error(fieldName + ' must be omitted when cost basis is unknown.');
    }
    return;
  }
  if (cents === undefined) {
    throw new Error(fieldName + ' is required for known or estimated cost basis.');
  }
  assertSafeInteger(cents, fieldName);
}

function sameTime(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function isSameManualInventoryCommand(
  existing: InventoryLot,
  command: CreateManualInventoryCommand
): boolean {
  return (
    existing.id === command.lotId &&
    existing.acquisitionId === command.acquisitionId &&
    existing.cardId === command.cardId &&
    existing.initialQuantity === command.quantity &&
    existing.allocatedCostCent === command.allocatedCostCent &&
    existing.costBasisStatus === command.costBasisStatus &&
    existing.finish === command.finish &&
    existing.language === command.language.toLowerCase() &&
    existing.condition === command.condition &&
    sameTime(existing.acquiredAt, command.occurredAt)
  );
}

function isSameAdjustmentCommand(
  existing: InventoryAdjustment,
  command: ApplyInventoryAdjustmentCommand
): boolean {
  return (
    existing.id === command.id &&
    existing.lotId === command.lotId &&
    existing.quantityDelta === command.quantityDelta &&
    existing.costBasisDeltaCent === command.costBasisDeltaCent &&
    existing.costBasisStatus === command.costBasisStatus &&
    existing.kind === command.kind &&
    existing.note === command.note &&
    existing.reversesAdjustmentId === command.reversesAdjustmentId &&
    sameTime(existing.effectiveAt, command.effectiveAt) &&
    sameTime(existing.confirmedAt, command.confirmedAt)
  );
}

export class AccountingCommandService {
  private readonly repository: AccountingRepository;
  private readonly db: MtgTrackerDb;

  constructor(db: MtgTrackerDb) {
    this.db = db;
    this.repository = new AccountingRepository(db);
  }

  async createManualInventory(
    command: CreateManualInventoryCommand
  ): Promise<InventoryLot> {
    assertSafeInteger(command.quantity, 'quantity');
    if (command.quantity <= 0) {
      throw new Error('quantity must be greater than zero.');
    }
    assertCostBasis(
      command.costBasisStatus,
      command.allocatedCostCent,
      'allocatedCostCent'
    );

    const now = new Date(command.occurredAt);
    return this.db.transaction(
      'rw',
      this.db.cards,
      this.db.acquisitions,
      this.db.inventory_lots,
      this.db.inventory_lot_sources,
      async () => {
        const existing = await this.db.inventory_lots
          .where('sourceRef')
          .equals(command.sourceRef)
          .first();
        if (existing) {
          if (!isSameManualInventoryCommand(existing, command)) {
            throw new Error(
              `Manual inventory sourceRef collision: ${command.sourceRef}`
            );
          }
          return existing;
        }
        const card = await this.db.cards.get(command.cardId);
        if (!card) {
          throw new Error('Card ' + command.cardId + ' does not exist.');
        }

        await this.db.acquisitions.add({
          id: command.acquisitionId,
          kind: 'manual_entry',
          source: 'manual',
          externalRef: command.sourceRef,
          sourceRef: command.sourceRef,
          currency: 'EUR',
          happenedAt: now,
          occurredAt: now,
          totalPriceCent: command.allocatedCostCent,
          totalCostCent: command.allocatedCostCent,
          merchandiseCent: command.allocatedCostCent,
          allocationMethod: 'manual',
          projectionVersion: 1,
          createdAt: now,
          updatedAt: now,
        });

        const lot: InventoryLot = {
          id: command.lotId,
          acquisitionId: command.acquisitionId,
          cardId: command.cardId,
          initialQuantity: command.quantity,
          allocatedCostCent: command.allocatedCostCent,
          costBasisStatus: command.costBasisStatus,
          origin: 'manual',
          ownershipStatus: 'user_confirmed',
          condition: command.condition,
          language: command.language.toLowerCase(),
          finish: command.finish,
          acquiredAt: now,
          sourceRef: command.sourceRef,
          createdAt: now,
          updatedAt: now,
        };
        await this.db.inventory_lots.add(lot);

        const lotSource: InventoryLotSource = {
          id: command.lotSourceId,
          lotId: command.lotId,
          sourceRef: command.sourceRef,
          role: 'created_from',
          quantity: command.quantity,
          costBasisContributionCent: command.allocatedCostCent,
          linkedAt: now,
        };
        await this.db.inventory_lot_sources.add(lotSource);
        return lot;
      }
    );
  }

  async applyAdjustment(
    command: ApplyInventoryAdjustmentCommand
  ): Promise<InventoryAdjustment> {
    assertSafeInteger(command.quantityDelta, 'quantityDelta');
    if (command.quantityDelta === 0) {
      throw new Error('quantityDelta must not be zero.');
    }
    assertCostBasis(
      command.costBasisStatus,
      command.costBasisDeltaCent,
      'costBasisDeltaCent'
    );

    return this.db.transaction(
      'rw',
      this.db.inventory_lots,
      this.db.inventory_adjustments,
      this.db.lot_allocations,
      this.db.deck_inventory_allocations,
      async () => {
        const existing = await this.db.inventory_adjustments
          .where('sourceRef')
          .equals(command.sourceRef)
          .first();
        if (existing) {
          if (!isSameAdjustmentCommand(existing, command)) {
            throw new Error(
              `Inventory adjustment sourceRef collision: ${command.sourceRef}`
            );
          }
          return existing;
        }
        const lot = await this.db.inventory_lots.get(command.lotId);
        if (!lot) {
          throw new Error('Inventory lot ' + command.lotId + ' does not exist.');
        }

        const adjustment: InventoryAdjustment = {
          ...command,
          createdAt: new Date(command.confirmedAt),
        };
        const [adjustments, saleAllocations, deckAllocations] = await Promise.all([
          this.db.inventory_adjustments.where('lotId').equals(lot.id).toArray(),
          this.db.lot_allocations.where('lotId').equals(lot.id).toArray(),
          this.db.deck_inventory_allocations.where('lotId').equals(lot.id).toArray(),
        ]);
        const snapshot = calculateLotAccounting({
          lot: {
            id: lot.id,
            initialQuantity: lot.initialQuantity,
            allocatedCostCent: lot.allocatedCostCent,
            costBasisStatus: lot.costBasisStatus,
          },
          adjustments: [...adjustments, adjustment],
          saleAllocations,
          deckAllocations,
        });
        assertAccountingSnapshot(snapshot);

        await this.db.inventory_adjustments.add(adjustment);
        return adjustment;
      }
    );
  }

  async reverseAdjustment(
    adjustmentId: string,
    command: Omit<
      ApplyInventoryAdjustmentCommand,
      | 'lotId'
      | 'quantityDelta'
      | 'costBasisDeltaCent'
      | 'costBasisStatus'
      | 'kind'
      | 'reversesAdjustmentId'
    >
  ): Promise<InventoryAdjustment> {
    const original = await this.db.inventory_adjustments.get(adjustmentId);
    if (!original) {
      throw new Error('Inventory adjustment ' + adjustmentId + ' does not exist.');
    }
    const existingReversal = await this.db.inventory_adjustments
      .where('reversesAdjustmentId')
      .equals(adjustmentId)
      .first();
    if (existingReversal) return existingReversal;

    return this.applyAdjustment({
      ...command,
      lotId: original.lotId,
      quantityDelta: -original.quantityDelta,
      costBasisDeltaCent:
        original.costBasisDeltaCent === undefined
          ? undefined
          : -original.costBasisDeltaCent,
      costBasisStatus: original.costBasisStatus,
      kind: 'correction',
      reversesAdjustmentId: original.id,
    });
  }

  async correctRemainingQuantity(
    command: CorrectInventoryQuantityCommand
  ): Promise<InventoryAdjustment> {
    assertSafeInteger(command.targetRemainingQuantity, 'targetRemainingQuantity');
    if (command.targetRemainingQuantity < 0) {
      throw new Error('targetRemainingQuantity must not be negative.');
    }
    const snapshot = await this.repository.getLotSnapshot(command.lotId);
    if (!snapshot) {
      throw new Error('Inventory lot ' + command.lotId + ' does not exist.');
    }
    const quantityDelta = command.targetRemainingQuantity - snapshot.remainingQuantity;
    if (quantityDelta === 0) {
      throw new Error('The requested correction does not change remaining quantity.');
    }

    let costBasisStatus: CostBasisStatus;
    let costBasisDeltaCent: number | undefined;
    if (quantityDelta > 0) {
      costBasisStatus = command.addedCostBasisStatus ?? 'unknown';
      costBasisDeltaCent = command.addedCostBasisCent;
    } else if (snapshot.openCostBasis.status === 'unknown') {
      costBasisStatus = 'unknown';
    } else {
      costBasisStatus = snapshot.openCostBasis.status;
      const removedQuantity = -quantityDelta;
      costBasisDeltaCent = -(
        allocateIntegerCents(snapshot.openCostBasis.cents, [
          {
            id: 'remaining',
            weight: snapshot.remainingQuantity - removedQuantity,
          },
          { id: 'removed', weight: removedQuantity },
        ]).find(row => row.id === 'removed')?.cents ?? 0
      );
    }

    return this.applyAdjustment({
      id: command.id,
      sourceRef: command.sourceRef,
      lotId: command.lotId,
      quantityDelta,
      costBasisDeltaCent,
      costBasisStatus,
      kind: command.kind,
      effectiveAt: command.effectiveAt,
      note: command.note,
      confirmedAt: command.confirmedAt,
    });
  }

  async getLotSnapshot(lotId: string) {
    return this.repository.getLotSnapshot(lotId);
  }
}
