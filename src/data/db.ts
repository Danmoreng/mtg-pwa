import Dexie, {type EntityTable} from 'dexie';

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
    kind: 'box' | 'sealed' | 'single' | 'collection' | 'other';
    source: string;               // 'manabox', 'cardmarket', ...
    externalRef?: string;         // import/order id
    currency: 'EUR';
    happenedAt: Date;

    // Total cost at acquisition level
    totalPriceCent?: number;
    totalFeesCent?: number;
    totalShippingCent?: number;
    totalCostCent?: number;       // derived = sum of above

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
    cardId?: string;
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
    relatedTransactionId?: string;
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
    importedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeckCard {
    id: string;
    deckId: string;
    cardId: string;
    lotId?: string;
    quantity: number;
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

    constructor() {
        super('MtgTrackerDb');

        // Version 1 - Initial schema
        this.version(1).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish',
            transactions: 'id, kind, cardId, source, externalRef, happenedAt',
            scans: 'id, cardFingerprint, cardId, source, scannedAt',
            decks: 'id, platform, name, importedAt',
            deck_cards: 'id, [deckId+cardId], deckId, cardId',
            price_points: 'id, cardId, provider, asOf',
            valuations: 'id, asOf',
            settings: 'k'
        });

        // Version 2 - Enhanced schema with better indexing and new tables
        this.version(2).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
            transactions: 'id, kind, cardId, source, externalRef, happenedAt, createdAt, updatedAt',
            scans: 'id, cardFingerprint, cardId, source, scannedAt, createdAt, updatedAt',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, [deckId+cardId], deckId, cardId, createdAt',
            price_points: 'id, cardId, provider, asOf, createdAt',
            valuations: 'id, asOf, createdAt',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, matchedAt, createdAt'
        }).upgrade(async (tx) => {
            // Add createdAt and updatedAt to existing records
            const now = new Date();

            // Update cards
            await tx.table('cards').toCollection().modify(card => {
                card.createdAt = card.createdAt || now;
                card.updatedAt = card.updatedAt || now;
            });


            // Update transactions
            await tx.table('transactions').toCollection().modify(transaction => {
                transaction.createdAt = transaction.createdAt || now;
                transaction.updatedAt = transaction.updatedAt || now;
            });

            // Update scans
            await tx.table('scans').toCollection().modify(scan => {
                scan.createdAt = scan.createdAt || now;
                scan.updatedAt = scan.updatedAt || now;
            });

            // Update decks
            await tx.table('decks').toCollection().modify(deck => {
                deck.createdAt = deck.createdAt || now;
                deck.updatedAt = deck.updatedAt || now;
            });

            // Update deck_cards
            await tx.table('deck_cards').toCollection().modify(deckCard => {
                deckCard.createdAt = deckCard.createdAt || now;
            });

            // Update price_points
            await tx.table('price_points').toCollection().modify(pricePoint => {
                pricePoint.createdAt = pricePoint.createdAt || now;
            });

            // Update valuations
            await tx.table('valuations').toCollection().modify(valuation => {
                valuation.createdAt = valuation.createdAt || now;
            });

            // Update settings
            await tx.table('settings').toCollection().modify(setting => {
                setting.createdAt = setting.createdAt || now;
                setting.updatedAt = setting.updatedAt || now;
            });
        });

        // Version 3 - Enhanced schema for historical pricing
        this.version(3).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
            transactions: 'id, kind, cardId, source, externalRef, happenedAt, createdAt, updatedAt',
            scans: 'id, cardFingerprint, cardId, source, scannedAt, createdAt, updatedAt',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, [deckId+cardId], deckId, cardId, createdAt',
            price_points: 'id, cardId, provider, currency, asOf, createdAt, [cardId+asOf], [provider+asOf]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, matchedAt, createdAt'
        });

        // Version 4 - Enhanced schema for lot-based tracking
        this.version(4).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, [cardId+purchasedAt], [acquisitionId+cardId]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, [lotId+kind]',
            scans: 'id, cardFingerprint, cardId, lotId, source, scannedAt, boosterPackId, createdAt, updatedAt, [lotId+scannedAt]',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
            price_points: 'id, cardId, provider, currency, asOf, source, createdAt, [cardId+asOf], [provider+asOf]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt'
        }).upgrade(async (_tx) => {
            // Add missing fields to existing deck_cards records
        });

        // Version 5 - Add externalRef to card_lots for deduplication
        this.version(5).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, [cardId+purchasedAt], [acquisitionId+cardId], [externalRef]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, [lotId+kind]',
            scans: 'id, cardFingerprint, cardId, lotId, source, scannedAt, boosterPackId, createdAt, updatedAt, [lotId+scannedAt]',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
            price_points: 'id, cardId, provider, currency, asOf, source, createdAt, [cardId+asOf], [provider+asOf]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt'
        });

        // Version 6 - Add layout to cards and improve card_lots indexing
        this.version(6).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, [cardId+purchasedAt], [acquisitionId+cardId], [externalRef]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, [lotId+kind]',
            scans: 'id, cardFingerprint, cardId, lotId, source, scannedAt, boosterPackId, createdAt, updatedAt, [lotId+scannedAt]',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
            price_points: 'id, cardId, provider, currency, asOf, source, createdAt, [cardId+asOf], [provider+asOf]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt'
        }).upgrade(async tx => {
            await tx.table('cards').toCollection().modify(card => {
                card.layout = card.layout || 'normal';
            });
        });

        // Version 7 - Remove holdings table
        this.version(7).stores({
            holdings: null
        });

        // Version 8 - Enhanced price points schema for M2
        this.version(8).stores({
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, cardmarketId, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, [cardId+purchasedAt], [acquisitionId+cardId], [externalRef]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, [lotId+kind]',
            scans: 'id, cardFingerprint, cardId, lotId, source, scannedAt, boosterPackId, createdAt, updatedAt, [lotId+scannedAt]',
            decks: 'id, platform, name, importedAt, createdAt, updatedAt',
            deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',
            price_points: 'id, cardId, provider, finish, date, currency, priceCent, asOf, createdAt, [cardId+date], [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt'
        }).upgrade(async tx => {
            const t = tx.table('price_points');
            const rows = await t.toArray();
            for (const r of rows) {
                // price → priceCent (convert decimals to cents when needed)
                if (r.priceCent == null && r.price != null) {
                    const isDecimal = typeof r.price === 'number' && r.price < 1000;
                    r.priceCent = isDecimal ? Math.round(r.price * 100) : r.price;
                    delete r.price;
                }

                // derive finish/date/provider/id from old shapes
                let finish: 'nonfoil' | 'foil' | 'etched' = r.finish ?? 'nonfoil';
                let date = r.date ?? (r.asOf ? new Date(r.asOf).toISOString().slice(0, 10) : undefined);
                const parts = String(r.id ?? '').split(':'); // legacy ids
                const maybeFinish = parts[2];
                const maybeDate = parts[3] ?? parts[2];
                if (maybeFinish === 'foil' || maybeFinish === 'etched') finish = maybeFinish;
                if (/^\d{4}-\d{2}-\d{2}$/.test(maybeDate)) date = maybeDate;

                // Convert source to provider
                let provider: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide' = 'scryfall';
                if (r.source) {
                    if (r.source === 'mtgjson') {
                        provider = 'mtgjson.cardmarket';
                    } else if (r.source === 'cardmarket') {
                        provider = 'cardmarket.priceguide';
                    } else {
                        provider = 'scryfall';
                    }
                }

                r.finish = finish;
                r.provider = provider;
                r.date = date ?? new Date().toISOString().slice(0, 10);
                r.currency = r.currency ?? 'EUR';
                r.createdAt = r.createdAt ?? new Date();
                r.asOf = r.asOf ?? new Date();
                r.id = `${r.cardId}:${provider}:${finish}:${r.date}`;

                await t.put(r);
            }
        });

        // Version 9 – acquisitions + strengthened indexes + scans.acquisitionId
        this.version(9).stores({
            acquisitions: 'id, kind, source, externalRef, currency, happenedAt, createdAt, updatedAt, [source+externalRef]',
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, cardmarketId, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, ' +
                '[cardId+purchasedAt], [acquisitionId+purchasedAt], [externalRef]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, finish, language, ' +
                '[lotId+kind], [cardId+kind], [source+externalRef]',
            scans: 'id, cardFingerprint, cardId, lotId, acquisitionId, source, scannedAt, boosterPackId, externalRef, createdAt, updatedAt, finish, language, ' +
                '[lotId+scannedAt], [acquisitionId+scannedAt], [cardId+scannedAt], [acquisitionId+externalRef]',
            deck_cards: '[deckId+cardId], lotId, addedAt, removedAt, createdAt, [lotId+addedAt]',
            // ensure provider index matches repository API (see §7.3)
            price_points: 'id, cardId, provider, finish, date, currency, priceCent, asOf, createdAt, ' +
                '[cardId+date], [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt, strategy, score'
        }).upgrade(async (_tx) => {
            // Backfill scans.acquisitionId = null; leave existing data intact
            // Ensure disposedAt stays consistent (optional pass to set disposedAt where remaining==0)
        });

        // Version 10 - Add sell_allocations store for M3 implementation
        this.version(10).stores({
            acquisitions: 'id, kind, source, externalRef, currency, happenedAt, createdAt, updatedAt, [source+externalRef]',
            cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, cardmarketId, createdAt, updatedAt',
            card_lots: 'id, cardId, acquisitionId, source, purchasedAt, disposedAt, createdAt, updatedAt, externalRef, ' +
                '[cardId+purchasedAt], [acquisitionId+purchasedAt], [externalRef]',
            transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, finish, language, ' +
                '[lotId+kind], [cardId+kind], [source+externalRef]',
            scans: 'id, cardFingerprint, cardId, lotId, acquisitionId, source, scannedAt, boosterPackId, externalRef, createdAt, updatedAt, finish, language, ' +
                '[lotId+scannedAt], [acquisitionId+scannedAt], [cardId+scannedAt], [acquisitionId+externalRef]',
            deck_cards: '[deckId+cardId], lotId, addedAt, removedAt, createdAt, [lotId+addedAt]',
            price_points: 'id, cardId, provider, finish, date, currency, priceCent, asOf, createdAt, ' +
                '[cardId+date], [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]',
            valuations: 'id, asOf, createdAt, [asOf+createdAt]',
            settings: 'k, createdAt, updatedAt',
            scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt, strategy, score',
            sell_allocations: 'id, transactionId, lotId, quantity, unitCostCentAtSale, createdAt, ' +
                '[transactionId+lotId], [lotId], [transactionId]'
        }).upgrade(async (_tx) => {
            // No-op upgrade as this is an additive change
        });
    }
}
