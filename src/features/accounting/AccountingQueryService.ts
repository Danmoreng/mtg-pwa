import type {
  Acquisition,
  Card,
  Deck,
  DeckCard,
  DeckInventoryAllocation,
  InventoryAdjustment,
  InventoryLot,
  LotAllocation,
  PricePoint,
  ReconciliationIssue,
  Sale,
  SaleLine,
} from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { calculateLotAccounting } from './AccountingKernel';
import type {
  AccountingMoney,
  CostBasisStatus,
  LotAccountingSnapshot,
} from './AccountingTypes';

const PROVIDER_RANK: Record<PricePoint['provider'], number> = {
  'cardmarket.priceguide': 3,
  'mtgjson.cardmarket': 2,
  scryfall: 1,
};

export interface AmountSummary {
  status: CostBasisStatus;
  cents?: number;
  knownCents: number;
  unknownItems: number;
  estimatedItems: number;
}

export interface CanonicalLotView {
  lot: InventoryLot;
  card?: Card;
  snapshot: LotAccountingSnapshot;
  unitMarketPriceCent?: number;
  marketValue: AccountingMoney;
  priceProvider?: PricePoint['provider'];
  priceAsOf?: Date;
}

export interface CanonicalHolding {
  cardId: string;
  card: Card;
  quantity: number;
  deckReservedQuantity: number;
  availableQuantity: number;
  totalCostBasis: AmountSummary;
  marketValue: AmountSummary;
  unrealizedPnL: AmountSummary;
  realizedPnL: AmountSummary;
  lots: CanonicalLotView[];
}

export interface PortfolioSummary {
  cardCount: number;
  lotCount: number;
  quantity: number;
  deckReservedQuantity: number;
  availableQuantity: number;
  marketValue: AmountSummary;
  openCostBasis: AmountSummary;
  realizedPnL: AmountSummary;
  unrealizedPnL: AmountSummary;
  totalPnL: AmountSummary;
  acquisitionCost: AmountSummary;
  grossSalesCent: number;
  netSalesCent: number;
  salesFeesCent: number;
  shippingIncomeCent: number;
  shippingExpenseCent: number;
  purchaseFeesCent: number;
  purchaseShippingCent: number;
  openIssueCount: number;
  unpricedLotCount: number;
  unknownCostLotCount: number;
}

export interface CardSaleActivity {
  line: SaleLine;
  sale: Sale;
}

export interface CardAccountingActivity {
  lots: CanonicalLotView[];
  sales: CardSaleActivity[];
}

export interface DeckCardCoverage {
  deckCard: DeckCard;
  card?: Card;
  requiredQuantity: number;
  allocatedQuantity: number;
  missingQuantity: number;
}

export interface DeckCoverageSummary {
  deck: Deck;
  trackedPhysicalInventory: boolean;
  requiredQuantity: number;
  allocatedQuantity: number;
  missingQuantity: number;
  coveragePercentage: number;
  rows: DeckCardCoverage[];
  openIssues: ReconciliationIssue[];
}

export interface AcquisitionAccountingSummary {
  acquisition: Acquisition;
  lots: CanonicalLotView[];
  initialQuantity: number;
  remainingQuantity: number;
  soldQuantity: number;
  acquisitionCost: AmountSummary;
  marketValue: AmountSummary;
  realizedPnL: AmountSummary;
  unrealizedPnL: AmountSummary;
  netSaleProceedsCent: number;
}

interface QueryContext {
  cardsById: Map<string, Card>;
  lots: InventoryLot[];
  adjustmentsByLot: Map<string, InventoryAdjustment[]>;
  saleAllocationsByLot: Map<string, LotAllocation[]>;
  deckAllocationsByLot: Map<string, DeckInventoryAllocation[]>;
  priceByCardFinish: Map<string, PricePoint>;
}

function appendByKey<T>(map: Map<string, T[]>, key: string, value: T): void {
  const rows = map.get(key);
  if (rows) rows.push(value);
  else map.set(key, [value]);
}

function aggregateMoney(values: readonly AccountingMoney[]): AmountSummary {
  let knownCents = 0;
  let unknownItems = 0;
  let estimatedItems = 0;
  for (const value of values) {
    if (value.status === 'unknown') {
      unknownItems += 1;
      continue;
    }
    knownCents += value.cents;
    if (value.status === 'estimated') estimatedItems += 1;
  }
  if (unknownItems > 0) {
    return {
      status: 'unknown',
      knownCents,
      unknownItems,
      estimatedItems,
    };
  }
  return {
    status: estimatedItems > 0 ? 'estimated' : 'known',
    cents: knownCents,
    knownCents,
    unknownItems,
    estimatedItems,
  };
}

function amountFromOptionalCents(values: readonly (number | undefined)[]): AmountSummary {
  return aggregateMoney(
    values.map(value =>
      typeof value === 'number'
        ? { status: 'known' as const, cents: value }
        : { status: 'unknown' as const }
    )
  );
}

function addAmounts(left: AmountSummary, right: AmountSummary): AmountSummary {
  const knownCents = left.knownCents + right.knownCents;
  const unknownItems = left.unknownItems + right.unknownItems;
  const estimatedItems = left.estimatedItems + right.estimatedItems;
  if (unknownItems > 0) {
    return { status: 'unknown', knownCents, unknownItems, estimatedItems };
  }
  return {
    status: estimatedItems > 0 ? 'estimated' : 'known',
    cents: knownCents,
    knownCents,
    unknownItems,
    estimatedItems,
  };
}

function priceKey(cardId: string, finish: InventoryLot['finish']): string {
  return `${cardId}:${finish}`;
}

function isBetterPrice(candidate: PricePoint, current: PricePoint): boolean {
  const rankDifference = PROVIDER_RANK[candidate.provider] - PROVIDER_RANK[current.provider];
  if (rankDifference !== 0) return rankDifference > 0;
  const dateDifference = candidate.date.localeCompare(current.date);
  if (dateDifference !== 0) return dateDifference > 0;
  return candidate.asOf.getTime() > current.asOf.getTime();
}

export class AccountingQueryService {
  private readonly db: MtgTrackerDb;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
  }

  async getLotViews(cardId?: string): Promise<CanonicalLotView[]> {
    const context = await this.loadContext();
    return this.buildLotViews(context, cardId);
  }

  async getHoldings(): Promise<CanonicalHolding[]> {
    const context = await this.loadContext();
    const allLotViews = this.buildLotViews(context);
    const activeByCard = new Map<string, CanonicalLotView[]>();
    for (const lotView of allLotViews) {
      if (lotView.snapshot.remainingQuantity <= 0) continue;
      appendByKey(activeByCard, lotView.lot.cardId, lotView);
    }

    const holdings: CanonicalHolding[] = [];
    for (const [cardId, lots] of activeByCard) {
      const card = context.cardsById.get(cardId);
      if (!card) continue;
      const allCardLots = allLotViews.filter(row => row.lot.cardId === cardId);
      holdings.push({
        cardId,
        card,
        quantity: lots.reduce((sum, row) => sum + row.snapshot.remainingQuantity, 0),
        deckReservedQuantity: lots.reduce(
          (sum, row) => sum + row.snapshot.deckReservedQuantity,
          0
        ),
        availableQuantity: lots.reduce(
          (sum, row) => sum + row.snapshot.availableForDecks,
          0
        ),
        totalCostBasis: aggregateMoney(lots.map(row => row.snapshot.openCostBasis)),
        marketValue: aggregateMoney(lots.map(row => row.marketValue)),
        unrealizedPnL: aggregateMoney(lots.map(row => row.snapshot.unrealizedPnL)),
        realizedPnL: aggregateMoney(allCardLots.map(row => row.snapshot.realizedPnL)),
        lots,
      });
    }
    return holdings.sort((left, right) => left.card.name.localeCompare(right.card.name));
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const context = await this.loadContext();
    const views = this.buildLotViews(context);
    const active = views.filter(row => row.snapshot.remainingQuantity > 0);
    const acquisitionIds = new Set(context.lots.map(row => row.acquisitionId));
    const [acquisitions, sales, openIssueCount] = await Promise.all([
      this.db.acquisitions.bulkGet([...acquisitionIds]),
      this.db.sales.toArray(),
      this.db.reconciliation_issues.where('status').equals('open').count(),
    ]);
    const canonicalAcquisitions = acquisitions.filter(
      (row): row is Acquisition => row !== undefined
    );
    const realizedPnL = aggregateMoney(views.map(row => row.snapshot.realizedPnL));
    const unrealizedPnL = aggregateMoney(active.map(row => row.snapshot.unrealizedPnL));

    return {
      cardCount: new Set(active.map(row => row.lot.cardId)).size,
      lotCount: active.length,
      quantity: active.reduce((sum, row) => sum + row.snapshot.remainingQuantity, 0),
      deckReservedQuantity: active.reduce(
        (sum, row) => sum + row.snapshot.deckReservedQuantity,
        0
      ),
      availableQuantity: active.reduce(
        (sum, row) => sum + row.snapshot.availableForDecks,
        0
      ),
      marketValue: aggregateMoney(active.map(row => row.marketValue)),
      openCostBasis: aggregateMoney(active.map(row => row.snapshot.openCostBasis)),
      realizedPnL,
      unrealizedPnL,
      totalPnL: addAmounts(realizedPnL, unrealizedPnL),
      acquisitionCost: amountFromOptionalCents(
        canonicalAcquisitions.map(row => row.totalCostCent)
      ),
      grossSalesCent: sales.reduce((sum, row) => sum + row.grossMerchandiseCent, 0),
      netSalesCent: sales.reduce((sum, row) => sum + row.netProceedsCent, 0),
      salesFeesCent: sales.reduce((sum, row) => sum + row.platformFeesCent, 0),
      shippingIncomeCent: sales.reduce((sum, row) => sum + row.shippingIncomeCent, 0),
      shippingExpenseCent: sales.reduce((sum, row) => sum + row.shippingExpenseCent, 0),
      purchaseFeesCent: canonicalAcquisitions.reduce(
        (sum, row) => sum + (row.feesCent ?? row.totalFeesCent ?? 0),
        0
      ),
      purchaseShippingCent: canonicalAcquisitions.reduce(
        (sum, row) => sum + (row.shippingCent ?? row.totalShippingCent ?? 0),
        0
      ),
      openIssueCount,
      unpricedLotCount: active.filter(row => row.unitMarketPriceCent === undefined).length,
      unknownCostLotCount: active.filter(
        row => row.snapshot.openCostBasis.status === 'unknown'
      ).length,
    };
  }

  async getCardActivity(cardId: string): Promise<CardAccountingActivity> {
    const [lots, lines] = await Promise.all([
      this.getLotViews(cardId),
      this.db.sale_lines.where('cardId').equals(cardId).toArray(),
    ]);
    const sales = await this.db.sales.bulkGet([...new Set(lines.map(row => row.saleId))]);
    const salesById = new Map(
      sales.filter((row): row is Sale => row !== undefined).map(row => [row.id, row])
    );
    return {
      lots,
      sales: lines
        .flatMap(line => {
          const sale = salesById.get(line.saleId);
          return sale ? [{ line, sale }] : [];
        })
        .sort((left, right) => right.sale.occurredAt.getTime() - left.sale.occurredAt.getTime()),
    };
  }

  async getDeckSummary(deckId: string): Promise<DeckCoverageSummary | undefined> {
    const deck = await this.db.decks.get(deckId);
    if (!deck) return undefined;
    const deckCards = (await this.db.deck_cards.where('deckId').equals(deckId).toArray())
      .filter(row => !row.removedAt);
    const allocationsByDeckCard = new Map<string, number>();
    for (const deckCard of deckCards) {
      const allocations = await this.db.deck_inventory_allocations
        .where('deckCardId')
        .equals(deckCard.id)
        .toArray();
      allocationsByDeckCard.set(
        deckCard.id,
        allocations
          .filter(row => !row.releasedAt)
          .reduce((sum, row) => sum + row.quantity, 0)
      );
    }
    const cards = await this.db.cards.bulkGet([...new Set(deckCards.map(row => row.cardId))]);
    const cardsById = new Map(
      cards.filter((row): row is Card => row !== undefined).map(row => [row.id, row])
    );
    const trackedPhysicalInventory = deck.inventoryMode === 'physical_exclusive';
    const rows = deckCards.map(deckCard => {
      const allocatedQuantity = allocationsByDeckCard.get(deckCard.id) ?? 0;
      return {
        deckCard,
        card: cardsById.get(deckCard.cardId),
        requiredQuantity: deckCard.quantity,
        allocatedQuantity,
        missingQuantity: trackedPhysicalInventory
          ? Math.max(0, deckCard.quantity - allocatedQuantity)
          : 0,
      };
    });
    const requiredQuantity = rows.reduce((sum, row) => sum + row.requiredQuantity, 0);
    const allocatedQuantity = rows.reduce((sum, row) => sum + row.allocatedQuantity, 0);
    const missingQuantity = rows.reduce((sum, row) => sum + row.missingQuantity, 0);
    const openIssues = (await this.db.reconciliation_issues.where('status').equals('open').toArray())
      .filter(issue => issue.details?.deckId === deckId);
    return {
      deck,
      trackedPhysicalInventory,
      requiredQuantity,
      allocatedQuantity,
      missingQuantity,
      coveragePercentage:
        !trackedPhysicalInventory || requiredQuantity === 0
          ? 100
          : Math.round((allocatedQuantity / requiredQuantity) * 100),
      rows,
      openIssues,
    };
  }

  async getDeckSummaries(): Promise<DeckCoverageSummary[]> {
    const decks = await this.db.decks.toArray();
    const summaries = await Promise.all(decks.map(deck => this.getDeckSummary(deck.id)));
    return summaries.filter((row): row is DeckCoverageSummary => row !== undefined);
  }

  async getAcquisitionSummary(
    acquisitionId: string
  ): Promise<AcquisitionAccountingSummary | undefined> {
    const acquisition = await this.db.acquisitions.get(acquisitionId);
    if (!acquisition) return undefined;
    const lots = (await this.getLotViews()).filter(
      row => row.lot.acquisitionId === acquisitionId
    );
    const allocations = await Promise.all(
      lots.map(row => this.db.lot_allocations.where('lotId').equals(row.lot.id).toArray())
    );
    return {
      acquisition,
      lots,
      initialQuantity: lots.reduce((sum, row) => sum + row.lot.initialQuantity, 0),
      remainingQuantity: lots.reduce(
        (sum, row) => sum + row.snapshot.remainingQuantity,
        0
      ),
      soldQuantity: lots.reduce((sum, row) => sum + row.snapshot.soldQuantity, 0),
      acquisitionCost: amountFromOptionalCents([acquisition.totalCostCent]),
      marketValue: aggregateMoney(
        lots
          .filter(row => row.snapshot.remainingQuantity > 0)
          .map(row => row.marketValue)
      ),
      realizedPnL: aggregateMoney(lots.map(row => row.snapshot.realizedPnL)),
      unrealizedPnL: aggregateMoney(
        lots
          .filter(row => row.snapshot.remainingQuantity > 0)
          .map(row => row.snapshot.unrealizedPnL)
      ),
      netSaleProceedsCent: allocations
        .flat()
        .reduce((sum, row) => sum + row.netProceedsCentSnapshot, 0),
    };
  }

  private async loadContext(): Promise<QueryContext> {
    const [cards, lots, adjustments, saleAllocations, deckAllocations, prices] =
      await Promise.all([
        this.db.cards.toArray(),
        this.db.inventory_lots.toArray(),
        this.db.inventory_adjustments.toArray(),
        this.db.lot_allocations.toArray(),
        this.db.deck_inventory_allocations.toArray(),
        this.db.price_points.toArray(),
      ]);
    const adjustmentsByLot = new Map<string, typeof adjustments>();
    const saleAllocationsByLot = new Map<string, typeof saleAllocations>();
    const deckAllocationsByLot = new Map<string, typeof deckAllocations>();
    for (const row of adjustments) appendByKey(adjustmentsByLot, row.lotId, row);
    for (const row of saleAllocations) appendByKey(saleAllocationsByLot, row.lotId, row);
    for (const row of deckAllocations) appendByKey(deckAllocationsByLot, row.lotId, row);

    const priceByCardFinish = new Map<string, PricePoint>();
    for (const price of prices) {
      const key = priceKey(price.cardId, price.finish);
      const existing = priceByCardFinish.get(key);
      if (!existing || isBetterPrice(price, existing)) {
        priceByCardFinish.set(key, price);
      }
    }
    return {
      cardsById: new Map(cards.map(row => [row.id, row])),
      lots,
      adjustmentsByLot,
      saleAllocationsByLot,
      deckAllocationsByLot,
      priceByCardFinish,
    };
  }

  private buildLotViews(context: QueryContext, cardId?: string): CanonicalLotView[] {
    return context.lots
      .filter(lot => !cardId || lot.cardId === cardId)
      .map(lot => {
        const price = context.priceByCardFinish.get(priceKey(lot.cardId, lot.finish));
        const baseSnapshot = calculateLotAccounting({
          lot,
          adjustments: context.adjustmentsByLot.get(lot.id) ?? [],
          saleAllocations: context.saleAllocationsByLot.get(lot.id) ?? [],
          deckAllocations: context.deckAllocationsByLot.get(lot.id) ?? [],
        });
        const marketValueCent =
          price && baseSnapshot.remainingQuantity > 0
            ? price.priceCent * baseSnapshot.remainingQuantity
            : undefined;
        const snapshot = calculateLotAccounting({
          lot,
          adjustments: context.adjustmentsByLot.get(lot.id) ?? [],
          saleAllocations: context.saleAllocationsByLot.get(lot.id) ?? [],
          deckAllocations: context.deckAllocationsByLot.get(lot.id) ?? [],
          marketValueCent,
        });
        return {
          lot,
          card: context.cardsById.get(lot.cardId),
          snapshot,
          unitMarketPriceCent: price?.priceCent,
          marketValue:
            marketValueCent === undefined
              ? { status: 'unknown' as const }
              : { status: 'known' as const, cents: marketValueCent },
          priceProvider: price?.provider,
          priceAsOf: price?.asOf,
        };
      })
      .sort((left, right) => {
        const dateDifference = left.lot.acquiredAt.getTime() - right.lot.acquiredAt.getTime();
        return dateDifference || left.lot.id.localeCompare(right.lot.id);
      });
  }
}

export const accountingAmount = {
  aggregateMoney,
  amountFromOptionalCents,
  addAmounts,
};
