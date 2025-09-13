Awesome—here’s a concrete, repo-fit blueprint to add **historical prices** using the sources your research identified, with minimal churn to your current architecture and lots-centric data model.&#x20;

---

# What we’ll use (from the research)

* **Cardmarket Price Guide daily snapshot** → official, daily, bulk file you can download and store as your own daily time-series (includes trend, 1-day/7-day/30-day averages). No API for “price on date X,” so you build it from the daily file.&#x20;
* **Scryfall** → today’s price only (no history); keep using for *current* EUR price but not for backfill.&#x20;
* **MTGJSON AllPrices (or MTGGraphQL)** → up to **90 days** of daily history per printing, incl. foil vs non-foil, Cardmarket included; great for a **first-run backfill**, then switch to Cardmarket’s daily snapshot to extend history beyond 90 days.&#x20;

---

# Data model (Dexie) — minimal, future-proof

Add a finish-aware, provider-scoped time series table. (You already store price points—this tightens keys and adds fields we’ll need.)

```ts
// db.schema.ts (Dexie)
price_points: {
  id: string;           // `${cardId}:${provider}:${finish}:${dateISO}`
  cardId: string;       // local card UUID (printing)
  provider: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide';
  finish: 'nonfoil' | 'foil' | 'etched';
  date: string;         // 'YYYY-MM-DD'
  currency: 'EUR';
  priceCent: number;    // integer cents
  // Optional aggregates if source exposes them (Cardmarket file):
  avg1dCent?: number;
  avg7dCent?: number;
  avg30dCent?: number;
  sourceRev?: string;   // e.g., priceguide file build date / MTGJSON version
  createdAt: number;
  updatedAt: number;
}
```

**Identity mapping**

* Persist the **Cardmarket product ID(s)** and/or **MTGJSON UUID** on each `card` (printing) if not already stored.
* If you can’t persist both, keep a small **provider\_id\_map** table: `{ cardId, provider, providerId }`.

---

# Ingestion strategy (fast + reliable)

## Phase A — One-time bootstrap (90-day backfill)

1. For all **owned printings** (lots > 0 or ever held), resolve **MTGJSON UUID**.
2. Pull **90 days** of Cardmarket history for those printings from **MTGJSON** (bulk AllPrices.json or their GraphQL).
3. Upsert into `price_points` per `(cardId, provider='mtgjson.cardmarket', finish, date)`.

> Why: instant history without waiting 90 days; finish-aware and official-enough.&#x20;

## Phase B — Ongoing daily extension (beyond 90 days)

1. Add a **PriceGuideSyncWorker** that downloads the **Cardmarket daily price guide** (CSV/JSON).
2. Filter rows to **only the Cardmarket product IDs** you care about (printings you own or favorited).
3. For each row & finish, map → `cardId` and write a daily point with `provider='cardmarket.priceguide'`, filling `priceCent`, and any `avg*` fields present.
4. Schedule via:

    * **Service Worker Periodic Sync** if available; else
    * App-level timer when the PWA is opened (respect a 24h TTL).

> This builds your own long-term series. No scraping; officially supported file.&#x20;

## Phase C — Today’s price (unchanged)

* Keep **Scryfall** for the “now” price used in quick UI views; also store it into `price_points` for today with `provider='scryfall'`. (Treat it as volatile—Cardmarket sources are your canonical history.)&#x20;

---

# Provider precedence & dedupe

When querying a date range:

1. Prefer **Cardmarket Price Guide** if that exact date exists.
2. Else prefer **MTGJSON (Cardmarket)** if within the last \~90 days.
3. Else fall back to **Scryfall** for “today” only (no historical).

Upsert rule: overwrite by **(cardId, provider, finish, date)**; never cross-overwrite between providers.

---

# Mapping details (important edge cases)

* **Finish awareness**: MTGJSON separates non-foil vs foil; Cardmarket’s files often expose finishes via distinct product variants. Normalize both to your three finishes (`nonfoil/foil/etched`).&#x20;
* **Language**: price series are market prices; don’t split by language in the series (too sparse).
* **Currencies**: fix to **EUR** for Cardmarket/Scryfall; store currency anyway for future cases.
* **Missing IDs**: if a printing lacks a Cardmarket product ID, fill it once (your Scryfall batch-by-Cardmarket-ID flow is already in place); persist for future syncs.

---

# UI & analytics

* **Price chart** on Card Details:

    * Toggle **provider** (Cardmarket vs MTGJSON) and **finish**.
    * Overlay **avg7/avg30** from Price Guide when available (dashed lines).&#x20;
* **Collection analytics**:

    * Use your existing valuation snapshots, but now you can rebuild a point-in-time valuation by joining lots to **that day’s** price point.
    * Your new filters (timeframe, set, purchase group) will “just work” with historical joins.

---

# Pseudocode (worker orchestration)

```ts
// priceHistoryOrchestrator.ts
export async function runDailyPriceHistorySync() {
  if (!shouldRun('price-history', { ttlHours: 24 })) return;

  const cards = await cardsRepo.getCardsNeedingHistory(); // owned/ever owned
  const needMkmIds = cards.filter(c => !c.cardmarketId);
  if (needMkmIds.length) await enrichWithCardmarketIds(needMkmIds);

  await ingestCardmarketPriceGuide(cards); // Phase B
  await scheduleValuationSnapshot('daily'); // optional: create daily snapshot post-sync
}
```

```ts
// ingestCardmarketPriceGuide.ts
export async function ingestCardmarketPriceGuide(cards: Card[]) {
  const guide = await downloadPriceGuideFile();   // CSV or JSON
  const indexByMkmId = indexBy(guide.rows, 'productId');

  for (const card of cards) {
    const rows = indexByMkmId[card.cardmarketId] ?? [];
    for (const row of rows) {
      const finish = mapFinish(row); // nonfoil/foil/etched
      const date = guide.date;       // e.g., '2025-09-13'
      const id = `${card.id}:cardmarket.priceguide:${finish}:${date}`;
      await db.price_points.put({
        id, cardId: card.id, provider: 'cardmarket.priceguide',
        finish, date, currency: 'EUR',
        priceCent: toCent(row.trendPrice),
        avg1dCent: toCent(row.avg1d),
        avg7dCent: toCent(row.avg7d),
        avg30dCent: toCent(row.avg30d),
        sourceRev: guide.build, createdAt: now(), updatedAt: now(),
      });
    }
  }
}
```

---

# Tests (additions)

* **Mapping**: productId→cardId; finish mapping is correct; unknown product IDs are skipped gracefully.
* **Upserts**: same (cardId, provider, finish, date) is idempotent.
* **Precedence**: when both providers have the date, your query picks Price Guide first.
* **Charts**: finish toggle shows the right series; avg7/avg30 lines render when present.
* **Valuation**: point-in-time valuation uses the correct provider/date and respects filters (timeframe, set, purchase group).

---

# Migrations & rollout plan

1. **Schema bump** for `price_points` (finish & provider in the PK) + optional `provider_id_map`.
2. **Backfill job (one-shot)** using MTGJSON for the last 90 days (owned printings only).&#x20;
3. **Daily sync** from Cardmarket Price Guide via SW Periodic Sync (with app-fallback timer + TTL).&#x20;
4. **UI**: price chart controls + analytics joins.
5. **Docs**: note data sources and precedence; no scraping required.&#x20;

---

## Why this fits your codebase

* It keeps **lots** as the inventory truth and only augments the **price points** layer.
* It matches your existing **worker + Dexie** pattern and your earlier plan to add **background/periodic** updates.
* It gives you **instant history (90d)** and then **grows your own** official daily series indefinitely—no vendor lock-in, no scraping.&#x20;

If you want, I can turn this into PR-ready patches (schema + migration, MTGJSON backfill worker, PriceGuide sync worker, chart/UI toggle, and tests).
