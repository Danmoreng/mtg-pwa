// Import service for handling CSV imports
import { transactionRepository, cardLotRepository, cardRepository } from '../../data/repos';
import { Money } from '../../core/Money';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import { resolveSetCode } from '../pricing/SetCodeResolver';
import db from '../../data/db';
import type { Card, CardLot } from '../../data/db';
import { useImportStatusStore } from '../../stores/importStatus';
import { v4 as uuidv4 } from 'uuid';
import { FinanceService } from '../analytics/FinanceService';

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
                const existing = await db.transactions.where('externalRef').equals(externalRef).first();
                if (existing) continue;

                // Parse amount as Money
                const amount = Money.parse(transaction.amount, 'EUR');

                // Create transaction record
                const transactionRecord = {
                    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    kind: amount.isPositive() ? ('SELL' as const) : ('BUY' as const),
                    quantity: 1, // For transactions, quantity is typically 1
                    unitPrice: amount.getCents(),
                    fees: 0, // Fees would be in separate records
                    shipping: 0, // Shipping would be in separate records
                    currency: 'EUR',
                    source: 'cardmarket',
                    externalRef,
                    happenedAt: new Date(transaction.date),
                    createdAt: now,
                    updatedAt: now
                };

                // Save transaction
                await transactionRepository.add(transactionRecord);
            }

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
        const externalRef = `cardmarket:order:${order.orderId}:${order.lineNumber}`;

        // Check if order already exists
        const existing = await db.transactions.where('externalRef').equals(externalRef).first();
        if (existing) continue;

        // Parse values as Money
        const merchandiseValue = Money.parse(order.merchandiseValue, 'EUR');
        const shipmentCosts = Money.parse(order.shipmentCosts, 'EUR');
        const commission = Money.parse(order.commission, 'EUR');

        // Create transaction record
        const transactionRecord = {
          id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          kind: order.direction === 'sale' ? ('SELL' as const) : ('BUY' as const),
          quantity: parseInt(order.articleCount) || 1,
          unitPrice: Math.round(merchandiseValue.getCents() / (parseInt(order.articleCount) || 1)),
          fees: commission.getCents(),
          shipping: shipmentCosts.getCents(),
          currency: 'EUR',
          source: 'cardmarket',
          externalRef,
          happenedAt: new Date(order.dateOfPurchase),
          createdAt: now,
          updatedAt: now
        };

        // Save transaction
        await transactionRepository.add(transactionRecord);

        // If this is a purchase order, update the associated card lots with enhanced financial tracking
        if (order.direction === 'purchase') {
          // Find all articles associated with this order
          const articles = await db.transactions
            .where('externalRef')
            .startsWith(`cardmarket:article:${order.orderId}:`)
            .toArray();

          // Update each associated card lot with the financial details
          for (const article of articles) {
            if (article.lotId) {
              // Get the lot
              const lot = await cardLotRepository.getById(article.lotId);
              if (lot) {
                // Calculate proportional costs for this article
                const articleCountInOrder = parseInt(order.articleCount) || 1;
                const proportion = article.quantity / articleCountInOrder;

                // Calculate financial details
                const unitAcquisitionCostCent = FinanceService.calculateTrueAcquisitionCost(
                  merchandiseValue.getCents() / 100,
                  shipmentCosts.getCents() / 100,
                  commission.getCents() / 100,
                  articleCountInOrder
                );
                
                const unitShippingCostCent = Math.round((shipmentCosts.getCents() * proportion) / article.quantity);
                const unitCommissionCent = Math.round((commission.getCents() * proportion) / article.quantity);

                // Update the lot with enhanced financial tracking
                await cardLotRepository.update(lot.id, {
                  // Enhanced financial tracking
                  acquisitionPriceCent: unitAcquisitionCostCent,
                  acquisitionFeesCent: unitCommissionCent,
                  acquisitionShippingCent: unitShippingCostCent,
                  totalAcquisitionCostCent: unitAcquisitionCostCent + unitCommissionCent + unitShippingCostCent,
                  updatedAt: now
                });
              }
            }
          }
        }
        
        // If this is a sale order, update the associated card lots with sale financial details
        if (order.direction === 'sale') {
          // Find all articles associated with this order
          const articles = await db.transactions
            .where('externalRef')
            .startsWith(`cardmarket:article:${order.orderId}:`)
            .toArray();

          // Update each associated card lot with the sale financial details
          for (const article of articles) {
            if (article.lotId) {
              // Get the lot
              const lot = await cardLotRepository.getById(article.lotId);
              if (lot) {
                // Calculate proportional revenue for this article
                const articleCountInOrder = parseInt(order.articleCount) || 1;
                const proportion = article.quantity / articleCountInOrder;

                // Calculate sale financial details
                const unitSalePriceCent = Math.round(merchandiseValue.getCents() / articleCountInOrder);
                const unitSaleFeesCent = Math.round((commission.getCents() * proportion) / article.quantity);
                const unitSaleShippingCent = Math.round((shipmentCosts.getCents() * proportion) / article.quantity);

                // Update the lot with sale financial tracking
                await cardLotRepository.update(lot.id, {
                  // Sale financial tracking
                  salePriceCent: unitSalePriceCent,
                  saleFeesCent: unitSaleFeesCent,
                  saleShippingCent: unitSaleShippingCent,
                  totalSaleRevenueCent: unitSalePriceCent - unitSaleFeesCent + unitSaleShippingCent,
                  updatedAt: now
                });
              }
            }
          }
        }
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
      const now = new Date();

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        // Update progress
        importStatusStore.updateImport(importId, {
          status: 'processing',
          processedItems: i + 1,
          progress: Math.round(((i + 1) / articles.length) * 100)
        });

        const { cardId, cardData } = await this.resolveCard(article);

        // Parse price as Money
        const price = Money.parse(article.price, 'EUR');

        // If we have a card ID, fetch and save price data
        if (cardId) {
          await this.ensureCardInDb(cardId, cardData, article);
        }

        // Create card lot record if card was bought
        let lotIdForTransaction: string | undefined = undefined;
        if (article.direction === 'purchase') {
          lotIdForTransaction = await this.getOrCreateLotForPurchase(cardId, price, article);
        }

        // Create transaction record
        await this.createTransactionForArticle(article, cardId, lotIdForTransaction, price, now);
      }

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

    // Priority 1: Try to resolve by Cardmarket product ID first
    if (article.productId) {
      const productIds = article.productId.split(' | ').map((id: string) => id.trim());
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
      const setCode = await resolveSetCode(article.expansion);
      const collectorNumber = this.extractCollectorNumber(article.name);
      let cleanCardName = article.name;
      let versionInfo = null;
      const versionMatch = article.name.match(/^(.+?)\s*\((V\.\d+)\)$/i);
      if (versionMatch) {
        cleanCardName = versionMatch[1].trim();
        versionInfo = versionMatch[2];
      }

      console.log(JSON.stringify({ product_ids: article.productId ? article.productId.split(' | ').map((id: string) => id.trim()) : [], resolved_via: 'set+cn', set_code: setCode, collector_number: collectorNumber, final_uri: setCode ? `/cards/${setCode}/${collectorNumber}` : '' }));

      cardData = await ScryfallProvider.hydrateCard({ name: cleanCardName, setCode: setCode || article.expansion, collectorNumber: collectorNumber, version: versionInfo });
      cardId = cardData?.id || null;

      if (!cardId) {
        console.log(JSON.stringify({ product_ids: article.productId ? article.productId.split(' | ').map((id: string) => id.trim()) : [], resolved_via: 'none', set_code: null, collector_number: '', final_uri: '', name: article.name, expansion: article.expansion }));
      }
    }
    return { cardId, cardData };
  }

  private static extractCollectorNumber(name: string): string {
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
    if (!existingCard) {
      const scryfallData = cardData || await ScryfallProvider.hydrateCard({ scryfall_id: cardId, name: article.name, setCode: article.expansion, collectorNumber: '' });
      const imageUrls = await ScryfallProvider.getImageUrlById(cardId);
      const newCard: Card = {
        id: cardId,
        oracleId: scryfallData?.oracle_id || cardData?.oracle_id || '',
        name: article.name,
        set: scryfallData?.set_name || cardData?.set_name || article.expansion,
        setCode: scryfallData?.set || cardData?.set || (await resolveSetCode(article.expansion) || ''),
        number: scryfallData?.collector_number || cardData?.collector_number || this.extractCollectorNumber(article.name) || '',
        lang: scryfallData?.lang || cardData?.lang || 'en',
        finish: 'nonfoil',
        layout: imageUrls?.layout || 'normal',
        imageUrl: imageUrls?.front || '',
        imageUrlBack: imageUrls?.back || '',
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
      const pricePointId = `${cardId}:scryfall:${dateStr}`;
      const existingPricePoint = await db.price_points.get(pricePointId);
      if (!existingPricePoint) {
        const price = await ScryfallProvider.getPriceById(cardId);
        if (price) {
          const pricePoint = { id: pricePointId, cardId: cardId, provider: 'scryfall', currency: price.getCurrency(), price: price.getCents(), asOf: now, createdAt: now };
          await db.price_points.put(pricePoint);
        }
      }
    } catch (error) {
      console.error(`Error checking/updating price for existing card ${cardId}:`, error);
    }
  }

  private static async getOrCreateLotForPurchase(cardId: string | null, price: Money, article: any): Promise<string | undefined> {
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
        condition: '',
        language: '',
        foil: false,
        finish: 'nonfoil',
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

  private static async createTransactionForArticle(article: any, cardId: string | null, lotId: string | undefined, price: Money, now: Date): Promise<void> {
    const transactionExternalRef = `cardmarket:article:${article.shipmentId}:${article.lineNumber}`;
    const existingTransaction = await db.transactions.where('externalRef').equals(transactionExternalRef).first();
    if (existingTransaction) return;

    const transactionRecord = {
      id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      kind: article.direction === 'sale' ? ('SELL' as const) : ('BUY' as const),
      cardId: cardId || undefined,
      lotId: lotId,
      quantity: parseInt(article.amount) || 1,
      unitPrice: price.getCents(),
      fees: 0,
      shipping: 0,
      currency: 'EUR',
      source: 'cardmarket',
      externalRef: transactionExternalRef,
      happenedAt: new Date(article.dateOfPurchase),
      createdAt: now,
      updatedAt: now
    };
    await transactionRepository.add(transactionRecord);
  }

    

    // Check if articles have already been imported
    static async checkForExistingImports(articles: any[]): Promise<{ article: any, exists: boolean }[]> {
        const results = [];

        for (const article of articles) {
            // Create external reference to check for duplicates
            const externalRef = `cardmarket:article:${article.shipmentId}:${article.lineNumber}`;

            // Check if transaction already exists
            const existing = await db.transactions.where('externalRef').equals(externalRef).first();

            results.push({
                article,
                exists: !!existing
            });
        }

        return results;
    }
}