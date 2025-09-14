
import { expose } from 'threads/worker';
import { pricePointRepository } from '../../data/repos';
import Papa from 'papaparse';
import type { PricePoint } from '../../data/db';
// Note: We can't import ScryfallProvider directly in a worker
// We'll need to fetch card data directly in the worker

const PRICE_GUIDE_UPLOAD_WORKER = {
  async upload(file: File): Promise<number> {
    const text = await file.text();
    const result = Papa.parse(text, { header: true });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Collect all unique Cardmarket IDs from the CSV
    const cardmarketIds: string[] = [];
    for (const row of result.data as any[]) {
      const cardmarketId = row['idProduct'];
      if (cardmarketId && !cardmarketIds.includes(cardmarketId)) {
        cardmarketIds.push(cardmarketId);
      }
    }

    // Resolve Cardmarket IDs to Scryfall IDs
    const cardmarketIdToCardId: Record<string, string> = {};
    
    // Process in batches to avoid rate limiting
    const batchSize = 75;
    for (let i = 0; i < cardmarketIds.length; i += batchSize) {
      const batch = cardmarketIds.slice(i, i + batchSize);
      
      try {
        // Use Scryfall's collection endpoint to resolve Cardmarket IDs
        const response = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            identifiers: batch.map(id => ({ cardmarket_id: id }))
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            for (const card of data.data) {
              if (card.id && card.cardmarket_id) {
                cardmarketIdToCardId[card.cardmarket_id] = card.id;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error resolving Cardmarket IDs to Scryfall IDs:', error);
      }
      
      // Add a small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
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
