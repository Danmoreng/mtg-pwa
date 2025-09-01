// Import service for handling CSV imports
import { transactionRepository, holdingRepository, cardRepository } from '../../data/repos';
import { EntityLinker, type CardFingerprint } from '../linker/EntityLinker.ts';
import { Money } from '../../core/Money';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import db from '../../data/db';

export class ImportService {
  // Import Cardmarket transactions
  static async importCardmarketTransactions(transactions: any[]): Promise<void> {
    try {
      const now = new Date();
      
      for (const transaction of transactions) {
        // Create external reference to avoid duplicates
        const externalRef = `cardmarket:${transaction.reference}`;
        
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
    } catch (error) {
      console.error('Error importing Cardmarket transactions:', error);
      throw error;
    }
  }

  // Import Cardmarket orders
  static async importCardmarketOrders(orders: any[]): Promise<void> {
    try {
      const now = new Date();
      
      for (const order of orders) {
        // Create external reference to avoid duplicates
        const externalRef = `cardmarket:order:${order.orderId}`;
        
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
      }
    } catch (error) {
      console.error('Error importing Cardmarket orders:', error);
      throw error;
    }
  }

  // Import Cardmarket articles
  static async importCardmarketArticles(articles: any[]): Promise<void> {
    try {
      const now = new Date();
      
      for (const article of articles) {
        // Create a card fingerprint
        const fingerprint: CardFingerprint = {
          name: article.name,
          setCode: article.expansion,
          collectorNumber: '', // Not available in articles CSV
          finish: '', // Not available in articles CSV
          language: '' // Not available in articles CSV
        };
        
        // Try to resolve to a Scryfall ID
        const cardId = await EntityLinker.resolveFingerprint(fingerprint);
        
        // Parse price as Money
        const price = Money.parse(article.price, 'EUR');
        
        // Create holding record if card was bought
        if (article.direction === 'purchase') {
          const holding = {
            id: `holding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            cardId: cardId || '', // Will be empty if not resolved
            quantity: parseInt(article.amount) || 1,
            unitCost: price.getCents(),
            source: 'cardmarket',
            condition: '', // Not available in articles CSV
            language: '', // Not available in articles CSV
            foil: false, // Not available in articles CSV
            createdAt: new Date(article.dateOfPurchase),
            updatedAt: now
          };
          
          // Save holding
          await holdingRepository.add(holding);
        }
        
        // If we have a card ID, fetch and save price data
        if (cardId) {
          // Check if the card exists in our database
          const existingCard = await cardRepository.getById(cardId);
          if (!existingCard) {
            // Get full card data from Scryfall
            const scryfallData = await ScryfallProvider.hydrateCard({
              scryfall_id: cardId,
              name: article.name,
              setCode: article.expansion,
              collectorNumber: '' // Not available in articles CSV
            });
            
            // Get image URL from Scryfall
            const imageUrl = await ScryfallProvider.getImageUrlById(cardId);
            
            const cardRecord = {
              id: cardId,
              oracleId: scryfallData?.oracle_id || '',
              name: article.name,
              set: scryfallData?.set_name || article.expansion,
              setCode: article.expansion,
              number: '', // Not available in articles CSV
              lang: scryfallData?.lang || 'en',
              finish: 'nonfoil', // Default to nonfoil
              imageUrl: imageUrl || '',
              createdAt: now,
              updatedAt: now
            };
            
            await cardRepository.add(cardRecord);
            
            // Fetch and save price data for the new card
            try {
              const price = await ScryfallProvider.getPriceById(cardId);
              if (price) {
                // Create price point ID with date
                const dateStr = now.toISOString().split('T')[0];
                const pricePointId = `${cardId}:scryfall:${dateStr}`;
                
                // Create price point
                const pricePoint = {
                  id: pricePointId,
                  cardId: cardId,
                  provider: 'scryfall',
                  currency: price.getCurrency(),
                  price: price.getCents(),
                  asOf: now,
                  createdAt: now
                };
                
                // Save price point
                await db.price_points.put(pricePoint);
              }
            } catch (error) {
              console.error(`Error fetching price for new card ${cardId}:`, error);
            }
          } else {
            // Card already exists, but we might want to update its price data
            // For now, we'll just make sure there's a price point for today
            try {
              const dateStr = now.toISOString().split('T')[0];
              const pricePointId = `${cardId}:scryfall:${dateStr}`;
              const existingPricePoint = await db.price_points.get(pricePointId);
              
              if (!existingPricePoint) {
                const price = await ScryfallProvider.getPriceById(cardId);
                if (price) {
                  // Create price point
                  const pricePoint = {
                    id: pricePointId,
                    cardId: cardId,
                    provider: 'scryfall',
                    currency: price.getCurrency(),
                    price: price.getCents(),
                    asOf: now,
                    createdAt: now
                  };
                  
                  // Save price point
                  await db.price_points.put(pricePoint);
                }
              }
            } catch (error) {
              console.error(`Error checking/updating price for existing card ${cardId}:`, error);
            }
          }
        }
        
        // Create transaction record
        const transactionRecord = {
          id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          kind: article.direction === 'sale' ? ('SELL' as const) : ('BUY' as const),
          cardId: cardId || undefined, // Will be undefined if not resolved
          quantity: parseInt(article.amount) || 1,
          unitPrice: price.getCents(),
          fees: 0, // Fees would be in order records
          shipping: 0, // Shipping would be in order records
          currency: 'EUR',
          source: 'cardmarket',
          externalRef: `cardmarket:article:${article.shipmentId}:${article.productId}`,
          happenedAt: new Date(article.dateOfPurchase),
          createdAt: now,
          updatedAt: now
        };
        
        // Save transaction
        await transactionRepository.add(transactionRecord);
      }
    } catch (error) {
      console.error('Error importing Cardmarket articles:', error);
      throw error;
    }
  }
}