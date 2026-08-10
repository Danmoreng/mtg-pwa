import type {
  CardmarketOrder,
  CardmarketOrderLine,
  InventoryLot,
  LotAllocation,
  ReconciliationIssue,
  SaleLine,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingRepository } from '../accounting/AccountingRepository';
import { allocateIntegerCents } from '../accounting/CentAllocator';

const PROJECTION_VERSION = 1;

export interface CardmarketAccountingProjectionSummary {
  acquisitions: number;
  inventoryLots: number;
  sales: number;
  saleLines: number;
  lotAllocations: number;
  openIssues: number;
}

function normalizeFinish(line: CardmarketOrderLine): InventoryLot['finish'] {
  return line.isFoil ? 'foil' : 'nonfoil';
}

function normalizeLanguage(value: string | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    english: 'en',
    german: 'de',
    french: 'fr',
    italian: 'it',
    spanish: 'es',
    japanese: 'ja',
    portuguese: 'pt',
    russian: 'ru',
    korean: 'ko',
    chinese: 'zhs',
  };
  return aliases[normalized] ?? (normalized || 'en');
}

function allocationWeights(lines: readonly CardmarketOrderLine[]) {
  const useLineTotals = lines.some(line => line.lineTotalCents > 0);
  return lines.map(line => ({
    id: line.id,
    weight: useLineTotals ? Math.max(0, line.lineTotalCents) : Math.max(0, line.quantity),
  }));
}

function allocationMap(totalCent: number, lines: readonly CardmarketOrderLine[]) {
  return new Map(
    allocateIntegerCents(totalCent, allocationWeights(lines)).map(row => [
      row.id,
      row.cents,
    ])
  );
}

function takeProportionalCents(
  totalCent: number,
  totalQuantity: number,
  takenQuantity: number
): number {
  if (takenQuantity === totalQuantity) return totalCent;
  const rows = allocateIntegerCents(totalCent, [
    { id: 'remaining', weight: totalQuantity - takenQuantity },
    { id: 'taken', weight: takenQuantity },
  ]);
  return rows.find(row => row.id === 'taken')?.cents ?? 0;
}

export class CardmarketAccountingProjectionService {
  private readonly db: MtgTrackerDb;
  private readonly accounting: AccountingRepository;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.accounting = new AccountingRepository(db);
  }

  async projectAll(): Promise<CardmarketAccountingProjectionSummary> {
    return this.db.transaction(
      'rw',
      [
        this.db.cm_orders,
        this.db.cm_order_lines,
        this.db.cards,
        this.db.acquisitions,
        this.db.inventory_lots,
        this.db.inventory_lot_sources,
        this.db.inventory_adjustments,
        this.db.sales,
        this.db.sale_lines,
        this.db.lot_allocations,
        this.db.deck_inventory_allocations,
        this.db.reconciliation_issues,
      ],
      async () => {
        const orders = (await this.db.cm_orders.toArray()).sort((left, right) => {
          const dateDifference = left.orderDate.getTime() - right.orderDate.getTime();
          return dateDifference || left.id.localeCompare(right.id);
        });
        const summary: CardmarketAccountingProjectionSummary = {
          acquisitions: 0,
          inventoryLots: 0,
          sales: 0,
          saleLines: 0,
          lotAllocations: 0,
          openIssues: 0,
        };

        for (const order of orders.filter(row => row.direction === 'purchase')) {
          await this.projectPurchase(order, summary);
        }
        for (const order of orders.filter(row => row.direction === 'sale')) {
          await this.projectSale(order, summary);
        }
        summary.openIssues = await this.db.reconciliation_issues
          .where('status')
          .equals('open')
          .count();
        return summary;
      }
    );
  }

  private async resolveCardId(line: CardmarketOrderLine): Promise<string | undefined> {
    const productId = Number.parseInt(line.productId, 10);
    if (Number.isFinite(productId)) {
      const card = await this.db.cards.where('cardmarketId').equals(productId).first();
      if (card) return card.id;
    }
    const syntheticId = line.productId ? 'cm:' + line.productId : '';
    if (syntheticId && (await this.db.cards.get(syntheticId))) return syntheticId;
    return undefined;
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
    candidateLotId?: string,
    saleLineId?: string
  ): Promise<void> {
    const existing = await this.db.reconciliation_issues.get(id);
    if (existing?.status === 'resolved' && existing.resolution === 'ignored') return;
    await this.db.reconciliation_issues.put({
      id,
      kind,
      sourceRef,
      candidateLotId,
      saleLineId,
      details,
      status: 'open',
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    });
  }

  private async projectPurchase(
    order: CardmarketOrder,
    summary: CardmarketAccountingProjectionSummary
  ): Promise<void> {
    const lines = (await this.db.cm_order_lines.where('orderId').equals(order.id).toArray())
      .filter(line => line.direction === 'purchase')
      .sort((left, right) => left.lineNo - right.lineNo || left.id.localeCompare(right.id));
    if (lines.length === 0) return;

    const sourceRef = 'cardmarket:purchase:' + order.id;
    const acquisitionId = 'acquisition:' + sourceRef;
    const existingAcquisition = await this.db.acquisitions.get(acquisitionId);
    const feesCent = (order.commissionCents ?? 0) + (order.trusteeFeeCents ?? 0);
    const totalCostCent = order.merchandiseCents + feesCent + order.shippingCents;
    await this.db.acquisitions.put({
      id: acquisitionId,
      kind: lines.length === 1 ? 'single' : 'collection',
      source: 'cardmarket',
      externalRef: order.id,
      sourceRef,
      currency: 'EUR',
      happenedAt: order.orderDate,
      occurredAt: order.orderDate,
      totalPriceCent: order.merchandiseCents,
      totalFeesCent: feesCent,
      totalShippingCent: order.shippingCents,
      totalCostCent,
      merchandiseCent: order.merchandiseCents,
      feesCent,
      shippingCent: order.shippingCents,
      allocationMethod: 'by_market_price',
      allocationAsOf: order.updatedAt,
      allocationSourceRev: 'cardmarket:order-lines',
      projectionVersion: PROJECTION_VERSION,
      createdAt: existingAcquisition?.createdAt ?? order.createdAt,
      updatedAt: order.updatedAt,
    });
    summary.acquisitions += 1;

    const merchandise = allocationMap(order.merchandiseCents, lines);
    const fees = allocationMap(feesCent, lines);
    const shipping = allocationMap(order.shippingCents, lines);

    for (const line of lines) {
      const lineSourceRef = sourceRef + ':line:' + line.id;
      await this.resolveOpenIssues(lineSourceRef, line.updatedAt);
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        await this.putIssue(
          'issue:quantity-conflict:' + lineSourceRef,
          'quantity_conflict',
          lineSourceRef,
          line.updatedAt,
          { provider: 'cardmarket', orderId: order.id, quantity: line.quantity }
        );
        continue;
      }
      const cardId = await this.resolveCardId(line);
      if (!cardId) {
        await this.putIssue(
          'issue:unmatched:' + lineSourceRef,
          'unmatched',
          lineSourceRef,
          line.updatedAt,
          { provider: 'cardmarket', orderId: order.id, productId: line.productId }
        );
        continue;
      }

      const allocatedCostCent =
        (merchandise.get(line.id) ?? 0) +
        (fees.get(line.id) ?? 0) +
        (shipping.get(line.id) ?? 0);
      const lotId = 'lot:' + lineSourceRef;
      const existingLot = await this.db.inventory_lots.get(lotId);
      const lot: InventoryLot = {
        id: lotId,
        acquisitionId,
        cardId,
        initialQuantity: line.quantity,
        allocatedCostCent,
        costBasisStatus: 'known',
        origin: 'purchase',
        ownershipStatus: 'imported',
        condition: line.condition ?? 'unknown',
        language: normalizeLanguage(line.language),
        finish: normalizeFinish(line),
        acquiredAt: line.purchasedAt,
        sourceRef: lineSourceRef,
        createdAt: existingLot?.createdAt ?? line.createdAt,
        updatedAt: line.updatedAt,
      };
      await this.db.inventory_lots.put(lot);
      await this.db.inventory_lot_sources.put({
        id: 'lot-source:' + lineSourceRef,
        lotId,
        sourceRef: lineSourceRef,
        role: 'created_from',
        quantity: line.quantity,
        costBasisContributionCent: allocatedCostCent,
        linkedAt: line.updatedAt,
      });
      summary.inventoryLots += 1;
      await this.flagPossibleDeckDuplicate(lot, line.updatedAt);
    }
  }

  private async projectSale(
    order: CardmarketOrder,
    summary: CardmarketAccountingProjectionSummary
  ): Promise<void> {
    const lines = (await this.db.cm_order_lines.where('orderId').equals(order.id).toArray())
      .filter(line => line.direction === 'sale')
      .sort((left, right) => left.lineNo - right.lineNo || left.id.localeCompare(right.id));
    if (lines.length === 0) return;

    const sourceRef = 'cardmarket:sale:' + order.id;
    const saleId = 'sale:' + sourceRef;
    const existingSale = await this.db.sales.get(saleId);
    const feesCent = (order.commissionCents ?? 0) + (order.trusteeFeeCents ?? 0);
    const netProceedsCent = order.merchandiseCents + order.shippingCents - feesCent;
    await this.db.sales.put({
      id: saleId,
      occurredAt: order.orderDate,
      currency: 'EUR',
      grossMerchandiseCent: order.merchandiseCents,
      platformFeesCent: feesCent,
      shippingIncomeCent: order.shippingCents,
      shippingExpenseCent: 0,
      netProceedsCent,
      sourceRef,
      projectionVersion: PROJECTION_VERSION,
      createdAt: existingSale?.createdAt ?? order.createdAt,
      updatedAt: order.updatedAt,
    });
    summary.sales += 1;

    const gross = allocationMap(order.merchandiseCents, lines);
    const fees = allocationMap(feesCent, lines);
    const shipping = allocationMap(order.shippingCents, lines);

    for (const line of lines) {
      const lineSourceRef = sourceRef + ':line:' + line.id;
      await this.resolveOpenIssues(lineSourceRef, line.updatedAt);
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        await this.putIssue(
          'issue:quantity-conflict:' + lineSourceRef,
          'quantity_conflict',
          lineSourceRef,
          line.updatedAt,
          { provider: 'cardmarket', orderId: order.id, quantity: line.quantity }
        );
        continue;
      }
      const cardId = await this.resolveCardId(line);
      if (!cardId) {
        await this.putIssue(
          'issue:unmatched:' + lineSourceRef,
          'unmatched',
          lineSourceRef,
          line.updatedAt,
          { provider: 'cardmarket', orderId: order.id, productId: line.productId }
        );
        continue;
      }

      const grossLineCent = gross.get(line.id) ?? 0;
      const allocatedFeesCent = fees.get(line.id) ?? 0;
      const allocatedShippingIncomeCent = shipping.get(line.id) ?? 0;
      const lineId = 'sale-line:' + lineSourceRef;
      const existingLine = await this.db.sale_lines.get(lineId);
      const saleLine: SaleLine = {
        id: lineId,
        saleId,
        cardId,
        quantity: line.quantity,
        finish: normalizeFinish(line),
        language: normalizeLanguage(line.language),
        grossLineCent,
        allocatedFeesCent,
        allocatedShippingIncomeCent,
        allocatedShippingExpenseCent: 0,
        netLineProceedsCent:
          grossLineCent + allocatedShippingIncomeCent - allocatedFeesCent,
        sourceRef: lineSourceRef,
        createdAt: existingLine?.createdAt ?? line.createdAt,
        updatedAt: line.updatedAt,
      };
      await this.db.sale_lines.put(saleLine);
      summary.saleLines += 1;
      summary.lotAllocations += await this.allocateSaleLine(saleLine, line.updatedAt);
    }
  }

  private async allocateSaleLine(saleLine: SaleLine, updatedAt: Date): Promise<number> {
    const existing = await this.db.lot_allocations
      .where('saleLineId')
      .equals(saleLine.id)
      .toArray();
    const unlocked = existing.filter(row => row.method === 'auto' && !row.lockedAt);
    if (unlocked.length > 0) {
      await this.db.lot_allocations.bulkDelete(unlocked.map(row => row.id));
    }
    const locked = existing.filter(row => row.method === 'manual' || row.lockedAt);
    const lockedQuantity = locked.reduce((sum, row) => sum + row.quantity, 0);
    let neededQuantity = Math.max(0, saleLine.quantity - lockedQuantity);
    const planned: Array<Omit<LotAllocation, 'netProceedsCentSnapshot'>> = [];
    const lots = await this.accounting.getAvailableLots(
      saleLine.cardId,
      saleLine.finish,
      saleLine.language
    );

    for (const candidate of lots) {
      if (neededQuantity === 0) break;
      const activeDeckAllocations = await this.db.deck_inventory_allocations
        .where('lotId')
        .equals(candidate.lot.id)
        .toArray();
      const lockedDeckQuantity = activeDeckAllocations
        .filter(row => (row.method === 'manual' || row.lockedAt) && !row.releasedAt)
        .reduce((sum, row) => sum + row.quantity, 0);
      const availableQuantity = Math.max(
        0,
        candidate.snapshot.remainingQuantity - lockedDeckQuantity
      );
      if (availableQuantity === 0) continue;
      const quantity = Math.min(availableQuantity, neededQuantity);
      const costBasisStatus = candidate.snapshot.openCostBasis.status;
      const costBasisCentSnapshot =
        candidate.snapshot.openCostBasis.status === 'unknown'
          ? undefined
          : takeProportionalCents(
              candidate.snapshot.openCostBasis.cents,
              candidate.snapshot.remainingQuantity,
              quantity
            );
      planned.push({
        id: 'allocation:' + saleLine.id + ':' + candidate.lot.id,
        saleLineId: saleLine.id,
        lotId: candidate.lot.id,
        quantity,
        costBasisCentSnapshot,
        costBasisStatus,
        method: 'auto',
        createdAt: updatedAt,
      });
      neededQuantity -= quantity;
    }

    const lockedProceeds = locked.reduce(
      (sum, row) => sum + row.netProceedsCentSnapshot,
      0
    );
    const netToAllocate = saleLine.netLineProceedsCent - lockedProceeds;
    const proceedsWeights = [
      ...planned.map(row => ({ id: row.id, weight: row.quantity })),
      ...(neededQuantity > 0 ? [{ id: 'unmatched', weight: neededQuantity }] : []),
    ];
    const proceeds = new Map<string, number>();
    if (proceedsWeights.length > 0) {
      for (const row of allocateIntegerCents(netToAllocate, proceedsWeights)) {
        proceeds.set(row.id, row.cents);
      }
    } else if (
      netToAllocate !== 0 ||
      lockedQuantity !== saleLine.quantity
    ) {
      await this.putIssue(
        'issue:allocation-conflict:' + saleLine.sourceRef,
        'quantity_conflict',
        saleLine.sourceRef,
        updatedAt,
        {
          requestedQuantity: saleLine.quantity,
          lockedQuantity,
          lineNetProceedsCent: saleLine.netLineProceedsCent,
          lockedNetProceedsCent: lockedProceeds,
        },
        undefined,
        saleLine.id
      );
    }
    const allocations: LotAllocation[] = planned.map(row => ({
      ...row,
      netProceedsCentSnapshot: proceeds.get(row.id) ?? 0,
    }));
    if (allocations.length > 0) {
      await this.db.lot_allocations.bulkPut(allocations);
    }

    if (neededQuantity > 0) {
      await this.putIssue(
        'issue:oversold:' + saleLine.sourceRef,
        'oversold',
        saleLine.sourceRef,
        updatedAt,
        {
          requestedQuantity: saleLine.quantity,
          allocatedQuantity: saleLine.quantity - neededQuantity,
          missingQuantity: neededQuantity,
        },
        undefined,
        saleLine.id
      );
    }
    return allocations.length;
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
      const issueId = 'issue:possible-duplicate:' + incomingLot.id + ':' + candidate.id;
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
