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

        const { cardId } = await this.resolveCard(article);
        const price = Money.parse(article.price, 'EUR');
        const quantity = parseInt(article.amount, 10) || 1;

        if (cardId) {
          await this.ensureCardInDb(cardId, null, article);
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
    const cardName = this.getCardNameCandidate(article);
    const expansion = this.normalizeText(article.expansion);

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
    }

    // Priority 2: If no product ID or product ID lookup failed, try set code resolution
    if (!cardId) {
      if (!cardName) {
        return { cardId: null, cardData: null };
      }
      const setCode = await resolveSetCode(expansion);
      const collectorNumber = this.extractCollectorNumber(cardName);
      let cleanCardName = cardName;
      let versionInfo: string | undefined;
      const versionMatch = cardName.match(/^(.+?)\s*\((V\.\d+)\)$/i);
      if (versionMatch) {
        cleanCardName = versionMatch[1].trim();
        versionInfo = versionMatch[2];
      }

      console.log(JSON.stringify({ product_ids: productIds, resolved_via: 'set+cn', set_code: setCode, collector_number: collectorNumber, final_uri: setCode ? `/cards/${setCode}/${collectorNumber}` : '' }));

      cardData = await ScryfallProvider.hydrateCard({ name: cleanCardName, setCode: setCode || expansion, collectorNumber: collectorNumber, version: versionInfo });
      cardId = cardData?.id || null;

      if (!cardId) {
        console.log(JSON.stringify({ product_ids: productIds, resolved_via: 'none', set_code: null, collector_number: '', final_uri: '', name: cardName, expansion }));
      }
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

  private static extractCollectorNumber(name: string): string {
    if (typeof name !== 'string' || !name) {
      return '';
    }
    const patterns = [
      /-\s*(\d+[a-zA-Z★]*)\s*-/i,  // Standard with optional letters/special chars
      /-\s*([IVXLCDM]+)\s*-/i,     // Roman numerals
      /\s+(\d+[a-zA-Z★]*)\s*$/i,   // At end of name with space
      /\((\d+[a-zA-Z★]*)\)/i       // In parentheses
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
        cardmarketId: typeof scryfallData?.cardmarket_id === 'number' ? scryfallData.cardmarket_id : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await cardRepository.add(newCard);
      await this.updatePriceForCard(cardId);
    } else {
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
