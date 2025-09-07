# Roadmap — MTG Collection Value Tracker
_Last updated: 2025‑09‑07_

## Principles
- **Lots are source of truth** for ownership, cost basis, P/L.
- **Prices are cached & persisted**; UI never blocks on live API.
- **PWA first:** the app should work offline (incl. deep links).
- **Idempotent imports:** re‑importing must be safe (no dupes).

---

## NOW (stability & correctness)

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

### P1 — Minor TS import cleanup
**Why:** Avoid `.ts` SFC imports unless explicitly configured.  
**Changes:** Drop the `.ts` extension or enable in `tsconfig.app.json`.  
**Accept:** Build and typecheck pass.  
**Refs:** `src/features/dashboard/HomeView.vue`.

---

## NEXT (importer reliability & UX)

### P1 — Cardmarket “IDs first”, consistent idempotency
**Why:** Robust linking and safe re‑imports.  
**Changes:** Prefer Scryfall `/cards/collection` by Cardmarket IDs; unify `externalRef` formats (`cardmarket:{type}:{id}:{line}`); fall back to set+collector only.  
**Accept:** Re‑import same CSVs → 0 new rows; logs show batch lookups.  
**Refs:** `src/features/pricing/ScryfallProvider.ts`, `src/features/imports/ImportService.ts`, `src/workers/cardmarketCsv.ts`.

### P2 — Deck coverage based on **lots**
**Why:** Coverage should reflect **remaining** owned units per card.  
**Changes:** Compute deck coverage from `card_lots` (remaining qty).  
**Accept:** Coverage percentages match what lots imply.  
**Refs:** `src/features/decks/views/DeckDetailView.vue`, `src/data/repos`.

### P2 — Virtualize card grids
**Why:** Performance at scale.  
**Changes:** Introduce virtualization for Cards/Deck cards.  
**Accept:** Smooth scroll with large collections.

### P2 — Re‑enable and extend unit tests
**Why:** Guard rails for pricing/import.  
**Changes:** Un‑comment and align tests for regex, batch provider, valuation; add idempotency tests.  
**Accept:** `npm test` runs green locally & in CI.

---

## LATER (nice‑to‑have)

- **Background job scheduler** for price sync/import progress with persisted status.
- **Periodic valuation snapshots** + charts.
- **Background Sync** registration to refresh prices when network returns.  

