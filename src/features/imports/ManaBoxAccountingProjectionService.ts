import type {
  Acquisition,
  InventoryLot,
  ReconciliationIssue,
  Scan,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingRepository } from '../accounting/AccountingRepository';
import { allocateIntegerCents } from '../accounting/CentAllocator';

const PROJECTION_VERSION = 1;

export interface ManaBoxAccountingProjectionSummary {
  acquisitions: number;
  inventoryLots: number;
  openIssues: number;
}

function normalizeFinish(value: string | undefined): InventoryLot['finish'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'etched') return 'etched';
  if (normalized === 'foil') return 'foil';
  return 'nonfoil';
}

function normalizeLanguage(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase() || 'en';
}

function sourceReference(acquisition: Acquisition): string {
  const externalRef = acquisition.externalRef || acquisition.id;
  return `manabox:acquisition:${acquisition.source}:${externalRef}`;
}

export class ManaBoxAccountingProjectionService {
  private readonly db: MtgTrackerDb;
  private readonly accounting: AccountingRepository;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.accounting = new AccountingRepository(db);
  }

  async projectAcquisition(
    acquisitionId: string
  ): Promise<ManaBoxAccountingProjectionSummary> {
    return this.db.transaction(
      'rw',
      [
        this.db.acquisitions,
        this.db.scans,
        this.db.inventory_lots,
        this.db.inventory_lot_sources,
        this.db.inventory_adjustments,
        this.db.lot_allocations,
        this.db.deck_inventory_allocations,
        this.db.reconciliation_issues,
      ],
      async () => {
        const acquisition = await this.db.acquisitions.get(acquisitionId);
        if (!acquisition) {
          throw new Error(`ManaBox acquisition not found: ${acquisitionId}`);
        }

        const scans = (await this.db.scans
          .where('acquisitionId')
          .equals(acquisitionId)
          .toArray()).sort((left, right) => {
          const dateDifference = left.scannedAt.getTime() - right.scannedAt.getTime();
          return dateDifference || left.id.localeCompare(right.id);
        });
        const positiveScans = scans.filter(scan => scan.quantity > 0);
        const totalCostCent = acquisition.totalCostCent;
        const costByScan =
          typeof totalCostCent === 'number' && positiveScans.length > 0
            ? new Map(
                allocateIntegerCents(
                  totalCostCent,
                  positiveScans.map(scan => ({ id: scan.id, weight: scan.quantity }))
                ).map(row => [row.id, row.cents])
              )
            : new Map<string, number>();

        const canonicalSourceRef = sourceReference(acquisition);
        await this.db.acquisitions.put({
          ...acquisition,
          sourceRef: canonicalSourceRef,
          occurredAt: acquisition.occurredAt ?? acquisition.happenedAt,
          merchandiseCent: acquisition.totalPriceCent,
          feesCent: acquisition.totalFeesCent,
          shippingCent: acquisition.totalShippingCent,
          projectionVersion: PROJECTION_VERSION,
          allocationMethod: acquisition.allocationMethod ?? 'equal_per_card',
          allocationAsOf: acquisition.allocationAsOf ?? acquisition.updatedAt,
          allocationSourceRev: acquisition.allocationSourceRev ?? 'manabox:scan-quantity',
        });

        let inventoryLots = 0;
        for (const scan of scans) {
          await this.projectScan(scan, acquisition, costByScan.get(scan.id));
          if (scan.cardId && scan.quantity > 0) inventoryLots += 1;
        }

        return {
          acquisitions: 1,
          inventoryLots,
          openIssues: await this.db.reconciliation_issues
            .where('status')
            .equals('open')
            .count(),
        };
      }
    );
  }

  private async projectScan(
    scan: Scan,
    acquisition: Acquisition,
    allocatedCostCent: number | undefined
  ): Promise<void> {
    const sourceRef = `manabox:scan:${scan.id}`;
    const projectionTime = scan.updatedAt;
    await this.resolveOpenIssues(sourceRef, projectionTime);

    if (scan.quantity <= 0) {
      await this.putIssue(
        `issue:quantity-conflict:${sourceRef}`,
        'quantity_conflict',
        sourceRef,
        projectionTime,
        { quantity: scan.quantity, acquisitionId: acquisition.id }
      );
      return;
    }
    if (!scan.cardId) {
      await this.putIssue(
        `issue:unmatched:${sourceRef}`,
        'unmatched',
        sourceRef,
        projectionTime,
        {
          provider: 'manabox',
          acquisitionId: acquisition.id,
          fingerprint: scan.cardFingerprint,
        }
      );
      return;
    }

    const lotId = `lot:${sourceRef}`;
    const existing = await this.db.inventory_lots.get(lotId);
    const lot: InventoryLot = {
      id: lotId,
      acquisitionId: acquisition.id,
      cardId: scan.cardId,
      initialQuantity: scan.quantity,
      allocatedCostCent,
      costBasisStatus: typeof allocatedCostCent === 'number' ? 'known' : 'unknown',
      origin: 'scan',
      ownershipStatus: 'imported',
      condition: 'unknown',
      language: normalizeLanguage(scan.language),
      finish: normalizeFinish(scan.finish),
      acquiredAt: scan.scannedAt,
      sourceRef,
      createdAt: existing?.createdAt ?? scan.createdAt,
      updatedAt: projectionTime,
    };
    await this.db.inventory_lots.put(lot);
    await this.db.inventory_lot_sources.put({
      id: `lot-source:${sourceRef}`,
      lotId,
      sourceRef,
      role: 'created_from',
      quantity: scan.quantity,
      costBasisContributionCent: allocatedCostCent,
      linkedAt: projectionTime,
    });
    await this.flagPossibleDeckDuplicate(lot, projectionTime);
  }

  private async resolveOpenIssues(sourceRef: string, resolvedAt: Date): Promise<void> {
    const existing = await this.db.reconciliation_issues
      .where('sourceRef')
      .equals(sourceRef)
      .toArray();
    for (const issue of existing.filter(row => row.status === 'open')) {
      await this.db.reconciliation_issues.update(issue.id, {
        status: 'resolved',
        resolution: 'other',
        resolutionData: { reason: 'projection_succeeded' },
        resolvedAt,
        updatedAt: resolvedAt,
      });
    }
  }

  private async putIssue(
    id: string,
    kind: ReconciliationIssue['kind'],
    sourceRef: string,
    updatedAt: Date,
    details: Record<string, unknown>,
    candidateLotId?: string
  ): Promise<void> {
    const existing = await this.db.reconciliation_issues.get(id);
    if (existing?.status === 'resolved' && existing.resolution === 'ignored') return;
    await this.db.reconciliation_issues.put({
      id,
      kind,
      sourceRef,
      candidateLotId,
      details,
      status: 'open',
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    });
  }

  private async flagPossibleDeckDuplicate(
    incomingLot: InventoryLot,
    updatedAt: Date
  ): Promise<void> {
    const candidates = (await this.db.inventory_lots
      .where('cardId')
      .equals(incomingLot.cardId)
      .toArray())
      .filter(row => row.id !== incomingLot.id)
      .filter(row => row.origin === 'deck_import')
      .filter(row => row.finish === incomingLot.finish)
      .filter(row => row.language === incomingLot.language);

    for (const candidate of candidates) {
      const snapshot = await this.accounting.getLotSnapshot(candidate.id);
      if (!snapshot || snapshot.remainingQuantity <= 0) continue;
      const issueId = `issue:possible-duplicate:${incomingLot.id}:${candidate.id}`;
      const existing = await this.db.reconciliation_issues.get(issueId);
      if (
        existing?.status === 'resolved' &&
        ['same_physical_copy', 'additional_copy', 'ignored'].includes(
          existing.resolution ?? ''
        )
      ) {
        continue;
      }
      await this.putIssue(
        issueId,
        'possible_duplicate_inventory',
        incomingLot.sourceRef,
        updatedAt,
        {
          incomingLotId: incomingLot.id,
          incomingOrigin: incomingLot.origin,
          candidateOrigin: candidate.origin,
        },
        candidate.id
      );
    }
  }
}
