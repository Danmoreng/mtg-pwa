# AI Change Log

A chronological log of AI‑proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

## 2025-09-01 17:30 — feat: Implement automatic price updates and fix price data saving
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/PriceUpdateService.ts, src/features/dashboard/HomeView.vue, src/features/decks/DeckImportService.ts, src/features/imports/ImportService.ts, src/workers/priceSync.ts
- **Type**: feat
- **Summary**: Implement automatic price updates and ensure price data is saved when cards are imported.
- **Details**:
  - Created PriceUpdateService to handle price updates and checking if updates are needed
  - Modified HomeView to automatically check for and update prices when the app starts (if more than 24 hours since last update)
  - Updated DeckImportService to fetch and save price data when new cards are imported
  - Updated ImportService to fetch and save price data when new cards are imported
  - Modified price sync worker to use put instead of add to handle updates
  - This ensures that price data is always available in the database for valuation calculations
- **Impact/Risks**: These changes ensure that price data is properly saved and updated, improving the accuracy of valuation calculations.
- **Verification Steps**: `npm run build` completes successfully.
- **Linked Task/Issue**: Price data saving and updates

## 2025-09-01 17:00 — fix: Use database price data in CardsView instead of API calls
- **Author**: AI (Qwen)
- **Scope**: src/features/cards/views/CardsView.vue
- **Type**: fix
- **Summary**: Modified CardsView to use price data from the database instead of making API calls every time the page is visited.
- **Details**:
  - Updated loadCardPrices method to fetch price data from the price_points table
  - Implemented logic to find the most recent price point for each card
  - Removed dependency on ScryfallProvider in CardsView
  - This change ensures that the cards page loads pricing data from the database, not from the API
  - API requests will only happen when adding new cards or when manually triggering price updates
- **Impact/Risks**: These changes improve app performance and reduce API usage by using cached price data from the database.
- **Verification Steps**: `npm run build` completes successfully.
- **Linked Task/Issue**: Cards view optimization

## 2025-09-01 16:30 — fix: Use database price data for valuation instead of API calls
- **Author**: AI (Qwen)
- **Scope**: src/features/analytics/ValuationEngine.ts
- **Type**: fix
- **Summary**: Modified ValuationEngine to use price data from the database instead of making API calls every time the app opens.
- **Details**:
  - Updated calculateHoldingValue method to fetch price data from the price_points table
  - Implemented logic to find the most recent price point for each card
  - Removed dependency on ScryfallProvider in ValuationEngine
  - This change ensures that the dashboard loads pricing data from the database, not from the API
  - API requests will only happen when adding new cards or when manually triggering price updates
- **Impact/Risks**: These changes improve app performance and reduce API usage by using cached price data from the database.
- **Verification Steps**: `npm run build` completes successfully.
- **Linked Task/Issue**: Valuation engine optimization

## 2025-09-01 16:00 — feat: Implement service worker caching for Scryfall API
- **Author**: AI (Qwen)
- **Scope**: vite.config.ts, src/sw.ts, src/features/pricing/ScryfallProvider.ts
- **Type**: feat
- **Summary**: Implement service worker caching for Scryfall API requests to provide persistent caching across app restarts.
- **Details**:
  - Configured Vite PWA plugin to use injectManifest mode for custom service worker
  - Created service worker with caching strategies for Scryfall API and images
  - Implemented StaleWhileRevalidate strategy for Scryfall API with 24-hour expiration
  - Implemented CacheFirst strategy for images with 30-day expiration
  - Simplified ScryfallProvider to remove in-memory caching since service worker handles it
  - Maintained rate limiting in ScryfallProvider
- **Impact/Risks**: These changes provide persistent caching that survives app restarts and improves offline capabilities.
- **Verification Steps**: `npm run build` completes successfully and service worker is generated.
- **Linked Task/Issue**: Scryfall API caching

## 2025-09-01 15:30 — feat: Implement rate limiting and caching for Scryfall API
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/ScryfallProvider.ts
- **Type**: feat
- **Summary**: Implement rate limiting and in-memory caching for Scryfall API requests to improve performance and reduce redundant requests.
- **Details**:
  - Added rate limiting with 100ms delay between requests to respect Scryfall API limits
  - Implemented in-memory caching with 24-hour expiration for API responses
  - Added caching for price and image requests by Scryfall ID and set/collector number
  - Added caching for card hydration requests
- **Impact/Risks**: These changes improve performance and reduce API usage, but the cache is in-memory and will be cleared on app restart.
- **Verification Steps**: `npm run build` completes successfully.
- **Linked Task/Issue**: Scryfall API caching

## 2025-09-01 15:00 — fix: Fix database schema issues and build errors
- **Author**: AI (Qwen)
- **Scope**: src/core/SettingsService.ts, src/features/analytics/SnapshotService.ts, src/features/decks/DeckImportService.ts, src/features/decks/views/DeckImportView.vue, src/features/imports/ImportService.ts, src/features/cards/views/CardsView.vue, src/features/dashboard/HomeView.vue, src/workers/priceSync.ts
- **Type**: fix
- **Summary**: Fixed database schema issues and build errors caused by missing createdAt/updatedAt fields in entities.
- **Details**:
  - Added missing createdAt and updatedAt fields to all database entities
  - Fixed type errors in SettingsService, SnapshotService, DeckImportService, ImportService, and priceSync worker
  - Fixed undefined object access in CardsView.vue
  - Removed unused variables in HomeView.vue
  - Updated DeckImportView.vue to include required fields for new database schema
- **Impact/Risks**: These changes fix build errors and ensure compatibility with the updated database schema.
- **Verification Steps**: `npm run build` now completes successfully.
- **Linked Task/Issue**: Database schema upgrade

## 2025-09-01 14:30 — feat: Upgrade database structure and implement Pinia state management
- **Author**: AI (Qwen)
- **Scope**: src/data/db.ts, src/data/repos.ts, src/stores/, src/features/dashboard/HomeView.vue, src/main.ts
- **Type**: feat
- **Summary**: Upgrade database to version 3 with enhanced indexing for historical pricing and implement Pinia for state management.
- **Details**:
  - Upgraded database schema to version 3 with improved indexing for historical pricing
  - Added createdAt/updatedAt fields to all entities
  - Enhanced price_points table with compound indexes for historical pricing queries
  - Implemented Pinia stores for cards, holdings, transactions, decks, and settings
  - Created a unified MTG store that combines all individual stores
  - Updated HomeView to use the new Pinia stores
  - Added tests for the new stores
- **Impact/Risks**: Database schema migration from v1 to v3; no destructive changes. Pinia implementation is backward compatible.
- **Verification Steps**: `npm run dev` and verify that the dashboard loads correctly and displays data.
- **Linked Task/Issue**: Database upgrade and Pinia implementation

## 2025-09-01 12:00 — docs: Update implementation status based on code review
- **Author**: AI (Qwen)
- **Scope**: docs/implementation-checklist.md, .github/issues/
- **Type**: chore
- **Summary**: Updated implementation checklist and issue files to reflect the actual completion status of various milestones based on code review.
- **Details**:
  - Updated Milestone 1 status to COMPLETE with all acceptance criteria met
  - Updated Milestone 2 status to 80% COMPLETE
  - Updated Milestone 3 status to 70% COMPLETE
  - Updated Milestone 5 status to 90% COMPLETE
  - Updated Milestone 6 status to 25% COMPLETE
  - Updated Milestone 7 status with basic valuation engine implemented
  - Checked off completed acceptance criteria in issue files
  - Updated project plan with completion status for milestones
- **Impact/Risks**: These changes provide a more accurate view of the project's progress.
- **Verification Steps**: Review the updated checklist and issue files to ensure they accurately reflect the current state of the project.
- **Linked Task/Issue**: Plan Mode

## 2025-09-01 11:30 — docs: Create issues and update documentation for planned improvements
- **Author**: AI (Qwen)
- **Scope**: .github/issues, docs/implementation-checklist.md, docs/project_plan.md
- **Type**: chore
- **Summary**: Created new issues for historical pricing, API caching, and 24h price caching. Updated implementation checklist and project plan to reflect these enhancements.
- **Details**:
  - Created issue #7 for historical pricing
  - Created issue #8 for Scryfall API caching
  - Created issue #9 for 24h price caching
  - Created issue #10 for Pinia state management (future enhancement)
  - Created issue #11 for UI component refactoring (future enhancement)
  - Updated implementation checklist with new issues
  - Updated project plan with enhanced Milestone 3 description
- **Impact/Risks**: These changes improve the project planning and organization without affecting existing functionality.
- **Verification Steps**: Review the new issue files and updated documentation to ensure they accurately reflect the planned improvements.
- **Linked Task/Issue**: Plan Mode