# MTG Collection Value Tracker — Vue PWA Project Plan

This plan is written for an AI coding agent to implement step by step. It targets a **client‑only** Vue 3 + TypeScript PWA using **IndexedDB (Dexie)** for storage and **plain CSS (no UI library)**.

---

## 0) Scope & Goals

**Data sources**
- Cardmarket CSV exports (buys & sales)
- Moxfield commander decklists (via URL or ID)
- ManaBox scanned cards CSV exports
- Manual entries for booster boxes

**Key outcomes**
- Money spent & realized gains (sales)
- Current portfolio value (unrealized P/L)
- Value change over time (snapshots)
- Mapping of *scanned* ManaBox cards that have been **sold** on Cardmarket
- 100% offline-capable PWA with local persistence

**Assumptions**
- Primary currency: **EUR** (extensible).  
- Card identity unified through **Scryfall IDs** where possible; otherwise set+collector number+finish+language fingerprinting.  
- Pricing provider initially **Scryfall** (eur) to avoid server secrets; Cardmarket API is optional via proxy later.

---

## 1) Project Bootstrap

**Tasks**
1. Create repo and scaffold:
   - `npm create vite@latest` → Vue + TypeScript
   - Add PWA support (Vite plugin), service worker w/ workbox or minimal custom SW.
   - Configure ESLint + Prettier, strict TS (`"strict": true`).
2. Base folders:
   ```text
   src/
     app/                # app shell, router, pwa bootstrap
     core/               # types, utils, error handling
     data/               # Dexie db, repositories, migrations
     features/           # vertical slices (import, holdings, pricing, decks, analytics)
     ui/                 # components (plain CSS), tokens.css
     workers/            # web workers for CSV parsing & pricing sync
   ```
3. Add routing (Vue Router) & a minimal layout: header, nav rail, main.
4. Add CSS tokens & reset:
   - `src/ui/tokens.css` with color palette, spacing, radius, shadow, typography.
   - Scoped component CSS only, no external UI libs.
5. Define app constants (currency `EUR`, locale `de-DE` default) and a lightweight i18n util.

**Acceptance**: App boots, PWA installs, offline shell cached. Lint & type checks pass.

---

## 2) Data Model (Dexie + TS)

**Tables & indices** (versioned migrations)
```ts
// v1 schema
cards            (id [scryfall_id], oracleId, name, set, setCode, number, lang, finish, imageUrl)
holdings         (id, cardId, acquisitionId?, quantity, unitCost, source, condition, language, foil, createdAt)
transactions    (id, kind ["BUY"|"SELL"], cardId, quantity, unitPrice, fees, shipping, currency, source, externalRef, happenedAt)
scans            (id, cardFingerprint, cardId?, source, scannedAt, quantity)
decks            (id, platform ["moxfield"], name, commander?, url, importedAt)
deck_cards       (deckId+cardId, quantity, role [main|side|maybeboard])
price_points     (id [cardId+provider+asOf], cardId, provider, currency, price, asOf)
valuations       (id [asOf], asOf, totalValue, totalCostBasis, realizedPnLToDate)
settings         (k, v)
```

**Notes**
- `cardFingerprint` = normalized tuple `(name,setCode,collectorNumber,finish,language)` used pre‑link before resolving to `cardId`.
- Keep `fees` and `shipping` at transaction level for realized P/L accuracy.
- All monetary values stored as **integer cents** in a `Money` helper.

**Acceptance**: Dexie database with typed repositories; migration harness and smoke tests.

---

## 3) Core Domain Types & Utilities

**Tasks**
1. Define `Money` utility (parse, add, multiply, format) with currency.
2. Define `CardFingerprint` normalize/compare (strip punctuation, normalize language/finish enums).
3. Define `PriceProvider` interface and `ScryfallProvider` implementation (no secrets).
4. Implement `EntityLinker`: maps `CardFingerprint` → `cardId` using Scryfall search (by set+number or name+set fallback).
5. Implement `ValuationEngine`:
   - Current value = Σ(holding.quantity × latest price per cardId)
   - Cost basis (FIFO) from `transactions` kind BUY
   - Unrealized P/L per card
   - Realized P/L from SELL transactions (with fees/ship)
6. Implement snapshot generator writing `valuations(asOf=today)`.

**Acceptance**: Unit tests for Money math, fingerprint match, FIFO, and valuation.

---

## 4) Importers (CSV & URLs)

### 4.1 Cardmarket CSV (Buys & Sells)
**Tasks**
- Create Web Worker `workers/cardmarketCsv.ts` to parse large CSVs without blocking UI.
- Support at least two export variants (buy and sell). Map columns: `Date, Product, Expansion, Nr, Language, Condition, Foil, Price, Quantity, Fees, Shipping, OrderId`.
- Convert to `transactions` records (BUY/SELL) with cents and `currency=EUR`.
- Attempt immediate `cardId` resolution via `EntityLinker`. If unresolved, store fingerprint for later.
- Idempotency: compute `externalRef = "cardmarket:" + OrderId + ":" + lineNumber` and skip duplicates.

**Acceptance**: Import wizard shows preview, conflicts, and results; transactions appear and update holdings/valuation.

### 4.2 ManaBox CSV (Scanned Rares)
**Tasks**
- Parse CSV variants (Manabox has multiple). Map: `Name, Set, Collector, Language, Foil, Condition, Qty, ScanDate`.
- Create `scans` entries; resolve to `cardId` when possible.
- Add **matching algorithm** to mark which scans were later **sold**:
  - Build a multikey `(cardId or fingerprint, foil, language)`.
  - For each scanned unit, scan SALES transactions with `happenedAt >= scannedAt` and available quantities; greedily assign earliest eligible sale units.
  - Store back-reference `soldTransactionId` (virtual mapping table if needed) and `soldAt`.

**Acceptance**: View shows scanned cards with badges **Sold** / **Still Owned** and link to sale.

### 4.3 Moxfield Decklist
**Tasks**
- Input: Moxfield deck URL or ID. Fetch JSON (public), parse `mainboard` & commander.
- Resolve to `cardId`s; upsert `decks` and `deck_cards`.
- Cross-check collection coverage: highlight which deck slots are fully/partially owned.

**Acceptance**: Deck page displays deck, ownership coverage%, and links to holdings.

### 4.4 Manual Booster Boxes
**Tasks**
- Simple form: `setCode, productName, quantity, totalPrice, date` → store as `transactions` kind BUY with `cardId=null` and `source="boosterbox"` **or** a separate `boxes` table that rolls its spend into “Money Spent”.
- Optional: pack open tracking later.

**Acceptance**: Spend totals reflect box purchases; exports preserved.

---

## 5) Pricing & Snapshots

**Tasks**
1. **ScryfallProvider**: load by set+collector or by `scryfall_id`, read `prices.eur`.
2. `workers/priceSync.ts`: batch refresh prices for `cardId`s in holdings; write `price_points` (with `asOf` date only, no intraday).
3. Snapshot job `workers/snapshot.ts`: at app start (online) and daily, compute & persist `valuations(asOf)`.
4. Allow manual “Refresh prices” and “Take snapshot now”.
5. Optional later: Cardmarket API provider via serverless proxy.

**Acceptance**: Current value visible; historical chart uses snapshots; operations are offline‑safe, updating when online.

---

## 6) Analytics & Metrics

**KPIs**
- **Money Spent** = Σ BUY totals (including boxes) + fees + shipping
- **Money Gained (Sales)** = Σ SELL totals − fees − shipping
- **Realized P/L** = Σ (SELL proceeds − proportional FIFO cost − sell fees/shipping)
- **Unrealized P/L** = Current Value − Remaining Cost Basis

**Tasks**
1. Build `analytics` service to compute KPIs and per‑card stats.
2. Time series: use `valuations` snapshots for portfolio line; buy/sell overlays from transactions.
3. Per‑card detail: lot history, cost basis, realized/unrealized.

**Acceptance**: Dashboard cards + simple SVG charts render KPIs and trends. No external chart lib; use inline SVG.

---

## 7) UI/UX (No UI Library)

**Screens**
1. **Dashboard**: KPIs, sparkline, last imports, quick actions.
2. **Holdings**: table with filters (set, foil, lang), current price, cost basis, unrealized P/L.
3. **Transactions**: sortable list; BUY/SELL tabs; import button.
4. **Scans vs Sales**: grid of scanned items with **Sold**/**Owned** status and sale link.
5. **Decks**: list and detail with ownership coverage.
6. **Imports**: wizards for Cardmarket & ManaBox CSV, Moxfield URL; preview → map → confirm.
7. **Settings**: currency, locale, price provider toggles, data export/backup.

**CSS Strategy**
- `tokens.css`: `--color-*`, `--radius-*`, `--space-*`, `--font-*`.
- Utility classes for layout (`.stack`, `.cluster`, `.grid`) and components (button, card, table).
- Prefer CSS Modules/Scoped CSS in SFCs, no Tailwind.

**Acceptance**: Accessible keyboard navigation, responsive layout, consistent spacing.

---

## 8) PWA & Offline Strategy

**Tasks**
1. Cache app shell & routes via service worker.
2. Background sync (when supported) for price updates.
3. File import UX works offline (CSV stored; price resolution deferred until online).
4. Versioned DB migrations with safe fallback & backup export.

**Acceptance**: App is installable, works offline, resumes tasks when back online.

---

## 9) Backup, Import/Export

**Tasks**
- Full JSON export of DB (all tables) to file; import with dry-run preview.
- Optional: scheduled reminder to export backup.

**Acceptance**: Backup round‑trip tested with sample data.

---

## 10) Testing & Quality Gate

**Tasks**
- Unit tests (Vitest) for: Money, CSV parsers, FIFO, matching algorithm.
- Component tests for Import wizard & Holdings table.
- E2E (Playwright) for: upload CSV → see holdings → refresh prices → see dashboard.
- Sample fixtures: small CSVs from each source.

**Acceptance**: CI passes, coverage target (e.g., 80%).

---

## 11) Privacy, Legal, Performance

**Tasks**
- No third‑party analytics by default; no secrets stored.
- Graceful handling of API rate limits; price sync concurrency caps.
- IndexedDB performance: compound indices, pagination, virtualized tables for large collections.

**Acceptance**: Large CSV (10k rows) imports in a worker without freezing UI; search under 50ms for typical queries.

---

## 12) Implementation Order (Milestones)

1. **M1: Foundation** — Bootstrap, DB schema, Money utils, minimal UI shell. ✅ COMPLETE
2. **M2: Cardmarket Import** — Parser, transactions, holdings updates, valuation. 🚧 IN PROGRESS (80% COMPLETE)
3. **M3: Pricing & Snapshots** — Scryfall provider, daily snapshots, dashboard KPIs. 🚧 IN PROGRESS (70% COMPLETE)
4. **M4: ManaBox Scans** — Import + Sold/Owned matching view. 🔲 NOT STARTED
5. **M5: Moxfield Decks** — Deck import + ownership coverage. 🚧 IN PROGRESS (90% COMPLETE)
6. **M6: PWA polish** — Offline, background sync, backup/export. 🔲 NOT STARTED (25% COMPLETE)
7. **M7: Analytics Deep‑Dive** — Per‑card P/L, time series SVG charts. 🔲 NOT STARTED

## 13) Enhanced Milestone 3 with Pricing Improvements

To enhance the pricing functionality in Milestone 3, the following improvements should be implemented:

1. **Historical Pricing** — Store price points over time to enable trend analysis
2. **API Caching** — Implement comprehensive caching for Scryfall API requests
3. **24h Price Caching** — Cache prices for 24 hours to reduce API usage

---

## 13) Detailed Step List for AI Agent

**For each step, include:** purpose, files to create/edit, tests, and acceptance.

### Step A: Create Dexie DB & Types
- **Create** `src/data/db.ts` with Dexie init and schema v1.
- **Create** types in `src/core/types.ts` (Card, Holding, Transaction, Scan, Deck, DeckCard, PricePoint, Valuation, Money).
- **Add** repositories in `src/data/repos/*` for CRUD and indexed queries.
- **Tests**: insert/select/migrate, money arithmetic.

### Step B: Scryfall Provider & EntityLinker
- **Create** `src/features/pricing/scryfallProvider.ts` with `getPrice(cardId): Promise<Money>` and `hydrateCard(cardFingerprint): Promise<Card>`.
- **Create** `src/features/linker/entityLinker.ts` to resolve fingerprints to `cardId`.
- **Tests**: mock fetch, resolve sample cards, fallback by set/collector.

### Step C: Import Wizard Framework
- **Create** `src/features/imports/wizard` components: `FileDrop.vue`, `CsvPreview.vue`, `ColumnMapper.vue`, `Summary.vue`.
- **Create** CSV worker utilities `workers/csvCommon.ts`.
- **Tests**: parse sample CSVs, preview mapping.

### Step D: Cardmarket CSV Parser
- **Create** `workers/cardmarketCsv.ts` with robust column mapping & type guards.
- **Wire** to `transactions` upsert & holdings updates.
- **Tests**: idempotency by `externalRef`, correct FIFO & fees.

### Step E: Valuation Engine + Dashboard
- **Create** `src/features/analytics/valuationEngine.ts` and `src/features/dashboard/Dashboard.vue`.
- **Tests**: snapshot correctness with mixed buys/sells.

### Step F: ManaBox Scans & Matching
- **Create** `workers/manaboxCsv.ts` and `src/features/scans/ScansView.vue`.
- **Implement** matching algo and resolved/unknown states.
- **Tests**: unit matching (scan→sale) including multi-quantity.

### Step G: Moxfield Deck Import & Coverage
- **Create** `src/features/decks/deckImport.ts` and `DeckView.vue`.
- **Tests**: import deck, compute coverage.

### Step H: PWA & Background Sync
- **Implement** service worker routes, caching; background price sync.
- **Tests**: manual verification + mock SW events.

### Step I: Backup/Restore
- **Create** `src/features/backup/backup.ts` + UI.
- **Tests**: export JSON, re-import equals DB state.

---

## 14) Matching Algorithm Details (Scans → Sales)

**Goal**: Mark ManaBox‑scanned units as **Sold** when matching Cardmarket SELL transactions.

**Algorithm (greedy FIFO by sale date)**
1. For each `scan` row → expand into `quantity` singletons with key `K=(cardId||fingerprint, foil, language)` and `scannedAt`.
2. Get all SELL transactions with same `K` and `happenedAt >= scannedAt` sorted by date.
3. Assign units to earliest sale lots with remaining quantity.
4. Persist `scan_sold_links(scanUnitId, transactionId, soldAt)` or embed as array on scan.

**Edge cases**
- Unknown `cardId`: match by fingerprint; later, when resolved, re‑run matcher.
- Multiple scans same day: stable order by import time.
- Partial matches: `soldQty < scannedQty` → mark remainder as **Owned**.

---

## 15) Minimal UI Component Inventory (No UI Library)

- `AppHeader`, `NavRail`, `Page`, `Card`, `Button`, `Badge`, `Table`, `Dialog`, `Toast`, `FormField`, `Spinner`, `EmptyState`.
- Build with SFC + CSS modules; states via BEM class names.

---

## 16) Config & Secrets

- No secrets required for base build. If adding Cardmarket API later: create optional `serverless/proxy` (Netlify/Cloudflare) for OAuth; configure provider switch in settings.

---

## 17) Deliverables Checklist

- [ ] Repo with Vue + TS + PWA scaffold
- [ ] Dexie DB with migrations & tests
- [ ] Importers: Cardmarket, ManaBox, Moxfield
- [ ] Pricing: Scryfall provider + daily snapshots
- [ ] Analytics dashboard & SVG charts
- [ ] Scans vs Sales view with matching
- [ ] Backup/Restore
- [ ] PWA offline + background sync
- [ ] E2E & unit tests

---

## 18) Nice‑to‑Have Roadmap

- Card condition multipliers in valuation (NM/EX/PL).  
- Language price adjustments.  
- Multi‑currency with historical FX rates.  
- Price alert notifications (PWA).  
- Print run / reprint risk indicators.  
- Deck price estimator & upgrade suggestions.

---

## 19) Handover Notes for the AI Agent

- Prefer web workers for heavy CSV parsing and price refresh.
- Always write money in cents; use `Money` helpers.
- Keep idempotency keys on imports to avoid duplicates.
- Add feature flags in `settings` to toggle providers and experimental features.
- Write small fixtures first; build up from green tests.

