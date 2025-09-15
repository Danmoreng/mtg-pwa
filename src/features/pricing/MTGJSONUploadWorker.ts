/// <reference lib="webworker" />
import { expose, Transfer } from 'threads/worker';
import { pricePointRepository } from '../../data/repos';
import type { PricePoint } from '../../data/db';
import { mapFinish } from '../../utils/finishMapper';
import { Gunzip } from 'fflate';

// ---- small MTGJSON fragment we need ----
type RetailPricesByDate = Record<string, number>;
type RetailFinishes = Record<string, RetailPricesByDate>;
type MtgjsonCard = {
    paper?: { cardmarket?: { retail?: RetailFinishes } };
};

// Progress tracking
let progressPort: MessagePort | null = null;

type ProgressTick = {
  phase: 'importing-price-points';
  processedCards: number;
  totalWanted: number;
  writtenPricePoints: number;
  percentage: number;      // 0..100
  note?: string;
};

function sendProgress(p: ProgressTick) {
  try { progressPort?.postMessage(p); } catch {}
}

// ----------------- stream helpers -----------------

/** Stream a File → UTF-8 text chunks (no gzip) */
async function* streamText(file: File): AsyncGenerator<string> {
    const reader = file.stream().getReader();
    const dec = new TextDecoder();
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            yield dec.decode(value, { stream: true });
        }
    } finally {
        reader.releaseLock?.();
    }
    const tail = new TextDecoder().decode();
    if (tail) yield tail;
}

/** Stream-gunzip a File → UTF-8 text chunks (prefers native DecompressionStream, falls back to fflate) */
async function* gunzipToText(file: File): AsyncGenerator<string> {
    // Prefer native streaming
    if ('DecompressionStream' in self) {
        // @ts-ignore
        const ds = new DecompressionStream('gzip');
        // @ts-ignore
        const stream = file.stream().pipeThrough(ds);
        const reader = stream.getReader();
        const dec = new TextDecoder();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                yield dec.decode(value, { stream: true });
            }
        } finally {
            reader.releaseLock?.();
        }
        const tail = new TextDecoder().decode();
        if (tail) yield tail;
        return;
    }

    // Fallback: fflate streaming gunzip
    const reader = file.stream().getReader();
    const dec = new TextDecoder();

    let resolveChunk: ((s: string) => void) | null = null;
    let donePromise: Promise<void> | null = null;
    let doneResolve: (() => void) | null = null;

    const queue: string[] = [];
    const enqueue = (s: string) => {
        if (!s) return;
        if (resolveChunk) {
            const r = resolveChunk;
            resolveChunk = null;
            r(s);
        } else queue.push(s);
    };

    const gz = new Gunzip((chunk, final) => {
        const s = dec.decode(chunk, { stream: !final });
        enqueue(s);
        if (final) {
            const tail = dec.decode();
            if (tail) enqueue(tail);
            doneResolve?.();
        }
    });

    donePromise = new Promise<void>((r) => (doneResolve = r));

    await (async () => {
        try {
            while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                gz.push(value, false);
            }
            gz.push(new Uint8Array(0), true);
        } finally {
            reader.releaseLock?.();
        }
    })();

    while (true) {
        if (queue.length) {
            yield queue.shift()!;
            continue;
        }
        if (donePromise) {
            const next = new Promise<string>((r) => (resolveChunk = r));
            const race = await Promise.race([next, donePromise.then(() => '')]);
            if (race !== '') {
                yield race;
                continue;
            }
        }
        break;
    }
}

/** Decide if filename looks gzip. */
const looksGzip = (name: string) => /\.gz$/i.test(name);

// --------------- incremental parser ----------------
//
// Parse the giant object shape:
//
// {
//   "meta": { ... },
//   "data": {
//     "<mtgjson-uuid>": { ...card... },
//     ...
//   }
// }
//
// We keep a small rolling buffer of text, scan for keys inside "data", and when a key is in `wanted`
// we slice out **just that object**, JSON.parse it, and ingest its prices.
//


async function parseAllPricesStream(
  chunks: AsyncGenerator<string>,
  wanted: Set<string>,
  uuidToScryfallIdMap: Record<string, string>,
  batchSize: number,
  ninetyDaysAgo: Date,
  now: Date
): Promise<{ processed: number; written: number }> {
  let processedWanted = 0;
  let totalWritten = 0;

  // Normalize wanted ids to lowercase once (MTGJSON uuids are lowercase)
  const wantedLC = new Set(Array.from(wanted, (x) => x.toLowerCase()));

  // Rolling buffer
  let buf = '';
  let pos = 0;

  // Keep memory bounded
  const TRIM_THRESHOLD = 1 << 20;     // trim when consumed >1 MB
  const MAX_BUFFER_CHARS = 4 << 20;   // hard cap ~4 MB
  const LOOKBACK = 256;               // keep some tail to avoid cutting across a match

  // Strict UUID key followed by an object:  "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" : {
  // Note: whitespace allowed around the colon
  const UUID_KEY_OBJ = /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"\s*:\s*\{/i;

  // Find end index of object starting at '{' (pos at '{'), respecting strings/escapes
  const findObjEnd = (): number | null => {
    if (buf[pos] !== '{') return null;
    let i = pos;
    let depth = 0;
    let inStr = false;
    let esc = false;
    while (i < buf.length) {
      const ch = buf[i]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return i;
        }
      }
      i++;
    }
    return null; // need more data
  };

  // Ingest only when a wanted UUID is hit
  const ingestCard = async (uuid: string, objText: string) => {
    try {
      const card = JSON.parse(objText) as MtgjsonCard | undefined;
      const retail = card?.paper?.cardmarket?.retail;
      if (!retail) return;

      // Translate MTGJSON UUID to Scryfall ID for consistent cardId usage
      const scryfallId = uuidToScryfallIdMap[uuid];
      if (!scryfallId) {
        console.warn('[MTGJSONUploadWorker] No Scryfall ID found for MTGJSON UUID', uuid);
        return;
      }

      const batch: PricePoint[] = [];
      for (const [finishKey, byDate] of Object.entries(retail)) {
        const finish = mapFinish(finishKey);
        if (!finish) continue;
        for (const [dateStr, price] of Object.entries(byDate)) {
          if (typeof price !== 'number') continue;
          const d = new Date(dateStr);
          if (Number.isNaN(d.getTime()) || d < ninetyDaysAgo) continue;

          batch.push({
            id: `${uuid}:mtgjson.cardmarket:${finish}:${dateStr}`,
            cardId: scryfallId, // Use Scryfall ID instead of MTGJSON UUID
            provider: 'mtgjson.cardmarket',
            finish,
            date: dateStr,
            currency: 'EUR',
            priceCent: Math.round(price * 100),
            asOf: now,
            createdAt: now,
          });

          if (batch.length >= batchSize) {
            await pricePointRepository.bulkPut(batch);
            totalWritten += batch.length;
            batch.length = 0;
            // Send progress update after batch write
            sendProgress({
              phase: 'importing-price-points',
              processedCards: processedWanted,
              totalWanted: wantedLC.size,
              writtenPricePoints: totalWritten,
              percentage: Math.min(99, Math.round((processedWanted / Math.max(1, wantedLC.size)) * 100)),
              note: 'batch written'
            });
            // let the event loop breathe a tiny bit
            await new Promise((r) => setTimeout(r, 1));
          }
        }
      }
      if (batch.length) {
        await pricePointRepository.bulkPut(batch);
        totalWritten += batch.length;
        // Send progress update after batch write
        sendProgress({
          phase: 'importing-price-points',
          processedCards: processedWanted,
          totalWanted: wantedLC.size,
          writtenPricePoints: totalWritten,
          percentage: Math.min(99, Math.round((processedWanted / Math.max(1, wantedLC.size)) * 100)),
          note: 'batch written'
        });
      }
      processedWanted++;
      // Send progress update after finishing one wanted UUID
      sendProgress({
        phase: 'importing-price-points',
        processedCards: processedWanted,
        totalWanted: wantedLC.size,
        writtenPricePoints: totalWritten,
        percentage: Math.min(99, Math.round((processedWanted / Math.max(1, wantedLC.size)) * 100)),
        note: 'card done'
      });
    } catch (e) {
      // keep streaming on per-card issues
      // eslint-disable-next-line no-console
      console.warn('[MTGJSONUploadWorker] Skipping malformed card', uuid, e);
    }
  };

  // Optional: stop early once all wanted IDs are processed
  const remaining = new Set(wantedLC);

  for await (const chunk of chunks) {
    buf += chunk;

    // Search for UUID-key matches starting at 'pos'
    // We always search in buf.slice(pos) to avoid re-matching old text.
    while (true) {
      const slice = buf.slice(pos);
      const m = UUID_KEY_OBJ.exec(slice);
      if (!m) break;

      const matchIdx = pos + m.index;
      const uuid = m[1].toLowerCase();

      // Start of the value object is the '{' at the end of the match
      const objStart = matchIdx + m[0].length - 1;

      // Move the global pos to the object start and find its end
      const savedPos = pos;
      pos = objStart;
      const endObj = findObjEnd();
      if (endObj === null) {
        // Not enough data for the full object yet — restore pos and wait for next chunk
        pos = savedPos;
        break;
      }

      // Extract object text and ingest if we want this UUID
      if (remaining.has(uuid)) {
        const objText = buf.slice(objStart, endObj + 1);
        await ingestCard(uuid, objText);
        remaining.delete(uuid);
        if (remaining.size === 0) {
          return { processed: processedWanted, written: totalWritten };
        }
      }

      // Advance past this object and keep looking
      pos = endObj + 1;

      // Trim periodically, keeping a small lookback to avoid cutting across a `"uuid":{` match
      if (pos > TRIM_THRESHOLD || buf.length > MAX_BUFFER_CHARS) {
        const keepFrom = Math.max(0, pos - LOOKBACK);
        buf = buf.slice(keepFrom);
        pos -= keepFrom;
      }
    }

    // Also trim outside the inner loop to keep memory bounded
    if (pos > TRIM_THRESHOLD || buf.length > MAX_BUFFER_CHARS) {
      const keepFrom = Math.max(0, pos - LOOKBACK);
      buf = buf.slice(keepFrom);
      pos -= keepFrom;
    }
  }

  return { processed: processedWanted, written: totalWritten };
}

// ---------------- worker API ----------------

// Define progress message types
type ProgressMessage = 
  | { type: 'downloading-all-identifiers'; message: string; percentage: number }
  | { type: 'processing-all-identifiers'; message: string; percentage: number }
  | { type: 'downloading-all-prices'; message: string; percentage: number }
  const MTGJSON_UPLOAD_WORKER = {
    setProgressPort(port: MessagePort) {
        progressPort = port;
        // Some browsers require start() on dedicated ports (mainly for MessageChannel)
        // @ts-ignore
        progressPort.start?.();
    },
    
    async upload(file: File, wantedIds: string[], uuidToScryfallIdMap: Record<string, string>): Promise<{ processed: number; written: number }> {
        try {
            console.log(`[MTGJSONUploadWorker] Received file: ${file.name}, size: ${file.size} bytes`);
            const wantedSet = new Set(wantedIds);
            console.log(`[MTGJSONUploadWorker] Received ${wantedSet.size} wanted card IDs`);

            // choose stream based on extension (and fall back internally)
            const chunks = looksGzip(file.name) ? gunzipToText(file) : streamText(file);

            const batchSize = 2000;
            const now = new Date();
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

            const { processed, written } = await parseAllPricesStream(
                chunks,
                wantedSet,
                uuidToScryfallIdMap,
                batchSize,
                ninetyDaysAgo,
                now
            );

            sendProgress({
                phase: 'importing-price-points',
                processedCards: processed,
                totalWanted: wantedSet.size,
                writtenPricePoints: written,
                percentage: 100,
                note: 'done'
            });
            
            console.log(
                `[MTGJSONUploadWorker] Streaming parse finished. Processed ${processed} wanted cards; wrote ${written} price points.`
            );
            return { processed, written };
        } catch (err: unknown) {
            // Re-throw a simple, cloneable error back to the main thread
            const msg =
                err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err);
            console.error('[MTGJSONUploadWorker] Fatal error:', msg);
            throw new Error(msg);
        }
    },
};

expose(MTGJSON_UPLOAD_WORKER);
