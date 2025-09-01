# Feature Implementation Checklist

This checklist tracks the implementation of features according to the project plan.

## Milestone 1: Foundation ✅ COMPLETE
- [x] Set up Vue 3 + TypeScript project with Vite
- [x] Add PWA support with vite-plugin-pwa
- [x] Configure ESLint + Prettier with strict TypeScript
- [x] Create base folder structure (app, core, data, features, ui, workers)
- [x] Add Vue Router and create basic layout
- [x] Add CSS tokens and reset
- [x] Define app constants and lightweight i18n
- [x] Create Dexie database with initial schema
- [x] Define core domain types
- [x] Create Money utility
- [x] Create basic UI components

## Milestone 2: Cardmarket Import 🚧 IN PROGRESS (80% COMPLETE)
- [x] Create Cardmarket CSV parser worker (basic implementation)
- [x] Implement transaction repository
- [x] Create import service for Cardmarket data (basic implementation)
- [ ] Build import wizard UI
- [x] Update holdings based on imports (partially implemented)
- [ ] Implement complete valuation engine

## Milestone 3: Pricing & Snapshots 🚧 IN PROGRESS (70% COMPLETE)
- [x] Create Scryfall provider (basic implementation)
- [x] Implement price sync worker (basic implementation)
- [x] Create snapshot service (basic implementation)
- [ ] Build dashboard with KPIs
- [ ] Implement manual price refresh
- [ ] Enhance with historical pricing (#7)
- [ ] Implement Scryfall API caching (#8)
- [ ] Implement 24h price caching (#9)

## Milestone 4: ManaBox Scans 🔲 NOT STARTED
- [ ] Create ManaBox CSV parser
- [ ] Implement scan repository
- [ ] Build scan matching algorithm
- [ ] Create scans view with sold/owned status

## Milestone 5: Moxfield Decks 🚧 IN PROGRESS (90% COMPLETE)
- [x] Create deck import service (basic implementation)
- [x] Implement deck repository
- [x] Build deck import UI (text format)
- [x] Calculate ownership coverage (basic implementation)
- [x] Create deck view (with images)

## Milestone 6: PWA Polish 🔲 NOT STARTED (25% COMPLETE)
- [ ] Implement service worker caching
- [ ] Add background sync for price updates
- [x] Implement backup/restore functionality
- [ ] Add offline support for imports

## Milestone 7: Analytics Deep-Dive 🔲 NOT STARTED
- [x] Enhance valuation engine with FIFO calculations (basic implementation)
- [ ] Create time series charts with SVG
- [ ] Build per-card P/L views
- [ ] Add advanced filtering and sorting

## Future Enhancements 🔲 NOT STARTED
- [ ] Implement Pinia for state management (#10)
- [ ] Refactor UI into reusable components (#11)

## Testing & Quality 🔲 NOT STARTED
- [x] Unit tests for core utilities (Money tests exist)
- [ ] Component tests for UI
- [ ] E2E tests with Playwright
- [ ] Sample fixtures for each data source
- [ ] CI setup with GitHub Actions