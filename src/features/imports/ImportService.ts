// Import service for handling CSV imports
import { transactionRepository, cardLotRepository, cardRepository } from '../../data/repos';
import { Money } from '../../core/Money';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import { resolveSetCode } from '../pricing/SetCodeResolver';
import db from '../../data/db';

export class ImportService {
  // Import Cardmarket transactions
  static async importCardmarketTransactions(transactions: any[]): Promise<void> {
    try {
      const now = new Date();
      
      for (const transaction of transactions) {
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
        let cardData = null;
        let cardId = null;
        
        // Priority 1: Try to resolve by Cardmarket product ID first
        if (article.productId) {
          // Handle multiple product IDs separated by " | "
          const productIds = article.productId.split(' | ').map((id: string) => id.trim());
          
          if (productIds.length === 1) {
            // Single product ID
            cardData = await ScryfallProvider.getByCardmarketId(productIds[0]);
            // Add structured logging
            console.log(JSON.stringify({
              product_ids: productIds,
              resolved_via: 'cardmarket_id',
              cardmarket_id: productIds[0],
              final_uri: `/cards/cardmarket/${productIds[0]}`
            }));
          } else if (productIds.length > 1) {
            // Multiple product IDs - try each one
            for (const productId of productIds) {
              cardData = await ScryfallProvider.getByCardmarketId(productId);
              if (cardData) {
                // Add structured logging
                console.log(JSON.stringify({
                  product_ids: productIds,
                  resolved_via: 'cardmarket_id',
                  cardmarket_id: productId,
                  final_uri: `/cards/cardmarket/${productId}`
                }));
                break;
              }
            }
          }
          
          cardId = cardData?.id || null;
        }
        
        // Priority 2: If no product ID or product ID lookup failed, try set code resolution
        if (!cardId) {
          const setCode = await resolveSetCode(article.expansion);
          
          // Check if card name contains version information
          let cleanCardName = article.name;
          let versionInfo = null;
          const versionMatch = article.name.match(/^(.+?)\s*\((V\.\d+)\)$/i);
          if (versionMatch) {
            cleanCardName = versionMatch[1].trim();
            versionInfo = versionMatch[2]; // e.g., "V.1"
          }
          
          // Try to extract collector number from the card name
          // Pattern: "- {number} -" e.g., "- 167 -"
          let collectorNumber = '';
          const collectorNumberMatch = article.name.match(/-\s*(\d+[a-zA-Z]*)\s*-/);
          if (collectorNumberMatch) {
            collectorNumber = collectorNumberMatch[1];
          }
          
          // Add structured logging
          console.log(JSON.stringify({
            product_ids: article.productId ? article.productId.split(' | ').map((id: string) => id.trim()) : [],
            resolved_via: 'set+cn',
            set_code: setCode,
            collector_number: collectorNumber,
            final_uri: setCode ? `/cards/${setCode}/${collectorNumber}` : ''
          }));
          
          // Try to resolve to a Scryfall ID
          cardData = await ScryfallProvider.hydrateCard({
            name: cleanCardName,
            setCode: setCode || article.expansion, // Fallback to original if we can't resolve
            collectorNumber: collectorNumber,
            version: versionInfo
          });
          
          cardId = cardData?.id || null;
          
          // Add structured logging when no resolution is possible
          if (!cardId) {
            console.log(JSON.stringify({
              product_ids: article.productId ? article.productId.split(' | ').map((id: string) => id.trim()) : [],
              resolved_via: 'none',
              set_code: null,
              collector_number: '',
              final_uri: '',
              name: article.name,
              expansion: article.expansion
            }));
          }
        }
        
        // Parse price as Money
        const price = Money.parse(article.price, 'EUR');
        
        // If we have a card ID, fetch and save price data
        if (cardId) {
          // Check if the card exists in our database
          const existingCard = await cardRepository.getById(cardId);
          if (!existingCard) {
            // Get full card data from Scryfall
            const scryfallData = cardData || await ScryfallProvider.hydrateCard({
              scryfall_id: cardId,
              name: article.name,
              setCode: article.expansion,
              collectorNumber: '' // Not available in articles CSV
            });
            
            // Get image URL from Scryfall
            const imageUrl = await ScryfallProvider.getImageUrlById(cardId);
            
            // Try to extract collector number from the card name for the card record
          let collectorNumberForRecord = '';
          const collectorNumberMatchForRecord = article.name.match(/-\s*(\d+[a-zA-Z]*)\s*-/);
          if (collectorNumberMatchForRecord) {
            collectorNumberForRecord = collectorNumberMatchForRecord[1];
          }

          const cardRecord = {
              id: cardId,
              oracleId: scryfallData?.oracle_id || cardData?.oracle_id || '',
              name: article.name,
              set: scryfallData?.set_name || cardData?.set_name || article.expansion,
              setCode: scryfallData?.set || cardData?.set || article.expansion,
              number: scryfallData?.collector_number || cardData?.collector_number || collectorNumberForRecord || '', // Use parsed collector number if available
              lang: scryfallData?.lang || cardData?.lang || 'en',
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
        
        // Create card lot record if card was bought
        if (article.direction === 'purchase') {
          // Check if we already have a lot for this card without a purchase transaction
          // This would be the case if we imported a deck first and then the Cardmarket purchase
          const existingLots = await cardLotRepository.getByCardId(cardId || '');
          let lotToLink = null;
          
          // Look for a lot that doesn't have a purchase transaction yet
          for (const lot of existingLots) {
            // Check if this lot already has a purchase transaction linked to it
            const purchaseTransactions = await transactionRepository.getByLotId(lot.id);
            const hasPurchaseTransaction = purchaseTransactions.some(tx => tx.kind === 'BUY');
            
            if (!hasPurchaseTransaction) {
              lotToLink = lot;
              break;
            }
          }
          
          if (lotToLink) {
            // Update the existing lot with purchase information
            await cardLotRepository.update(lotToLink.id, {
              unitCost: price.getCents(),
              source: 'cardmarket',
              purchasedAt: new Date(article.dateOfPurchase),
              updatedAt: now
            });
          } else {
            // Create a new lot for this purchase
            const lotId = `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const lot = {
                  id: lotId,
                  cardId: cardId || '', // Will be empty if not resolved
                  quantity: parseInt(article.amount) || 1,
                  unitCost: price.getCents(),
                  condition: '', // Not available in articles CSV
                  language: '', // Not available in articles CSV
                  foil: false, // Not available in articles CSV
                  finish: 'nonfoil', // Default to nonfoil
                  source: 'cardmarket',
                  currency: 'EUR', // Add currency
                  purchasedAt: new Date(article.dateOfPurchase),
                  createdAt: now,
                  updatedAt: now
                };
            
            // Save lot
            await cardLotRepository.add(lot);
          }
        }
        
        // Find the lot we just created or updated
        let lotIdForTransaction: string | undefined = undefined;
        if (article.direction === 'purchase') {
          const lots = await cardLotRepository.getByCardId(cardId || '');
          // Get the most recently updated lot
          lots.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          if (lots.length > 0) {
            lotIdForTransaction = lots[0].id;
          }
        }
        
        // Create transaction record
        const transactionRecord = {
          id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          kind: article.direction === 'sale' ? ('SELL' as const) : ('BUY' as const),
          cardId: cardId || undefined, // Will be undefined if not resolved
          lotId: lotIdForTransaction, // Link to the lot if we have one
          quantity: parseInt(article.amount) || 1,
          unitPrice: price.getCents(),
          fees: 0, // Fees would be in order records
          shipping: 0, // Shipping would be in order records
          currency: 'EUR',
          source: 'cardmarket',
          externalRef: `cardmarket:article:${article.shipmentId}:${article.lineNumber}`,
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