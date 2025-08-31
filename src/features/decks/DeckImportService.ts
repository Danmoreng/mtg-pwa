// Deck import service for importing decks from text files
import { cardRepository, holdingRepository } from '../../data/repos';
import { EntityLinker } from '../linker/EntityLinker';
import db from '../../data/db';

export class DeckImportService {
  // Process a deck from text data
  static async importDeckFromText(deckName: string, deckText: string): Promise<void> {
    try {
      // Create deck record
      const deckId = `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const deck = {
        id: deckId,
        platform: 'csv' as const, // Using 'csv' for text imports as well
        name: deckName,
        commander: '',
        url: '',
        importedAt: new Date()
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
              const existingCard = await cardRepository.getById(cardId);
              if (!existingCard) {
                const cardRecord = {
                  id: cardId,
                  oracleId: '',
                  name: cardName.trim(),
                  set: setCode.trim(),
                  setCode: setCode.trim(),
                  number: collectorNumber.trim(),
                  lang: 'en',
                  finish: 'nonfoil',
                  imageUrl: ''
                };
                
                await cardRepository.add(cardRecord);
                console.log('Added new card to database:', cardRecord);
              }
            }
            
            // Create deck card record
            const deckCard = {
              deckId,
              cardId: cardId || '',
              quantity,
              role: 'main' as const
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