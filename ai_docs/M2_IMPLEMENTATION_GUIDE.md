## Milestone 2 Implementation Guide (v3)

### Overview

Fast daily pricing with **finish-aware time series**, **historical backfill**, **source precedence**, and **automatic valuation snapshots**. Works offline, is idempotent, and scales.

**Note**: Based on product owner feedback, we've simplified the architecture to have a single type of price (euro) with different sources rather than multiple providers with switching capabilities.

---

### Current Status

✅ **Partially Implemented**

* Scryfall collection batching.
* Finish-aware price points.
* Basic valuation snapshots.
* Simplified source-based pricing model.

❌ **Missing**

* Schema + migration for source/finish/date key.
* MTGJSON historical backfill (upload).
* Daily Cardmarket Price Guide ingestion.
* Source precedence enforcement.
* Chart finish toggles with avg overlays.
* Periodic scheduling with TTL.

---

## Roadmap

### Phase 1 — Schema & Migration

**1.1 PricePoint interface**

```ts
export interface PricePoint {
  id: string; // `${cardId}:${source}:${finish}:${date}`
  cardId: string;
  source: 'scryfall' | 'mtgjson' | 'cardmarket'; // Simplified sources instead of providers
  finish: 'nonfoil' | 'foil' | 'etched';
  date: string;        // 'YYYY-MM-DD' (time-series key)
  currency: 'EUR';
  priceCent: number;   // integer cents
  avg1dCent?: number;
  avg7dCent?: number;
  avg30dCent?: number;
  sourceRev?: string;  // file build/version
  asOf: Date;          // when we recorded the point
  createdAt: Date;
}
```

**1.2 Dexie schema (v8) & indexes**

* Add both `"[cardId+date]"` and `"[cardId+source+finish+date]"`.
* Keep `"[cardId+asOf]"` only for troubleshooting.

```ts
this.version(8).stores({
  // ...other tables...
  price_points: `
    id, cardId, source, finish, date, currency, priceCent, asOf, createdAt,
    [cardId+date],
    [cardId+asOf],
    [source+asOf],
    [cardId+source+finish+date]
  `
}).upgrade(async tx => {
  const t = tx.table('price_points');
  const rows = await t.toArray();
  for (const r of rows) {
    // price → priceCent (convert decimals to cents when needed)
    if (r.priceCent == null && r.price != null) {
      const isDecimal = typeof r.price === 'number' && r.price < 1000;
      r.priceCent = isDecimal ? Math.round(r.price * 100) : r.price;
      delete r.price;
    }

    // derive finish/date/source/id from old shapes
    let finish: 'nonfoil'|'foil'|'etched' = r.finish ?? 'nonfoil';
    let date = r.date ?? (r.asOf ? new Date(r.asOf).toISOString().slice(0,10) : undefined);
    const parts = String(r.id ?? '').split(':'); // legacy ids
    const maybeFinish = parts[2];
    const maybeDate = parts[3] ?? parts[2];
    if (maybeFinish === 'foil' || maybeFinish === 'etched') finish = maybeFinish;
    if (/^\d{4}-\d{2}-\d{2}$/.test(maybeDate)) date = maybeDate;

    // Convert provider to source (simplified model)
    let source: 'scryfall' | 'mtgjson' | 'cardmarket' = 'scryfall';
    if (r.provider) {
      if (r.provider === 'mtgjson.cardmarket') {
        source = 'mtgjson';
      } else if (r.provider === 'cardmarket.priceguide') {
        source = 'cardmarket';
      } else {
        source = 'scryfall';
      }
    }
    
    r.finish = finish;
    r.source = source;
    r.date = date ?? new Date().toISOString().slice(0,10);
    r.currency = r.currency ?? 'EUR';
    r.createdAt = r.createdAt ?? new Date();
    r.asOf = r.asOf ?? new Date();
    r.id = `${r.cardId}:${source}:${finish}:${r.date}`;

    await t.put(r);
  }
});
```

> If Cardmarket product IDs aren’t on `card`, add a small `provider_id_map` or persist them on `card` now.

---

### Phase 2 — Historical Backfill (MTGJSON upload)

**UX**

* Wizard step: “Backfill historical prices (upload MTGJSON AllPricesToday.json(.gz)).”
* Show file size, progress, matched IDs, points written, skipped.

**Worker approach**

* Decompress `.gz` in worker (`fflate`).
* Parse once and **only iterate owned/ever-owned IDs** (keeps memory sane).
* Extract **last 90 days** of `paper.cardmarket.retail` by `normal/foil/etched`.
* `bulkPut` to `price_points` with `provider='mtgjson.cardmarket'`.

**Feature flag**

* Gate behind `VITE_ENABLE_MTGJSON_UPLOAD`.

> For very large libraries or Safari memory limits, switch to a streaming parser later.

---

### Phase 3 — Daily Cardmarket Price Guide

**Ingestion**

* Either: download the **daily price guide** (preferred, single file), or support a **user upload** similarly to MTGJSON.
* Filter to relevant product IDs; map to `cardId`.
* Upsert `price_points` with `provider='cardmarket.priceguide'`; fill `avg7dCent`/`avg30dCent` when present.

**Scheduling**

* `PriceGuideScheduler.syncIfNecessary()` checks `settings['last_priceguide_sync_timestamp']` and 24h TTL.
* Use **SW Periodic Sync** when available; fallback to an app-timer.

**Feature flag**

* Gate behind `VITE_ENABLE_PRICEGUIDE_SYNC`.

---

### Phase 4 — Provider Precedence & Queries

**Precedence**

1. `cardmarket.priceguide` (by date)
2. `mtgjson.cardmarket` (past \~90 days)
3. `scryfall` (today only)

**Query rules**

* Sort by **precedence**, then **`date` desc**, then **`asOf`** as tie-breaker.
* For **point-in-time**: query `where('[cardId+provider+finish+date]')` for the specific `date`.

**Implementation tips**

* Add an overload `getLatestPriceForCard(cardId, preferredFinish?)` to prefer lot finish.

---

### Phase 5 — UI & Charts

**Controls**

* Finish toggle (nonfoil/foil/etched) + Provider toggle (Price Guide / MTGJSON / Scryfall).
* Date range (optional).
* Auto-select the **first provider/finish** that has data for the card.

**Charts**

* Use `date` for labels.
* Keep datasets aligned; output **`null`** where avg values are missing.
* Consider Chart.js **decimation** plugin for big series.

---

### Phase 6 — Valuation & Snapshots

* When valuing a lot, **prefer lot.finish**; fallback to any finish if none found.
* After each successful pricing update/backfill, create a **valuation snapshot**.
* Analytics pages use **provider precedence** and `date` to build point-in-time values.

---

### Phase 7 — Tests & Perf

**Unit**

* Provider ID mapping, finish mapping, precedence.
* Idempotent upserts keyed by `(cardId, provider, finish, date)`.
* Price for date (index query) and latest price with precedence.
* Lot valuation prefers finish.

**Integration**

* MTGJSON upload worker with tiny fixture.
* Price Guide ingestion with synthetic file.
* Chart renders with toggles, avg overlay alignment.

**Performance**

* 5k cards update ≤5m P50 / ≤10m P95.
* Upload backfill stays < device memory thresholds; measure worker time.

**CI**

* Add a perf smoke test and a migration test (v7 → v8).

---

## Technical details (snippets)

**Price query (date-aware + precedence)**

```ts
import Dexie from 'dexie';
import db from '@/data/db';
import { Money } from '@/core/Money';

const PRECEDENCE = ['cardmarket.priceguide', 'mtgjson.cardmarket', 'scryfall'] as const;

function sortByPrecedence(a:any,b:any){
  const pa = PRECEDENCE.indexOf(a.provider as any); const pb = PRECEDENCE.indexOf(b.provider as any);
  if (pa !== pb) return pa - pb;
  const d = a.date.localeCompare(b.date); if (d !== 0) return -d; // newest first
  return new Date(b.asOf).getTime() - new Date(a.asOf).getTime();
}

export async function getPriceForDate(cardId: string, date: string) {
  const pts = await db.price_points
    .where('[cardId+provider+finish+date]')
    .between([cardId, Dexie.minKey, Dexie.minKey, date],
             [cardId, Dexie.maxKey, Dexie.maxKey, date])
    .toArray();
  if (!pts.length) return null;
  pts.sort(sortByPrecedence);
  const p = pts[0];
  return { money: new Money(p.priceCent, p.currency), provider: p.provider, finish: p.finish };
}
```

**Chart alignment**

```ts
const labels = series.map(p => p.date);
const price = series.map(p => toEur(p.priceCent));
const avg7  = series.map(p => p.avg7dCent  != null ? toEur(p.avg7dCent)  : null);
const avg30 = series.map(p => p.avg30dCent != null ? toEur(p.avg30dCent) : null);
```

**Scheduler TTL**

```ts
const key = 'last_priceguide_sync_timestamp';
const last = await settingRepository.get(key);
if (!last || (Date.now() - new Date(last).getTime())/36e5 >= 24) {
  await PriceGuideSyncWorker.syncPriceGuide();
  await settingRepository.set(key, new Date().toISOString());
}
```

---

## Acceptance Criteria

**Performance**

* Backfill: ≥95% of owned printings get ≥90 daily points after upload.
* Daily sync success ≥97% (30-day rolling).
* 5k cards ≤5m P50 / ≤10m P95.
* Snapshot ≤60s after update completion.

**Data quality**

* Precedence honored for same-date overlaps.
* Lot valuation prefers matching finish.

**UX**

* Chart toggles (finish/provider) and avg overlays.
* Clear progress + cancel during upload/sync.
* Offline-friendly; no UI blocking on live APIs.

---

## Risks & Mitigations

* **Large files / memory** → .gz upload, owned-IDs filtering, optional streaming parse, worker only.
* **Upstream format drift** → parse through adapters + schema validation; feature flags; fallback to Scryfall-today.
* **DB growth** → daily rows: `Ncards × finishes`. Consider optional compaction (e.g., keep daily for 180d, weekly beyond).
* **Periodic sync availability** → SW Periodic Sync where supported; app-timer with TTL everywhere.

---

## Next Steps (sequenced)

1. Apply schema + **migration** (v8) and indexes.
2. Implement **MTGJSON upload** worker + wizard step (flagged).
3. Implement **Price Guide ingestion** + scheduler + TTL (flagged).
4. Wire **provider precedence** (queries, valuation).
5. Upgrade **charts** (finish/provider toggles, aligned averages).
6. Tests (unit + integration + perf) and fix paths/aliases.
7. Docs: ARCHITECTURE, IMPORTERS, MIGRATION\_M2.
8. Canary rollout with flags → enable by default after validation.
