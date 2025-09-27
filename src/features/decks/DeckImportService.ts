// Deck import service for importing decks from text files
import {cardRepository, cardLotRepository} from '../../data/repos';
import {EntityLinker} from '../linker/EntityLinker';
import {ScryfallProvider} from '../pricing/ScryfallProvider';
import {type Card} from '../../data/db';
import { getDb } from '../../data/init';
import {useImportStatusStore} from '../../stores/importStatus';
import {v4 as uuidv4} from 'uuid';

export class DeckImportService {
    // Process a deck from text data
    static async importDeckFromText(deckName: string, deckText: string): Promise<void> {
        let importStatusStore;
        let importId;

        try {
            // Try to initialize the import status store
            importStatusStore = useImportStatusStore();

            // Process cards from text
            // Handle different line endings
            const lines = deckText.split('\n').map(line => line.trim()).filter(line => line);

            // Create import tracking
            importId = uuidv4();
            importStatusStore.addImport({
                id: importId,
                type: 'deck',
                name: deckName,
                status: 'pending',
                progress: 0,
                totalItems: lines.length,
                processedItems: 0
            });
        } catch (error) {
            // If we can't initialize the store, continue without import tracking
            console.warn('Could not initialize import status store:', error);
            importStatusStore = null;
            importId = null;
        }

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
            const db = getDb();
            await db.decks.add(deck);

            // Process cards from text
            // Handle different line endings
            const lines = deckText.split('\n').map(line => line.trim()).filter(line => line);

            console.log('Processing deck import:', {deckName, lineCount: lines.length});

            // Update import tracking to processing state
            if (importStatusStore && importId) {
                try {
                    importStatusStore.updateImport(importId, {
                        status: 'processing'
                    });
                } catch (error) {
                    console.warn('Could not update import status:', error);
                }
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                console.log('Processing line:', trimmedLine);

                // Update progress
                if (importStatusStore && importId) {
                    try {
                        importStatusStore.updateImport(importId, {
                            processedItems: i + 1,
                            progress: Math.round(((i + 1) / lines.length) * 100)
                        });
                    } catch (error) {
                        console.warn('Could not update import progress:', error);
                    }
                }

                // Parse the line (format: "quantity cardName (setCode) collectorNumber")
                // Example: "1 Captain America, First Avenger (SLD) 1726"
                // Also handle foil indicators like "*F*"
                const match = trimmedLine.match(/^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i);

                if (match) {
                    const [, quantityStr, cardName, setCode, collectorNumber] = match;
                    const quantity = parseInt(quantityStr) || 1;

                    console.log('Parsed card:', {quantity, cardName, setCode, collectorNumber});

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
                                const imageUrls = await ScryfallProvider.getImageUrlById(cardId);

                                const newCard: Card = {
                                    id: cardId,
                                    oracleId: scryfallData?.oracle_id || '',
                                    name: cardName.trim(),
                                    set: scryfallData?.set_name || setCode.trim(),
                                    setCode: scryfallData?.set || setCode.trim(),
                                    number: scryfallData?.collector_number || collectorNumber.trim(),
                                    lang: scryfallData?.lang || 'en',
                                    finish: 'nonfoil',
                                    layout: imageUrls?.layout || 'normal',
                                    imageUrl: imageUrls?.front || '',
                                    imageUrlBack: imageUrls?.back || '',
                                    createdAt: now,
                                    updatedAt: now,
                                };

                                await cardRepository.add(newCard);
                                console.log('Added new card to database:', newCard);

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
                                            provider: 'scryfall' as const,
                                            finish: 'nonfoil' as const,
                                            date: now.toISOString().split('T')[0],
                                            currency: 'EUR' as const,
                                            priceCent: price.getCents(),
                                            asOf: now,
                                            createdAt: now
                                        };

                                        // Save price point
                                        const db = getDb();
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

            // Mark import as completed
            if (importStatusStore && importId) {
                try {
                    importStatusStore.completeImport(importId);
                } catch (error) {
                    console.warn('Could not complete import status:', error);
                }
            }
        } catch (error) {
            console.error('Error importing deck from text:', error);
            // Mark import as failed
            if (importStatusStore && importId) {
                try {
                    importStatusStore.completeImport(importId, (error as Error).message);
                } catch (storeError) {
                    console.warn('Could not update import status to failed:', storeError);
                }
            }
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
            const db = getDb();
            const deckCards = await db.deck_cards.where('deckId').equals(deckId).toArray();

            let totalCards = 0;
            let ownedCards = 0;

            // Check ownership for each card
            for (const deckCard of deckCards) {
                totalCards += deckCard.quantity;

                // Check if we own this card
                const lots = await cardLotRepository.getActiveLotsByCardId(deckCard.cardId);
                const totalOwned = lots.reduce((sum, lot) => sum + lot.quantity, 0);

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