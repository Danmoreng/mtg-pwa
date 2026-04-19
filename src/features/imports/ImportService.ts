// Import service for handling CSV imports
import { transactionRepository, cardLotRepository, cardRepository } from '../../data/repos';
import { Money } from '../../core/Money';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import type { Card, CardLot } from '../../data/db';
import { getDb } from '../../data/init';
import { useImportStatusStore } from '../../stores/importStatus';
import { v4 as uuidv4 } from 'uuid';
import { kickReconciler } from '../../workers/WorkerManager';


// Use the new normalization gateway
import { NormalizationGateway } from '../../core/Normalization';
const { resolveSetCode } = NormalizationGateway;

import * as ImportPipelines from './ImportPipelines';
import type { Deck } from '../../data/db';

export class ImportService {
    // Import Cardmarket transactions
    static async importCardmarketTransactions(transactions: any[]): Promise<void> {
        const importStatusStore = useImportStatusStore();

        // Create import tracking
        const importId = uuidv4();
        importStatusStore.addImport({
            id: importId,
            type: 'cardmarket',
            name: 'Cardmarket Transactions',
            status: 'pending',
            progress: 0,
            totalItems: transactions.length,
            processedItems: 0
        });

        try {
            const now = new Date();

            for (let i = 0; i < transactions.length; i++) {
                const transaction = transactions[i];

                // Update progress
                importStatusStore.updateImport(importId, {
                    status: 'processing',
                    processedItems: i + 1,
                    progress: Math.round(((i + 1) / transactions.length) * 100)
                });

                // Create external reference to avoid duplicates
                const externalRef = `cardmarket:${transaction.reference}:${transaction.lineNumber}`;

                // Check if transaction already exists
                const db = getDb();
                const existing = await db.transactions.where('externalRef').equals(externalRef).first();
                if (existing) continue;

                // Parse amount as Money
                const amount = Money.parse(transaction.amount, 'EUR');
                const kind = amount.isPositive() ? ('SELL' as const) : ('BUY' as const);

                const hasCardIdentityHints = this.getProductIds(transaction.productId).length > 0
                  || this.getCardNameCandidate(transaction).length > 0;

                let cardId: string | null = null;
                let cardData: any | null = null;
                if (hasCardIdentityHints) {
                  const resolved = await this.resolveCard(transaction);
                  cardId = resolved.cardId;
                  cardData = resolved.cardData;
                }

                // If we have a card ID, fetch and save price data
                if (cardId) {
                    await this.ensureCardInDb(cardId, cardData, transaction);
                }

                let lotIdForTransaction: string | undefined = undefined;
                if (kind === 'BUY' && cardId) {
                    lotIdForTransaction = await this.getOrCreateLotForPurchase(cardId, amount, transaction);
                } else if (cardId) { // For 'SELL'
                    const existingLots = await cardLotRepository.getByCardId(cardId);
                    if (existingLots.length === 0) {
                        // No lots exist for this card. Create a provisional one and link it.
                        const lotId = `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const lot: CardLot = {
                            id: lotId,
                            cardId: cardId,
                            quantity: 0, // Provisional lot starts with 0 quantity
                            unitCost: 0,
                            condition: '',
                            language: transaction.language || 'en',
                            foil: transaction.finish === 'foil' || transaction.finish === 'etched',
                            finish: transaction.finish || 'nonfoil',
                            source: 'provisional-sell', // A new source to identify these
                            purchasedAt: new Date(transaction.date),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        await cardLotRepository.add(lot);
                        lotIdForTransaction = lotId; // Link the transaction to the new provisional lot
                    }
                }

                // Create transaction record
                const transactionRecord = {
                    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    kind: kind,
                    cardId: cardId || undefined,
                    lotId: lotIdForTransaction,
                    quantity: 1, // For transactions, quantity is typically 1
                    unitPrice: amount.getCents(),
                    fees: 0, // Fees would be in separate records
                    shipping: 0, // Shipping would be in separate records
                    currency: 'EUR',
                    source: 'cardmarket',
                    externalRef,
                          happenedAt: new Date(transaction.date),
                          finish: transaction.finish || 'nonfoil',
                          language: transaction.language || 'en',
                          createdAt: now,
                          updatedAt: now                };

                // Save transaction
                await transactionRepository.add(transactionRecord);
            }

            // Trigger reconciliation
            await kickReconciler('after cardmarket transaction import');

            // Mark import as completed
            importStatusStore.completeImport(importId);
        } catch (error) {
            console.error('Error importing Cardmarket transactions:', error);
            importStatusStore.completeImport(importId, (error as Error).message);
            throw error;
        }
    }

    // Import Cardmarket orders
  static async importCardmarketOrders(orders: any[]): Promise<void> {
    const importStatusStore = useImportStatusStore();

    // Create import tracking
    const importId = uuidv4();
    importStatusStore.addImport({
      id: importId,
      type: 'cardmarket',
      name: 'Cardmarket Orders',
      status: 'pending',
      progress: 0,
      totalItems: orders.length,
      processedItems: 0
    });

    try {
      const now = new Date();

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];

        // Update progress
        importStatusStore.updateImport(importId, {
          status: 'processing',
          processedItems: i + 1,
          progress: Math.round(((i + 1) / orders.length) * 100)
        });

        // Create external reference to avoid duplicates
        const externalRef = `cardmarket:order:${order.orderId}`;

        // Check if order already exists
        const db = getDb();
        const existing = await db.transactions.where('externalRef').equals(externalRef).first();
        if (existing) continue;

        // Parse values as Money
        const commission = Money.parse(order.commission, 'EUR');
        const shipmentCosts = Money.parse(order.shipmentCosts, 'EUR');

        // Create transaction record
        const transactionRecord = {
          id: uuidv4(),
          kind: order.direction === 'sale' ? ('SELL' as const) : ('BUY' as const),
          cardId: null,
          quantity: 0,
          unitPrice: 0,
          fees: commission.getCents(),
          shipping: shipmentCosts.getCents(),
          currency: 'EUR',
          source: 'cardmarket',
          externalRef,
          happenedAt: new Date(order.dateOfPurchase),
          relatedTransactionId: null,
          createdAt: now,
          updatedAt: now
        };

        // Save transaction
        await transactionRepository.add(transactionRecord);
      }

      // Mark import as completed
      importStatusStore.completeImport(importId);
    } catch (error) {
      console.error('Error importing Cardmarket orders:', error);
      importStatusStore.completeImport(importId, (error as Error).message);
      throw error;
    }
  }

  // Import Cardmarket articles with enhanced financial tracking
  static async importCardmarketArticles(articles: any[]): Promise<void> {
    const importStatusStore = useImportStatusStore();

    // Create import tracking
    const importId = uuidv4();
    importStatusStore.addImport({
      id: importId,
      type: 'cardmarket',
      name: 'Cardmarket Articles',
      status: 'pending',
      progress: 0,
      totalItems: articles.length,
      processedItems: 0
    });

    try {
      const orderLines: ImportPipelines.CardmarketSellOrderLine[] = [];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        // Update progress for resolving cards
        importStatusStore.updateImport(importId, {
          status: 'processing',
          processedItems: i + 1,
          progress: Math.round(((i + 1) / articles.length) * 50) // 0-50% for resolving
        });

        const { cardId, cardData } = await this.resolveCard(article);
        const price = Money.parse(article.price, 'EUR');
        const quantity = parseInt(article.amount, 10) || 1;

        if (cardId) {
          await this.ensureCardInDb(cardId, cardData, article);
        }

        const lineExternalRef = `cardmarket:order:${article.shipmentId}:line:${article.lineNumber}`;
        const headerExternalRef = `cardmarket:order:${article.shipmentId}`;
        const header = await transactionRepository
          .getBySourceRef('cardmarket', headerExternalRef)
          .then(res => res[0]);

        if (article.direction === 'sale') {
          orderLines.push({
            id: uuidv4(),
            cardId: cardId || undefined,
            lotId: undefined, // Reconciler will set this
            quantity,
            unitPrice: price.getCents(),
            fees: 0,
            shipping: 0,
            currency: 'EUR',
            source: 'cardmarket',
            externalRef: lineExternalRef,
            happenedAt: new Date(article.dateOfPurchase),
            relatedTransactionId: header?.id,
            finish: article.finish || 'nonfoil',
            language: article.language || 'en',
          });
          continue;
        }

        if (article.direction === 'purchase') {
          const existing = await transactionRepository.getBySourceRef('cardmarket', lineExternalRef);
          if (existing.length > 0) continue;

          const lotIdForPurchase = cardId
            ? await this.getOrCreateLotForPurchase(cardId, price, article)
            : undefined;

          await transactionRepository.add({
            id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            kind: 'BUY',
            cardId: cardId || undefined,
            lotId: lotIdForPurchase,
            quantity,
            unitPrice: price.getCents(),
            fees: 0,
            shipping: 0,
            currency: 'EUR',
            source: 'cardmarket',
            externalRef: lineExternalRef,
            happenedAt: new Date(article.dateOfPurchase),
            relatedTransactionId: header?.id,
            finish: article.finish || 'nonfoil',
            language: article.language || 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Now, import the processed order lines using the pipeline
      await ImportPipelines.importCardmarketSells(orderLines);

      // Mark import as completed
      importStatusStore.completeImport(importId);

    } catch (error) {
      console.error('Error importing Cardmarket articles:', error);
      importStatusStore.completeImport(importId, (error as Error).message);
      throw error;
    }
  }

  private static async resolveCard(article: any): Promise<{ cardId: string | null, cardData: any | null }> {
    let cardData = null;
    let cardId = null;
    const productIds = this.getProductIds(article.productId);
    const productIdNumbers = productIds
      .map(id => Number.parseInt(id, 10))
      .filter((id): id is number => Number.isFinite(id));
    const cardName = this.getCardNameCandidate(article);
    const isArtSeries = this.isArtSeriesName(cardName);
    const expansion = this.normalizeText(article.expansion);
    const hasProductId = productIds.length > 0;
    let resolvedViaCardmarketId = false;

    // Priority 1: Try to resolve by Cardmarket product ID first
    if (productIds.length > 0) {
      if (productIds.length === 1) {
        cardData = await ScryfallProvider.getByCardmarketId(productIds[0]);
        console.log(JSON.stringify({ product_ids: productIds, resolved_via: 'cardmarket_id', cardmarket_id: productIds[0], final_uri: `/cards/cardmarket/${productIds[0]}` }));
      } else if (productIds.length > 1) {
        const cards = await ScryfallProvider.getByCardmarketIds(productIds);
        if (cards && cards.length > 0) {
          cardData = cards[0];
          console.log(JSON.stringify({ product_ids: productIds, resolved_via: 'cardmarket_id', cardmarket_id: productIds[0], final_uri: `/cards/collection` }));
        }
      }
      cardId = cardData?.id || null;
      resolvedViaCardmarketId = !!cardId;
    }

    // Priority 2: If no product ID or product ID lookup failed, try set code resolution
    if (!cardId) {
      if (!cardName) {
        if (hasProductId) {
          const syntheticId = this.toSyntheticCardmarketCardId(productIds[0]);
          return {
            cardId: syntheticId,
            cardData: {
              id: syntheticId,
              cardmarket_id: Number.parseInt(productIds[0], 10),
              synthetic_source: 'cardmarket_product'
            }
          };
        }
        return { cardId: null, cardData: null };
      }
      const setCode = await resolveSetCode(expansion);
      const collectorCandidates = await this.getCollectorNumberCandidates(article, cardName, isArtSeries);
      const collectorNumber = collectorCandidates[0] || '';
      const lookupNames = this.getLookupNameCandidates(cardName);
      let versionInfo: string | undefined = undefined;
      const versionMatch = cardName.match(/\((V\.\d+)\)\s*$/i);
      if (versionMatch) {
        versionInfo = versionMatch[1];
      }

      console.log(JSON.stringify({
        product_ids: productIds,
        resolved_via: 'set+cn',
        set_code: setCode,
        collector_number: collectorNumber,
        collector_candidates: collectorCandidates,
        final_uri: setCode ? `/cards/${setCode}/${collectorNumber}` : ''
      }));

      const setHints = this.getSetLookupCandidates(setCode, expansion, hasProductId, cardName);
      const artSeriesSetCode = setCode ? `a${setCode}`.toLowerCase() : '';
      // Deterministic first pass using set + collector number variants (e.g., A38 / 38).
      if (!cardData?.id && setHints.length > 0 && collectorCandidates.length > 0) {
        for (const setHint of setHints) {
          for (const collectorCandidate of collectorCandidates) {
            cardData = await ScryfallProvider.getBySetAndCollector(setHint, collectorCandidate);
            if (cardData?.id) {
              break;
            }
          }
          if (cardData?.id) {
            break;
          }
        }
      }

      for (const setHint of setHints) {
        if (cardData?.id) break;
        for (const lookupName of lookupNames) {
          cardData = await ScryfallProvider.hydrateCard({
            name: lookupName,
            setCode: setHint,
            collectorNumber: collectorNumber,
            version: versionInfo
          });
          if (cardData?.id) {
            break;
          }
        }
        if (cardData?.id) {
          break;
        }
      }

      // `cards/named` often misses Art Series / split-name entries.
      // Use search endpoint as a secondary lookup.
      if (!cardData?.id && setHints.length > 0 && (hasProductId || isArtSeries)) {
        for (const setHint of setHints) {
          for (const lookupName of lookupNames) {
            cardData = await ScryfallProvider.searchBySetAndName(setHint, lookupName);
            if (cardData?.id) {
              break;
            }
          }
          if (cardData?.id) {
            break;
          }
        }
      }

      cardId = cardData?.id || null;

      // For product-id imports, only accept fallback resolution when Cardmarket ID matches.
      // Exception: Art Series cards in `a<setCode>` can legitimately have no Cardmarket mapping in Scryfall.
      if (hasProductId && cardId && !resolvedViaCardmarketId) {
        const resolvedCardmarketId = typeof cardData?.cardmarket_id === 'number' ? cardData.cardmarket_id : null;
        const productIdMatches = resolvedCardmarketId !== null && productIdNumbers.includes(resolvedCardmarketId);
        const isAcceptedArtSeriesFallback = Boolean(
          isArtSeries &&
          artSeriesSetCode &&
          typeof cardData?.set === 'string' &&
          cardData.set.toLowerCase() === artSeriesSetCode
        );

        if (!productIdMatches && !isAcceptedArtSeriesFallback) {
          cardData = null;
          cardId = null;
        }
      }

      if (!cardId) {
        console.log(JSON.stringify({ product_ids: productIds, resolved_via: 'none', set_code: null, collector_number: '', final_uri: '', name: cardName, expansion }));
      }
    }

    // If product-id resolution and safe fallback both failed, use synthetic ID.
    if (hasProductId && !cardId) {
      const syntheticId = this.toSyntheticCardmarketCardId(productIds[0]);
      return {
        cardId: syntheticId,
        cardData: {
          id: syntheticId,
          cardmarket_id: Number.parseInt(productIds[0], 10),
          synthetic_source: 'cardmarket_product'
        }
      };
    }

    return { cardId, cardData };
  }

  private static normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  }

  private static getProductIds(value: unknown): string[] {
    const raw = this.normalizeText(value);
    if (!raw) return [];
    return raw.split('|').map(id => id.trim()).filter(Boolean);
  }

  private static getCardNameCandidate(article: any): string {
    const candidates = [
      article?.name,
      article?.localizedProductName,
      article?.articleName
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizeText(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private static getLookupNameCandidates(cardName: string): string[] {
    const base = this.normalizeText(cardName);
    const withoutVersion = base.replace(/\s*\(V\.\d+\)\s*$/i, '').trim();
    const withoutArtSeriesPrefix = withoutVersion.replace(/^Art\s*Series:\s*/i, '').trim();
    const candidates = [base, withoutVersion, withoutArtSeriesPrefix]
      .map(name => this.normalizeText(name))
      .filter(Boolean);
    return Array.from(new Set(candidates));
  }

  private static isArtSeriesName(cardName: string): boolean {
    return /^Art\s*Series:/i.test(this.normalizeText(cardName));
  }

  private static getSetLookupCandidates(
    resolvedSetCode: string | null,
    expansion: string,
    hasProductId: boolean,
    cardName: string
  ): string[] {
    const candidates: string[] = [];
    const isArtSeries = /^Art\s*Series:/i.test(this.normalizeText(cardName));

    if (resolvedSetCode) {
      if (isArtSeries) {
        candidates.push(`a${resolvedSetCode}`.toLowerCase());
      }
      candidates.push(resolvedSetCode);
    }

    if (!hasProductId && expansion) {
      candidates.push(expansion);
    }

    return Array.from(new Set(candidates.map(value => this.normalizeText(value)).filter(Boolean)));
  }

  private static async getCollectorNumberCandidates(article: any, cardName: string, isArtSeries: boolean): Promise<string[]> {
    const rawCandidates: string[] = [];

    const fromName = this.extractCollectorNumber(cardName);
    if (fromName) rawCandidates.push(fromName);

    const directCandidates = [article?.collectorNumber, article?.number];
    for (const candidate of directCandidates) {
      const normalized = this.normalizeCollectorNumber(candidate);
      if (normalized) rawCandidates.push(normalized);
    }

    const textCandidates = [article?.description, article?.comments];
    for (const textCandidate of textCandidates) {
      const extracted = this.extractCollectorNumberFromText(this.normalizeText(textCandidate));
      if (extracted) rawCandidates.push(extracted);
    }

    const shipmentId = this.normalizeText(article?.shipmentId);
    const productId = this.getProductIds(article?.productId)[0];
    if (shipmentId && productId) {
      try {
        const db = getDb();
        const orderLines = await db.cm_order_lines
          .where('[orderId+productId]')
          .equals([shipmentId, productId])
          .toArray();

        for (const orderLine of orderLines) {
          if (orderLine?.collectorNumber) {
            rawCandidates.push(orderLine.collectorNumber);
          }

          if (orderLine?.descriptionRaw) {
            rawCandidates.push(...this.extractCollectorNumbersFromText(orderLine.descriptionRaw));
          }
        }

        const order = await db.cm_orders.get(shipmentId);
        if (
          order &&
          this.orderContainsProductId(order.productIdsRaw, productId) &&
          order.descriptionRaw
        ) {
          const targetedMatch = this.extractCollectorNumberForCardName(order.descriptionRaw, cardName);
          if (targetedMatch) {
            rawCandidates.push(targetedMatch);
          } else if ((order.articleCount ?? 0) <= 1) {
            rawCandidates.push(...this.extractCollectorNumbersFromText(order.descriptionRaw));
          }
        }
      } catch (error) {
        console.warn('Unable to fetch collector number hints from cm_order_lines.', error);
      }
    }

    return this.expandCollectorNumberCandidates(rawCandidates, isArtSeries);
  }

  private static normalizeCollectorNumber(value: unknown): string {
    const normalized = this
      .normalizeText(value)
      .replace(/^#/, '')
      .replace(/\s+/g, '')
      .toUpperCase();
    return /^[A-Z]?\d+[A-Z★]*$/.test(normalized) ? normalized : '';
  }

  private static extractCollectorNumberFromText(text: string): string {
    return this.extractCollectorNumbersFromText(text)[0] || '';
  }

  private static extractCollectorNumbersFromText(text: string): string[] {
    if (!text) return [];

    const out: string[] = [];
    const seen = new Set<string>();
    const patterns = [
      /-\s*([A-Za-z]?\d+[A-Za-z★]*)\s*-/g,
      /\b([A-Za-z]?\d+[A-Za-z★]*)\b/g,
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const normalized = this.normalizeCollectorNumber(match?.[1]);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
      }
    }

    return out;
  }

  private static escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static extractCollectorNumberForCardName(description: string, cardName: string): string {
    const normalizedDescription = this.normalizeText(description);
    if (!normalizedDescription) return '';

    const lookupNames = this
      .getLookupNameCandidates(cardName)
      .sort((a, b) => b.length - a.length);

    for (const lookupName of lookupNames) {
      if (!lookupName) continue;

      const escapedName = this.escapeRegex(lookupName);
      const aroundNameRegex = new RegExp(
        `${escapedName}[\\s\\S]{0,180}?-\\s*([A-Za-z]?\\d+[A-Za-z★]*)\\s*-`,
        'i'
      );
      const match = normalizedDescription.match(aroundNameRegex);
      if (match?.[1]) {
        const normalized = this.normalizeCollectorNumber(match[1]);
        if (normalized) return normalized;
      }
    }

    return '';
  }

  private static orderContainsProductId(productIdsRaw: unknown, productId: string): boolean {
    const normalizedProductId = this.normalizeText(productId);
    if (!normalizedProductId) return false;

    const raw = this.normalizeText(productIdsRaw);
    if (!raw) return false;

    const tokens = raw
      .split(/[|,;\s]+/)
      .map(value => value.trim())
      .filter(Boolean);

    return tokens.includes(normalizedProductId);
  }

  private static expandCollectorNumberCandidates(rawCandidates: string[], isArtSeries: boolean): string[] {
    const expanded: string[] = [];

    for (const raw of rawCandidates) {
      const normalized = this.normalizeCollectorNumber(raw);
      if (!normalized) continue;
      expanded.push(normalized);

      if (isArtSeries) {
        if (/^A\d+[A-Z★]*$/.test(normalized)) {
          expanded.push(normalized.slice(1));
        } else if (/^\d+[A-Z★]*$/.test(normalized)) {
          expanded.push(`A${normalized}`);
        }
      }
    }

    return Array.from(new Set(expanded.filter(Boolean)));
  }

  private static toSyntheticCardmarketCardId(productId: string): string {
    return `cm:${productId}`;
  }

  private static isSyntheticCardmarketCardId(cardId: string): boolean {
    return typeof cardId === 'string' && cardId.startsWith('cm:');
  }

  private static extractCollectorNumber(name: string): string {
    if (typeof name !== 'string' || !name) {
      return '';
    }
    const patterns = [
      /-\s*([a-zA-Z]?\d+[a-zA-Z★]*)\s*-/i,  // Standard with optional prefix/suffix chars
      /-\s*([IVXLCDM]+)\s*-/i,     // Roman numerals
      /\s+([a-zA-Z]?\d+[a-zA-Z★]*)\s*$/i,   // At end of name with space
      /\(([a-zA-Z]?\d+[a-zA-Z★]*)\)/i       // In parentheses
    ];
    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return '';
  }

  private static async ensureCardInDb(cardId: string, cardData: any, article: any): Promise<void> {
    const existingCard = await cardRepository.getById(cardId);
    const cardName = this.getCardNameCandidate(article);
    const expansion = this.normalizeText(article.expansion);
    const productId = this.getProductIds(article.productId)[0];
    const parsedProductId = Number.parseInt(productId, 10);
    const fallbackCardmarketId = Number.isFinite(parsedProductId) ? parsedProductId : undefined;
    const isSyntheticCardmarketCard = this.isSyntheticCardmarketCardId(cardId);

    if (isSyntheticCardmarketCard) {
      if (!existingCard) {
        const syntheticCard: Card = {
          id: cardId,
          oracleId: '',
          name: cardName || `Cardmarket Product ${productId}`,
          set: expansion || '',
          setCode: (await resolveSetCode(expansion)) || '',
          number: this.extractCollectorNumber(cardName) || '',
          lang: this.normalizeText(article.language) || 'en',
          finish: this.normalizeText(article.finish) || 'nonfoil',
          layout: 'normal',
          imageUrl: '',
          imageUrlBack: '',
          cardmarketId: fallbackCardmarketId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await cardRepository.add(syntheticCard);
      }
      return;
    }

    if (!existingCard) {
      const scryfallData = cardData || await ScryfallProvider.hydrateCard({ scryfall_id: cardId, name: cardName, setCode: expansion, collectorNumber: '' });
      const imageUrls = await ScryfallProvider.getImageUrlById(cardId);
      const newCard: Card = {
        id: cardId,
        oracleId: scryfallData?.oracle_id || cardData?.oracle_id || '',
        name: cardName || scryfallData?.name || cardData?.name || '',
        set: scryfallData?.set_name || cardData?.set_name || expansion,
        setCode: scryfallData?.set || cardData?.set || (await resolveSetCode(expansion) || ''),
        number: scryfallData?.collector_number || cardData?.collector_number || this.extractCollectorNumber(cardName) || '',
        lang: scryfallData?.lang || cardData?.lang || 'en',
        finish: 'nonfoil',
        layout: imageUrls?.layout || 'normal',
        imageUrl: imageUrls?.front || '',
        imageUrlBack: imageUrls?.back || '',
        cardmarketId:
          typeof scryfallData?.cardmarket_id === 'number'
            ? scryfallData.cardmarket_id
            : typeof cardData?.cardmarket_id === 'number'
              ? cardData.cardmarket_id
              : fallbackCardmarketId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await cardRepository.add(newCard);
      await this.updatePriceForCard(cardId);
    } else {
      const cardmarketIdFromData =
        typeof cardData?.cardmarket_id === 'number'
          ? cardData.cardmarket_id
          : fallbackCardmarketId;
      if (!existingCard.cardmarketId && typeof cardmarketIdFromData === 'number') {
        await cardRepository.update(cardId, {
          cardmarketId: cardmarketIdFromData,
          updatedAt: new Date(),
        });
      }
      await this.updatePriceForCard(cardId);
    }
  }

  private static async updatePriceForCard(cardId: string): Promise<void> {
    try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const db = getDb();

        const prices = await ScryfallProvider.getPricesForCard(cardId);

        if (prices.nonfoil) {
            const pricePointId = `${cardId}:scryfall:nonfoil:${dateStr}`;
            const existingPricePoint = await db.price_points.get(pricePointId);
            if (!existingPricePoint) {
                const pricePoint = {
                    id: pricePointId,
                    cardId: cardId,
                    provider: 'scryfall' as const,
                    finish: 'nonfoil' as const,
                    date: dateStr,
                    currency: 'EUR' as const,
                    priceCent: prices.nonfoil.getCents(),
                    asOf: now,
                    createdAt: now
                };
                await db.price_points.put(pricePoint);
            }
        }

        if (prices.foil) {
            const pricePointId = `${cardId}:scryfall:foil:${dateStr}`;
            const existingPricePoint = await db.price_points.get(pricePointId);
            if (!existingPricePoint) {
                const pricePoint = {
                    id: pricePointId,
                    cardId: cardId,
                    provider: 'scryfall' as const,
                    finish: 'foil' as const,
                    date: dateStr,
                    currency: 'EUR' as const,
                    priceCent: prices.foil.getCents(),
                    asOf: now,
                    createdAt: now
                };
                await db.price_points.put(pricePoint);
            }
        }
        
        if (prices.etched) {
            const pricePointId = `${cardId}:scryfall:etched:${dateStr}`;
            const existingPricePoint = await db.price_points.get(pricePointId);
            if (!existingPricePoint) {
                const pricePoint = {
                    id: pricePointId,
                    cardId: cardId,
                    provider: 'scryfall' as const,
                    finish: 'etched' as const,
                    date: dateStr,
                    currency: 'EUR' as const,
                    priceCent: prices.etched.getCents(),
                    asOf: now,
                    createdAt: now
                };
                await db.price_points.put(pricePoint);
            }
        }

    } catch (error) {
        console.error(`Error checking/updating price for existing card ${cardId}:`, error);
    }
  }

  private static async getOrCreateLotForPurchase(cardId: string | null, price: Money, article: any): Promise<string | undefined> {
    if (!cardId) {
      console.warn("Attempted to create a lot for a purchase without a valid cardId. Skipping.", { article });
      return undefined;
    }

    const now = new Date();
    const lotExternalRef = `cardmarket:lot:${article.shipmentId}:${article.lineNumber}`;
    const existingLots = await cardLotRepository.getByExternalRef(lotExternalRef);

    let lotToLink: CardLot | null = null;
    if (existingLots.length > 0) {
      lotToLink = existingLots[0];
    } else if (cardId) {
      const existingCardLots = await cardLotRepository.getByCardId(cardId);
      for (const lot of existingCardLots) {
        const purchaseTransactions = await transactionRepository.getByLotId(lot.id);
        const hasPurchaseTransaction = purchaseTransactions.some(tx => tx.kind === 'BUY');
        if (!hasPurchaseTransaction) {
          lotToLink = lot;
          break;
        }
      }
    }

    if (lotToLink) {
      await cardLotRepository.update(lotToLink.id, { unitCost: price.getCents(), source: 'cardmarket', purchasedAt: new Date(article.dateOfPurchase), updatedAt: now, acquisitionPriceCent: price.getCents(), acquisitionFeesCent: 0, acquisitionShippingCent: 0, totalAcquisitionCostCent: price.getCents() });
      return lotToLink.id;
    } else {
      const lotId = `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const lot: CardLot = {
        id: lotId,
        cardId: cardId || '',
        quantity: parseInt(article.amount) || 1,
        unitCost: price.getCents(),
        condition: this.normalizeText(article.condition) || 'NM',
        language: this.normalizeText(article.language) || 'en',
        foil: this.normalizeText(article.finish).toLowerCase() === 'foil' || this.normalizeText(article.finish).toLowerCase() === 'etched',
        finish: this.normalizeText(article.finish) || 'nonfoil',
        source: 'cardmarket',
        currency: 'EUR',
        externalRef: lotExternalRef,
        purchasedAt: new Date(article.dateOfPurchase),
        acquisitionPriceCent: price.getCents(),
        acquisitionFeesCent: 0,
        acquisitionShippingCent: 0,
        totalAcquisitionCostCent: price.getCents(),
        createdAt: now,
        updatedAt: now
      };
      await cardLotRepository.add(lot);
      return lotId;
    }
  }



    

    // Check if articles have already been imported
    static async checkForExistingImports(articles: any[]): Promise<{ article: any, exists: boolean }[]> {
        const results = [];

        for (const article of articles) {
            // Create external reference to check for duplicates
            const externalRef = `cardmarket:order:${article.shipmentId}:line:${article.lineNumber}`;

            // Check if transaction already exists
            const db = getDb();
            const existing = await db.transactions.where('externalRef').equals(externalRef).first();

            results.push({
                article,
                exists: !!existing
            });
        }

        return results;
    }
    
    // Adapter methods for the new M3 import pipelines
    
    /**
     * Import Manabox scans with box cost
     * Adapter that delegates to the new implementation
     */
    static async importManaboxScansWithBoxCost(
      rows: ImportPipelines.ManaboxImportRow[],
      boxCost: ImportPipelines.BoxCost,
      happenedAt: Date,
      source: string,
      externalRef: string
    ): Promise<{ acquisitionId: string; scanIds: string[] }> {
      const importStatusStore = useImportStatusStore();

      // Create import tracking
      const importId = uuidv4();
      importStatusStore.addImport({
        id: importId,
        type: 'manabox',
        name: 'ManaBox Scans',
        status: 'pending',
        progress: 0,
        totalItems: rows.length,
        processedItems: 0
      });

      try {
        // Call the pipeline function with progress tracking
        const result = await ImportPipelines.importManaboxScansWithBoxCost(
          rows, 
          boxCost, 
          happenedAt, 
          source, 
          externalRef,
          (processed, total) => {
            importStatusStore.updateImport(importId, {
              status: 'processing',
              processedItems: processed,
              progress: Math.round((processed / total) * 100)
            });
          }
        );

        // Mark import as completed
        importStatusStore.completeImport(importId);

        return result;
      } catch (error) {
        console.error('Error importing Manabox scans with box cost:', error);
        importStatusStore.completeImport(importId, (error as Error).message);
        throw error;
      }
    }

    /**
     * Import Cardmarket SELLs
     * Adapter that delegates to the new implementation
     */
    static async importCardmarketSells(orderLines: ImportPipelines.CardmarketSellOrderLine[]): Promise<string[]> {
      return await ImportPipelines.importCardmarketSells(orderLines);
    }

    /**
     * Import decks
     * Adapter that delegates to the new implementation
     */
    static async importDecks(decks: Omit<Deck, 'id'>[], deckCards: ImportPipelines.DeckImportRow[]): Promise<{ deckIds: string[]; deckCardIds: string[] }> {
      return await ImportPipelines.importDecks(decks, deckCards);
    }
}
