# MTG Collection Value Tracker

*Status: **2025‑09‑18***

## Principles

* **Lots are the source of truth** for ownership, cost basis, and P/L. No direct `holdings` mutations.
* **Idempotent imports**: re‑imports must not create duplicates; IDs‑first resolution.
* **Prices are cached & persisted**; UI never blocks on live API.
* **PWA first**: app works offline (including deep links) and passes Lighthouse PWA checks.

---

## Status legend

* **Planned** ▢  **In progress** ◧  **Done** ✓  **Deferred** ◌

---

## Completed ✓

* **P0 — Offline SPA navigation** ✓
* **P0 — PWA icons & branding** ✓
* **P0 — Backup/restore completeness** ✓ (includes `card_lots` & `scan_sale_links`)
* **P0 — Unrealized cost basis honors partial disposals** ✓
* **P1 — Remove or implement Release Date sort** ✓ *(option chosen in codebase; keep consistent)*
* **P1 — ESLint config unification** ✓
* **P1 — Historic price graphs in card details** ✓
* **P2 — Enhance import status tracking and UI** ✓
* **P2 — Re‑enable and extend unit tests** ✓
* **P2 — Pagination for card grids** ✓
* **M2 — Pricing throughput, history & snapshots** ✓

---

## Milestones

### M1 — Inventory truth & importer reliability (IDs‑first)  ✓

**Goal:** All imports are ID‑first, idempotent; *lots* are the only persisted inventory.

**Scope**

* Importer: Product‑ID‑first resolution; strictly ordered fallbacks; multi‑ID parsing.
* Remove `holdings` mutation; compute holdings from lots everywhere.
* Locale cleanup (settings‑driven).
* Tests: importer idempotency; Product‑ID success/fallback paths; holdings=lots parity; `SetCodeResolver` edge cases.

**Acceptance**

* Re‑importing the same CSVs → **0** new rows.
* When Cardmarket/Product IDs are present, **100%** resolution via IDs.
* All UI reads **holdings from lots** only.

**Dependencies:** none.

---

#### M2 — Pricing throughput, history & snapshots  ✓

**Goal:** Fast daily pricing with **finish-aware time series**, **historical backfill**, provider precedence, and **automatic valuation snapshots**.

**Scope**

* **Schema & migrations**

    * Update `price_points` to use a provider/finish/date key: `id = ${cardId}:${provider}:${finish}:${date}`.
    * Add optional `provider_id_map` (e.g., Cardmarket product ID, MTGJSON UUID) if not already persisted on `card`.
* **Historical backfill (one-time)**

    * Pull **last 90 days** of Cardmarket prices per printing via **MTGJSON** (foil/nonfoil separated) and upsert into `price_points`.
* **Daily extension (ongoing)**

    * New **PriceGuideSyncWorker**: ingest **Cardmarket Price Guide** daily snapshot for owned/favorited printings; write one row per `(cardId, finish, date)`.
    * **Precedence rules:** prefer **Price Guide** for a given date; else **MTGJSON** if within \~90 days; use **Scryfall** only for "today".
    * **TTL + scheduling:** Service Worker Periodic Sync when supported; app-level fallback timer otherwise.
* **Finish-aware series** for current-day updates (Scryfall `/cards/collection` batching).
* **Valuation snapshots**

    * Create a snapshot immediately after the daily price update (or manual run).
    * Enable point-in-time valuations by joining lots to that day's `price_points`.
* **Charts & UI**

    * Card detail charts display **finish** variations (nonfoil/foil) with standardized Cardmarket EUR pricing.
    * UI uses a unified price source with provider precedence (Price Guide > MTGJSON > Scryfall) without user-facing toggles.

**Acceptance** *(targets)*

* **Backfill coverage:** ≥95% of owned printings have ≥90 consecutive daily points after the one-time backfill.
* **Daily sync reliability:** ≥97% success rate (last 30 days) with automatic retry/backoff.
* **Throughput:** Update **5k cards** in **≤5 min P50 / ≤10 min P95** on a typical desktop.
* **Snapshots:** A valuation snapshot is created within **≤60s** of price update completion.
* **Finish visibility:** Both `eur` and `eur_foil` series render when applicable.

**Dependencies:** M1 (schema/read-paths stabilized on lots).

---

### M3 — ManaBox scans & reconciliation

**Goal:** Round‑trip physical inventory → sales reconciliation.

**Scope**

* ManaBox worker + Scans view; wire to `ScanMatchingService` (sold vs owned).
* UI to manually link scans to lots/sales; audit trail via `scan_sale_links`.
* Tests: greedy FIFO match, including partial quantities.

**Acceptance**

* Import of sample CSV shows **matched/owned** correctly.
* Manual linking updates lot/scan relations and audit trail.

**Dependencies:** M1 (lots truth), optional M2 (for valuations in the view).

---

### M4 — Manual add & correction

**Goal:** Users can add lots by hand and correct/lock mappings safely.

**Scope**

* **Add Card** dialog (Cards/Holdings): create manual lots (with/without cost).
* **Correct/Lock** on a lot/scan/transaction: set `override*` or `overrideCardId`; toggle `resolutionLocked`.
* Linker: respect `resolutionLocked`/overrides and skip auto‑relink.
* Tests: manual add changes analytics totals; re‑import does not alter locked lots.

**Acceptance**

* Manual lot creation with optional `acquisitionPriceCent = null` shows "unknown cost".
* Locked lots are preserved across re‑imports.

**Dependencies:** M1.

---

### M5 — ManaBox group pricing (Purchase Groups)

**Goal:** Group scans/lots into a Booster/Box purchase with a single paid price.

**Scope**

* New table: `purchase_groups` (schema + migration).
* ManaBox wizard step: create/attach purchase group; set `acquiredAt` and total price.
* Lots gain `purchaseGroupId` and `isManual` fields; importer attaches accordingly.
* Tests: group created; lots attached; idempotent behavior preserved.

**Acceptance**

* During import, user can create a purchase group and attach all created lots.
* Group metadata appears in lot details and analytics.

**Dependencies:** M4 (UI primitives), M1.

---

### M6 — Analytics filters & group ROI

**Goal:** Trustworthy analytics with filters and group‑level ROI.

**Scope**

* Dashboard filters: **Timeframe**, **Set**, **Purchase Group** (Pinia‑persisted; offline‑friendly).
* Finance/Valuation: handle `acquisitionPriceCent = null` (unknown bucket); filtered aggregations.
* Metrics: unrealized value/basis/P\&L; realized P\&L by timeframe; **Group ROI** = revenue − group cost.
* Tests: filter logic; ROI math; UI KPIs and charts.

**Acceptance**

* Users can filter and see matching totals; group view shows ROI and per‑card breakdown.

**Dependencies:** M2 (snapshots); M5 (groups); M1.

---

### M7 — UX polish & quality bars

**Goal:** Smoother browsing and clearly explained charts.

**Scope**

* Price history charts render both finishes if available; clear provider legend.
* Deck coverage derives from **lots** in all deck screens (no `holdings` dependency).
* Lighthouse PWA passes on target profiles.
* (If not already complete) Release‑date sort option aligned with persisted `released_at`.

**Acceptance**

* Lighthouse PWA score passes; analytics totals match hand‑checked calculations.

**Dependencies:** M1, M2, M6.

---

## Cross‑cutting: Data model & migrations (Dexie)

* **`purchase_groups`**: `id`, `kind`, `title`, `acquiredAt`, `totalAcquisitionPriceCent`, `notes`, timestamps.
* **`card_lots` additions**: `purchaseGroupId?`, `isManual?`, `resolutionLocked?`, `overrideCardId?` or granular overrides, `acquisitionPriceCent` nullable.
* **Migrations**: additive; backfill defaults; preserve prior financial fields; unit tests around migration up/down where applicable.

---

## Test plan summary (per milestone)

* **M1**: importer idempotency; holdings parity; locale; set‑code edges.
* **M2**: batch sizing; finish series; snapshot creation; perf harness for 5k cards.
* **M3**: FIFO/partial matching; manual link round‑trip; audit trail integrity.
* **M4**: manual add; correction lock; linker guard.
* **M5**: group creation/attachment; idempotency when re‑importing same scans.
* **M6**: filters → metrics; null‑cost handling; ROI math.
* **M7**: double‑finish chart rendering; lighthouse; deck coverage from lots.

---

## KPIs & SLOs

* **Importer correctness**: 0 dupes on same‑file re‑import; 100% ID‑present resolutions use IDs.
* **Pricing throughput**: 5k cards ≤5 min P50 / ≤10 min P95.
* **Snapshot freshness**: snapshot within ≤60s of price update completion.
* **Reconciliation accuracy**: ≥99% auto‑match rate on sample scans; manual links persist.
* **Analytics trust**: totals within ±0.5% of hand‑checked calculations under test fixtures.
* **PWA quality**: Lighthouse PWA audit passes on reference device profiles.
* **Historical data completeness:** ≥95% of owned printings have ≥90 days of continuous history after backfill; ≥90% have continuous daily data over any rolling 30-day window.
* **Provider correctness:** For dates where both MTGJSON and Price Guide exist, chart/tooling uses Price Guide; audit shows 100% precedence compliance in tests.

---

## Dependencies & sequencing

1. **M1** foundation → unblocks M2, M3, M4.
2. **M2** → required for M6 (time‑series and snapshots).
3. **M4** → improves UX and prepares UI for M5 linking.
4. **M5** → enables **M6** group ROI.
5. **M7** after M6 for coherent UX polish.

---

## Risks & mitigations

* **API rate limits** on price providers → batch sizes with backoff; TTL guard; offline queue.
* **Idempotency drift** across importers → shared normalization utilities; golden CSV fixtures in tests.
* **Null acquisition price semantics** → UI "unknown cost" bucket; exclude from basis sums by default; explicit callouts in analytics.
* **Linker regressions** → `resolutionLocked` respected at all entry points; add contract tests.

---

## Tracking checklist (high‑level)

* [x] M1 complete and merged
* [x] M2 complete and merged
* [ ] M3 scan→sale reconciliation shipped
* [ ] M4 manual add/correction GA
* [ ] M5 purchase groups schema + wizard
* [ ] M6 analytics filters + ROI
* [ ] M7 polish & Lighthouse pass