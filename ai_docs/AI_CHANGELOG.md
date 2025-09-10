# AI Change Log

A chronological log of AI-proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

## 2025-09-10 15:30 — feat: Improve import status indicator UI
- **Author**: AI (Qwen)
- **Scope**: src/components/ImportStatusIndicator.vue
- **Type**: feat
- **Summary**: Updated the import status indicator to show progress directly in the navbar without a dropdown.
- **Details**:
  - Replaced dropdown button with direct progress bar display
  - Shows import name, progress bar, and item count (x/y) directly in navbar
  - Maintains alert notifications for completed imports
  - Fixed TypeScript errors in component
- **Impact/Risks**: UI improvement with no breaking changes.
- **Verification Steps**: Build passes successfully. Manual testing required to verify progress display.
- **Linked Task/Issue**: Request to show import progress directly in navbar

## 2025-09-10 14:00 — feat: Add reusable import status indicator in navbar
- **Author**: AI (Qwen)
- **Scope**: src/stores/importStatus.ts, src/components/ImportStatusIndicator.vue, src/components/Navigation.vue, src/features/decks/DeckImportService.ts, src/features/imports/ImportService.ts, src/features/imports/views/wizard/CardmarketImportWizard.vue, src/features/decks/views/DeckImportView.vue
- **Type**: feat
- **Summary**: Implemented a reusable import status indicator that displays in the navbar for both deck and Cardmarket imports.
- **Details**:
  - Created a Pinia store (importStatus.ts) to track import progress across the application
  - Created a reusable ImportStatusIndicator Vue component that displays in the navbar
  - Integrated import status tracking into both deck import service and Cardmarket import service
  - Updated the Navigation component to include the import status indicator
  - Modified both import wizards to use the new import status system instead of their own status tracking
  - Added uuid dependency for generating unique import IDs
- **Impact/Risks**: New feature with no breaking changes. Added dependency on uuid package.
- **Verification Steps**: Build passes successfully. Manual testing required to verify imports show status in navbar.
- **Linked Task/Issue**: Feature request to show import status in navbar