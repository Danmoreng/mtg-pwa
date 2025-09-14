
import {expose} from 'threads/worker';
import {pricePointRepository, type PricePoint} from '../../data/repos';
import {cardRepository} from '../../data/repos';
import Papa from 'papaparse';

const PRICE_GUIDE_UPLOAD_WORKER = {
  async upload(file: File): Promise<number> {
    const text = await file.text();
    const result = Papa.parse(text, { header: true });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const allCards = await cardRepository.getAll();
    const cardmarketIdToCardId: Record<string, string> = {};
    for (const card of allCards) {
      if (card.cardmarketId) {
        cardmarketIdToCardId[card.cardmarketId] = card.id;
      }
    }

    const pricePoints: PricePoint[] = [];

    for (const row of result.data as any[]) {
      const cardmarketId = row['idProduct'];
      const cardId = cardmarketIdToCardId[cardmarketId];

      if (cardId) {
        const price = parseFloat(row['Avg. Sell Price']);
        const avg7d = parseFloat(row['7-Day Avg.']);
        const avg30d = parseFloat(row['30-Day Avg.']);

        if (!isNaN(price)) {
          const pricePoint: PricePoint = {
            id: `${cardId}:cardmarket.priceguide:nonfoil:${dateStr}`,
            cardId: cardId,
            provider: 'cardmarket.priceguide',
            finish: 'nonfoil',
            date: dateStr,
            currency: 'EUR',
            priceCent: Math.round(price * 100),
            avg7dCent: isNaN(avg7d) ? undefined : Math.round(avg7d * 100),
            avg30dCent: isNaN(avg30d) ? undefined : Math.round(avg30d * 100),
            asOf: now,
            createdAt: now,
          };
          pricePoints.push(pricePoint);
        }
      }
    }

    if (pricePoints.length > 0) {
      await pricePointRepository.bulkPut(pricePoints);
    }

    return pricePoints.length;
  }
};

expose(PRICE_GUIDE_UPLOAD_WORKER);
