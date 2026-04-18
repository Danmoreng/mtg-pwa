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

## Current Health (verified on 2026-04-18)
- `npm run build`: passes.
- `npm run lint`: passes (warnings only).
- `npm run typecheck`: passes.
- `npm run test:run`: passes (`16` files, `84` tests).
- Test discovery intentionally targets `tests/**/*.test.ts`; legacy `src/test/**` is excluded in `vitest.config.ts`.

## Architectural Map
- App bootstrap: `src/main.ts`
  - registers PWA SW
  - initializes Dexie DB (`dbPromise`)
  - mounts router + Pinia
  - schedules automatic pricing update
- Routing: `src/app/router.ts`
  - Dashboard, Cards, Decks, Booster Boxes, and Import wizards.
- Persistence:
  - schema + migrations: `src/data/db.ts` (DB version 10)
  - singleton init: `src/data/init.ts`
  - repositories: `src/data/repos.ts`
- State stores: `src/stores`
- Feature modules: `src/features`

## Data Model Invariants
- `card_lots` is the inventory truth; holdings are derived.
- Key tables: `cards`, `acquisitions`, `card_lots`, `transactions`, `scans`, `price_points`, `valuations`, `sell_allocations`, `scan_sale_links`.
- Pricing key shape: `${cardId}:${provider}:${finish}:${date}`.
- Provider precedence in query logic: `cardmarket.priceguide` > `mtgjson.cardmarket` > `scryfall`.

## Core Flows
- Cardmarket import wizard:
  - UI parses CSV in worker `src/workers/cardmarketCsv.ts`
  - applies import logic via `src/features/imports/ImportService.ts`
  - pipelines in `src/features/imports/ImportPipelines.ts`
  - triggers reconciler (`kickReconciler`).
- ManaBox import:
  - wizard -> `ImportService.importManaboxScansWithBoxCost`
  - scan hydration/materialization in `src/features/scans/ScanProcessingService.ts`
  - reconciliation in `src/features/scans/ReconcilerService.ts`.
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
- Reconciler is complex and currently the most fragile part (heavy logging, provisional lot creation, allocation rewrites).
- Import and scan flows duplicate some logic across old/new services; prefer `src/features/**` over deprecated shims in `src/services/**`.
- `BoosterBoxesView` constructs `new MtgTrackerDb()` directly instead of using shared `getDb()` singleton.
- `Money.parse(number)` assumes decimal units and multiplies by 100; pass careful input types to avoid double scaling.

## Where To Start For Changes
- Imports: `src/features/imports/**`, `src/workers/cardmarketCsv.ts`
- Reconciliation: `src/features/scans/ReconcilerService.ts`
- Pricing/history: `src/features/pricing/**`, `src/stores/cards.ts`
- Analytics/P&L: `src/features/analytics/**`
- Schema/migrations: `src/data/db.ts`

## Useful Docs
- `README.md`
- `ai_docs/ARCHITECTURE.md`
- `ai_docs/CURRENT_STATUS.md`
- `TODO.md`
