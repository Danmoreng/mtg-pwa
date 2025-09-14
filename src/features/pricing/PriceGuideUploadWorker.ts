
import { expose } from 'threads/worker';
import { cardRepository, pricePointRepository } from '../../data/repos';
import Papa from 'papaparse';
import type { PricePoint } from '../../data/db';

const PRICE_GUIDE_UPLOAD_WORKER = {
  async upload(file: File): Promise<number> {
    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    
    const pick = (row: any, ...keys: string[]) =>
      keys.map(k => row[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Collect all unique Cardmarket IDs from the CSV
    const cardmarketIds = [
      ...new Set(
        (result.data as any[])
          .map((row) => parseInt(
            pick(row, 'idProduct', 'Product ID', 'product_id', 'id_product'),
            10
          ))
          .filter((id) => !isNaN(id))
      ),
    ];

    // Fetch existing cards from the database using the new repository method
    const existingCards = await cardRepository.getByCardmarketIds(cardmarketIds);

    // Create a map from Cardmarket ID to Scryfall ID (card.id)
    const cardmarketIdToCardId: Record<number, string> = {};
    for (const card of existingCards) {
      if (card.cardmarketId) {
        cardmarketIdToCardId[card.cardmarketId] = card.id;
      }
    }

    const pricePoints: PricePoint[] = [];

    for (const row of result.data as any[]) {
      const cardmarketId = parseInt(
        pick(row, 'idProduct', 'Product ID', 'product_id', 'id_product'),
        10
      );
      if (isNaN(cardmarketId)) continue;

      const cardId = cardmarketIdToCardId[cardmarketId];

      if (cardId) {
        const price  = parseFloat(pick(row, 'Avg. Sell Price', 'Average Sell Price', 'Avg Sell Price'));
        const avg7d  = parseFloat(pick(row, '7-Day Avg.', '7 Days Average', '7 Day Average', '7 day avg'));
        const avg30d = parseFloat(pick(row, '30-Day Avg.', '30 Days Average', '30 Day Average', '30 day avg'));

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
