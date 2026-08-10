# AGENTS.md

## Repo Snapshot
- App: MTG collection tracker (Vue 3 + TypeScript + Vite + Pinia + Dexie).
- Runtime model: local-first PWA, IndexedDB is the source of persisted state.
- Deploy target: GitHub Pages-style base path `/mtg-pwa/` with build output in `docs/`.
- Monetary invariant: values are stored as integer cents (EUR).

## Quick Start
1. `npm install`
2. `npm run dev`
3. `npm run build`

Build runs `vue-tsc -b` and writes production assets + service worker into `docs/`.

## Current Health (verified on 2026-08-10)
- `npm run build`: passes.
- `npm run lint`: passes (`59` warnings, no errors).
- `npm run typecheck`: passes.
- `npm run test:run`: passes (`28` files, `118` tests).
- `npm run test:accounting`: passes (`7` files, `29` tests).
- Test discovery intentionally targets `tests/**/*.test.ts`; legacy `src/test/**` is excluded in `vitest.config.ts`.

## Architectural Map
- App bootstrap: `src/main.ts`
  - registers PWA SW
  - initializes Dexie DB (`dbPromise`)
  - mounts router + Pinia
  - schedules automatic pricing update
- Routing: `src/app/router.ts`
  - Dashboard, Cards, Decks, Booster Boxes, Import wizards, and Backup/Restore.
- Persistence:
  - fresh baseline schema: `src/data/db.ts` (`MtgTrackerDbAccounting`, schema version 1)
  - no legacy migrations or automatic database deletion
  - singleton init: `src/data/init.ts`
  - repositories: `src/data/repos.ts`
- State stores: `src/stores`
- Feature modules: `src/features`

## Data Model Invariants
- Canonical inventory truth is `inventory_lots` plus immutable
  `inventory_adjustments`; sold and deck-reserved quantities are derived from
  `lot_allocations` and active `deck_inventory_allocations`.
- Cost basis and P/L use `known | estimated | unknown`; unknown is never zero.
- Cardmarket, ManaBox, and deck import rows project through stable source refs;
  unlocked sale/deck allocations are reproducible and locked decisions survive.
- Legacy `card_lots`, `transactions`, and `sell_allocations` remain only for
  Phase 4 compatibility and are not canonical accounting truth.
- Pricing key shape: `${cardId}:${provider}:${finish}:${date}`.
- Provider precedence in query logic: `cardmarket.priceguide` > `mtgjson.cardmarket` > `scryfall`.

## Core Flows
- Cardmarket import wizard:
  - UI parses CSV in worker `src/workers/cardmarketCsv.ts`
  - applies import logic via `src/features/imports/ImportService.ts`
  - pipelines in `src/features/imports/ImportPipelines.ts`
  - projects raw orders into canonical acquisitions/sales/allocations and then
    recomputes stored deck runs.
- ManaBox import:
  - wizard -> `ImportService.importManaboxScansWithBoxCost`
  - scan hydration/materialization in `src/features/scans/ScanProcessingService.ts`
  - canonical scan projection, sale retry, and deck reprojection through
    `AccountingProjectionCoordinator`.
- Price updates:
  - scheduler: `src/features/pricing/AutomaticPriceUpdateService.ts`
  - fetch/write: `src/features/pricing/PriceUpdateService.ts`
  - valuation snapshot after update.
- MTGJSON/PriceGuide import:
  - thread-based upload workers in `src/features/pricing/*UploadWorker.ts`.

## PWA + Build Details
- Vite + PWA plugin config: `vite.config.ts`
- SW source: `src/sw.ts`
  - caches Scryfall API and images
  - navigation fallback to `index.html`.
- `npm run build` mutates tracked `docs/` artifacts; avoid running unless needed during code-only edits.

## Known Risk Areas
- Legacy reconciler is complex and remains the most fragile compatibility path
  (heavy logging, provisional lot creation, allocation rewrites).
- UI consumers still using `disposedQuantity`/`disposedAt`, legacy lots, or old
  analytics are not authoritative until the separately reviewed Phase 4 cutover.
- Import and scan flows duplicate some logic across old/new services; prefer `src/features/**` over deprecated shims in `src/services/**`.
- `BoosterBoxesView` constructs `new MtgTrackerDb()` directly instead of using shared `getDb()` singleton.
- `Money.parse(number)` assumes decimal units and multiplies by 100; pass careful input types to avoid double scaling.

## Where To Start For Changes
- Imports: `src/features/imports/**`, `src/workers/cardmarketCsv.ts`
- Reconciliation: `src/features/scans/ReconcilerService.ts`
- Canonical accounting: `src/features/accounting/**`
- Canonical deck projection: `src/features/decks/DeckAccountingProjectionService.ts`
- Pricing/history: `src/features/pricing/**`, `src/stores/cards.ts`
- Analytics/P&L: `src/features/analytics/**`
- Schema baseline: `src/data/db.ts`
- Backup/restore: `src/features/backup/**`

## Useful Docs
- `README.md`
- `ai_docs/ARCHITECTURE.md`
- `ai_docs/CURRENT_STATUS.md`
- `TODO.md`
