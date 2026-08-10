import type {
  Card,
  InventoryAdjustment,
  InventoryLot,
  ReconciliationIssue,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { AccountingCommandService } from './AccountingCommandService';
import { calculateLotAccounting } from './AccountingKernel';
import { AccountingProjectionCoordinator } from './AccountingProjectionCoordinator';
import { AccountingRepository } from './AccountingRepository';
import type { CostBasisStatus } from './AccountingTypes';
import { assertAccountingSnapshot } from './AccountingValidation';
import { allocateIntegerCents } from './CentAllocator';

export interface SamePhysicalCopyOptions {
  quantity?: number;
  note?: string;
}

export interface MissingInventoryIssueContext {
  issue: ReconciliationIssue;
  card: Card;
  quantity: number;
  finish: InventoryLot['finish'];
  language: string;
  condition: string;
  occurredAt: Date;
  reason: 'deck_deficit' | 'oversold';
}

export interface CreateMissingInventoryOptions {
  costBasisStatus: CostBasisStatus;
  totalCostCent?: number;
  occurredAt?: Date;
  condition?: string;
}

export interface IssueActionResult {
  issue: ReconciliationIssue;
  resolved: boolean;
}

export interface ReconciliationIssuePresentation {
  issueId: string;
  card?: Card;
  title: string;
  printing: string;
  context: string;
}

export class ReconciliationActionService {
  private readonly db: MtgTrackerDb;
  private readonly accounting: AccountingRepository;
  private readonly projections: AccountingProjectionCoordinator;
  private readonly commands: AccountingCommandService;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.accounting = new AccountingRepository(db);
    this.projections = new AccountingProjectionCoordinator(db);
    this.commands = new AccountingCommandService(db);
  }

  async getIssues(status?: ReconciliationIssue['status']): Promise<ReconciliationIssue[]> {
    const rows = status
      ? await this.db.reconciliation_issues.where('status').equals(status).toArray()
      : await this.db.reconciliation_issues.toArray();
    return rows.sort((left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime() || left.id.localeCompare(right.id)
    );
  }

  async getIssuePresentations(
    issues: readonly ReconciliationIssue[]
  ): Promise<ReconciliationIssuePresentation[]> {
    const [cards, decks, deckCards, saleLines, sales, lots, cardmarketLines, scans] =
      await Promise.all([
        this.db.cards.toArray(),
        this.db.decks.toArray(),
        this.db.deck_cards.toArray(),
        this.db.sale_lines.toArray(),
        this.db.sales.toArray(),
        this.db.inventory_lots.toArray(),
        this.db.cm_order_lines.toArray(),
        this.db.scans.toArray(),
      ]);
    const cardById = new Map(cards.map(row => [row.id, row]));
    const cardByCardmarketId = new Map(
      cards.flatMap(row => row.cardmarketId === undefined ? [] : [[row.cardmarketId, row] as const])
    );
    const deckById = new Map(decks.map(row => [row.id, row]));
    const deckCardById = new Map(deckCards.map(row => [row.id, row]));
    const saleLineById = new Map(saleLines.map(row => [row.id, row]));
    const saleById = new Map(sales.map(row => [row.id, row]));
    const lotById = new Map(lots.map(row => [row.id, row]));
    const cardmarketLineBySourceRef = new Map(cardmarketLines.map(row => [
      `cardmarket:${row.direction === 'sale' ? 'sale' : 'purchase'}:${row.orderId}:line:${row.id}`,
      row,
    ]));
    const scanBySourceRef = new Map(scans.map(row => [`manabox:scan:${row.id}`, row]));

    return issues.map(issue => {
      const deckCard = deckCardById.get(String(issue.details?.deckCardId ?? ''));
      const saleLine = issue.saleLineId ? saleLineById.get(issue.saleLineId) : undefined;
      const incomingLot = lotById.get(String(issue.details?.incomingLotId ?? ''));
      const candidateLot = issue.candidateLotId ? lotById.get(issue.candidateLotId) : undefined;
      const candidateIdLot = issue.candidateIds
        ?.map(id => lotById.get(id))
        .find((row): row is InventoryLot => Boolean(row));
      const cardmarketLine = cardmarketLineBySourceRef.get(issue.sourceRef);
      const scan = scanBySourceRef.get(issue.sourceRef);
      const cardmarketProductId = Number(cardmarketLine?.productId);
      const card = cardById.get(
        deckCard?.cardId ??
        saleLine?.cardId ??
        incomingLot?.cardId ??
        candidateLot?.cardId ??
        candidateIdLot?.cardId ??
        scan?.cardId ??
        ''
      ) ?? (Number.isSafeInteger(cardmarketProductId)
        ? cardByCardmarketId.get(cardmarketProductId)
        : undefined);

      const rawTitle = cardmarketLine?.localizedProductName || cardmarketLine?.articleName;
      const title = card?.name || rawTitle || (
        scan ? 'Unmatched ManaBox card' : this.issueKindTitle(issue.kind)
      );
      const exactLanguage = (
        deckCard?.language ?? saleLine?.language ?? incomingLot?.language ??
        candidateLot?.language ?? candidateIdLot?.language ?? scan?.language ??
        cardmarketLine?.language ?? card?.lang
      )?.toUpperCase();
      const exactFinish =
        deckCard?.finish ?? saleLine?.finish ?? incomingLot?.finish ??
        candidateLot?.finish ?? candidateIdLot?.finish ?? scan?.finish ??
        (cardmarketLine?.isFoil ? 'foil' : card?.finish);
      const printing = card
        ? [card.set, `(${card.setCode.toUpperCase()})`, `#${card.number}`, exactLanguage, exactFinish]
            .filter(Boolean)
            .join(' · ')
        : [
            cardmarketLine?.expansion,
            cardmarketLine?.collectorNumber ? `#${cardmarketLine.collectorNumber}` : undefined,
            cardmarketLine?.language,
            cardmarketLine?.isFoil ? 'foil' : undefined,
            scan?.cardFingerprint,
          ].filter(Boolean).join(' · ') || 'Exact printing not identified yet';

      let context = '';
      if (deckCard) {
        const deck = deckById.get(deckCard.deckId);
        const missing = Number(issue.details?.missingQuantity ?? 0);
        context = `Deck: ${deck?.name ?? deckCard.deckId}` +
          (missing > 0 ? ` · ${missing} missing of ${deckCard.quantity}` : '');
      } else if (saleLine) {
        const sale = saleById.get(saleLine.saleId);
        context = `Sale${sale ? ` on ${sale.occurredAt.toLocaleDateString()}` : ''}` +
          ` · ${saleLine.quantity} × ${saleLine.finish} · ${saleLine.language.toUpperCase()}`;
      } else if (cardmarketLine) {
        context = `Cardmarket ${cardmarketLine.direction}` +
          ` · order ${cardmarketLine.orderId} · quantity ${cardmarketLine.quantity}`;
      } else if (scan) {
        context = `ManaBox scan · quantity ${scan.quantity}`;
      } else if (incomingLot || candidateLot || candidateIdLot) {
        const lot = incomingLot ?? candidateLot ?? candidateIdLot!;
        context = `Inventory comparison · ${lot.finish} · ${lot.language.toUpperCase()}`;
      }

      return { issueId: issue.id, card, title, printing, context };
    });
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

  async getMissingInventoryContext(
    issueId: string
  ): Promise<MissingInventoryIssueContext> {
    const issue = await this.requireOpenIssue(issueId);
    const quantity = Number(issue.details?.missingQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error('This issue has no valid missing quantity to add.');
    }

    const deckCardId = String(issue.details?.deckCardId ?? '');
    if (issue.kind === 'quantity_conflict' && deckCardId) {
      const deckCard = await this.db.deck_cards.get(deckCardId);
      if (!deckCard) throw new Error('The affected deck card no longer exists.');
      const [card, deck, run] = await Promise.all([
        this.db.cards.get(deckCard.cardId),
        this.db.decks.get(deckCard.deckId),
        this.db.deck_import_runs.get(`deck-import-run:${deckCard.deckId}`),
      ]);
      if (!card) throw new Error('The affected card printing no longer exists.');
      return {
        issue,
        card,
        quantity,
        finish: deckCard.finish ?? run?.defaultFinish ?? 'nonfoil',
        language: (deckCard.language ?? run?.defaultLanguage ?? card.lang ?? 'en').toLowerCase(),
        condition: deckCard.condition ?? run?.defaultCondition ?? 'unknown',
        occurredAt: deck?.importedAt ?? issue.createdAt,
        reason: 'deck_deficit',
      };
    }

    if (issue.kind === 'oversold' && issue.saleLineId) {
      const saleLine = await this.db.sale_lines.get(issue.saleLineId);
      if (!saleLine) throw new Error('The affected sale line no longer exists.');
      const [card, sale] = await Promise.all([
        this.db.cards.get(saleLine.cardId),
        this.db.sales.get(saleLine.saleId),
      ]);
      if (!card) throw new Error('The affected card printing no longer exists.');
      return {
        issue,
        card,
        quantity,
        finish: saleLine.finish,
        language: saleLine.language,
        condition: 'unknown',
        occurredAt: sale?.occurredAt ?? issue.createdAt,
        reason: 'oversold',
      };
    }

    throw new Error('This issue cannot be resolved by adding physical inventory.');
  }

  async createMissingInventory(
    issueId: string,
    options: CreateMissingInventoryOptions
  ): Promise<IssueActionResult> {
    const context = await this.getMissingInventoryContext(issueId);
    const sourceRef = `reconciliation:${context.issue.id}:inventory`;
    await this.commands.createManualInventory({
      acquisitionId: `acquisition:${sourceRef}`,
      lotId: `lot:${sourceRef}`,
      lotSourceId: `lot-source:${sourceRef}`,
      sourceRef,
      cardId: context.card.id,
      quantity: context.quantity,
      allocatedCostCent: options.totalCostCent,
      costBasisStatus: options.costBasisStatus,
      finish: context.finish,
      language: context.language,
      condition: options.condition ?? context.condition,
      occurredAt: options.occurredAt ?? context.occurredAt,
    });
    await this.projections.projectAfterInventoryChange();
    return this.issueResult(issueId);
  }

  async mapUnmatchedIssue(issueId: string, cardId: string): Promise<IssueActionResult> {
    const issue = await this.requireOpenIssue(issueId);
    if (issue.kind !== 'unmatched') {
      throw new Error('Only unmatched issues can be mapped to a card printing.');
    }
    const card = await this.db.cards.get(cardId);
    if (!card) throw new Error('Select a valid card printing.');
    const provider = String(issue.details?.provider ?? '');

    if (provider === 'cardmarket') {
      const productId = Number(issue.details?.productId);
      if (!Number.isSafeInteger(productId) || productId <= 0) {
        throw new Error('The Cardmarket issue has no valid product ID.');
      }
      const existingOwner = (await this.db.cards
        .where('cardmarketId')
        .equals(productId)
        .toArray()).find(row => row.id !== card.id);
      if (existingOwner) {
        throw new Error(`Cardmarket product ${productId} is already mapped to ${existingOwner.name}.`);
      }
      if (card.cardmarketId !== undefined && card.cardmarketId !== productId) {
        throw new Error(
          `${card.name} is already mapped to Cardmarket product ${card.cardmarketId}.`
        );
      }
      await this.db.cards.update(card.id, { cardmarketId: productId, updatedAt: new Date() });
      await this.projections.projectAfterInventoryChange();
      return this.issueResult(issueId);
    }

    if (provider === 'manabox') {
      const scanId = issue.sourceRef.startsWith('manabox:scan:')
        ? issue.sourceRef.slice('manabox:scan:'.length)
        : '';
      const scan = scanId ? await this.db.scans.get(scanId) : undefined;
      if (!scan || !scan.acquisitionId) {
        throw new Error('The ManaBox scan behind this issue no longer exists.');
      }
      await this.db.scans.update(scan.id, { cardId: card.id, updatedAt: new Date() });
      await this.projections.projectAfterManaBoxImport(scan.acquisitionId);
      return this.issueResult(issueId);
    }

    throw new Error(`Unsupported unmatched issue provider: ${provider || 'unknown'}.`);
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

  private async requireOpenIssue(issueId: string): Promise<ReconciliationIssue> {
    const issue = await this.requireIssue(issueId);
    if (issue.status !== 'open') throw new Error('This issue is already resolved.');
    return issue;
  }

  private async issueResult(issueId: string): Promise<IssueActionResult> {
    const issue = await this.requireIssue(issueId);
    return { issue, resolved: issue.status === 'resolved' };
  }

  private issueKindTitle(kind: ReconciliationIssue['kind']): string {
    const titles: Record<ReconciliationIssue['kind'], string> = {
      unmatched: 'Unmatched imported card',
      oversold: 'Sale without sufficient inventory',
      ambiguous: 'Ambiguous inventory match',
      quantity_conflict: 'Quantity conflict',
      possible_duplicate_inventory: 'Possible duplicate inventory',
    };
    return titles[kind];
  }
}
