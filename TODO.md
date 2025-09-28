# M3 Milestone Cleanup TODO

This document outlines the necessary cleanup tasks before merging the M3 milestone into the main branch.

**Current Status:**
- Most tests are now passing (83/84 tests pass)
- Only 1 test remains failing: tests/e2e/reconcile.e2e.test.ts
- The failing test has a DataError related to compound indexes in Dexie schema

## Phase 1: Test Consolidation & Verification

The goal of this phase is to unify the test file structure and ensure all tests are running correctly.

- [x] **Move all test files to the root `tests` directory.** The new structure inside `tests` should mirror the `src` directory structure.
  - `__tests__/identity.parse.test.ts` -> `tests/shared/identity.parse.test.ts`
  - `__tests__/pnl-price.test.ts` -> `tests/features/analytics/pnl-price.test.ts`
  - `__tests__/provisional-lot.test.ts` -> `tests/features/analytics/provisional-lot.test.ts`
  - `__tests__/scan-matcher.test.ts` -> `tests/features/scans/scan-matcher.test.ts`
  - `src/core/Money.test.ts` -> `tests/core/Money.test.ts`
  - `src/data/db.test.ts` -> `tests/data/db.test.ts`
  - `src/stores/cards.test.ts` -> `tests/stores/cards.test.ts`
  - `src/stores/importStatus.test.ts` -> `tests/stores/importStatus.test.ts`
  - `src/test/AutomaticPriceUpdateService.test.ts` -> `tests/features/pricing/AutomaticPriceUpdateService.test.ts`
  - `tests/CostAllocationService.test.ts` -> `tests/features/analytics/CostAllocationService.test.ts`
  - `tests/normalization.test.ts` -> `tests/core/normalization.test.ts`
  - `tests/NormalizationGateway.test.ts` -> `tests/core/NormalizationGateway.test.ts`
  - `tests/PnLService.test.ts` -> `tests/features/analytics/PnLService.test.ts`
  - `tests/reconcile.e2e.test.ts` -> `tests/e2e/reconcile.e2e.test.ts`
  - `tests/ReconcilerService.test.ts` -> `tests/features/scans/ReconcilerService.test.ts`
  - `tests/ReconcilerService2.test.ts` -> `tests/features/scans/ReconcilerService2.test.ts`

- [x] **Update `vitest.config.ts`** to reflect the new test file locations. The `include` pattern should be changed to `['tests/**/*.test.ts']`.

### IMPORTANT: tests are always run by the human user and results are provided inside ./test_results.txt. If you need to re-run the tests, ask the human user for running them and he will confirm that the updated run is inside test_results.txt.

- [x] **Run all tests** and ensure they pass after the move.
<!-- Test status: 1 test failing - tests/e2e/reconcile.e2e.test.ts (DataError with compound indexes) -->

- [ ] **Review and improve test coverage for M3 features.**
  - [ ] **`features/analytics`**:
    - [ ] Add tests for `CostAllocationService.ts` to cover edge cases.
    - [ ] Add tests for `FinanceService.ts`.
    - [ ] Add tests for `PnLService.ts` to cover the new `sell_allocations` logic.
    - [ ] Add tests for `ValuationEngine.ts`.
  - [ ] **`features/imports`**:
    - [ ] Add tests for `ImportPipelines.ts` to cover the order grouping (`relatedTransactionId`) logic.
    - [ ] Add tests for `ImportService.ts` to cover different import scenarios.
  - [ ] **`features/scans`**:
    - [ ] Add tests for `ReconcilerService.ts` to cover the new `sell_allocations` logic.
  - [ ] **`features/pricing`**:
    - [ ] Add tests for `AutomaticPriceUpdateService.ts` to cover different pricing scenarios.
    - [ ] Add tests for `PriceGuideScheduler.ts`.
    - [ ] Add tests for `PriceGuideSyncService.ts`.
  - [ ] **`features/decks`**:
    - [ ] Add tests for `DeckImportService.ts`.
  - [ ] **`data`**:
    - [ ] Add tests for `repos.ts` to ensure data integrity.

## Phase 2: Code Cleanup & Refactoring

This phase focuses on improving code quality and removing obsolete code.

- [ ] **Remove dead code and old services.**
  - [ ] Identify and remove any services that have been replaced by the new adapter pattern implementations.
  - [ ] Remove any unused feature flags related to M2 or older features.
  - [ ] Clean up `src/services` directory, as it seems to contain older implementations.

- [ ] **Address all `// TODO:` comments** in the codebase that are relevant to the M3 milestone.

- [ ] **Enforce consistent coding style.**
  - [ ] Ensure all new UI components use Bootstrap 5 utility classes for styling.
  - [ ] Run a linter and code formatter across the entire project to ensure consistency.

- [x] **Refactor `ReconcilerService2.test.ts`**. Merged valuable tests for `remainingQty` function into `ReconcilerService.test.ts` and deleted the separate file.

## Phase 3: Documentation & Finalization

This phase ensures that the project documentation is up-to-date with the M3 changes.

- [ ] **Update `ai_docs/ARCHITECTURE.md`**.
  - [ ] Add the `sell_allocations` table to the database schema diagram.
  - [ ] Update the data flow diagrams to reflect the new reconciler and allocation logic.

- [ ] **Verify the Dexie migration.**
  - [ ] Ensure that the migration to the new schema version (with `sell_allocations`) is non-destructive and works correctly for existing users.

- [ ] **Create a final `CHANGELOG.md` entry** for the M3 cleanup work.

- [ ] **Update `README.md`** to reflect the new features and improvements.

## Phase 4: Final Review

- [ ] **Perform a full code review** of all the changes made during the cleanup process.
- [ ] **Merge the M3 milestone branch** into `main`.
