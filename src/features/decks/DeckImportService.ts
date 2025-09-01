// Deck import service for importing decks from text files
import { cardRepository, holdingRepository } from '../../data/repos';
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
        const match = trimmedLine.match(/^(\d+)\s+(.+?)\s*$([^)]+)$\s*(\d+)(?:\s*\*F\*\s*)?$/i);
        
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
              
              // Add card to collection (holdings) when importing a deck
              // This ensures that importing a deck adds the cards to your collection
              const existingHoldings = await holdingRepository.getByCardId(cardId);
              const totalOwned = existingHoldings.reduce((sum, holding) => sum + holding.quantity, 0);
              
              // Only add to holdings if we don't already own enough of this card
              if (totalOwned < quantity) {
                const neededQuantity = quantity - totalOwned;
                
                const holding = {
                  id: `holding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  cardId: cardId,
                  quantity: neededQuantity,
                  unitCost: 0, // Default to 0 cost
                  source: 'deck_import',
                  condition: 'unknown',
                  language: 'en',
                  foil: false,
                  createdAt: now,
                  updatedAt: now
                };
                
                await holdingRepository.add(holding);
                console.log('Added card to holdings:', holding);
              }
            }
            
            // Create deck card record
            const deckCard = {
              deckId,
              cardId: cardId || '',
              quantity,
              role: 'main' as const,
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