# TODO: Fix ManaBox Import

This document outlines the plan to fix the ManaBox import functionality.

## Part 1: Process Scans into Cards

The current implementation only imports scans into the `scans` table. We need to process these scans to create `Card` and `CardLot` entries that will be displayed in the application.

- [x] Create a new `ScanProcessingService` with a `processScans` method.
- [x] The `processScans` method will:
  - [x] Fetch all unprocessed scans from the `scans` table.
  - [x] For each scan, check if a `Card` with the `scryfallId` exists.
  - [x] If the card does not exist, fetch the card data from Scryfall and create a new `Card` record.
  - [x] Create a new `CardLot` for the scanned card, linking it to the `Acquisition`.
  - [x] Update the `scan` record to link it to the new `Card` and `CardLot`, and mark it as processed.
- [x] Modify `importManaboxScansWithBoxCost` in `ImportPipelines.ts` to call `ScanProcessingService.processScans` after importing scans.

## Part 2: Relax CSV Parsing Validation

The current CSV parsing is too strict, causing many rows to be skipped.

- [x] Modify `handleManaBoxFileUpload` in `src/features/imports/views/ManaboxImportView.vue`.
- [x] Change the line splitting from `text.split('\n')` to `text.split(/\r?\n/)` to handle different line endings.
- [x] Relax the row validation to require `name` and either `expansion` or `scryfallId`, instead of `name`, `expansion`, and `number`.

## Part 3: Database Initialization Fix

This section addresses the `DatabaseClosedError` encountered when the database is not fully initialized before being accessed.

- [x] Make the `id` property of `DeckCard` required in `src/data/db.ts`.
- [x] Update the schema definitions in `src/data/db.ts` for versions 1, 2, and 3 to use `id` as the primary key for `deck_cards`.
- [x] Remove the problematic upgrade logic for `deck_cards` in version 4 of `src/data/db.ts`.
- [x] Ensure `DeckCard` objects are created with an `id` in `src/features/imports/ImportPipelines.ts`.
- [x] Create an `init.ts` module (`src/data/init.ts`) to handle database initialization, exporting a promise that resolves when the database is ready.
- [x] Modify `src/data/db.ts` to export the `MtgTrackerDb` class instead of a `db` instance.
- [x] Modify `src/data/repos.ts` to use `getDb()` from `init.ts` for all database operations.
- [x] Modify `src/main.ts` to wait for the database initialization promise (`dbPromise`) to resolve before mounting the Vue app.