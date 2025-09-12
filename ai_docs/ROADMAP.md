# Roadmap — MTG Collection Value Tracker
_Last updated: 2025‑09‑12_

## Principles
- **Lots are source of truth** for ownership, cost basis, P/L.
- **Prices are cached & persisted**; UI never blocks on live API.
- **PWA first:** the app should work offline (incl. deep links).
- **Idempotent imports:** re‑importing must be safe (no dupes).

---

## COMPLETED ✓

### P0 — Offline SPA navigation
**Why:** Deep links 404 offline without a navigation fallback.  
**Changes:** Add `NavigationRoute` to `src/sw.ts`.  
**Accept:** Refresh `/decks/...` and `/cards` while offline → renders app shell.  
**Refs:** `src/sw.ts`, `docs/dev-dist/sw.js`.

### P0 — PWA icons & branding
**Why:** Manifest points to non‑existent icons; index title still default.  
**Changes:** Place icons in `public/icons` and reference in `vite.config.ts`; update `<title>` and favicon in `index.html`.  
**Accept:** Lighthouse PWA check passes; app has correct name/icon.  
**Refs:** `vite.config.ts`, `index.html`.

### P0 — Backup/restore completeness
**Why:** `card_lots` & `scan_sale_links` missing in backup → data loss risk.  
**Changes:** Include both tables in export/import.  
**Accept:** Export → wipe DB → import → portfolio value & holdings identical.  
**Refs:** `src/features/backup/BackupService.ts`.

### P0 — Unrealized cost basis honors partial disposals
**Why:** Unrealized basis overcounts if a lot is partially sold.  
**Changes:** Use `remaining = quantity - disposedQuantity` in `calculateLotCostBasis` and aggregate accordingly.  
**Accept:** Unit tests show matching basis to remaining units; dashboard totals align.  
**Refs:** `src/features/analytics/ValuationEngine.ts`.

### P1 — Remove or implement Release Date sort
**Why:** UI offers `releasedAt` sort but schema lacks it.  
**Option A:** Hide option.  
**Option B:** Persist Scryfall `released_at` on card creation & sort by it.  
**Accept:** Sort menu only shows working choices OR date sort works.  
**Refs:** `src/features/cards/views/CardsView.vue`, `src/features/pricing/ScryfallProvider.ts`, `src/data/db.ts`.

### P1 — ESLint config unification
**Why:** Dual configs cause drift.  
**Changes:** Keep `eslint.config.js` (flat), remove `.eslintrc.json`, port rules.  
**Accept:** `npm run lint` passes; CI uses a single config.  
**Refs:** `eslint.config.js`, `.eslintrc.json`.

### P1 — Add historic price graphs to card details
**Why:** Users need to see price trends over time to make informed decisions.  
**Changes:** Added PriceHistoryChart component to card modal with historical price data visualization.  
**Accept:** Card modal shows price history chart with transaction annotations.  
**Refs:** `src/components/PriceHistoryChart.vue`, `src/components/CardComponent.vue`.

### P2 — Enhance import status tracking and UI
**Why:** Users need real-time feedback during import operations.  
**Changes:** Implemented import status store with progress tracking and updated navbar indicator.  
**Accept:** Import operations show real-time progress in navbar with detailed status information.  
**Refs:** `src/stores/importStatus.ts`, `src/components/ImportStatusIndicator.vue`.

### P1 — Minor TS import cleanup
**Why:** Avoid `.ts` SFC imports unless explicitly configured.  
**Changes:** Drop the `.ts` extension or enable in `tsconfig.app.json`.  
**Accept:** Build and typecheck pass.  
**Refs:** `src/features/dashboard/HomeView.vue`.

### P1 — Cardmarket "IDs first", consistent idempotency
**Why:** Robust linking and safe re‑imports.  
**Changes:** Prefer Scryfall `/cards/collection` by Cardmarket IDs; unify `externalRef` formats (`cardmarket:{type}:{id}:{line}`); fall back to set+collector only.  
**Accept:** Re‑import same CSVs → 0 new rows; logs show batch lookups.  
**Refs:** `src/features/pricing/ScryfallProvider.ts`, `src/features/imports/ImportService.ts`, `src/workers/cardmarketCsv.ts`.

### P2 — Refactor Pinia stores to remove duplication
**Why:** The `mtg.ts` store duplicates state, getters, and actions from other stores, increasing maintenance overhead and risk of inconsistencies.  
**Changes:** Remove `mtg.ts` and refactor components to use the individual, domain-specific stores directly.  
**Accept:** The `mtg.ts` file is deleted; app functionality is unchanged; codebase is smaller and easier to maintain.  
**Refs:** `src/stores/`.

### P1 — Add historic price graphs to card details
**Why:** Users need to see price trends over time to make informed decisions.  
**Changes:** Added PriceHistoryChart component to card modal with historical price data visualization.  
**Accept:** Card modal shows price history chart with transaction annotations.  
**Refs:** `src/components/PriceHistoryChart.vue`, `src/components/CardComponent.vue`.

### P2 — Enhance import status tracking and UI
**Why:** Users need real-time feedback during import operations.  
**Changes:** Implemented import status store with progress tracking and updated navbar indicator.  
**Accept:** Import operations show real-time progress in navbar with detailed status information.  
**Refs:** `src/stores/importStatus.ts`, `src/components/ImportStatusIndicator.vue`.

---

## NOW (importer reliability & UX)

### P2 — Virtualize card grids
**Why:** Performance at scale.  
**Changes:** Introduce virtualization for Cards/Deck cards.  
**Accept:** Smooth scroll with large collections.

### P1 — Re-enable and extend unit tests
**Why:** Guard rails for pricing/import.  
**Changes:** Un-comment and align tests for regex, batch provider, valuation; add idempotency tests.  
**Accept:** `npm test` runs green locally & in CI.

---

## COMPLETED ✓

### P2 — Re-enable and extend unit tests
**Why:** Guard rails for pricing/import.  
**Changes:** Fixed and re-enabled previously failing unit tests; improved test stability.  
**Accept:** `npm test` runs green locally & in CI.  
**Refs:** `src/test/views/HomeView.test.ts`, `src/test/components/CardComponentWithProgress.test.ts`.

---

## NEXT (enhancements)

### P1 — Background job scheduler
**Why:** Better UX for long-running operations.  
**Changes:** Implement a job queue for price sync/import progress with persisted status.  
**Accept:** Import and price sync operations show progress and can be resumed after app restart.

### P2 — Periodic valuation snapshots
**Why:** Historical tracking of portfolio value.  
**Changes:** Implement automatic daily snapshots of portfolio valuation.  
**Accept:** Dashboard shows valuation history charts.

### P2 — Background Sync registration
**Why:** Automatic price updates when connectivity returns.  
**Changes:** Register Background Sync to refresh prices when network returns.  
**Accept:** Prices update automatically when device comes online.

---

## LATER (nice‑to‑have)

- **Advanced analytics** with filtering and custom reports
- **Multi-currency support** for international users
- **Sharing features** to export deck lists or collection summaries
- **Mobile app optimizations** including install prompts and mobile-specific UX