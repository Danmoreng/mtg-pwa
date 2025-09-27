import { scanRepository, cardRepository, cardLotRepository } from '../../data/repos';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import type { Card, CardLot, Scan } from '../../data/db';
import { normalizeFingerprint } from '../../core/Normalization';

export class ScanProcessingService {
  static async processScans(): Promise<void> {
    const unprocessedScans = await scanRepository.getAll();

    for (const scan of unprocessedScans) {
      if (scan.cardId) {
        continue;
      }

      let cardId = scan.scryfallId;
      let card: Card | undefined;

      if (cardId) {
        card = await cardRepository.getById(cardId);
      }

      if (!card) {
        const fingerprint = normalizeFingerprint({
          name: scan.cardFingerprint.split(':')[1].replace(/-/g, ' '),
          setCode: scan.cardFingerprint.split(':')[0],
          number: '',
          lang: scan.language || 'en',
          finish: scan.finish || 'nonfoil',
        });

        const resolvedCardId = await ScryfallProvider.hydrateCard({
          name: fingerprint.name,
          setCode: fingerprint.setCode,
        });

        if (resolvedCardId) {
          cardId = resolvedCardId.id;
          card = await cardRepository.getById(cardId);

          if (!card) {
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
            await cardRepository.add(newCard);
            card = newCard;
          }
        }
      }

      if (card && cardId) {
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

        await scanRepository.update(scan.id, {
          cardId: cardId,
          lotId: lotId,
        });
      }
    }
  }
}
