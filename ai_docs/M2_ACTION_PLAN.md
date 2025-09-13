Here’s a crisp, code-aware review of **main → m2-implementation** focused on Milestone 2 (pricing history + MTGJSON), plus exactly what to change before merging.

---

## TL;DR (one screen)

* **What got better in `m2`:** Scryfall **batch** pricing + tests, a **finish-aware** time‑series table shape and a first pass at precedence queries and valuations. &#x20;
* **What’s still missing/buggy:** MTGJSON **upload/backfill** is only a stub; Cardmarket Price Guide ingestion is stubbed; schema & indexes are **inconsistent** (`provider` vs `source`, key formats); and there’s a small **runtime bug** in `PriceUpdateService`.  &#x20;
* **Your idea (“let the user download MTGJSON AllPrices and upload it”) is correct.** The repo already has a blueprint for an **upload worker**; it just isn’t wired into code. Implement that path and unify schema/precedence before merge.&#x20;

---

## What changed from `main` → `m2` (relevant to M2)

1. **Scryfall batch pricing**

    * `ScryfallProvider.getPricesByIds` + tests land in both branches, but `m2` wires them into price updates with a daily key. Good.  &#x20;
2. **Time‑series intent**

    * `main` still writes price points with **no `date` field** (and stores `price`, not `priceCent`). IDs also mix finish/date order (e.g. `…:scryfall:YYYY-MM-DD` vs `…:scryfall:YYYY-MM-DD:foil`).&#x20;
    * `m2` moves toward **finish-aware** points and a `${cardId}:{…}:{finish}:{date}` key and `priceCent`—exactly what M2 needs.&#x20;
3. **Schema direction**

    * Docs in both branches define the target table and precedence (Cardmarket Price Guide > MTGJSON(Cardmarket) > Scryfall). In `main` they call the field **`provider`** with dotted values (`cardmarket.priceguide`, `mtgjson.cardmarket`). &#x20;
    * `m2` starts renaming to **`source`** (`'cardmarket'|'mtgjson'|'scryfall'`) and ships a **v8 Dexie** shape + migration that converts older rows to `source` and rebuilds IDs. (Good migration mechanics, but it diverges from the earlier “provider.\*” plan.) &#x20;
4. **Precedence & queries**

    * `m2` adds a `PriceQueryService` that sorts by **source** precedence. One method queries by a **non‑existent index** (`[cardId+finish+date]`), which will perform poorly or fail. The repositories/indexes expose `[cardId+date]` and `[cardId+source+finish+date]`. &#x20;
5. **Backfill & daily extension (stubs)**

    * `MTGJSONBackfillService` and `PriceGuideSyncService/Scheduler` exist only as **stubs**; both use invalid destructuring: `const { type, .result } = e.data;`. Worker paths also don’t match real worker files. &#x20;
    * The plan to do **user‑driven MTGJSON upload** is written up in `ai_docs` (worker + service + wizard step) but not implemented as runtime code.&#x20;
6. **Valuation/Scheduling**

    * `m2` calls `ValuationEngine.createValuationSnapshot()` after price updates (good), and pings a scheduler hook for the price guide, but the scheduler currently **always** says “needs sync” and doesn’t use TTL. A proper TTL example is documented.  &#x20;

---

## Bugs & pitfalls you should fix before merge

1. **Undefined variable in `PriceUpdateService` (m2)**

    * Non‑foil path uses `finish` without defining it:
      `const pricePointId = \`\${cardId}\:scryfall:\${finish}:\${dateStr}\``. Set `finish = 'nonfoil'\`.&#x20;
2. **Worker stubs won’t run**

    * Both backfill/sync services destructure `e.data` with `.{result}` (syntax error), and reference worker paths that don’t exist. Replace with a real upload worker for MTGJSON and a real ingestion path for Price Guide. &#x20;
3. **Index mismatch in queries**

    * `getPriceForDateAndFinish` uses `[cardId+finish+date]` which isn’t defined; use `[cardId+source+finish+date]` (or add the index if you truly need it). &#x20;
4. **Naming drift (`provider` vs `source`)**

    * Docs/tests/blueprints use **`provider` with dotted names** (e.g., `mtgjson.cardmarket`), while `m2` code migrates to **`source`** with coarse names. Pick **one** across DB, repos, services, queries, and tests. (I recommend reverting to **`provider`** because your precedence and ingestion paths reference specific providers, not just origins.)  &#x20;
5. **`main` still writes old price shape**

    * `main` writes `price` (not `priceCent`) and inconsistent IDs. Migrate to `${cardId}:${provider}:${finish}:${date}`, `priceCent`, `date`, `finish`.&#x20;

---

## The right way to handle MTGJSON (aligns with your request)

You proposed prompting the user to **download MTGJSON AllPrices** and let the app **import the file**. That’s the best fit: it avoids huge network pulls/CORS, works offline, and gives instant 90‑day history. The repo already includes a **concrete blueprint**:

* **Worker** `MTGJSONUploadWorker.ts`: decompress `.json.gz` (e.g. `fflate`), stream/parse just the needed nodes, and **bulkPut** `(cardId, provider='mtgjson.cardmarket', finish, date, priceCent)` for the **last 90 days** of `paper.cardmarket.retail`.&#x20;
* **Service** `MTGJSONUploadService` + **wizard step** with a file picker (`accept=".json,.json.gz"`) and progress callbacks.&#x20;

> The doc also shows a **simple (non‑streaming) implementation** that parses once and iterates only your `wantedIds` (owned/ever‑owned printings). Use streaming later if memory becomes an issue.&#x20;

---

## Action plan to get a “good” M2 implementation (ready to merge)

### A. Lock the **data model** & migration

1. **Choose one field name: `provider` (recommended).**
   Use values: `'cardmarket.priceguide' | 'mtgjson.cardmarket' | 'scryfall'`. Update `db.ts`, repositories, query services, and migrations accordingly. (If you keep `source`, mirror the same precedence and indexes.) &#x20;
2. **Finalize Dexie v8**:

    * `price_points` PK/ID: `${cardId}:${provider}:${finish}:${date}`
    * Columns: `cardId, provider, finish, date, currency='EUR', priceCent, sourceRev?, asOf, createdAt`
    * Indexes: `[cardId+provider+finish+date]`, `[cardId+date]`, `[cardId+asOf]`, `[provider+asOf]`.
      The `m2` migration code is a good start—keep the `price→priceCent` conversion and ID rebuild. &#x20;

### B. Implement **MTGJSON upload backfill** (90 days)

1. Add **`src/features/pricing/MTGJSONUploadWorker.ts`** per the blueprint; ingest **only** scryfall IDs in the user’s collection, mapping `normal→nonfoil` and persisting `provider='mtgjson.cardmarket'`. Emit progress messages (`processedIds`, `written`).&#x20;
2. Add **`src/features/pricing/MTGJSONUploadService.ts`** and wire a new **wizard step** (file input `accept=".json,.json.gz"`). Use `bulkPut` and idempotent IDs so re‑runs are safe.&#x20;
3. **Feature flag** the step with `VITE_ENABLE_MTGJSON_UPLOAD`.&#x20;

### C. Implement **Cardmarket Price Guide** ingestion (daily extension)

1. Start with **manual upload** like MTGJSON (you can add network fetch later): parse file → filter to relevant **Cardmarket product IDs** → map to `cardId` → upsert `provider='cardmarket.priceguide'`, and (if available) `avg7dCent`/`avg30dCent`.&#x20;

    * If you don’t already store product IDs, add a tiny `provider_id_map` `{ cardId, provider, providerId }` or persist on `card`. The docs call this out.&#x20;
2. Replace scheduler stubs with a **TTL check** that writes `settings['last_priceguide_sync_timestamp']`; run only if ≥24h. The snippet is already documented.&#x20;
3. Gate with `VITE_ENABLE_PRICEGUIDE_SYNC`.&#x20;

### D. Fix **PriceUpdateService** (Scryfall today)

* Define `finish='nonfoil'` for the non‑foil path; keep the `foil` branch as is; save both with the **finalized ID format** and `priceCent`. (Current code references an undefined `finish`.)&#x20;
* Keep creating a **valuation snapshot** after update; that’s already wired.&#x20;

### E. Unify **PriceQueryService** (precedence & indexes)

* Normalize on **provider precedence**: `['cardmarket.priceguide','mtgjson.cardmarket','scryfall']`.
* Ensure **all** point‑in‑time and “latest” lookups use the **indexed** path `[cardId+provider+finish+date]` (or `[cardId+date]` then sort in‑memory by precedence), not `[cardId+finish+date]`.  &#x20;

### F. UI: chart & controls

* Update the price chart to toggle **finish** and **provider**, and show **avg7/avg30** overlays when present (from Price Guide). The implementation guide spells out controls and data alignment.&#x20;

### G. Tests you should add before merge

* **Upload worker (MTGJSON)**: tiny AllPrices fixture → assert correct IDs like
  `${cardId}:mtgjson.cardmarket:nonfoil:${date}`, correct `priceCent`, **only** wanted IDs, 90‑day limit.&#x20;
* **Precedence/unit**: when multiple providers have the same `date`, **Price Guide wins**; finish mapping; idempotent upserts by `(cardId, provider, finish, date)`.&#x20;
* **Perf**: 5k cards batch ≤ targets; you already have Scryfall batch unit tests to emulate.&#x20;

---

## Merge‑gate checklist

* [ ] DB schema v8 finalized (one of: **provider** or **source**) and migration tested on real data.&#x20;
* [ ] `PriceUpdateService` bug fixed; writes both non‑foil and foil with the finalized key and `priceCent`.&#x20;
* [ ] **MTGJSON Upload**: worker, service, wizard step working; progress UI shown. &#x20;
* [ ] **Price Guide** ingestion: upload path + TTL scheduler working (manual upload acceptable for first merge).&#x20;
* [ ] **Precedence** correct in queries & valuations; indexes actually used.&#x20;
* [ ] Chart toggles and overlays implemented.&#x20;
* [ ] New tests passing (worker ingestion, precedence, idempotency).&#x20;

---

## Notes on naming (“provider” vs “source”)

* Your **docs and acceptance criteria** consistently assume **`provider`** with precise identifiers (`cardmarket.priceguide`, `mtgjson.cardmarket`). That precision makes precedence robust and future‑proof (e.g., if you later add a different MTGJSON feed). `m2`’s **`source`** rename is workable, but it forces every consumer to infer meaning (e.g., “cardmarket” could mean price guide or live API). For the least churn and clean precedence, I recommend standardizing on **`provider`** everywhere and adjusting the `m2` migration accordingly.  &#x20;

---

## Answering your core doubt: “How does m2 actually import MTGJSON prices today?”

It **doesn’t**—not end‑to‑end. You have a **service/worker stub** with syntax errors and missing worker files; the real ingestion path is described in docs (upload a **user‑provided** AllPrices JSON(‑GZ) and write last 90 days to `price_points`), but it’s not implemented in runtime code yet. Adopt the documented upload worker & wizard step and you’ll meet the milestone requirement of history longer than the time the user has used the app. &#x20;

---

If you want, I can turn this plan into PR‑ready patches (schema + migration, `MTGJSONUploadWorker`, Price Guide upload + TTL, precedence queries, chart toggles, and tests) following the exact file paths above.
