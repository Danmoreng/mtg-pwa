import { spawn, Thread, Transfer } from 'threads';
import { cardRepository, settingRepository } from '../../data/repos';
import MTGJSONUploadWorker from './MTGJSONUploadWorker?worker';
import { gunzipSync, strFromU8 } from 'fflate';

type IdMap = Record<string, string>; // scryfallId or scryfallOracleId -> mtgjson uuid

const ID_MAP_SETTING_KEY = 'mtgjson.idMap.v1';
const ALL_IDENTIFIERS_URL = 'https://mtgjson.com/api/v5/AllIdentifiers.json.gz';
const ALL_PRICES_URL = 'https://mtgjson.com/api/v5/AllPrices.json.gz';

/**
 * Build a Scryfall(SF/Oracle) -> MTGJSON UUID map from a variety of known AllIdentifiers shapes.
 *
 * Known shapes:
 *  A) { data: Array<{ uuid, identifiers: { scryfallId, scryfallOracleId, ... } }> }
 *  B) { data: { [uuid]: { identifiers: { scryfallId, scryfallOracleId, ... } } } }
 *  C) { [uuid]: { identifiers: {...} } }   // rare / legacy
 */
function buildIdMapFromAllIdentifiers(json: any): IdMap {
  const map: IdMap = {};
  const data = json?.data ?? json;

  const addEntry = (uuid: string | undefined, entry: any) => {
    if (!uuid || !entry) return;
    const ids = entry.identifiers ?? entry; // sometimes identifiers are directly on the object
    const sf: string | undefined = ids?.scryfallId;
    const oracle: string | undefined = ids?.scryfallOracleId;
    if (sf) map[sf] = uuid;
    if (oracle) map[oracle] = uuid;
  };

  if (Array.isArray(data)) {
    for (const e of data) {
      const uuid: string | undefined = e?.uuid ?? e?.cardId ?? e?.id;
      addEntry(uuid, e);
    }
  } else if (data && typeof data === 'object') {
    // object keyed by uuid
    for (const [uuid, e] of Object.entries<any>(data)) {
      addEntry(uuid, e);
    }
  } else {
    throw new Error('[MTGJSONUploadService] Unrecognized AllIdentifiers format (no array/object).');
  }

  if (Object.keys(map).length === 0) {
    // Dump a tiny hint to logs for debugging
    const sampleKeys = data && typeof data === 'object' ? Object.keys(data).slice(0, 5) : [];
    console.warn('[MTGJSONUploadService] AllIdentifiers parsed but no entries found. Sample keys:', sampleKeys);
    throw new Error('[MTGJSONUploadService] Parsed AllIdentifiers but produced an empty id map.');
  }

  return map;
}

// Define progress types
type ProgressType = 
  | 'downloading-all-identifiers'
  | 'processing-all-identifiers'
  | 'downloading-all-prices'
  | 'importing-price-points'
  | 'completed';

type ProgressInfo = {
  type: ProgressType;
  message: string;
  percentage?: number;
};

async function loadIdMap(progressCallback: (info: ProgressInfo) => void): Promise<IdMap> {
  // 1) Try cache
  try {
    const cached = await settingRepository.get(ID_MAP_SETTING_KEY);
    if (cached && typeof cached === 'object') {
      console.log('[MTGJSONUploadService] Using cached AllIdentifiers id map.');
      progressCallback({
        type: 'downloading-all-identifiers',
        message: 'Using cached AllIdentifiers mapping...',
        percentage: 50
      });
      progressCallback({
        type: 'processing-all-identifiers',
        message: 'Processing cached AllIdentifiers mapping...',
        percentage: 75
      });
      progressCallback({
        type: 'processing-all-identifiers',
        message: 'AllIdentifiers mapping processed',
        percentage: 100
      });
      return cached as IdMap;
    }
  } catch (e) {
    console.warn('[MTGJSONUploadService] Could not read cached id map:', e);
  }

  // 2) Download and build
  progressCallback({
    type: 'downloading-all-identifiers',
    message: 'Downloading AllIdentifiers.json.gz...',
    percentage: 0
  });
  
  console.log('[MTGJSONUploadService] Downloading AllIdentifiers.json.gz...');
  const res = await fetch(ALL_IDENTIFIERS_URL, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(
      `[MTGJSONUploadService] Failed to fetch AllIdentifiers.json.gz: ${res.status} ${res.statusText}`
    );
  }
  
  // Track download progress for AllIdentifiers
  const contentLength = res.headers.get('content-length');
  const total = parseInt(contentLength || '0', 10);
  let loaded = 0;
  
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  
  if (reader && total) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      // 0-50% for download progress
      const percentage = Math.round((loaded / total) * 50);
      progressCallback({
        type: 'downloading-all-identifiers',
        message: `Downloading AllIdentifiers.json.gz... (${formatFileSize(loaded)} / ${formatFileSize(total)})`,
        percentage
      });
    }
  } else {
    // Fallback if we can't track progress
    const gz = new Uint8Array(await res.arrayBuffer());
    progressCallback({
      type: 'downloading-all-identifiers',
      message: 'Downloaded AllIdentifiers.json.gz',
      percentage: 50
    });
    
    progressCallback({
      type: 'processing-all-identifiers',
      message: 'Processing AllIdentifiers mapping...',
      percentage: 60
    });
    
    const text = strFromU8(gunzipSync(gz));
    const json = JSON.parse(text);

    // Build the map defensively (supports multiple shapes)
    const map = buildIdMapFromAllIdentifiers(json);

    // Show more progress
    progressCallback({
      type: 'processing-all-identifiers',
      message: 'Caching AllIdentifiers mapping...',
      percentage: 80
    });

    // 3) Cache it for later runs
    try {
      await settingRepository.set(ID_MAP_SETTING_KEY, map);
    } catch (e) {
      console.warn('[MTGJSONUploadService] Could not cache id map:', e);
    }

    progressCallback({
      type: 'processing-all-identifiers',
      message: 'AllIdentifiers mapping processed',
      percentage: 100
    });
    
    console.log(
      `[MTGJSONUploadService] Built AllIdentifiers id map with ${Object.keys(map).length} entries.`
    );
    return map;
  }
  
  // Combine chunks into a single blob
  const allChunks = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }
  
  progressCallback({
    type: 'downloading-all-identifiers',
    message: 'Downloaded AllIdentifiers.json.gz',
    percentage: 50
  });
  
  const text = strFromU8(gunzipSync(allChunks));
  const json = JSON.parse(text);

  // Show progress during processing (50-100%)
  progressCallback({
    type: 'processing-all-identifiers',
    message: 'Processing AllIdentifiers mapping...',
    percentage: 60
  });

  // Build the map defensively (supports multiple shapes)
  const map = buildIdMapFromAllIdentifiers(json);

  // Show more progress
  progressCallback({
    type: 'processing-all-identifiers',
    message: 'Caching AllIdentifiers mapping...',
    percentage: 80
  });

  // 3) Cache it for later runs
  try {
    await settingRepository.set(ID_MAP_SETTING_KEY, map);
  } catch (e) {
    console.warn('[MTGJSONUploadService] Could not cache id map:', e);
  }

  progressCallback({
    type: 'processing-all-identifiers',
    message: 'AllIdentifiers mapping processed',
    percentage: 100
  });
  
  console.log(
    `[MTGJSONUploadService] Built AllIdentifiers id map with ${Object.keys(map).length} entries.`
  );
  return map;
}

export class MTGJSONUploadService {
  static async upload(file: File | 'auto', progressCallback: (info: ProgressInfo) => void): Promise<void> {
    console.log(`[MTGJSONUploadService] Starting upload for file: ${file === 'auto' ? 'AUTOMATIC DOWNLOAD' : file.name}`);
    let uploadWorker: any = null;

    try {
      console.log('[MTGJSONUploadService] Spawning worker...');
      // Add a 5-minute timeout for worker initialization
      uploadWorker = await spawn(new MTGJSONUploadWorker(), { timeout: 300000 });
      console.log('[MTGJSONUploadService] Worker spawned.');

      console.log('[MTGJSONUploadService] Fetching wanted cards from DB...');
      const cards = await cardRepository.getAll();
      console.log(`[MTGJSONUploadService] Found ${cards.length} cards.`);

      // Resolve Scryfall IDs -> MTGJSON UUIDs using AllIdentifiers
      const idMap = await loadIdMap(progressCallback);

      // Prefer exact printing (scryfall id), fall back to oracle id when needed
      const wantedUuids = Array.from(
        new Set(
          cards
            .map((c: any) => idMap[c.id] || (c.oracleId ? idMap[c.oracleId] : undefined))
            .filter(Boolean) as string[]
        )
      );

      console.log(
        `[MTGJSONUploadService] Resolved ${wantedUuids.length} MTGJSON UUIDs from ${cards.length} cards.`
      );

      if (wantedUuids.length === 0) {
        console.warn(
          '[MTGJSONUploadService] No MTGJSON UUIDs resolved from local cards. Check that your cards contain Scryfall ids/oracleIds and that AllIdentifiers was parsed correctly.'
        );
      }

      // Create reverse mapping from MTGJSON UUIDs to Scryfall IDs
      const uuidToScryfallIdMap: Record<string, string> = {};
      for (const card of cards) {
        const uuid = idMap[card.id] || (card.oracleId ? idMap[c.oracleId] : undefined);
        if (uuid) {
          uuidToScryfallIdMap[uuid] = card.id;
        }
      }

      // Handle automatic download
      let fileToProcess: File;
      if (file === 'auto') {
        console.log('[MTGJSONUploadService] Downloading AllPrices.json.gz automatically...');
        progressCallback({
          type: 'downloading-all-prices',
          message: 'Downloading AllPrices.json.gz...',
          percentage: 0
        });
        
        const response = await fetch(ALL_PRICES_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(
            `[MTGJSONUploadService] Failed to fetch AllPrices.json.gz: ${response.status} ${response.statusText}`
          );
        }
        
        // Track download progress
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength || '0', 10);
        let loaded = 0;
        
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        
        if (reader && total) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;
            
            const percentage = Math.round((loaded / total) * 100);
            progressCallback({
              type: 'downloading-all-prices',
              message: `Downloading AllPrices.json.gz... (${formatFileSize(loaded)} / ${formatFileSize(total)})`,
              percentage
            });
          }
        } else {
          // Fallback if we can't track progress
          const arrayBuffer = await response.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: 'application/gzip' });
          fileToProcess = new File([blob], 'AllPrices.json.gz', { type: 'application/gzip' });
        }
        
        // Combine chunks into a single blob
        const allChunks = new Uint8Array(loaded);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }
        
        const blob = new Blob([allChunks], { type: 'application/gzip' });
        fileToProcess = new File([blob], 'AllPrices.json.gz', { type: 'application/gzip' });
        console.log(`[MTGJSONUploadService] Downloaded AllPrices.json.gz (${fileToProcess.size} bytes)`);
      } else {
        fileToProcess = file;
      }

      console.log('[MTGJSONUploadService] Calling worker.upload()...');
      progressCallback({
        type: 'importing-price-points',
        message: 'Importing price points...',
        percentage: 0
      });
      
      try {
        // Set up MessageChannel for progress updates
        const channel = new MessageChannel();
        
        // Tell the worker where to send progress
        await uploadWorker.setProgressPort(Transfer(channel.port2, [channel.port2]));
        
        // Pipe progress events into our existing callback
        channel.port1.onmessage = (ev) => {
          const p = ev.data as {
            phase: 'importing-price-points';
            processedCards: number;
            totalWanted: number;
            writtenPricePoints: number;
            percentage: number;
            note?: string;
          };
          progressCallback({
            type: 'importing-price-points',
            message: `Processing ${p.processedCards}/${p.totalWanted} cards — ${p.writtenPricePoints.toLocaleString()} price points`,
            percentage: p.percentage
          });
        };
        
        const result = await uploadWorker.upload(fileToProcess, wantedUuids, uuidToScryfallIdMap);
        
        console.log(
          `[MTGJSONUploadService] Worker finished processing. ${result.processed} cards processed, ${result.written} price points written.`
        );
        
        progressCallback({
          type: 'completed',
          message: `Import finished! ${result.processed} cards, ${result.written.toLocaleString()} price points.`,
          percentage: 100,
          // include machine-readable numbers for the UI:
          processedCards: result.processed,
          writtenPricePoints: result.written
        } as any);
      } catch (error) {
        console.error('[MTGJSONUploadService] Worker returned an error:', error);
        throw error;
      }
    } catch (error) {
      console.error('[MTGJSONUploadService] An error occurred in the upload service:', error);
      throw error;
    } finally {
      if (uploadWorker) {
        console.log('[MTGJSONUploadService] Terminating worker.');
        try {
          await Thread.terminate(uploadWorker);
        } catch (terminateError) {
          console.error('[MTGJSONUploadService] Error terminating worker:', terminateError);
        }
      }
    }
  }
}

// Helper function for formatting file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
