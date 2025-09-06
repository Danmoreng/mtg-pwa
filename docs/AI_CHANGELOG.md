# AI Change Log

A chronological log of AI‑proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

## 2025-09-06 18:30 — fix: Correct deck text import regex pattern
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/test/features/deckImportRegex.test.ts
- **Type**: fix
- **Summary**: Fix critical regex bug in deck text import that prevented parsing of card lines with set codes in parentheses.
- **Details**:
  - Fixed buggy regex pattern `/^(\d+)\s+(.+?)\s*$([^)]+)$\s*(\d+)(?:\s*\*F\*\s*)?$/i` 
  - Corrected to proper pattern `/^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i`
  - Added comprehensive tests to verify the fix works correctly
  - The bug prevented lines like "1 Captain America, First Avenger (SLD) 1726" from being parsed
- **Impact/Risks**: Fixes critical functionality issue in deck text imports. No breaking changes.
- **Verification Steps**: `npm run build` completes successfully. Run tests to verify regex patterns work correctly.

## 2025-09-06 19:00 — feat: Implement unified card component with modal dialog
- **Author**: AI (Qwen)
- **Scope**: src/components/CardComponent.vue, src/features/decks/views/DeckDetailView.vue, src/features/cards/views/CardsView.vue, src/components/index.ts
- **Type**: feat
- **Summary**: Create unified card component for consistent display across deck and cards views with modal dialog for detailed information.
- **Details**:
  - Created CardComponent.vue with card image, set name, collector number, and current price display
  - Implemented modal dialog showing detailed card information including buy/sell prices, value over time, and owned quantities
  - Updated DeckDetailView to use unified card component instead of individual card display logic
  - Updated CardsView to use unified card component instead of individual card display logic
  - Simplified both views by removing duplicated logic for card display and price loading
  - Component loads card details on demand when modal is opened for better performance
- **Impact/Risks**: Improves consistency and user experience across card displays. No breaking changes.
- **Verification Steps**: `npm run build` completes successfully. Verify card display works in both deck and cards views. Test modal dialog functionality.

## 2025-09-06 12:00 — feat: Implement batch Cardmarket ID lookup and enhanced collector number parsing
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/ScryfallProvider.ts, src/features/imports/ImportService.ts
- **Type**: feat
- **Summary**: Implement batch Cardmarket ID lookup using Scryfall's collection endpoint and enhance collector number parsing with support for various formats.
- **Details**:
  - Added `getByCardmarketIds` method to ScryfallProvider that uses `/cards/collection` endpoint for batch lookups
  - Updated ImportService to use batch lookup for multiple Cardmarket IDs instead of sequential requests
  - Implemented enhanced collector number parsing with support for Roman numerals, special characters, and various formats
  - Added fallback to individual lookups if batch request fails
  - Improved regex patterns for more robust collector number extraction
- **Impact/Risks**: Performance improvement for imports with multiple Cardmarket IDs. No breaking changes.
- **Verification Steps**: `npm run build` completes successfully. Import Cardmarket CSV files with multiple Product IDs and verify batch lookup is used.

## 2025-09-05 17:45 — fix: Improve Cardmarket import logging and handle missing Cardmarket IDs
- **Author**: AI (Qwen)
- **Scope**: src/features/imports/ImportService.ts
- **Type**: fix
- **Summary**: Fix logging in Cardmarket import to show correct API endpoints and handle cases where Cardmarket IDs are not found in Scryfall.
- **Details**:
  - Updated structured logging to show correct `/cards/cardmarket/:id` endpoint instead of incorrect `/cards/collection`
  - Added proper handling for 404 errors when Cardmarket IDs are not found in Scryfall database
  - System properly falls back to set code resolution when Cardmarket ID lookups fail
- **Impact/Risks**: Improves diagnostic information for troubleshooting Cardmarket imports. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import Cardmarket CSV files and verify correct logging in console.

## 2025-09-05 16:00 — docs: Document Cardmarket import fixes and implementation approach
- **Author**: AI (Qwen)
- **Scope**: docs/CARDMARKET_IMPORT_FIXES.md
- **Type**: docs
- **Summary**: Create comprehensive documentation for fixing Cardmarket import issues with set code resolution and product ID lookups.
- **Details**:
  - Document current SetCodeResolver implementation and identified issues from BUGS.md
  - Analyze example CSV data structures from Cardmarket exports
  - Outline solution approach based on BUGS.md recommendations
  - Define implementation phases for enhanced set code resolution
  - Specify test cases and logging improvements needed
- **Impact/Risks**: Documentation only, no code changes. Provides clear roadmap for implementing fixes.
- **Verification Steps**: Review CARDMARKET_IMPORT_FIXES.md for completeness and accuracy.

## 2025-09-04 16:00 — feat: Implement deduplication system for card tracking
- **Author**: AI (Qwen)
- **Scope**: src/data/db.ts, src/features/decks/DeckImportService.ts, src/features/imports/ImportService.ts, src/features/decks/views/DeckImportView.vue
- **Type**: feat
- **Summary**: Implement comprehensive deduplication system to prevent duplicate card entries when importing from different sources.
- **Details**:
  - Enhanced database schema to version 4 with improved lot-based tracking
  - Added proper upgrade functions to handle transitions from old data structures
  - Implemented deduplication logic for deck imports to link to existing cards instead of creating duplicates
  - Implemented deduplication logic for Cardmarket imports to link transactions to existing lots
  - Fixed variable declaration issues that were causing runtime errors
  - Added proper currency tracking to card lots
  - Ensured all required fields are properly populated
  - Fixed null/undefined type compatibility issues
  - Improved transaction tracking with better linking between transactions and specific card lots
- **Impact/Risks**: Significantly improves data integrity by preventing duplicate card entries. No destructive changes to existing data.
- **Verification Steps**: `npm run build` completes successfully. Import decks and Cardmarket data to verify deduplication works correctly.

## 2025-09-02 20:00 — feat: Enhanced Cardmarket set code resolution with complex set name handling
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/SetCodeResolver.ts
- **Type**: feat
- **Summary**: Improve Cardmarket import reliability by enhancing set code resolution for complex nested set names.
- **Details**:
  - Added enhanced heuristics for complex nested set names like "Commander: The Lord of the Rings: Tales of Middle-earth: Extras"
  - Improved handling of "Universes Beyond:" prefixed sets with "Extras" suffix
  - Enhanced resolution for "Magic: The Gathering -" prefixed sets
  - Added special case handling for "Stellar Sights" set (fallback to Secret Lair)
  - Improved debugging output to better track resolution attempts
  - Enhanced error recovery with more comprehensive cache refresh logic
- **Impact/Risks**: Further improves Cardmarket import success rate for complex and nested set names. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import Cardmarket CSV files with complex set names and verify proper set code resolution.
- **Linked Task/Issue**: Cardmarket import set code resolution improvements

## 2025-09-02 19:00 — feat: Enhanced Cardmarket Scryfall API integration
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/SetCodeResolver.ts, src/features/imports/ImportService.ts, src/features/pricing/ScryfallProvider.ts
- **Type**: feat
- **Summary**: Improve Cardmarket import reliability by enhancing Scryfall API integration with better set code resolution and versioned card handling.
- **Details**:
  - Enhanced SetCodeResolver with additional heuristics for complex set names (Universes Beyond, Magic: The Gathering - prefixes)
  - Added version information stripping from card names (e.g., "Card Name (V.1)" → "Card Name")
  - Updated ScryfallProvider to handle versioned cards with include_variations parameter
  - Improved error handling and debugging output for set code resolution
  - Added support for fuzzy matching as fallback for difficult card lookups
  - Enhanced caching mechanism with better error recovery
- **Impact/Risks**: Significantly improves Cardmarket import success rate for complex sets and versioned cards. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import Cardmarket CSV files and verify Scryfall API calls use correct set codes and handle versioned cards.
- **Linked Task/Issue**: Cardmarket import Scryfall API fixes

## 2025-09-02 18:00 — feat: Cardmarket Scryfall set code resolution
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/SetCodeResolver.ts, src/features/imports/ImportService.ts
- **Type**: feat
- **Summary**: Implement dynamic set code resolution for Cardmarket imports using Scryfall API.
- **Details**:
  - Created SetCodeResolver module to convert Cardmarket full set names to Scryfall set codes
  - Implemented heuristic rules for handling "Extras", "Commander:", and "Secret Lair Drop Series" variants
  - Added caching mechanism using IndexedDB to store Scryfall sets data with 7-day refresh policy
  - Implemented alias table for learning resolved mappings to avoid repeated API calls
  - Updated ImportService to use dynamic set code resolution instead of hardcoded mapping
  - Added fallback mechanisms for handling unknown/new sets by refreshing cache
- **Impact/Risks**: Improves Cardmarket import reliability by correctly resolving Scryfall set codes. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import Cardmarket CSV files and verify Scryfall API calls use correct set codes.
- **Linked Task/Issue**: Cardmarket import Scryfall API fixes

## 2025-09-02 17:00 — fix: Cardmarket CSV field name alignment and validation fixes
- **Author**: AI (Qwen)
- **Scope**: src/features/imports/views/wizard/CardmarketImportWizard.vue, src/workers/cardmarketCsv.ts
- **Type**: fix
- **Summary**: Fix field name mismatches between CSV parsing worker and validation logic for orders and articles.
- **Details**:
  - Fixed field name mismatches between worker parsing and validation functions
  - Updated articles validation to check for `amount` instead of `quantity` field
  - Updated articles validation to check for `shipmentId` instead of `orderId` field
  - Added date validation for orders (was missing)
  - Updated validation to handle both `date` and `dateOfPurchase` field names
  - Fixed template to display correct field names for articles and orders
  - Ensured consistent field naming between worker parsing and UI display
- **Impact/Risks**: Fixes critical functionality issues preventing Cardmarket orders and articles CSV imports from working. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import sample CSV files and verify all data types (transactions, orders, articles) are correctly parsed and validated.
- **Linked Task/Issue**: Cardmarket import feature fixes

## 2025-09-02 16:00 — fix: Cardmarket CSV parsing and validation improvements
- **Author**: AI (Qwen)
- **Scope**: src/features/imports/views/wizard/CardmarketImportWizard.vue, src/workers/cardmarketCsv.ts
- **Type**: fix
- **Summary**: Fix Cardmarket import validation and parsing issues to correctly handle actual CSV formats.
- **Details**:
  - Fixed date validation to handle DD.MM.YYYY HH:MM:SS format used in actual CSV files
  - Updated price validation to accept negative values (for fees)
  - Improved CSV parsing in worker to use flexible case-insensitive column matching
  - Added robust column value extraction using lookup functions similar to legacy implementation
  - Fixed worker to properly extract values from CSV rows with varying column names
- **Impact/Risks**: Fixes critical functionality issues preventing Cardmarket CSV imports from working with real data. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import sample CSV files and verify data is correctly parsed and validated.
- **Linked Task/Issue**: Cardmarket import feature fixes

## 2025-09-02 15:00 — fix: Cardmarket Import Wizard functionality and idempotency
- **Author**: AI (Qwen)
- **Scope**: src/features/imports/views/wizard/CardmarketImportWizard.vue, src/workers/cardmarketCsv.ts, src/features/imports/ImportService.ts
- **Type**: fix
- **Summary**: Fix Cardmarket import functionality by correcting validation logic, data mapping, and idempotency implementation.
- **Details**:
  - Fixed compilation error in CardmarketImportWizard.vue by replacing undefined `fileInfo` reference with `uploadedFiles`
  - Fixed data validation logic by ensuring correct fileType parameter is passed to validation functions
  - Updated Cardmarket CSV parser worker to include missing fields in data interfaces
  - Added lineNumber to all parsed data types for proper idempotency
  - Fixed idempotency implementation in ImportService to match documented format (`cardmarket:{orderId}:{lineNumber}`)
  - Improved externalRef generation for all import types (transactions, orders, articles)
- **Impact/Risks**: Fixes critical functionality issues preventing Cardmarket CSV imports from working correctly. No data migrations required.
- **Verification Steps**: `npm run build` completes successfully. Import sample CSV files and verify data is correctly parsed and imported without duplicates.
- **Linked Task/Issue**: Cardmarket import feature fixes

## 2025-09-02 16:00 — feat: Implement Cardmarket Import Wizard
- **Author**: AI (Qwen)
- **Scope**: src/features/imports/views/wizard/CardmarketImportWizard.vue, src/app/router.ts, src/components/Navigation.vue
- **Type**: feat
- **Summary**: Implement a multi-step wizard for Cardmarket CSV imports with enhanced validation and error handling.
- **Details**:
  - Created Cardmarket Import Wizard with 5 steps: file upload, column mapping, preview, conflicts resolution, and summary
  - Implemented file upload with automatic format detection
  - Added comprehensive column mapping interface with auto-detection for different CSV formats
  - Implemented conflict detection for duplicate imports using externalRef = cardmarket:{orderId}:{lineNo}
  - Added detailed preview and summary screens with import statistics
  - Enhanced error handling with comprehensive error surfaces for unknown sets, invalid prices, and malformed rows
  - Updated router and navigation to use the new wizard
- **Impact/Risks**: New feature with no breaking changes. Existing CSV import functionality is preserved.
- **Verification Steps**: `npm run build` completes successfully. Navigate to Cardmarket Import in the app and verify the wizard loads correctly.
- **Linked Task/Issue**: M2 Finish: Cardmarket Import (UI & polish)

## 2025-09-02 15:00 — docs: Restructure documentation to reduce sprawl
- **Author**: AI (Qwen)
- **Scope**: README.md, docs/ARCHITECTURE.md, docs/IMPORTERS.md, docs/ROADMAP.md, docs/QWEN.md, .github/pull_request_template.md
- **Type**: docs
- **Summary**: Restructured documentation according to lean structure to reduce sprawl and improve organization.
- **Details**:
    - Created ARCHITECTURE.md with technical architecture, data model, and current capabilities
    - Created IMPORTERS.md with detailed specifications for Cardmarket, ManaBox, and Moxfield importers
    - Created ROADMAP.md with project milestones, acceptance criteria, and prioritized tasks
    - Consolidated AI collaboration rules into QWEN.md
    - Created standard pull request template
    - Removed redundant documentation files (project_plan.md, project-status.md, etc.)
    - Updated README.md with links to new documentation structure
- **Impact/Risks**: No functional changes; documentation reorganization only. All content preserved in new structure.
- **Verification Steps**: Review new documentation files to ensure all information migrated correctly.
- **Linked Task/Issue**: Documentation restructuring

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

## 2025-09-04 17:00 — fix: Resolve TypeScript compilation errors
- **Author**: AI (Qwen)
- **Scope**: Multiple files across the codebase
- **Type**: fix
- **Summary**: Fix numerous TypeScript compilation errors to ensure successful build.
- **Details**:
  - Fixed variable declaration order issues
  - Resolved type compatibility problems
  - Corrected null/undefined type handling
  - Fixed test file mocking issues
  - Removed unused imports and variables
- **Impact/Risks**: Enables successful build and deployment. No functional changes.
- **Verification Steps**: `npm run build` completes successfully without errors.
- **Linked Task/Issue**: TypeScript compilation fixes

## 2025-09-04 16:00 — fix: Resolve database schema upgrade issues
- **Author**: AI (Qwen)
- **Scope**: src/data/db.ts
- **Type**: fix
- **Summary**: Fix database schema upgrade issues and ensure smooth transition from old data model.
- **Details**:
  - Added proper upgrade functions for version 4 schema changes
  - Fixed primary key transition from composite key to single key in deck_cards table
  - Added missing fields to existing records during upgrade
  - Ensured data integrity during schema migration
- **Impact/Risks**: Fixes critical database upgrade issues that could prevent application startup. No data loss.
- **Verification Steps**: `npm run build` completes successfully. Application starts without database errors.
- **Linked Task/Issue**: Database schema upgrade fixes

## 2025-09-04 15:00 — feat: Implement deduplication system for card tracking
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/features/imports/ImportService.ts, src/features/decks/views/DeckImportView.vue, src/data/db.ts, src/data/repos.ts
- **Type**: feat
- **Summary**: Implement comprehensive deduplication system to prevent duplicate card entries when importing from different sources.
- **Details**:
  - Enhanced data model with lot-based tracking to individually track physical cards
  - Implemented deduplication logic for deck imports to link to existing cards instead of creating duplicates
  - Implemented deduplication logic for Cardmarket imports to link transactions to existing lots
  - Fixed variable declaration issues causing runtime errors
  - Added proper currency tracking to card lots
  - Ensured all required fields are properly populated
  - Improved transaction tracking with better lot linking
  - Fixed numerous TypeScript compilation errors
  - Resolved variable scoping issues
  - Corrected type compatibility problems
- **Impact/Risks**: Significantly improves data integrity by preventing duplicate card entries. Maintains accurate cost basis and valuation tracking. No destructive changes to existing data.
- **Verification Steps**: `npm run build` completes successfully. Import decks and Cardmarket transactions and verify cards are properly linked rather than duplicated.
- **Linked Task/Issue**: Card deduplication implementation

## 2025-09-06 12:00 — Summary: Batch Cardmarket ID Lookup and Enhanced Collector Number Parsing
- **Author**: AI (Qwen)
- **Scope**: src/features/pricing/ScryfallProvider.ts, src/features/imports/ImportService.ts
- **Type**: docs
- **Summary**: Documentation of improvements to Cardmarket import functionality.
- **Details**:
  - **Batch Cardmarket ID Lookup**: Implemented batch lookup using Scryfall's `/cards/collection` endpoint for improved performance
    - Added `getByCardmarketIds` method to `ScryfallProvider` for batch lookups
    - Updated `ImportService` to use batch lookup for multiple Cardmarket IDs
    - Implemented fallback to individual lookups if batch request fails
    - Maintained backward compatibility for single ID lookups
    - Improved performance for imports with multiple Product IDs
    - Reduced API calls and network overhead
    - Better error handling with fallback mechanisms
  - **Enhanced Collector Number Parsing**: Created more robust parsing to handle multiple formats
    - Standard numbers: "- 167 -"
    - Numbers with letters: "- 167a -"
    - Roman numerals: "- IV -"
    - Special characters: "- 167★ -"
    - Numbers at the end of names: "Lightning Bolt 167"
    - Numbers in parentheses: "Lightning Bolt (167)"
    - Replaced both instances of the old regex in `ImportService`
    - Better handling of various collector number formats
    - More accurate data extraction from Cardmarket descriptions
    - Improved import success rates for cards with complex naming
- **Impact/Risks**: Documentation only. No code changes.
- **Verification Steps**: Review this summary entry for completeness and accuracy.