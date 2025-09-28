import { scanRepository, cardRepository, cardLotRepository } from '../../data/repos';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import type { Card, CardLot } from '../../data/db';
import { getDb } from '../../data/init';

export class ScanProcessingService {
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

  static async processScans(onProgress?: (processed: number, total: number) => void): Promise<void> {
    console.log("Starting processScans...");
    const unprocessedScans = await scanRepository.getAll();
    console.log(`Found ${unprocessedScans.length} unprocessed scans`);

    for (let i = 0; i < unprocessedScans.length; i++) {
      const scan = unprocessedScans[i];
      console.log(`Processing scan: ${scan.id}, fingerprint: ${scan.cardFingerprint}`);
      
      if (scan.cardId) {
        // Check if the card actually exists in the database
        const existingCard = await cardRepository.getById(scan.cardId);
        if (existingCard) {
          console.log(`Scan ${scan.id} already has cardId: ${scan.cardId} with existing card, skipping`);
          await this.updatePriceForCard(scan.cardId);
          // Still update progress
          if (onProgress) {
            onProgress(i + 1, unprocessedScans.length);
          }
          continue;
        } else {
          // CardId exists but card doesn't exist in DB, so we need to process
          console.log(`CardId ${scan.cardId} exists but card not found in DB, proceeding with processing`);
        }
      }

      let cardId: string | undefined = scan.cardId;
      let card: Card | undefined;

      if (cardId) {
        console.log(`Using existing cardId: ${cardId}`);
        // Safe because we just checked cardId truthiness
        card = await cardRepository.getById(cardId!);
      }

      if (!card) {
        console.log(`Card not found, need to process fingerprint: ${scan.cardFingerprint}`);
        // Parse the fingerprint to extract card information
        // Fingerprint can be in format: {setCode}:{number}:{lang}:{finish} or name:{name}:{lang}:{finish}
        const parts = scan.cardFingerprint.split(':');
        console.log(`Fingerprint parts: ${JSON.stringify(parts)}`);

        if (scan.cardFingerprint.startsWith('name:') && parts.length >= 2) {
          // Format: name:{name}:{lang}:{finish}
          const name = parts[1]?.replace(/-/g, ' ') || '';
          console.log(`Processing name-based fingerprint with name: ${name}`);
          const resolved = await ScryfallProvider.hydrateCard({ name });

          if (resolved?.id) {                     // <-- guard the id
            const id: string = resolved.id;       // <-- now a definite string
            console.log(`Successfully resolved card by name: ${resolved.name || 'Unknown'}`);
            cardId = id;
            card = await cardRepository.getById(id);

            if (!card) {
              console.log(`Card not in DB, creating new card entry`);
              const image = await ScryfallProvider.getImageUrlById(id);
              const newCard: Card = {
                id,                                // <-- use definite string
                name: resolved.name || '',
                set: resolved.set_name || '',
                setCode: resolved.set || '',
                number: resolved.collector_number || '',
                lang: resolved.lang || 'en',
                finish: scan.finish || 'nonfoil',
                layout: image?.layout,
                imageUrl: image?.front,
                imageUrlBack: image?.back,
                cardmarketId: resolved.cardmarket_id,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              const cardIdAdded = await cardRepository.add(newCard);
              console.log(`Added new card with id: ${cardIdAdded}`);
              card = newCard;
            }
            await this.updatePriceForCard(id);
          } else {
            console.error(`Failed to resolve card by name: ${name} (no id returned)`);
          }

        } else if (parts.length >= 4) {
          // Format: {setCode}:{number}:{lang}:{finish}
          // Get the setCode and number from the fingerprint
          const setCode = parts[0] || '';
          const collectorNumber = parts[1] || '';
          console.log(`Processing setCode/number-based fingerprint with setCode: ${setCode}, number: ${collectorNumber}`);

          const resolved = await ScryfallProvider.hydrateCard({
            setCode,
            collectorNumber
          });

          if (resolved?.id) {                     // <-- guard the id
            const id: string = resolved.id;       // <-- now a definite string
            console.log(`Successfully resolved card by setCode and number: ${resolved.name || 'Unknown'}`);
            cardId = id;
            card = await cardRepository.getById(id);

            if (!card) {
              console.log(`Card not in DB, creating new card entry`);
              const image = await ScryfallProvider.getImageUrlById(id);
              const newCard: Card = {
                id,                                // <-- use definite string
                name: resolved.name || '',
                set: resolved.set_name || '',
                setCode: resolved.set || '',
                number: resolved.collector_number || '',
                lang: resolved.lang || 'en',
                finish: scan.finish || 'nonfoil',
                layout: image?.layout,
                imageUrl: image?.front,
                imageUrlBack: image?.back,
                cardmarketId: resolved.cardmarket_id,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              const cardIdAdded = await cardRepository.add(newCard);
              console.log(`Added new card with id: ${cardIdAdded}`);
              card = newCard;
            }
            await this.updatePriceForCard(id);
          } else {
            console.error(`Failed to resolve card by setCode: ${setCode} and number: ${collectorNumber} (no id returned)`);
          }

        } else {
          console.error(`Unexpected fingerprint format: ${scan.cardFingerprint}`);
        }
      }

      if (card && cardId) {
        console.log(`Creating card lot for card: ${cardId}, scan: ${scan.id}`);
        const newLot: CardLot = {
          id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          cardId: cardId, // OK: CardLot.cardId is string and we're in the branch where cardId is truthy
          acquisitionId: scan.acquisitionId,
          quantity: scan.quantity,
          unitCost: 0,
          condition: 'near_mint',
          language: scan.language || 'en',
          foil: scan.finish === 'foil',
          finish: scan.finish || 'nonfoil',
          source: 'manabox',
          purchasedAt: scan.scannedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const lotId = await cardLotRepository.add(newLot);
        console.log(`Added new card lot with id: ${lotId}`);

        await scanRepository.update(scan.id, {
          cardId: cardId,
          lotId: lotId,
        });
        console.log(`Updated scan ${scan.id} with cardId: ${cardId} and lotId: ${lotId}`);
      } else {
        console.log(`No card found or created for scan: ${scan.id}, skipping lot creation`);
      }
      
      // Update progress after processing each scan
      if (onProgress) {
        onProgress(i + 1, unprocessedScans.length);
      }
    }
    console.log("Completed processScans");
  }
}
