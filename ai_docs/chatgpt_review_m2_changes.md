Absolutely—doing MTGJSON as a **user upload** is a great fit and avoids giant network pulls. Here’s a clean way to add it, re-using your import UX patterns (like the Cardmarket CSV wizard) and keeping memory under control.

---

# What we’ll add

1. **Wizard step**: “MTGJSON Backfill (Upload)” with a file picker that accepts:

    * `AllPrices.json` or `AllPricesToday.json`
    * Compressed `*.json.gz` (preferred—smaller)

2. **Worker**: `MTGJSONUploadWorker`

    * Decompress `.gz` in the worker (e.g. `fflate`/`pako`)
    * **Stream-parse** JSON (e.g. `clarinet`), filter to your **owned/favorited scryfall IDs** as you go
    * Emit **only** Cardmarket → paper → (nonfoil/foil/etched) daily points (last 90 days is usually enough)
    * Write to Dexie in **batches** via `bulkPut`, using your v8 schema (`id = ${cardId}:mtgjson.cardmarket:${finish}:${date}`, `priceCent`, `date`, `finish`, `currency:'EUR'`)

3. **Service wrapper**: `MTGJSONUploadService` to spawn the worker, route progress → wizard UI, and finalize.

4. **Provider precedence**: unchanged (your `PriceQueryService` will automatically “prefer” Price Guide when you have it).

---

# UX wiring (wizard step)

* Add a new tab/step alongside your CSV import:
  “**Backfill historical prices (MTGJSON upload)**”
* Guidance text: “Upload `AllPricesToday.json(.gz)` from mtgjson.com. We will only ingest printings in your collection/favorites.”
* Show file name, size, progress bar, counts: *cards matched*, *points written*, *skipped*.

---

# Worker skeleton (streaming & batched writes)

> Dependencies to add:
> `clarinet` (streaming JSON parser) + `fflate` (gzip in the browser)

```ts
// src/features/pricing/MTGJSONUploadWorker.ts
/* eslint-disable no-restricted-globals */
import { ungzip } from 'fflate';
import clarinet from 'clarinet';
import db from '@/data/db';
import { mapFinish } from '@/utils/finishMapper';

// Message in: { fileBuffer: ArrayBuffer, gz: boolean, wantedIds: string[], maxDays?: number }
self.onmessage = async (e: MessageEvent) => {
  try {
    const { fileBuffer, gz, wantedIds, maxDays = 90 } = e.data;

    // 1) Get text (decompress if needed)
    const bytes = new Uint8Array(fileBuffer);
    const raw = gz ? await gunzipToText(bytes) : new TextDecoder('utf-8').decode(bytes);

    // 2) Stream-parse JSON, filtering to wantedIds
    // MTGJSON shape: { "data": { "<scryfallId>": { "paper": { "cardmarket": { "retail": { "YYYY-MM-DD": { normal, foil, etched }}}}}}}
    const parser = clarinet.createStream();
    const BATCH_SIZE = 500;
    const batch: any[] = [];

    let inData = false;
    let currentId: string | null = null;
    let path: string[] = [];

    parser.on('key', (k: string) => { path.push(k); });
    parser.on('openobject', (k: string) => { if (k !== undefined) path.push(k); });
    parser.on('closeobject', () => { path.pop(); });
    parser.on('openarray', () => { path.push('[]'); });
    parser.on('closearray', () => { path.pop(); });

    parser.on('value', (val: any) => {
      // We don’t process primitive values directly; we’ll act when we hit a card node or retail entries.
    });

    // We’ll capture small sub-objects by listening to object starts for two kinds of nodes:
    // A) entering data root, B) entering retail date buckets
    // Simpler approach: walk stringified chunks is hard with clarinet; instead, we’ll
    // rebuild just the minimal sub-objects we need.

    // Helper to flush batches:
    const flush = async () => {
      if (batch.length) {
        await db.price_points.bulkPut(batch.splice(0, batch.length));
        (self as any).postMessage({ kind: 'progress', written: true });
      }
    };

    // FALLBACK: If you prefer clarity over fully event-driven reconstruction,
    // you can parse the top-level once and then iterate only the IDs you care about:
    //   const json = JSON.parse(raw); const data = json.data;
    //   for (const id of wantedIds) { if (!data[id]) continue; ... process ... }
    // This uses more memory but is much simpler and OK for small subsets.
    // Below is that simpler path—recommended if users upload `.json.gz` but your
    // collection is only a few thousand printings.

    const root = JSON.parse(raw);
    const data = root?.data ?? {};
    let processedIds = 0;
    for (const id of wantedIds) {
      const node = data[id];
      processedIds++;
      if (processedIds % 50 === 0) (self as any).postMessage({ kind: 'progress', processedIds });

      const retail = node?.paper?.cardmarket?.retail;
      if (!retail) continue;

      // Limit to last N days (maxDays)
      const dates = Object.keys(retail).sort().slice(-maxDays);

      for (const date of dates) {
        const row = retail[date];
        for (const key of ['normal', 'foil', 'etched'] as const) {
          const eur = row[key];
          if (eur == null) continue;

          const finish = key === 'normal' ? 'nonfoil' : key;
          batch.push({
            id: `${id}:mtgjson.cardmarket:${finish}:${date}`,
            cardId: id,
            provider: 'mtgjson.cardmarket' as const,
            finish,
            date,
            currency: 'EUR' as const,
            priceCent: Math.round(eur * 100),
            asOf: new Date(),
            createdAt: new Date()
          });

          if (batch.length >= BATCH_SIZE) await flush();
        }
      }
    }
    await flush();

    (self as any).postMessage({ kind: 'done' });
  } catch (err: any) {
    (self as any).postMessage({ kind: 'error', message: String(err?.message || err) });
  }
};

async function gunzipToText(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) =>
    ungzip(bytes, (err, out) => err ? reject(err) : resolve(new TextDecoder('utf-8').decode(out)))
  );
}
```

> Notes
> • The **simple path** above parses the JSON once (`JSON.parse(raw)`) and then iterates **only** your wanted IDs. This is acceptable if users upload the **.gz** file and your collection isn’t tens of thousands of printings.
> • If you do run into memory ceilings on iOS/Safari, switch to the fully streaming `clarinet` approach and reconstruct only the `retail` sub-objects for IDs as they appear.

---

# UI hook-up (service + view)

```ts
// src/features/pricing/MTGJSONUploadService.ts
export class MTGJSONUploadService {
  static async backfillFromUpload(file: File, wantedIds: string[], onProgress: (p: any) => void) {
    const gz = file.name.endsWith('.gz');
    const buf = await file.arrayBuffer();
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./MTGJSONUploadWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.kind === 'progress') onProgress?.(msg);
        else if (msg.kind === 'done') { worker.terminate(); resolve(); }
        else if (msg.kind === 'error') { worker.terminate(); reject(new Error(msg.message)); }
      };
      worker.postMessage({ fileBuffer: buf, gz, wantedIds, maxDays: 90 }, [buf as any]);
    });
  }
}
```

```vue
<!-- In your Import Wizard -->
<input type="file" accept=".json,.json.gz" @change="onPick" />

<script setup lang="ts">
import { MTGJSONUploadService } from '@/features/pricing/MTGJSONUploadService';
import { cardRepository } from '@/data/repos';
const progress = ref({ processedIds: 0, written: 0 });

async function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const cards = await cardRepository.getAll();
  const wanted = cards.map(c => c.id); // your scryfall ids
  await MTGJSONUploadService.backfillFromUpload(f, wanted, (p) => Object.assign(progress.value, p));
  // Optionally: toast “Backfill complete”, then prompt to run valuation snapshot
}
</script>
```

---

# Schema & precedence (already handled)

* You already moved to `price_points` v8 with provider/finish/date keys. Perfect for this.
* Ingest with `provider = 'mtgjson.cardmarket'`; your **PriceQueryService** keeps precedence:
  `cardmarket.priceguide` > `mtgjson.cardmarket` > `scryfall`.

---

# Tests (tiny fixture)

Create a 15-line **mini AllPrices** fixture and run the upload worker against it (pass `ArrayBuffer` directly), assert `bulkPut` rows.

* Validate:

    * Correct IDs: `${cardId}:mtgjson.cardmarket:nonfoil:${date}`
    * `priceCent` math
    * Only *wantedIds* are ingested
    * `maxDays` respected

---

# Gotchas & tips

* **Large file sizes**: prefer `.json.gz` from MTGJSON. Decompress in the worker.
* **Memory**: if your users have very large collections and Safari targets, consider a small helper script/server *once* to pre-filter the file for them.
* **Finish mapping**: You already have `finishMapper`; for MTGJSON it’s straightforward (normal/foil/etched).
* **Re-runs**: Use `bulkPut` (idempotent by your composite `id`).

---

# Roadmap placement

Add this as a sub-task under **M2 — Pricing throughput, history & snapshots**:

> **M2.2 — MTGJSON upload backfill**
>
> * Upload `AllPrices*.json(.gz)` and ingest only owned printings (≤90 days).
> * Worker-based decompress + (simple parse or stream-parse).
> * Idempotent `bulkPut`.
> * Progress UI & success toast.

If you want, I can sketch the *streaming* clarinet variant too—but the simple parse-per-wantedIds path above is usually sufficient and much faster to ship.
