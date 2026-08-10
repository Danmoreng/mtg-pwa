import Dexie, {type EntityTable} from 'dexie';
import type { CostBasisStatus } from '../features/accounting/AccountingTypes';

/**
 * Fresh 2026 data baseline. The new database name deliberately avoids opening
 * any pre-baseline IndexedDB database that may still exist in a browser.
 */
export const DATABASE_NAME = 'MtgTrackerDbAccounting';
export const DATABASE_SCHEMA_VERSION = 1;

export const DATABASE_TABLE_NAMES = [
    'acquisitions',
    'cards',
    'card_lots',
    'transactions',
    'scans',
    'decks',
    'deck_cards',
    'price_points',
    'valuations',
    'settings',
    'scan_sale_links',
    'sell_allocations',
    'cm_import_files',
    'cm_orders',
    'cm_order_parties',
    'cm_order_lines',
    'cm_ledger_transactions',
    'cm_order_ledger_links',
    'inventory_lots',
    'inventory_lot_sources',
    'inventory_adjustments',
    'sales',
    'sale_lines',
    'lot_allocations',
    'reconciliation_issues',
    'deck_inventory_allocations',
    'deck_import_runs',
] as const;

export type DatabaseTableName = typeof DATABASE_TABLE_NAMES[number];

// Define our data models
export interface Card {
    id: string; // scryfall_id
    oracleId?: string;
    name: string;
    set: string;
    setCode: string;
    number: string;
    lang: string;
    finish: string;
    layout?: string;
    imageUrl?: string;
    imageUrlBack?: string;
    cardmarketId?: number;
    createdAt: Date;
    updatedAt: Date;
}

// 1.1 New: parent entity for boxes/collections
export interface Acquisition {
    id: string; // ulid/uuid
    kind: 'box' | 'sealed' | 'single' | 'collection' | 'deck_gap' | 'manual_entry' | 'other';
    source: string;               // 'manabox', 'cardmarket', ...
    externalRef?: string;         // import/order id
    sourceRef?: string;           // canonical idempotency/provenance key
    currency: 'EUR';
    happenedAt: Date;
    occurredAt?: Date;            // canonical accounting date during transition

    // Total cost at acquisition level
    totalPriceCent?: number;
    totalFeesCent?: number;
    totalShippingCent?: number;
    totalCostCent?: number;       // derived = sum of above
    merchandiseCent?: number;
    feesCent?: number;
    shippingCent?: number;
    projectionVersion?: number;

    allocationMethod?: 'equal_per_card' | 'by_market_price' | 'manual' | 'by_rarity';
    allocationAsOf?: Date;        // last allocation timestamp
    allocationSourceRev?: string; // e.g., 'cardmarket.priceguide:avg7d:2025-09-01'

    createdAt: Date;
    updatedAt: Date;
}

export interface CardLot {
    id: string;
    cardId: string;
    acquisitionId?: string;
    quantity: number;
    unitCost: number; // in cents
    condition: string;
    language: string;
    foil: boolean;
    finish: string;
    source: string;
    purchasedAt: Date;
    disposedAt?: Date;
    disposedQuantity?: number;
    saleTransactionId?: string;
    currency?: string; // Add currency property
    externalRef?: string; // Add external reference for deduplication

    // Enhanced financial tracking
    acquisitionPriceCent?: number;    // Pure card price
    acquisitionFeesCent?: number;      // All fees (commission, shipping, etc.)
    acquisitionShippingCent?: number;  // Shipping costs for purchase
    totalAcquisitionCostCent?: number; // acquisitionPriceCent + fees + shipping

    salePriceCent?: number;          // Sale price per unit
    saleFeesCent?: number;           // Fees for sale (commission)
    saleShippingCent?: number;       // Shipping charged/received
    totalSaleRevenueCent?: number;   // salePriceCent - fees + shipping

    netProfitPerUnitCent?: number;    // Calculated net profit per unit
    totalNetProfitCent?: number;     // Total net profit for lot

    createdAt: Date;
    updatedAt: Date;
}


export interface Transaction {
    id: string;
    kind: 'BUY' | 'SELL';
    cardId?: string | null;
    lotId?: string;
    quantity: number;
    unitPrice: number; // in cents
    fees: number; // in cents
    shipping: number; // in cents
    currency: string;
    source: string;
    externalRef: string;
    happenedAt: Date;
    notes?: string;
    relatedTransactionId?: string | null;
    finish?: string;
    language?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Scan {
    id: string;
    cardFingerprint: string;
    cardId?: string;
    lotId?: string;
    acquisitionId?: string;
    source: string;
    externalRef?: string;
    scannedAt: Date;
    quantity: number;
    finish?: string;
    language?: string;
    boosterPackId?: string;
    notes?: string;
    soldTransactionId?: string;
    soldAt?: Date;
    soldQuantity?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Deck {
    id: string;
    platform: 'moxfield' | 'csv';
    name: string;
    commander?: string;
    url?: string;
    faceCardId?: string;
    inventoryMode?: 'requirements_only' | 'physical_exclusive';
    status?: 'active' | 'inactive' | 'archived';
    importedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeckCard {
    id: string;
    deckId: string;
    cardId: string;
    /** @deprecated Target accounting uses deck_inventory_allocations. */
    lotId?: string;
    quantity: number;
    finish?: 'nonfoil' | 'foil' | 'etched';
    language?: string;
    condition?: string;
    role: 'main' | 'side' | 'maybeboard';
    addedAt: Date;
    removedAt?: Date;
    createdAt: Date;
}

export interface PricePoint {
    id: string; // Format: `${cardId}:${provider}:${finish}:${date}`
    cardId: string;
    provider: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide'; // Specific provider identifiers
    finish: 'nonfoil' | 'foil' | 'etched';
    date: string; // ISO date format: 'YYYY-MM-DD'
    currency: 'EUR';
    priceCent: number; // Price in integer cents
    avg1dCent?: number; // 1-day average in cents
    avg7dCent?: number; // 7-day average in cents
    avg30dCent?: number; // 30-day average in cents
    sourceRev?: string; // Source version/build identifier
    asOf: Date; // When this price point was recorded
    createdAt: Date; // When this record was created
}

export interface Valuation {
    id: string; // asOf
    asOf: Date;
    totalValue: number; // in cents
    totalCostBasis: number; // in cents
    realizedPnLToDate: number; // in cents
    createdAt: Date;
}

export interface Setting {
    k: string;
    v: any;
    createdAt: Date;
    updatedAt: Date;
}

// Scan to Sale matching link
export interface ScanSaleLink {
    id: string;
    scanId: string;
    transactionId: string;
    quantity: number;
    matchedAt: Date;
    createdAt: Date;
}

// 1.1 New: allocation of SELL transactions across CardLots
export interface SellAllocation {
    id: string; // ulid/uuid
    transactionId: string; // SELL line id
    lotId: string;
    quantity: number;
    unitCostCentAtSale?: number; // snapshot for P&L accuracy
    createdAt: Date;
}

export type CardmarketImportFileKind =
    | 'transaction_summary'
    | 'sold_orders'
    | 'purchased_orders'
    | 'sold_articles'
    | 'purchased_articles';

export interface CardmarketImportFile {
    id: string;
    source: 'cardmarket';
    kind: CardmarketImportFileKind;
    fileName: string;
    fileHash: string;
    periodStart?: string; // YYYY-MM-DD from file name when present
    periodEnd?: string; // YYYY-MM-DD from file name when present
    rowCount: number;
    importedAt: Date;
    createdAt: Date;
}

export interface CardmarketOrder {
    id: string; // Cardmarket OrderID / Shipment nr.
    direction: 'sale' | 'purchase';
    orderDate: Date;
    username?: string;
    currency: string;
    articleCount: number;
    merchandiseCents: number;
    shippingCents: number;
    totalCents: number;
    commissionCents?: number;
    trusteeFeeCents?: number;
    descriptionRaw?: string;
    productIdsRaw?: string;
    localizedNamesRaw?: string;
    sourceFileId: string;
    sourceLineNumber: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CardmarketOrderParty {
    orderId: string;
    name?: string;
    street?: string;
    city?: string;
    country?: string;
    isProfessional?: boolean;
    vatNumber?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CardmarketOrderLine {
    id: string; // `${orderId}:${lineNo}`
    orderId: string;
    lineNo: number;
    direction: 'sale' | 'purchase';
    purchasedAt: Date;
    productId: string;
    articleName: string;
    localizedProductName?: string;
    expansion?: string;
    category?: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    currency: string;
    comments?: string;
    collectorNumber?: string;
    rarity?: string;
    condition?: string;
    language?: string;
    isFoil?: boolean;
    descriptionRaw?: string;
    sourceFileId: string;
    sourceLineNumber: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CardmarketLedgerTransaction {
    id: string; // Cardmarket "Transaction" id when available
    happenedAt: Date;
    category: string;
    type: string;
    counterpart: string;
    reference: string;
    amountCents: number;
    currency: string;
    startingBalanceCents?: number;
    closingBalanceCents?: number;
    sourceFileId: string;
    sourceLineNumber: number;
    createdAt: Date;
}

export interface CardmarketOrderLedgerLink {
    id: string; // `${orderId}:${ledgerTransactionId}`
    orderId: string;
    ledgerTransactionId: string;
    relation: 'sale' | 'fee' | 'purchase' | 'trustee_fee' | 'other';
    createdAt: Date;
}

export interface InventoryLot {
    id: string;
    acquisitionId: string;
    cardId: string;
    initialQuantity: number;
    allocatedCostCent?: number;
    costBasisStatus: CostBasisStatus;
    origin: 'purchase' | 'scan' | 'manual' | 'deck_import';
    ownershipStatus: 'imported' | 'user_confirmed';
    condition: string;
    language: string;
    finish: 'nonfoil' | 'foil' | 'etched';
    acquiredAt: Date;
    sourceRef: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface InventoryLotSource {
    id: string;
    lotId: string;
    sourceRef: string;
    role: 'created_from' | 'confirmed_by' | 'cost_basis_from';
    quantity: number;
    costBasisContributionCent?: number;
    linkedAt: Date;
}

export interface InventoryAdjustment {
    id: string;
    lotId: string;
    quantityDelta: number;
    costBasisDeltaCent?: number;
    costBasisStatus: CostBasisStatus;
    kind: 'found' | 'correction' | 'lost' | 'gifted' | 'transferred' | 'damaged' | 'other';
    effectiveAt: Date;
    note?: string;
    sourceRef: string;
    reversesAdjustmentId?: string;
    confirmedAt: Date;
    createdAt: Date;
}

export interface Sale {
    id: string;
    occurredAt: Date;
    currency: 'EUR';
    grossMerchandiseCent: number;
    platformFeesCent: number;
    shippingIncomeCent: number;
    shippingExpenseCent: number;
    netProceedsCent: number;
    sourceRef: string;
    projectionVersion: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface SaleLine {
    id: string;
    saleId: string;
    cardId: string;
    quantity: number;
    finish: 'nonfoil' | 'foil' | 'etched';
    language: string;
    grossLineCent: number;
    allocatedFeesCent: number;
    allocatedShippingIncomeCent: number;
    allocatedShippingExpenseCent: number;
    netLineProceedsCent: number;
    sourceRef: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface LotAllocation {
    id: string;
    saleLineId: string;
    lotId: string;
    quantity: number;
    costBasisCentSnapshot?: number;
    costBasisStatus: CostBasisStatus;
    netProceedsCentSnapshot: number;
    method: 'auto' | 'manual';
    lockedAt?: Date;
    createdAt: Date;
}

export interface ReconciliationIssue {
    id: string;
    kind: 'unmatched' | 'oversold' | 'ambiguous' | 'quantity_conflict' | 'possible_duplicate_inventory';
    sourceRef: string;
    saleLineId?: string;
    candidateLotId?: string;
    candidateIds?: string[];
    details?: Record<string, unknown>;
    status: 'open' | 'resolved';
    resolution?: 'same_physical_copy' | 'additional_copy' | 'ignored' | 'other';
    resolutionData?: Record<string, unknown>;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeckInventoryAllocation {
    id: string;
    deckCardId: string;
    lotId: string;
    quantity: number;
    method: 'auto' | 'manual' | 'created_deficit';
    lockedAt?: Date;
    releasedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeckImportRun {
    id: string;
    sourceFileId?: string;
    targetDeckId: string;
    existingInventoryPolicy: 'allocate_available' | 'requirements_only';
    missingInventoryPolicy: 'leave_missing' | 'create_deficit';
    costBasisPolicy: 'unknown' | 'enter_total' | 'enter_per_card';
    totalDeficitCostCent?: number;
    unitCostCentByDeckCardId?: Record<string, number>;
    defaultFinish: 'nonfoil' | 'foil' | 'etched';
    defaultLanguage: string;
    defaultCondition: string;
    confirmedAt?: Date;
    confirmedBy?: 'user';
    createdAt: Date;
}

const BASELINE_SCHEMA_STORES = {
    acquisitions: 'id, kind, source, externalRef, &sourceRef, currency, happenedAt, occurredAt, createdAt, updatedAt, [source+externalRef]',
    cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, cardmarketId, createdAt, updatedAt',
    card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, ' +
        '[cardId+purchasedAt], [acquisitionId+purchasedAt], [externalRef]',
    transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, finish, language, ' +
        '[lotId+kind], [cardId+kind], [source+externalRef]',
    scans: 'id, cardFingerprint, cardId, lotId, acquisitionId, source, scannedAt, boosterPackId, externalRef, createdAt, updatedAt, finish, language, ' +
        '[lotId+scannedAt], [acquisitionId+scannedAt], [cardId+scannedAt], [acquisitionId+externalRef]',
    decks: 'id, platform, name, inventoryMode, status, importedAt, createdAt, updatedAt',
    deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
    price_points: 'id, cardId, provider, finish, date, currency, priceCent, asOf, createdAt, ' +
        '[cardId+date], [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]',
    valuations: 'id, asOf, createdAt, [asOf+createdAt]',
    settings: 'k, createdAt, updatedAt',
    scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt, strategy, score',
    sell_allocations: 'id, transactionId, lotId, quantity, unitCostCentAtSale, createdAt, ' +
        '[transactionId+lotId], [lotId], [transactionId]',
    cm_import_files: 'id, source, kind, fileName, fileHash, periodStart, periodEnd, rowCount, importedAt, createdAt, &[source+fileHash]',
    cm_orders: 'id, direction, orderDate, username, articleCount, currency, sourceFileId, sourceLineNumber, createdAt, updatedAt, [direction+orderDate]',
    cm_order_parties: 'orderId, country, isProfessional, vatNumber, updatedAt',
    cm_order_lines: 'id, orderId, lineNo, direction, purchasedAt, productId, articleName, localizedProductName, quantity, sourceFileId, sourceLineNumber, updatedAt, &[orderId+lineNo], [orderId+productId], [productId+direction]',
    cm_ledger_transactions: 'id, happenedAt, category, type, counterpart, reference, amountCents, sourceFileId, sourceLineNumber, createdAt, [reference+happenedAt], [category+type], &[sourceFileId+sourceLineNumber]',
    cm_order_ledger_links: 'id, orderId, ledgerTransactionId, relation, createdAt, &[orderId+ledgerTransactionId], [ledgerTransactionId+orderId], [orderId+relation]'
};

const ACCOUNTING_SCHEMA_STORES = {
    ...BASELINE_SCHEMA_STORES,
    inventory_lots: 'id, acquisitionId, cardId, &sourceRef, origin, ownershipStatus, acquiredAt, createdAt, updatedAt, [cardId+acquiredAt], [acquisitionId+acquiredAt]',
    inventory_lot_sources: 'id, lotId, sourceRef, role, linkedAt, &[lotId+sourceRef+role], [sourceRef+role]',
    inventory_adjustments: 'id, lotId, kind, effectiveAt, &sourceRef, reversesAdjustmentId, confirmedAt, createdAt, [lotId+effectiveAt]',
    sales: 'id, occurredAt, &sourceRef, createdAt, updatedAt',
    sale_lines: 'id, saleId, cardId, &sourceRef, createdAt, updatedAt, [saleId+cardId]',
    lot_allocations: 'id, saleLineId, lotId, method, lockedAt, createdAt, &[saleLineId+lotId], [lotId+saleLineId]',
    reconciliation_issues: 'id, kind, sourceRef, status, saleLineId, candidateLotId, createdAt, updatedAt, [status+kind]',
    deck_inventory_allocations: 'id, deckCardId, lotId, method, lockedAt, releasedAt, createdAt, updatedAt, &[deckCardId+lotId], [lotId+releasedAt]',
    deck_import_runs: 'id, sourceFileId, targetDeckId, existingInventoryPolicy, missingInventoryPolicy, costBasisPolicy, confirmedAt, createdAt, &[sourceFileId+targetDeckId]'
};

export default class MtgTrackerDb extends Dexie {
    cards!: EntityTable<Card, 'id'>;
    card_lots!: EntityTable<CardLot, 'id'>;
    acquisitions!: EntityTable<Acquisition, 'id'>;

    transactions!: EntityTable<Transaction, 'id'>;
    scans!: EntityTable<Scan, 'id'>;
    decks!: EntityTable<Deck, 'id'>;
    deck_cards!: EntityTable<DeckCard, 'id'>;
    price_points!: EntityTable<PricePoint, 'id'>;
    valuations!: EntityTable<Valuation, 'id'>;
    settings!: EntityTable<Setting, 'k'>;
    scan_sale_links!: EntityTable<ScanSaleLink, 'id'>;
    sell_allocations!: EntityTable<SellAllocation, 'id'>;
    cm_import_files!: EntityTable<CardmarketImportFile, 'id'>;
    cm_orders!: EntityTable<CardmarketOrder, 'id'>;
    cm_order_parties!: EntityTable<CardmarketOrderParty, 'orderId'>;
    cm_order_lines!: EntityTable<CardmarketOrderLine, 'id'>;
    cm_ledger_transactions!: EntityTable<CardmarketLedgerTransaction, 'id'>;
    cm_order_ledger_links!: EntityTable<CardmarketOrderLedgerLink, 'id'>;
    inventory_lots!: EntityTable<InventoryLot, 'id'>;
    inventory_lot_sources!: EntityTable<InventoryLotSource, 'id'>;
    inventory_adjustments!: EntityTable<InventoryAdjustment, 'id'>;
    sales!: EntityTable<Sale, 'id'>;
    sale_lines!: EntityTable<SaleLine, 'id'>;
    lot_allocations!: EntityTable<LotAllocation, 'id'>;
    reconciliation_issues!: EntityTable<ReconciliationIssue, 'id'>;
    deck_inventory_allocations!: EntityTable<DeckInventoryAllocation, 'id'>;
    deck_import_runs!: EntityTable<DeckImportRun, 'id'>;

    constructor(databaseName: string = DATABASE_NAME) {
        super(databaseName);

        this.version(DATABASE_SCHEMA_VERSION).stores(ACCOUNTING_SCHEMA_STORES);
    }
}
