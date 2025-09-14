import { expose } from 'threads/worker';
import { pricePointRepository } from '../../data/repos';
import { gunzipSync, decompressSync, strFromU8 } from 'fflate';
import type { PricePoint } from '../../data/db';
import { mapFinish } from '../../utils/finishMapper';
import clarinet from 'clarinet';

const MTGJSON_UPLOAD_WORKER = {
  async upload(file: File, wantedIds: string[]): Promise<number> {
    console.log(`[MTGJSONUploadWorker] Received file: ${file.name}, size: ${file.size} bytes`);
    const wantedIdSet = new Set(wantedIds);
    console.log(`[MTGJSONUploadWorker] Received ${wantedIdSet.size} wanted card IDs`);

    const buffer = await file.arrayBuffer();
    console.log('[MTGJSONUploadWorker] File buffer read.');

    console.log('[MTGJSONUploadWorker] Decompressing file...');
    const u8 = new Uint8Array(buffer);
    const isGzip = u8[0] === 0x1f && u8[1] === 0x8b;
    // Decompress synchronously, but we will parse the result in a streaming fashion
    const decompressed = isGzip ? gunzipSync(u8) : decompressSync(u8);
    console.log(`[MTGJSONUploadWorker] Decompression complete, size: ${decompressed.length} bytes`);

    if (decompressed.byteLength > 1_500_000_000) { // ~1.5 GB
      throw new Error('The expanded MTGJSON file is too large to process in-browser.');
    }

    console.log('[MTGJSONUploadWorker] Starting streaming JSON parsing...');

    const pricePoints: PricePoint[] = [];
    const batchSize = 2000;
    let processedCardCount = 0;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const parser = clarinet.parser();

    // State machine for parsing
    let path: string[] = [];
    let currentCardId: string | null = null;
    let currentFinish: 'nonfoil' | 'foil' | 'etched' | null = null;
    let currentDate: string | null = null;

    parser.onopenobject = (key) => {
      path.push(key);
      // Are we entering a specific card object?
      if (path.length === 2 && path[0] === 'data' && wantedIdSet.has(key)) {
        currentCardId = key;
      }
    };

    parser.onkey = (key) => {
      path[path.length - 1] = key;
      // Are we entering a finish object?
      if (path.length === 5 && path[2] === 'paper' && path[3] === 'cardmarket' && path[4] === 'retail') {
        // The next keys will be finishes
      } else if (path.length === 6 && path[4] === 'retail' && currentCardId) {
        currentFinish = mapFinish(key);
      } else if (path.length === 7 && path[4] === 'retail' && currentCardId && currentFinish) {
        currentDate = key;
      }
    };

    parser.onvalue = (value) => {
      if (currentCardId && currentFinish && currentDate && typeof value === 'number') {
        const date = new Date(currentDate);
        if (date >= ninetyDaysAgo) {
          const pricePoint: PricePoint = {
            id: `${currentCardId}:mtgjson.cardmarket:${currentFinish}:${currentDate}`,
            cardId: currentCardId,
            provider: 'mtgjson.cardmarket',
            finish: currentFinish,
            date: currentDate,
            currency: 'EUR',
            priceCent: Math.round(value * 100),
            asOf: now,
            createdAt: now,
          };
          pricePoints.push(pricePoint);
        }
      }
    };

    parser.oncloseobject = () => {
      if (path.length === 7) { // Leaving a date object
        currentDate = null;
      } else if (path.length === 6) { // Leaving a finish object
        currentFinish = null;
      } else if (path.length === 2) { // Leaving a card object
        if (currentCardId) {
            processedCardCount++;
        }
        currentCardId = null;
      }
      path.pop();
    };

    // We need to feed the parser in chunks to allow the event loop to breathe
    const chunkSize = 1024 * 1024; // 1MB chunks
    for (let i = 0; i < decompressed.length; i += chunkSize) {
      const chunk = decompressed.subarray(i, i + chunkSize);
      // We need to convert chunk to string for the parser
      parser.write(strFromU8(chunk));

      if (pricePoints.length >= batchSize) {
        console.log(`[MTGJSONUploadWorker] Bulk inserting ${pricePoints.length} price points...`);
        await pricePointRepository.bulkPut(pricePoints);
        pricePoints.length = 0; // Clear the array
        // Give the main thread a moment to process other things
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    parser.close();

    // Insert any remaining price points
    if (pricePoints.length > 0) {
      console.log(`[MTGJSONUploadWorker] Bulk inserting remaining ${pricePoints.length} price points...`);
      await pricePointRepository.bulkPut(pricePoints);
    }

    console.log(`[MTGJSONUploadWorker] Streaming parse finished. Processed ${processedCardCount} cards from the wanted list.`);
    return processedCardCount;
  }
};

expose(MTGJSON_UPLOAD_WORKER);
