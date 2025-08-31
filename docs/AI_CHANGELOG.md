# AI Change Log

A chronological log of AI-proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

For an overview of the project status, see:
- Project Plan: `docs/project_plan.md`
- Implementation Status: `docs/project-status.md`
- Implementation Summary: `docs/implementation-summary.md`
- Setup Complete: `docs/setup-complete.md`
- Implementation Checklist: `docs/implementation-checklist.md`

## 2025-08-31 22:00 — feat: Add sorting functionality to cards view
- **Author**: AI (Qwen)
- **Scope**: src/features/cards/views/CardsView.vue
- **Type**: feat
- **Summary**: Added sorting functionality to cards view with options for name, set, price, release date, and owned quantity.
- **Details**:
  - Added sorting controls with dropdown for sort criteria (name, set, price, release date, owned quantity)
  - Implemented ascending/descending sort direction toggle
  - Improved card display by removing redundant Cardmarket price display (since Scryfall already includes Cardmarket data)
  - Enhanced responsive design for sorting controls
  - Updated styling for better UX with sorting controls
  - Maintained existing search functionality alongside sorting
  - Preserved existing card grid layout with 5 cards per row
- **Impact/Risks**: Low risk feature addition with no breaking changes
- **Verification Steps**: 
  1. Navigate to the cards view
  2. Verify that sorting controls are visible and functional
  3. Test sorting by different criteria (name, set, price, release date, owned quantity)
  4. Test both ascending and descending sort directions
  5. Verify that search functionality still works alongside sorting
  6. Verify that card display is unchanged except for the removal of redundant price display

## 2025-08-31 21:00 — fix: Improve card images display in cards overview view
- **Author**: AI (Qwen)
- **Scope**: src/features/cards/views/CardsView.vue
- **Type**: fix
- **Summary**: Improved card images display in cards overview view to match deck view styling and increase cards per row.
- **Details**:
  - Updated card image display to use full-width container with proper image scaling
  - Changed grid layout to show 5 cards per row (matching deck view)
  - Added image error handling with placeholder images
  - Improved card details styling for better readability
- **Impact/Risks**: Low risk UI improvements with no functional changes
- **Verification Steps**: 
  1. Navigate to the cards overview view
  2. Verify that card images fill their containers properly
  3. Verify that 5 cards are displayed per row (matching deck view)
  4. Verify that image error handling works correctly

## 2025-08-31 15:30 — fix: Improve deck import process and deck detail view
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/features/decks/views/DeckImportView.vue, src/features/decks/views/DeckDetailView.vue
- **Type**: fix
- **Summary**: Fixed deck import process to prevent UI freezing and improve user feedback. Enhanced deck detail view to show cards in a grid with images.
- **Details**:
  - Added progress bar to deck import view to show import status
  - Implemented non-blocking import process to prevent UI freezing
  - Modified deck import service to add cards to user's collection during import
  - Fixed total card count calculation in deck detail view to properly sum quantities
  - Updated deck detail view to display cards in a grid layout with images
  - Maintained ownership status indicators for each card
- **Impact/Risks**: Low risk changes that improve user experience
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Verify progress bar shows during import
  3. Verify UI remains responsive during import
  4. Check that imported cards are added to the collection
  5. Navigate to the deck detail view
  6. Verify total card count is correct
  7. Verify cards are displayed in a grid with images
  8. Verify ownership status is properly calculated and displayed

## 2025-08-31 16:00 — fix: Correct regex pattern and improve deck import process
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/features/decks/views/DeckImportView.vue, src/features/decks/views/DeckDetailView.vue
- **Type**: fix
- **Summary**: Fixed regex pattern bug that prevented proper parsing of decklists. Improved deck import process and deck detail view.
- **Details**:
  - Fixed regex pattern in deck import service and view to properly parse card information
  - Added progress bar to deck import view to show import status
  - Implemented non-blocking import process to prevent UI freezing
  - Modified deck import service to add cards to user's collection during import
  - Fixed total card count calculation in deck detail view to properly sum quantities
  - Updated deck detail view to display cards in a grid layout with images
  - Maintained ownership status indicators for each card
- **Impact/Risks**: Low risk changes that improve user experience and fix critical parsing bug
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Verify progress bar shows during import
  3. Verify UI remains responsive during import
  4. Check that imported cards are added to the collection
  5. Navigate to the deck detail view
  6. Verify total card count is correct
  7. Verify cards are displayed in a grid with images
  8. Verify ownership status is properly calculated and displayed

## 2025-08-31 17:30 — feat: Implement card image fetching and improve deck import process
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/features/decks/views/DeckImportView.vue, src/features/decks/views/DeckDetailView.vue, src/features/pricing/ScryfallProvider.ts, src/features/linker/EntityLinker.ts, src/features/imports/ImportService.ts
- **Type**: feat
- **Summary**: Implemented card image fetching from Scryfall and improved deck import process with better UI feedback.
- **Details**:
  - Fixed regex pattern bug that prevented proper parsing of decklists
  - Added image fetching functionality to ScryfallProvider
  - Implemented card image storage during deck import
  - Added progress bar to deck import view to show import status
  - Implemented non-blocking import process to prevent UI freezing
  - Modified deck import service to add cards to user's collection during import
  - Fixed total card count calculation in deck detail view to properly sum quantities
  - Updated deck detail view to display actual card images from Scryfall
  - Maintained ownership status indicators for each card
- **Impact/Risks**: Low risk changes that improve user experience and add new functionality
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Verify progress bar shows during import
  3. Verify UI remains responsive during import
  4. Check that imported cards are added to the collection
  5. Navigate to the deck detail view
  6. Verify total card count is correct
  7. Verify card images are displayed correctly
  8. Verify ownership status is properly calculated and displayed

## 2025-08-31 18:45 — fix: Optimize card image fetching in deck import view
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/views/DeckImportView.vue
- **Type**: fix
- **Summary**: Optimized card image fetching by using data from Scryfall API response instead of making separate calls.
- **Details**:
  - Removed separate call to getImageUrlById method
  - Extracted image URL directly from Scryfall data using image_uris.normal path
  - Added fallbacks to image_uris.large and image_uris.small if normal size is not available
  - Used correct structure as shown in Scryfall API example
- **Impact/Risks**: Low risk changes that optimize image fetching and fix the card image display issue
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Navigate to the deck detail view
  3. Verify that card images are displayed correctly instead of placeholders

## 2025-08-31 19:30 — fix: Implement proper card image fetching from Scryfall
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/views/DeckImportView.vue, src/features/decks/views/DeckDetailView.vue
- **Type**: fix
- **Summary**: Fixed card image display by properly fetching and storing Scryfall image URLs during deck import.
- **Details**:
  - Updated DeckImportView.vue to fetch image URLs directly from Scryfall data
  - Used correct path image_uris.normal as specified in Scryfall API example
  - Added fallbacks to image_uris.large and image_uris.small if normal size is not available
  - Removed custom image caching and let browser handle caching automatically
  - Removed debug logging
- **Impact/Risks**: Low risk changes that fix the card image display issue
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Navigate to the deck detail view
  3. Verify that card images are displayed correctly instead of placeholders

## 2025-08-31 20:15 — fix: Resolve database constraint errors during deck import
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/views/DeckImportView.vue
- **Type**: fix
- **Summary**: Fixed database constraint errors that occurred during deck import by removing duplicate card additions and using upsert for deck cards.
- **Details**:
  - Removed duplicate call to cardRepository.add(cardRecord)
  - Changed db.deck_cards.add to db.deck_cards.put to handle updates properly
  - This prevents constraint errors when importing the same deck multiple times
- **Impact/Risks**: Low risk changes that fix database constraint errors
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Verify that no constraint errors occur
  3. Import the same deck again
  4. Verify that no constraint errors occur and the deck is updated properly