import { cardRepository, cardLotRepository } from '../../data/repos';
import { EntityLinker } from '../linker/EntityLinker';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import { type Card } from '../../data/db';
import { getDb } from '../../data/init';
import { useImportStatusStore } from '../../stores/importStatus';
import { v4 as uuidv4 } from 'uuid';
import {
    DeckAccountingProjectionService,
    type DeckAccountingProjectionOptions,
} from './DeckAccountingProjectionService';

type DeckPlatform = 'moxfield' | 'csv';
type DeckRole = 'main' | 'side' | 'maybeboard';
type CardFinish = 'nonfoil' | 'foil' | 'etched';

export interface DeckImportEntry {
    quantity: number;
    cardName: string;
    setCode: string;
    collectorNumber: string;
    finish: CardFinish;
    language: string;
    role: DeckRole;
    scryfallId?: string;
    isCommander?: boolean;
}

interface DeckImportPayload {
    name: string;
    platform: DeckPlatform;
    url?: string;
    commander?: string;
    entries: DeckImportEntry[];
}

const DECK_TEXT_LINE_REGEX = /^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*([A-Za-z0-9-]+)(?:\s*\*F\*\s*)?$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstNonEmptyString(values: unknown[]): string {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function normalizeFinish(value: unknown): CardFinish {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized.includes('etched')) return 'etched';
    if (normalized.includes('nonfoil') || normalized.includes('non-foil')) return 'nonfoil';
    if (normalized.includes('foil')) return 'foil';
    return 'nonfoil';
}

function normalizeLanguage(value: unknown): string {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized || 'en';
}

function toQuantity(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
    }
    return 0;
}

function toLikelyScryfallId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return UUID_REGEX.test(normalized) ? normalized : undefined;
}

function flattenBoardEntries(board: unknown): unknown[] {
    if (!board) return [];
    if (Array.isArray(board)) return board;
    if (!isRecord(board)) return [];
    if ('cards' in board) {
        return flattenBoardEntries(board.cards);
    }
    return Object.values(board);
}

function parseMoxfieldBoardEntry(
    rawEntry: unknown,
    role: DeckRole,
    isCommander: boolean
): DeckImportEntry | null {
    if (!isRecord(rawEntry)) return null;
    const cardRecord = isRecord(rawEntry.card) ? rawEntry.card : rawEntry;

    const quantity = toQuantity(rawEntry.quantity ?? rawEntry.count ?? rawEntry.qty ?? 1);
    if (quantity <= 0) return null;

    const cardName = firstNonEmptyString([cardRecord.name, rawEntry.name]);
    const setCode = firstNonEmptyString([
        cardRecord.set,
        cardRecord.setCode,
        cardRecord.set_code,
        rawEntry.set,
        rawEntry.setCode,
    ]).toLowerCase();
    const collectorNumber = firstNonEmptyString([
        cardRecord.collector_number,
        cardRecord.collectorNumber,
        cardRecord.number,
        rawEntry.collector_number,
        rawEntry.collectorNumber,
        rawEntry.number,
    ]);
    const finish = normalizeFinish(rawEntry.finish ?? cardRecord.finish ?? rawEntry.foil ?? cardRecord.foil);
    const language = normalizeLanguage(rawEntry.language ?? rawEntry.lang ?? cardRecord.lang ?? cardRecord.language);
    const scryfallId = toLikelyScryfallId(
        firstNonEmptyString([
            cardRecord.scryfall_id,
            cardRecord.scryfallId,
            rawEntry.scryfall_id,
            rawEntry.scryfallId,
            cardRecord.id,
            rawEntry.cardId,
        ])
    );

    if (!cardName) return null;
    if (!scryfallId && (!setCode || !collectorNumber)) return null;

    return {
        quantity,
        cardName,
        setCode,
        collectorNumber,
        finish,
        language,
        role,
        scryfallId,
        isCommander,
    };
}

export function parseDeckTextLine(line: string): DeckImportEntry | null {
    const trimmedLine = String(line || '').trim();
    if (!trimmedLine) return null;

    const match = trimmedLine.match(DECK_TEXT_LINE_REGEX);
    if (!match) return null;

    const [, quantityStr, cardName, setCode, collectorNumber] = match;
    const quantity = Number.parseInt(quantityStr, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const finish = /\*F\*/i.test(trimmedLine) ? 'foil' : 'nonfoil';
    return {
        quantity,
        cardName: cardName.trim(),
        setCode: setCode.trim().toLowerCase(),
        collectorNumber: collectorNumber.trim(),
        finish,
        language: 'en',
        role: 'main',
    };
}

export function extractMoxfieldDeckId(inputUrl: string): string {
    const raw = String(inputUrl || '').trim();
    if (!raw) {
        throw new Error('Please provide a Moxfield deck URL.');
    }

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Invalid URL. Please paste a full Moxfield deck URL.');
    }

    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (hostname !== 'moxfield.com') {
        throw new Error('URL must point to moxfield.com.');
    }

    const match = url.pathname.match(/^\/decks\/([^/?#]+)/i);
    if (!match || !match[1]) {
        throw new Error('Could not find a deck ID in the URL.');
    }

    return match[1];
}

export function normalizeMoxfieldDeckData(
    rawDeck: unknown,
    sourceUrl: string,
    deckNameOverride?: string
): DeckImportPayload {
    if (!isRecord(rawDeck)) {
        throw new Error('Moxfield API returned an invalid deck payload.');
    }

    const boardConfigs: Array<{ key: string; role: DeckRole; isCommander?: boolean }> = [
        { key: 'commanders', role: 'main', isCommander: true },
        { key: 'mainboard', role: 'main' },
        { key: 'sideboard', role: 'side' },
        { key: 'maybeboard', role: 'maybeboard' },
        { key: 'companions', role: 'main' },
    ];

    const entries: DeckImportEntry[] = [];
    for (const config of boardConfigs) {
        const directBoard = rawDeck[config.key];
        const boardFromContainer = isRecord(rawDeck.boards) ? rawDeck.boards[config.key] : undefined;
        const boardEntries = flattenBoardEntries(directBoard ?? boardFromContainer);
        for (const boardEntry of boardEntries) {
            const parsed = parseMoxfieldBoardEntry(boardEntry, config.role, Boolean(config.isCommander));
            if (parsed) {
                entries.push(parsed);
            }
        }
    }

    if (entries.length === 0) {
        throw new Error('No importable cards found in this Moxfield deck.');
    }

    const deckName = String(deckNameOverride || '').trim() || firstNonEmptyString([rawDeck.name]) || 'Moxfield deck';
    const commanderNameFromEntry = entries.find(entry => entry.isCommander)?.cardName;
    const commanderName = commanderNameFromEntry || firstNonEmptyString([rawDeck.commander, rawDeck.commanderName]);
    const publicUrl = firstNonEmptyString([rawDeck.publicUrl, rawDeck.url]) || sourceUrl;

    return {
        name: deckName,
        platform: 'moxfield',
        url: publicUrl,
        commander: commanderName || undefined,
        entries,
    };
}

export class DeckImportService {
    static async importDeckFromText(
        deckName: string,
        deckText: string,
        accountingOptions: DeckAccountingProjectionOptions = {}
    ): Promise<void> {
        const normalizedDeckName = String(deckName || '').trim();
        if (!normalizedDeckName) {
            throw new Error('Please enter a deck name.');
        }

        const entries = deckText
            .split('\n')
            .map(line => parseDeckTextLine(line))
            .filter((entry): entry is DeckImportEntry => entry !== null);

        if (entries.length === 0) {
            throw new Error('No valid deck lines found. Expected format: "1 Card Name (SET) 123".');
        }

        await this.importDeck({
            name: normalizedDeckName,
            platform: 'csv',
            entries,
        }, accountingOptions);
    }

    static async importDeckFromMoxfieldUrl(
        moxfieldUrl: string,
        deckNameOverride?: string,
        accountingOptions: DeckAccountingProjectionOptions = {}
    ): Promise<void> {
        const deckId = extractMoxfieldDeckId(moxfieldUrl);
        const normalizedUrl = `https://moxfield.com/decks/${deckId}`;
        const rawDeck = await this.fetchMoxfieldDeck(deckId);
        const payload = normalizeMoxfieldDeckData(rawDeck, normalizedUrl, deckNameOverride);
        await this.importDeck(payload, accountingOptions);
    }

    private static getMoxfieldEndpoints(deckId: string): string[] {
        const encodedDeckId = encodeURIComponent(deckId);

        const configuredBase = String(import.meta.env.VITE_MOXFIELD_API_BASE || '').trim();
        if (configuredBase) {
            const base = configuredBase.replace(/\/+$/, '');
            return [
                `${base}/v3/decks/all/${encodedDeckId}`,
                `${base}/v2/decks/all/${encodedDeckId}`,
            ];
        }

        if (import.meta.env.DEV) {
            return [
                `/moxfield-api/v3/decks/all/${encodedDeckId}`,
                `/moxfield-api/v2/decks/all/${encodedDeckId}`,
            ];
        }

        return [
            `https://api2.moxfield.com/v3/decks/all/${encodedDeckId}`,
            `https://api2.moxfield.com/v2/decks/all/${encodedDeckId}`,
        ];
    }

    private static async fetchMoxfieldDeck(deckId: string): Promise<unknown> {
        const endpoints = this.getMoxfieldEndpoints(deckId);

        let lastError = '';
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                });
                if (!response.ok) {
                    lastError = `${response.status} ${response.statusText}`;
                    continue;
                }
                return await response.json();
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
        }

        const likelyCors =
            /cors|cross-origin|failed to fetch|networkerror/i.test(lastError) ||
            (!import.meta.env.DEV && !String(import.meta.env.VITE_MOXFIELD_API_BASE || '').trim());

        if (likelyCors) {
            throw new Error(
                'Moxfield URL import is blocked by browser CORS in pure client-side mode. ' +
                'Use text import, run in dev mode (uses local proxy), or configure VITE_MOXFIELD_API_BASE to a proxy.'
            );
        }

        throw new Error(`Failed to fetch Moxfield deck (${lastError || 'no successful endpoint'})`);
    }

    private static async importDeck(
        payload: DeckImportPayload,
        accountingOptions: DeckAccountingProjectionOptions
    ): Promise<void> {
        let importStatusStore: ReturnType<typeof useImportStatusStore> | null = null;
        let importId: string | null = null;

        try {
            importStatusStore = useImportStatusStore();
            importId = uuidv4();
            importStatusStore.addImport({
                id: importId,
                type: 'deck',
                name: payload.name,
                status: 'pending',
                progress: 0,
                totalItems: payload.entries.length,
                processedItems: 0,
            });
        } catch (error) {
            console.warn('Could not initialize import status store:', error);
        }

        try {
            const now = new Date();
            const deckId = this.generateId('deck');
            const db = getDb();
            await db.decks.add({
                id: deckId,
                platform: payload.platform,
                name: payload.name,
                commander: payload.commander || '',
                url: payload.url || '',
                importedAt: now,
                createdAt: now,
                updatedAt: now,
            });

            if (importStatusStore && importId) {
                importStatusStore.updateImport(importId, { status: 'processing' });
            }

            let faceCardId: string | undefined;
            for (let i = 0; i < payload.entries.length; i += 1) {
                const entry = payload.entries[i];
                if (importStatusStore && importId) {
                    importStatusStore.updateImport(importId, {
                        processedItems: i + 1,
                        progress: Math.round(((i + 1) / payload.entries.length) * 100),
                    });
                }

                const cardId = await this.importDeckEntry(deckId, entry);
                if (!faceCardId && cardId && entry.isCommander) {
                    faceCardId = cardId;
                }
            }

            if (faceCardId) {
                await db.decks.update(deckId, {
                    faceCardId,
                    updatedAt: new Date(),
                });
            }

            await new DeckAccountingProjectionService(db).projectDeck(
                deckId,
                accountingOptions
            );

            if (importStatusStore && importId) {
                importStatusStore.completeImport(importId);
            }
        } catch (error) {
            console.error('Error importing deck:', error);
            if (importStatusStore && importId) {
                importStatusStore.completeImport(importId, (error as Error).message);
            }
            throw error;
        }
    }

    private static async importDeckEntry(deckId: string, entry: DeckImportEntry): Promise<string | null> {
        const cardId = await this.resolveCardId(entry);
        if (!cardId) {
            console.warn('Skipping deck entry because card could not be resolved:', entry);
            return null;
        }

        await this.ensureCardExists(cardId, entry);

        const now = new Date();
        const db = getDb();
        await db.deck_cards.add({
            id: this.generateId('deckcard'),
            deckId,
            cardId,
            quantity: entry.quantity,
            finish: entry.finish,
            language: entry.language,
            role: entry.role,
            addedAt: now,
            createdAt: now,
        });

        return cardId;
    }

    private static async resolveCardId(entry: DeckImportEntry): Promise<string | null> {
        if (entry.scryfallId) {
            return entry.scryfallId;
        }

        if (!entry.setCode || !entry.collectorNumber) {
            return null;
        }

        return EntityLinker.resolveFingerprint({
            name: entry.cardName,
            setCode: entry.setCode,
            collectorNumber: entry.collectorNumber,
            finish: entry.finish,
            language: entry.language,
        });
    }

    private static async ensureCardExists(cardId: string, entry: DeckImportEntry): Promise<void> {
        const existingCard = await cardRepository.getById(cardId);
        if (existingCard) return;

        const now = new Date();
        const scryfallData = await ScryfallProvider.hydrateCard({
            scryfall_id: cardId,
            name: entry.cardName,
            setCode: entry.setCode,
            collectorNumber: entry.collectorNumber,
        });
        const imageUrls = await ScryfallProvider.getImageUrlById(cardId);

        const newCard: Card = {
            id: cardId,
            oracleId: scryfallData?.oracle_id || '',
            name: scryfallData?.name || entry.cardName,
            set: scryfallData?.set_name || entry.setCode,
            setCode: (scryfallData?.set || entry.setCode || '').toLowerCase(),
            number: scryfallData?.collector_number || entry.collectorNumber,
            lang: (scryfallData?.lang || entry.language || 'en').toLowerCase(),
            finish: entry.finish,
            layout: imageUrls?.layout || 'normal',
            imageUrl: imageUrls?.front || '',
            imageUrlBack: imageUrls?.back || '',
            cardmarketId: typeof scryfallData?.cardmarket_id === 'number' ? scryfallData.cardmarket_id : undefined,
            createdAt: now,
            updatedAt: now,
        };

        await cardRepository.add(newCard);
        await this.writeInitialScryfallPrices(cardId);
    }

    private static async writeInitialScryfallPrices(cardId: string): Promise<void> {
        const prices = await ScryfallProvider.getPricesForCard(cardId);
        const db = getDb();
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        const upsertIfMissing = async (finish: CardFinish, cents: number | null | undefined) => {
            if (typeof cents !== 'number') return;
            const id = `${cardId}:scryfall:${finish}:${date}`;
            const existing = await db.price_points.get(id);
            if (existing) return;
            await db.price_points.put({
                id,
                cardId,
                provider: 'scryfall',
                finish,
                date,
                currency: 'EUR',
                priceCent: cents,
                asOf: now,
                createdAt: now,
            });
        };

        await upsertIfMissing('nonfoil', prices.nonfoil?.getCents());
        await upsertIfMissing('foil', prices.foil?.getCents());
        await upsertIfMissing('etched', prices.etched?.getCents());
    }

    private static generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    static async calculateDeckCoverage(deckId: string): Promise<{
        totalCards: number;
        ownedCards: number;
        coveragePercentage: number;
    }> {
        try {
            const db = getDb();
            const deckCards = await db.deck_cards.where('deckId').equals(deckId).toArray();

            let totalCards = 0;
            let ownedCards = 0;

            for (const deckCard of deckCards) {
                totalCards += deckCard.quantity;
                const lots = await cardLotRepository.getActiveLotsByCardId(deckCard.cardId);
                const totalOwned = lots.reduce((sum, lot) => sum + lot.quantity, 0);
                ownedCards += Math.min(deckCard.quantity, totalOwned);
            }

            const coveragePercentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 100;
            return { totalCards, ownedCards, coveragePercentage };
        } catch (error) {
            console.error('Error calculating deck coverage:', error);
            throw error;
        }
    }
}
