import { scanRepository, cardRepository, cardLotRepository } from '../../data/repos';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import type { Card, CardLot, Scan } from '../../data/db';

export class ScanProcessingService {
  static async processScans(): Promise<void> {
    console.log("Starting processScans...");
    const unprocessedScans = await scanRepository.getAll();
    console.log(`Found ${unprocessedScans.length} unprocessed scans`);

    for (const scan of unprocessedScans) {
      console.log(`Processing scan: ${scan.id}, fingerprint: ${scan.cardFingerprint}`);
      
      if (scan.cardId) {
        // Check if the card actually exists in the database
        const existingCard = await cardRepository.getById(scan.cardId);
        if (existingCard) {
          console.log(`Scan ${scan.id} already has cardId: ${scan.cardId} with existing card, skipping`);
          continue;
        } else {
          // CardId exists but card doesn't exist in DB, so we need to process
          console.log(`CardId ${scan.cardId} exists but card not found in DB, proceeding with processing`);
        }
      }

      let cardId = scan.cardId; // Use the cardId from the scan
      let card: Card | undefined;

      if (cardId) {
        console.log(`Using existing cardId: ${cardId}`);
        card = await cardRepository.getById(cardId);
      }

      if (!card) {
        console.log(`Card not found, need to process fingerprint: ${scan.cardFingerprint}`);
        // Parse the fingerprint to extract card information
        // Fingerprint can be in format: {setCode}:{number}:{lang}:{finish} or name:{name}:{lang}:{finish}
        const parts = scan.cardFingerprint.split(':');
        console.log(`Fingerprint parts: ${JSON.stringify(parts)}`);

        if (scan.cardFingerprint.startsWith('name:')) {
          // Format: name:{name}:{lang}:{finish}
          const name = parts[1].replace(/-/g, ' ');
          console.log(`Processing name-based fingerprint with name: ${name}`);
          const resolvedCardId = await ScryfallProvider.hydrateCard({
            name: name
          });
          
          if (resolvedCardId) {
            console.log(`Successfully resolved card by name: ${resolvedCardId.name}`);
            cardId = resolvedCardId.id;
            card = await cardRepository.getById(cardId);

            if (!card) {
              console.log(`Card not in DB, creating new card entry`);
              const image = await ScryfallProvider.getImageUrlById(cardId);
              const newCard: Card = {
                id: cardId,
                name: resolvedCardId.name,
                set: resolvedCardId.set_name,
                setCode: resolvedCardId.set,
                number: resolvedCardId.collector_number,
                lang: resolvedCardId.lang,
                finish: scan.finish || 'nonfoil',
                layout: image?.layout,
                imageUrl: image?.front,
                imageUrlBack: image?.back,
                cardmarketId: resolvedCardId.cardmarket_id,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              const cardIdAdded = await cardRepository.add(newCard);
              console.log(`Added new card with id: ${cardIdAdded}`);
              card = newCard;
            }
          } else {
            console.error(`Failed to resolve card by name: ${name}`);
          }
        } else if (parts.length >= 4) {
          // Format: {setCode}:{number}:{lang}:{finish}
          // Get the setCode and number from the fingerprint
          const setCode = parts[0];
          const collectorNumber = parts[1];
          console.log(`Processing setCode/number-based fingerprint with setCode: ${setCode}, number: ${collectorNumber}`);
          
          // Try to hydrate card using setCode and collector number
          const resolvedCardId = await ScryfallProvider.hydrateCard({
            setCode: setCode,
            collectorNumber: collectorNumber
          });
          
          if (resolvedCardId) {
            console.log(`Successfully resolved card by setCode and number: ${resolvedCardId.name}`);
            cardId = resolvedCardId.id;
            card = await cardRepository.getById(cardId);

            if (!card) {
              console.log(`Card not in DB, creating new card entry`);
              const image = await ScryfallProvider.getImageUrlById(cardId);
              const newCard: Card = {
                id: cardId,
                name: resolvedCardId.name,
                set: resolvedCardId.set_name,
                setCode: resolvedCardId.set,
                number: resolvedCardId.collector_number,
                lang: resolvedCardId.lang,
                finish: scan.finish || 'nonfoil',
                layout: image?.layout,
                imageUrl: image?.front,
                imageUrlBack: image?.back,
                cardmarketId: resolvedCardId.cardmarket_id,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              const cardIdAdded = await cardRepository.add(newCard);
              console.log(`Added new card with id: ${cardIdAdded}`);
              card = newCard;
            }
          } else {
            console.error(`Failed to resolve card by setCode: ${setCode} and number: ${collectorNumber}`);
          }
        } else {
          console.error(`Unexpected fingerprint format: ${scan.cardFingerprint}`);
        }
      }

      if (card && cardId) {
        console.log(`Creating card lot for card: ${cardId}, scan: ${scan.id}`);
        const newLot: CardLot = {
          id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          cardId: cardId,
          acquisitionId: scan.acquisitionId,
          quantity: scan.quantity,
          unitCost: 0, // This should be updated later based on acquisition cost
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
    }
    console.log("Completed processScans");
  }
}
