import { expose } from 'threads/worker';
import { pricePointRepository } from '../../data/repos';
import { gunzipSync, decompressSync, strFromU8 } from 'fflate';
import type { PricePoint } from '../../data/db';
import { mapFinish } from '../../utils/finishMapper';

type RetailPricesByDate = Record<string, number>;
type RetailFinishes = Record<string, RetailPricesByDate>;

type MtgjsonCardMarket = {
  retail?: RetailFinishes;
};

type MtgjsonPaper = {
  cardmarket?: MtgjsonCardMarket;
};

type MtgjsonCard = {
  paper?: MtgjsonPaper;
};

type MtgjsonRoot =
  | { data: Record<string, MtgjsonCard> } // usual shape
  | Record<string, MtgjsonCard>;          // just in case the file is data-only

const MTGJSON_UPLOAD_WORKER = {
  async upload(file: File, wantedIds: string[]): Promise<number> {
    console.log(`[MTGJSONUploadWorker] Received file: ${file.name}, size: ${file.size} bytes`);
    const wantedIdSet = new Set(wantedIds);
    console.log(`[MTGJSONUploadWorker] Received ${wantedIdSet.size} wanted card IDs`);

    // Read & (if needed) decompress
    const buffer = await file.arrayBuffer();
    console.log('[MTGJSONUploadWorker] File buffer read.');

    console.log('[MTGJSONUploadWorker] Decompressing file...');
    const u8 = new Uint8Array(buffer);
    const isGzip = u8[0] === 0x1f && u8[1] === 0x8b;
    // If it's a .gz, gunzip; if not, attempt generic decompress (handles plain data by returning it unchanged)
    const decompressed = isGzip ? gunzipSync(u8) : decompressSync(u8);
    console.log(`[MTGJSONUploadWorker] Decompression complete, size: ${decompressed.length} bytes`);

    if (decompressed.byteLength > 1_500_000_000) {
      throw new Error('The expanded MTGJSON file is too large to process in-browser.');
    }

    // Parse JSON text
    console.log('[MTGJSONUploadWorker] Parsing JSON...');
    const jsonText = strFromU8(decompressed);
    const root = JSON.parse(jsonText) as MtgjsonRoot;
    const data: Record<string, MtgjsonCard> =
      'data' in root && root.data && typeof root.data === 'object' ? root.data : (root as any);

    console.log('[MTGJSONUploadWorker] Building price points (90-day window)...');

    const pricePoints: PricePoint[] = [];
    const batchSize = 2000;
    let processedCardCount = 0;

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Helpers
    const isRecent = (dateStr: string) => {
      // dateStr is ISO date like "2025-05-02" in MTGJSON price files
      const d = new Date(dateStr);
      return !Number.isNaN(d.getTime()) && d >= ninetyDaysAgo;
    };

    // Iterate only wanted IDs
    let scanned = 0;
    for (const [cardId, card] of Object.entries(data)) {
      scanned++;
      if (!wantedIdSet.has(cardId)) continue;

      const retail: RetailFinishes | undefined = card?.paper?.cardmarket?.retail;
      if (!retail || typeof retail !== 'object') continue;

      // finishes like "normal", "foil", "etched"
      for (const [finishKey, byDate] of Object.entries(retail)) {
        const finish = mapFinish(finishKey);
        if (!finish) continue;

        if (!byDate || typeof byDate !== 'object') continue;

        for (const [dateStr, price] of Object.entries(byDate)) {
          if (typeof price !== 'number') continue;
          if (!isRecent(dateStr)) continue;

          const pp: PricePoint = {
            id: `${cardId}:mtgjson.cardmarket:${finish}:${dateStr}`,
            cardId,
            provider: 'mtgjson.cardmarket',
            finish,
            date: dateStr,
            currency: 'EUR',
            priceCent: Math.round(price * 100),
            asOf: now,
            createdAt: now,
          };
          pricePoints.push(pp);

          if (pricePoints.length >= batchSize) {
            console.log(`[MTGJSONUploadWorker] Bulk inserting ${pricePoints.length} price points...`);
            // flush batch
            await pricePointRepository.bulkPut(pricePoints);
            pricePoints.length = 0;
            // allow event loop to breathe
            await new Promise((r) => setTimeout(r, 5));
          }
        }
      }

      processedCardCount++;
      if (processedCardCount % 250 === 0) {
        console.log(`[MTGJSONUploadWorker] Processed ${processedCardCount} wanted cards (scanned ${scanned}).`);
      }
    }

    // Flush remaining
    if (pricePoints.length > 0) {
      console.log(`[MTGJSONUploadWorker] Bulk inserting remaining ${pricePoints.length} price points...`);
      await pricePointRepository.bulkPut(pricePoints);
    }

    console.log(
      `[MTGJSONUploadWorker] Finished. Processed ${processedCardCount} cards from wanted list (scanned ${scanned}).`
    );
    return processedCardCount;
  },
};

expose(MTGJSON_UPLOAD_WORKER);
