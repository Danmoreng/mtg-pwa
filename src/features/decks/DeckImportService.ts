// Deck import service for importing decks from text files
import { cardRepository, holdingRepository, cardLotRepository } from '../../data/repos';
import { EntityLinker } from '../linker/EntityLinker';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import db from '../../data/db';

export class DeckImportService {
  // Process a deck from text data
  static async importDeckFromText(deckName: string, deckText: string): Promise<void> {
    try {
      const now = new Date();
      
      // Create deck record
      const deckId = `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const deck = {
        id: deckId,
        platform: 'csv' as const, // Using 'csv' for text imports as well
        name: deckName,
        commander: '',
        url: '',
        importedAt: now,
        createdAt: now,
        updatedAt: now
      };
      
      // Save deck
      await db.decks.add(deck);
      
      // Process cards from text
      // Handle different line endings
      const lines = deckText.split('\n').map(line => line.trim()).filter(line => line);
      
      console.log('Processing deck import:', { deckName, lineCount: lines.length });
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        console.log('Processing line:', trimmedLine);
        
        // Parse the line (format: "quantity cardName (setCode) collectorNumber")
        // Example: "1 Captain America, First Avenger (SLD) 1726"
        // Also handle foil indicators like "*F*"
        const match = trimmedLine.match(/^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i);
        
        if (match) {
          const [, quantityStr, cardName, setCode, collectorNumber] = match;
          const quantity = parseInt(quantityStr) || 1;
          
          console.log('Parsed card:', { quantity, cardName, setCode, collectorNumber });
          
          if (cardName && setCode && collectorNumber) {
            // Create a card fingerprint
            const fingerprint = {
              name: cardName.trim(),
              setCode: setCode.trim(),
              collectorNumber: collectorNumber.trim(),
              finish: 'nonfoil', // Default to nonfoil
              language: 'en' // Default to English
            };
            
            // Try to resolve to a Scryfall ID
            const cardId = await EntityLinker.resolveFingerprint(fingerprint);
            
            console.log('Resolved card ID:', cardId);
            
            // If card doesn't exist in our database, create it
            if (cardId) {
              const now = new Date();
              const existingCard = await cardRepository.getById(cardId);
              if (!existingCard) {
                // Get full card data from Scryfall
                const scryfallData = await ScryfallProvider.hydrateCard({
                  scryfall_id: cardId,
                  name: cardName.trim(),
                  setCode: setCode.trim(),
                  collectorNumber: collectorNumber.trim()
                });
                
                // Get image URL from Scryfall
                const imageUrl = await ScryfallProvider.getImageUrlById(cardId);
                
                const cardRecord = {
                  id: cardId,
                  oracleId: scryfallData?.oracle_id || '',
                  name: cardName.trim(),
                  set: scryfallData?.set_name || setCode.trim(),
                  setCode: setCode.trim(),
                  number: collectorNumber.trim(),
                  lang: scryfallData?.lang || 'en',
                  finish: 'nonfoil',
                  imageUrl: imageUrl || '',
                  createdAt: now,
                  updatedAt: now
                };
                
                await cardRepository.add(cardRecord);
                console.log('Added new card to database:', cardRecord);
                
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
              }
              
              // Check if we already have this card in our collection
              // If we do, we don't need to create a new lot unless we need more quantity
              const existingLots = await cardLotRepository.getByCardId(cardId);
              const totalOwned = existingLots.reduce((sum, lot) => {
                // Only count lots that haven't been fully disposed
                if (!lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity)) {
                  const remainingQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
                  return sum + remainingQuantity;
                }
                return sum;
              }, 0);
              
              // Only add to collection if we don't already own enough of this card
              if (totalOwned < quantity) {
                const neededQuantity = quantity - totalOwned;
                
                // Create a new lot for the additional cards we need
                const lotId = `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const lot = {
                  id: lotId,
                  cardId: cardId,
                  quantity: neededQuantity,
                  unitCost: 0, // Default to 0 cost for deck imports
                  condition: 'unknown',
                  language: 'en',
                  foil: false,
                  finish: 'nonfoil',
                  source: 'deck_import',
                  currency: 'EUR',
                  purchasedAt: now,
                  createdAt: now,
                  updatedAt: now
                };
                
                await cardLotRepository.add(lot);
                console.log('Added new lot for deck import:', lot);
              }
            }
            
            // Find an existing lot for this card that we can link to
            // Prefer lots that are not yet disposed
            let lotIdToLink: string | undefined = undefined;
            const existingLots = await cardLotRepository.getByCardId(cardId || '');
            if (existingLots.length > 0) {
              // Look for a lot that has enough quantity and is not disposed
              for (const lot of existingLots) {
                const remainingQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
                if (remainingQuantity >= quantity && !lot.disposedAt) {
                  lotIdToLink = lot.id;
                  break;
                }
              }
              
              // If we didn't find a suitable lot, use the first one
              if (!lotIdToLink && existingLots.length > 0) {
                lotIdToLink = existingLots[0].id;
              }
            }
            
            // Create deck card record with new schema
            const now = new Date();
            const deckCard = {
              id: `deckcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              deckId: deckId || 'unknown-deck',
              cardId: cardId || 'unknown-card',
              lotId: lotIdToLink, // Link to existing lot if possible
              quantity: typeof quantity === 'number' && quantity > 0 ? quantity : 1,
              role: 'main' as const,
              addedAt: now,
              createdAt: now
            };
            
            // Save deck card
            await db.deck_cards.add(deckCard);
            console.log('Added deck card:', deckCard);
          }
        } else {
          console.log('Line did not match expected format:', trimmedLine);
        }
      }
      
      // Verify the import worked
      const cardCount = await db.deck_cards.where('deckId').equals(deckId).count();
      console.log('Total cards imported:', cardCount);
    } catch (error) {
      console.error('Error importing deck from text:', error);
      throw error;
    }
  }

  // Calculate deck coverage (how many cards are owned)
  static async calculateDeckCoverage(deckId: string): Promise<{
    totalCards: number;
    ownedCards: number;
    coveragePercentage: number;
  }> {
    try {
      // Get all cards in the deck
      const deckCards = await db.deck_cards.where('deckId').equals(deckId).toArray();
      
      let totalCards = 0;
      let ownedCards = 0;
      
      // Check ownership for each card
      for (const deckCard of deckCards) {
        totalCards += deckCard.quantity;
        
        // Check if we own this card
        const holdings = await holdingRepository.getByCardId(deckCard.cardId);
        const totalOwned = holdings.reduce((sum, holding) => sum + holding.quantity, 0);
        
        // Count owned cards (up to the quantity needed)
        ownedCards += Math.min(deckCard.quantity, totalOwned);
      }
      
      const coveragePercentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 100;
      
      return {
        totalCards,
        ownedCards,
        coveragePercentage
      };
    } catch (error) {
      console.error('Error calculating deck coverage:', error);
      throw error;
    }
  }
}