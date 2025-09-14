import {expose} from 'threads/worker';
import {mapFinish} from '../../utils/finishMapper';
import {pricePointRepository} from '../../data/repos';
import {gunzipSync, decompressSync, strFromU8} from 'fflate';
import type {PricePoint} from '../../data/db';

const MTGJSON_UPLOAD_WORKER = {
  async upload(file: File, wantedIds: string[]): Promise<number> {
    console.log(`[MTGJSONUploadWorker] Received file: ${file.name}, size: ${file.size} bytes`);
    console.log(`[MTGJSONUploadWorker] Received ${wantedIds.length} wanted card IDs`);

    try {
      const buffer = await file.arrayBuffer();
      console.log('[MTGJSONUploadWorker] File buffer read.');

      console.log('[MTGJSONUploadWorker] Decompressing file...');
      const u8 = new Uint8Array(buffer);
      const isGzip = u8[0] === 0x1f && u8[1] === 0x8b;
      const decompressed = isGzip ? gunzipSync(u8) : decompressSync(u8);
      console.log(`[MTGJSONUploadWorker] Decompression complete, size: ${decompressed.length} bytes`);

      // Add file size guard to prevent memory blow-up
      if (decompressed.byteLength > 1_500_000_000) { // ~1.5 GB
        throw new Error('The expanded MTGJSON file is too large to process in-browser. Please use the smaller "today" file or enable streaming parse.');
      }

      console.log('[MTGJSONUploadWorker] Parsing JSON...');
      const json = JSON.parse(strFromU8(decompressed));
      console.log('[MTGJSONUploadWorker] JSON parsing complete.');

      const pricePoints: PricePoint[] = [];
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      console.log(`[MTGJSONUploadWorker] Processing prices from the last 90 days (since ${ninetyDaysAgo.toISOString()})`);

      let processedCardCount = 0;
      const batchSize = 1000; // Process in batches to avoid memory issues

      // Process cards in smaller batches to reduce memory usage
      const batchSizeForIds = 50; // Process 50 card IDs at a time
      
      for (let i = 0; i < wantedIds.length; i += batchSizeForIds) {
        const batch = wantedIds.slice(i, i + batchSizeForIds);
        
        for (const cardId of batch) {
          const cardData = json.data[cardId];
          if (!cardData) continue;

          const paperData = cardData.paper;
          if (!paperData) continue;

          const cardmarketData = paperData.cardmarket;
          if (!cardmarketData) continue;

          const retailData = cardmarketData.retail;
          if (!retailData) continue;

          processedCardCount++;

          for (const finish of Object.keys(retailData)) {
            const mappedFinish = mapFinish(finish);
            const priceHistory = retailData[finish];

            for (const dateStr of Object.keys(priceHistory)) {
              const date = new Date(dateStr);
              if (date < ninetyDaysAgo) continue;

              const price = priceHistory[dateStr];
              const pricePoint: PricePoint = {
                id: `${cardId}:mtgjson.cardmarket:${mappedFinish}:${dateStr}`,
                cardId: cardId,
                provider: 'mtgjson.cardmarket' as const,
                finish: mappedFinish,
                date: dateStr,
                currency: 'EUR',
                priceCent: Math.round(price * 100),
                asOf: now,
                createdAt: now,
              };
              pricePoints.push(pricePoint);
            }
          }

          // Batch insert to avoid memory issues with large datasets
          if (pricePoints.length >= batchSize) {
            console.log(`[MTGJSONUploadWorker] Bulk inserting ${pricePoints.length} price points into the database...`);
            await pricePointRepository.bulkPut(pricePoints);
            console.log('[MTGJSONUploadWorker] Batch insert complete.');
            pricePoints.length = 0; // Clear the array
          }
        }
        
        // Allow browser to process other tasks between batches
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      console.log(`[MTGJSONUploadWorker] Found price points for ${processedCardCount} cards.`);

      // Insert any remaining price points
      if (pricePoints.length > 0) {
        console.log(`[MTGJSONUploadWorker] Bulk inserting remaining ${pricePoints.length} price points into the database...`);
        await pricePointRepository.bulkPut(pricePoints);
        console.log('[MTGJSONUploadWorker] Final batch insert complete.');
      }

      console.log('[MTGJSONUploadWorker] Upload process finished.');
      return processedCardCount;
    } catch (error) {
      console.error('[MTGJSONUploadWorker] An error occurred during the upload process:', error);
      throw error; // Re-throw the error to be caught by the service
    }
  }
};

expose(MTGJSON_UPLOAD_WORKER);