# Feature Implementation Checklist

This checklist tracks the implementation of features according to the project plan.

## Milestone 1: Foundation
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
- [ ] Create basic UI components

## Milestone 2: Cardmarket Import
- [ ] Create Cardmarket CSV parser worker
- [ ] Implement transaction repository
- [ ] Create import service for Cardmarket data
- [ ] Build import wizard UI
- [ ] Update holdings based on imports
- [ ] Implement valuation engine

## Milestone 3: Pricing & Snapshots
- [ ] Create Scryfall provider
- [ ] Implement price sync worker
- [ ] Create snapshot service
- [ ] Build dashboard with KPIs
- [ ] Implement manual price refresh

## Milestone 4: ManaBox Scans
- [ ] Create ManaBox CSV parser
- [ ] Implement scan repository
- [ ] Build scan matching algorithm
- [ ] Create scans view with sold/owned status

## Milestone 5: Moxfield Decks
- [ ] Create deck import service
- [ ] Implement deck repository
- [ ] Build deck import UI
- [ ] Calculate ownership coverage
- [ ] Create deck view

## Milestone 6: PWA Polish
- [ ] Implement service worker caching
- [ ] Add background sync for price updates
- [ ] Implement backup/restore functionality
- [ ] Add offline support for imports

## Milestone 7: Analytics Deep-Dive
- [ ] Enhance valuation engine with FIFO calculations
- [ ] Create time series charts with SVG
- [ ] Build per-card P/L views
- [ ] Add advanced filtering and sorting

## Testing & Quality
- [ ] Unit tests for core utilities
- [ ] Component tests for UI
- [ ] E2E tests with Playwright
- [ ] Sample fixtures for each data source
- [ ] CI setup with GitHub Actions