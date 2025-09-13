Below is a thorough, code‑level review of the repository, grounded in the two docs you asked me to read carefully—**ARCHITECTURE** and the (moved) **PROJECTPLAN** (Roadmap)—plus the actual implementation. I’ve split it into: a quick overview, concrete gaps vs. plan, refactors, data‑model feedback (including *what card lots are for*), tests, immediate next steps, and a fresh project plan you can drop into `ai_docs/ROADMAP.md`.

---

## TL;DR

**What’s solid**

* A clear, local‑first architecture with Dexie repositories, workers for CSV and pricing, and a PWA shell with Workbox.&#x20;
* A well‑designed inventory layer around **card lots** (the right choice for FIFO, cost basis, realized P/L).&#x20;
* Import wizard, batch Scryfall lookups by Cardmarket IDs, and automatic price update orchestration with time‑to‑live.  &#x20;

**What’s missing / needs polish**

* Background/periodic syncing is documented as planned, but the service worker does not implement Background Sync or periodic tasks yet.  &#x20;
* Importer still prioritizes **set‑code heuristics** in places instead of **Cardmarket ID‑first**; unify this path end‑to‑end. &#x20;
* Some small but important correctness/UX items (e.g., invalid `'en-EU'` NumberFormat locale in the wizard).&#x20;
* “Holdings” persists alongside lots (transitional), which risks duplication and drift if not enforced as derived.&#x20;

---

## What’s missing in the implementation?

1. **Background / periodic price updates**
   The architecture/roadmap calls for background sync (“planned”) but the SW currently only caches and logs push/notification clicks—no `sync`/`periodicSync` handler, and the worker isn’t scheduled from the SW. The current auto‑update flow is app‑driven via `usePriceUpdates` and `AutomaticPriceUpdateService.schedulePriceUpdate()`. Consider adding Periodic Background Sync (or a simple SW message pump) to drive `priceSync` from the SW when online.  &#x20;

2. **Importer “Cardmarket IDs first” end‑to‑end**
   You’ve added and tested `ScryfallProvider.getByCardmarketIds` (with fallback to individual lookups), which is great. But `ImportService.importCardmarketArticles` still primarily runs through `resolveSetCode(...)` + `hydrateCard(...)` instead of trying **Product ID(s) first**. Retool it to:
   **(a)** try `getByCardmarketId(s)` → **(b)** setCode+collector → **(c)** fuzzy by name as last resort.  &#x20;

3. **Release‑date sort**
   Roadmap flags a discrepancy: UI mentions release date sort, but cards don’t persist `released_at`. Either hide the option or persist Scryfall’s date on creation.&#x20;

4. **ManaBox importer UX**
   The “CSV Import” view stubs the ManaBox path (“would be implemented here”). The matching engine exists (`ScanMatchingService`), specs are documented, but the actual UI/worker parsing flow is not finished. &#x20;

5. **Valuation batch/bulk speed**
   Price sync currently fetches per‑card by id in a loop. Consider using Scryfall’s `/cards/collection` in **batches (≤75 identifiers)** to amortize latency. (You already use it for ID linking; extend to pricing.) &#x20;

6. **Deck coverage + ownership**
   Docs say deck ownership is computed from lots (good). Make sure the UI consistently references lots (not holdings). Also confirm coverage calculations are wired in all deck views.&#x20;

---

## What should be refactored?

1. **Holdings vs. Lots**
   Per architecture, *holdings* are transitional/derived. Today, the UI and stores still load holdings directly (e.g., `HomeView` calls `useHoldingsStore().loadHoldings()`). Move to a **“derived from lots”** model everywhere and deprecate `holdings` storage to avoid divergence. Provide a migration/“read‑through” adapter that computes holdings from remaining lot quantities. &#x20;

2. **Importer path consolidation**
   `ImportService` contains multiple code paths: some ID‑first, some set‑code‑first. Consolidate into a single resolution pipeline with explicit strategy order and telemetry for misses. (Your CARDMARKET\_IMPORT\_FIXES doc already outlines this; implement it across the importer.) &#x20;

3. **Finish vs. Foil duplication**
   Lots and cards carry `finish` and also a `foil` boolean. Keep only `finish` (`'nonfoil' | 'foil' | 'etched'`) and derive `foil` in getters to remove redundancy and drift. (You already key price fields by provider; this makes mapping to `eur` vs `eur_foil` simpler.) &#x20;

4. **Price sync logic**
   Refactor `PriceUpdateService.syncPrices` to:

* Chunk cards into batches; use Scryfall `/cards/collection` to bring back full records including `prices`;
* Store **finish‑aware** price points (eur vs eur\_foil) under distinct provider keys (e.g., `scryfall:eur`, `scryfall:eur_foil`) or include `finish` as part of the key.&#x20;

5. **Locale & currency formatting**
   Fix `'en-EU'` locale (invalid). Source from `SettingsService.DEFAULT_SETTINGS.locale` (`'de-DE'`) and allow override via Settings. Audit all formatting calls to avoid hard‑coding. &#x20;

6. **SW responsibilities**
   The generated `docs/dev-dist/sw.js` is checked in for GH Pages—fine—but avoid letting it accumulate logic that differs from `src/sw.ts`. Keep **all** logic in `src/sw.ts` and build from there. If you add Background Sync, centralize it in `src/sw.ts`.&#x20;

---

## Is the data structure solid—or could it be improved?

**Strong fundamentals**

* Cents for money, typed Dexie schema, historical **price\_points**, and **valuations** snapshots: all the right calls for a local‑first finance tracker.&#x20;

**Improvements**

* **Eliminate holdings persistence** (derived from lots). It’s marked transitional in docs—make it so in code.&#x20;
* **Normalize finish/foil** (see refactor above).
* **Card identity**: you already store Scryfall `id` and `oracleId`; keep `setCode` + `number` for fast lookups and sorting. Consider persisting `released_at` per roadmap item.&#x20;
* **Lot financial fields**: You recently added `acquisitionFeesCent`, `acquisitionShippingCent`, and `totalAcquisitionCostCent` via migration—good for margin analytics. Ensure all importers populate these fields from **orders** not only **articles** (fees often live at order level).&#x20;
* **Price points**: consider a composite key that encodes `finish` or `channel` to support different series (non‑foil vs foil) without conflation. Current `id = ${cardId}:scryfall:${date}` can collide finishes.&#x20;

---

## What are **card lots** for?

> **Card lots** model *how and when* you acquired specific copies of a printing (quantity, unit cost, currency, provenance, timestamps). They are the **source of truth** for:
>
> * **FIFO cost basis** (realized P/L when selling)
> * **Unrealized cost basis** (remaining units)
> * **Deck ownership coverage** (remaining units available)
> * **Scan/sale linkage** (provenance & reconciliation)
    >   The architecture explicitly positions **lots** as the inventory layer—“holdings” are a transitional, derived view. You also have `scan_sale_links` to connect scans with sell transactions. &#x20;

---

## Do we have enough tests?

**Good coverage exists where it matters first:**

* **Automatic price update TTL** logic; **price update** progress and failure handling; **Scryfall batch fallback** behavior.  &#x20;
* View tests for **HomeView** (async loads) and card component interactions.&#x20;

**Gaps to fill (high‑impact first):**

1. **Importer correctness & idempotency**

    * Articles + Orders → **fees/shipping allocation** at lot/transaction level.
    * **Product ID first** path (single & multi IDs).
    * **SetCodeResolver** edge cases (Commander: … : Extras; UB; “Stellar Sights”). &#x20;

2. **Valuation engine**

    * FIFO with **partial disposals**, realized/unrealized P/L, snapshot creation after price updates. (Roadmap and changelog call this out.)&#x20;

3. **Scan matching**

    * Greedy FIFO matching across multi‑quantity sales; sold vs still‑owned status.&#x20;

4. **Lots as source of truth**

    * Tests proving holdings = derived from lots (until holdings table is removed).

5. **Price points**

    * Finish‑aware price persistence and retrieval.

---

## Immediate next steps (ordered)

1. **Importer rewrite to “IDs first” (P0)**

    * Modify `ImportService.importCardmarketArticles` to try **Cardmarket Product ID(s)** via `ScryfallProvider.getByCardmarketIds` first; then `/cards/{set}/{collector}`; then fallback Named. Add tests mirroring BUGS.md cases. &#x20;

2. **Make holdings truly derived (P0)**

    * Add a derived “holdings view” (store/composable) fed by lots, remove `holdings` writes; plan a migration to drop holdings table later. Update Home/Decks views to use the derived data.&#x20;

3. **Background / periodic price sync (P1)**

    * Add SW `periodicSync` (with a fallback app timer) to trigger the `priceSync` worker. Keep your TTL guard. On success, call `ValuationEngine.createValuationSnapshot`. &#x20;

4. **Price batching & finish‑aware prices (P1)**

    * Batch price requests; persist separate price points for `eur` vs `eur_foil`. Update charts to select series by card.finish.&#x20;

5. **Locale / currency cleanup (P1)**

    * Replace `'en-EU'` with `SettingsService` locale everywhere; expose locale in Settings. &#x20;

6. **Release date sort (P1)**

    * Either hide option or persist `released_at` on card creation.&#x20;

7. **ManaBox importer UI & tests (P2)**

    * Implement worker + view, then wire to `ScanMatchingService`. &#x20;

---

## Fresh PROJECTPLAN (drop‑in replacement for `ai_docs/ROADMAP.md`)

**Status updated: 2025‑09‑13**

### M1 — Inventory truth & importer reliability (IDs‑first)

**Goal:** All imports are ID‑first, idempotent, and lots are the only persisted inventory.
**Scope:**

* Importer: Product‑ID‑first resolution; fallbacks strictly ordered; multi‑ID parsing.&#x20;
* Remove `holdings` mutation; compute holdings from lots everywhere.&#x20;
* Locale cleanup (Settings‑driven).&#x20;
* Tests: importer idempotency, Product‑ID success/fallbacks; holdings=lots parity; SetCodeResolver edge cases.&#x20;
  **Accept:** Re‑importing the same CSVs → 0 new rows; all cards resolved through Product IDs when present; UI reads holdings from lots only.

### M2 — Pricing throughput & snapshots

**Goal:** Fast daily pricing with correct finish‑aware series + automatic snapshots.
**Scope:**

* Batch price fetch (`/cards/collection`), finish‑aware price points, snapshot post‑update.&#x20;
* Background/periodic sync in SW with TTL guard and app‑fallback.&#x20;
* Tests: price batching, finish series correctness, snapshot creation after update.
  **Accept:** Collections of 5k cards update < N minutes; both `eur` and `eur_foil` series visible where applicable; valuation snapshots created on update.

### M3 — ManaBox scans & reconciliation

**Goal:** Round‑trip physical inventory → sales reconciliation.
**Scope:**

* ManaBox worker + Scans view; wire to `ScanMatchingService` (sold vs owned).&#x20;
* UI to manually link scans to lots/sales; audit trail via `scan_sale_links`.
* Tests: greedy FIFO match including partial quantities.
  **Accept:** Import of sample CSV shows matched/owned; manual linking updates lot/scan relations.

### M4 — UX polish & analytics

**Goal:** Trustworthy analytics and smoother browsing.
**Scope:**

* Release‑date sort (persist `released_at` or remove control).&#x20;
* Deck coverage from lots in all deck screens (no holdings dependency).&#x20;
* Price history charts render both finishes if available; clear provider legend.
* Backup/restore includes **all** tables (already improved).&#x20;
  **Accept:** Lighthouse PWA passes; analytics totals match hand‑checked calculations.

---

## Extra suggestions the app would benefit from

* **Importer diagnostics panel**: After parse, show “resolution strategy used” (ID, set+collector, name‑based) + any aliases added by `SetCodeResolver`. Great for trust & debugging.&#x20;
* **Conflict resolution UI in the wizard**: You have steps (`Upload → Preview → Conflicts → Summary`); surface “multiple product IDs” and ambiguous set mappings in the **Conflicts** step with one‑click resolution.&#x20;
* **Cardmarket order‑level fee allocation**: Distribute order‑level fees/shipping across lots in that order (pro‑rata by line total). Fill those `acquisitionFeesCent` / `acquisitionShippingCent` fields you recently added.&#x20;
* **Keyboard & accessibility**: The grids and wizard can add ARIA roles and keyboard navigation (cheap win).
* **Data export filters**: Let users export *just* lots/transactions or date‑ranged price points for audits. (BackupService is close.)&#x20;

---

## References I used (docs + code)

* **ARCHITECTURE (Authoritative)**: lots as inventory, pricing flow, background sync planned.&#x20;
* **ROADMAP / Project plan** moved to `ai_docs/ROADMAP.md` (release date sort issue, importer items, pagination).&#x20;
* **Service worker & workers** (caching; no background sync yet; `priceSync.ts`). &#x20;
* **Scryfall Provider** (ID batch API & tests). &#x20;
* **Import paths** (wizard, importer service still set‑code‑first in places). &#x20;
* **Valuation & finance** (snapshots after updates; financial fields in lots). &#x20;

If you want, I can turn the **M1** changes into concrete diffs (ImportService changes, SetCodeResolver tweaks, finish‑aware price points, and a “derived holdings” composable) in a follow‑up.
