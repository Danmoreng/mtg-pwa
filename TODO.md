# TODO: ManaBox/CardMarket Import Logic Analysis and Refactoring

This document outlines the findings from an analysis of the CardMarket and ManaBox import logic, the recent fix for the missing `lotId` in CardMarket transactions, and a plan for further testing and improvements.

## 1. Summary of the Recent Fix

*   **Problem:** CardMarket "BUY" transactions were being imported without a `lotId`, meaning they were not being linked to a specific `CardLot`. This prevented proper tracking of acquisition costs and inventory.
*   **Root Cause:** The `importCardmarketTransactions` function in `src/features/imports/ImportService.ts` was responsible for creating the `Transaction` record but did not have the logic to create a corresponding `CardLot`.
*   **Solution:** The `importCardmarketTransactions` function has been updated to include the logic for creating or updating a `CardLot` for each "BUY" transaction and linking it via the `lotId`. This logic was adapted from the more comprehensive `importCardmarketArticles` function.

## 2. Analysis of the Current Import Logic

Based on a review of the codebase, here are some key observations about the current state of the import system:

*   **Multiple CardMarket Import Functions:** There are three distinct functions for handling CardMarket data:
    *   `importCardmarketTransactions`: A simple function for importing individual transactions. (This was the source of the bug).
    *   `importCardmarketOrders`: A function for importing order-level data like commissions and shipping costs.
    *   `importCardmarketArticles`: A more comprehensive function that handles individual articles (cards) within an order, including resolving card data from Scryfall and creating `CardLot`s.
    This separation of concerns is a potential source of confusion and bugs. It's not clear from the code alone which function should be used in which scenario.

*   **Complex `getOrCreateLotForPurchase` Logic:** The `getOrCreateLotForPurchase` function contains complex logic to decide whether to create a new `CardLot` or link to an existing one. It attempts to find an existing lot for the same card that doesn't have a 'BUY' transaction associated with it. While this is a clever way to handle linking purchases to pre-existing lots (e.g., from a ManaBox scan), it's also a potential source of errors and needs to be tested thoroughly.

*   **Provisional Lots for 'SELL' Transactions:** When a 'SELL' transaction is imported for a card that has no existing `CardLot`, the system creates a "provisional lot". This is a good fallback, but it might lead to data inconsistencies if not handled carefully. For example, if the user later imports the corresponding "BUY" transaction, will the provisional lot be updated correctly?

*   **Data Inconsistencies:** The existence of multiple import paths for similar data can lead to inconsistencies in how data is stored. A unified import pipeline would help to ensure that all imported data is processed in the same way.

## 3. Recommended Next Steps and Testing

To ensure the stability and reliability of the import system, the following actions are recommended:

*   **Thoroughly Test the Fix:**
    *   **Test Case 1 (BUY):** Import a CardMarket CSV containing a "BUY" transaction. Verify that a new `CardLot` is created and that its ID is correctly assigned to the `lotId` of the `Transaction`.
    *   **Test Case 2 (SELL - Existing Lot):** Import a CardMarket CSV containing a "SELL" transaction for a card that already has a `CardLot` in the database. Verify that the transaction is correctly linked to the existing lot (or that a `SellAllocation` is created).
    *   **Test Case 3 (SELL - No Lot):** Import a CardMarket CSV containing a "SELL" transaction for a card that does *not* have a `CardLot`. Verify that a new "provisional lot" is created and linked to the transaction.
    *   **Test Case 4 (Idempotency):** Import the same CardMarket CSV file twice. Verify that no duplicate `CardLot`s or `Transaction`s are created.

*   **Refactor the CardMarket Import Logic:**
    *   **Unify Import Functions:** Refactor the three CardMarket import functions (`importCardmarketTransactions`, `importCardmarketOrders`, and `importCardmarketArticles`) into a single, robust service. This service should be able to handle a complete CardMarket export and correctly create all the necessary `Acquisition`, `CardLot`, and `Transaction` records.
    *   **Create a Unified Import Pipeline:** Design and implement a unified import pipeline for all data sources (CardMarket, ManaBox, etc.). This pipeline should have clear stages for:
        1.  **Parsing:** Reading the raw data from the source file.
        2.  **Normalization:** Converting the raw data into a standardized format.
        3.  **Entity Resolution:** Identifying the correct `Card` from the database (using Scryfall, etc.).
        4.  **Data Storage:** Creating or updating the necessary records in the database (`Acquisition`, `CardLot`, `Transaction`, etc.).

*   **Review and Simplify `getOrCreateLotForPurchase`:**
    *   Analyze the logic of the `getOrCreateLotForPurchase` function and see if it can be simplified.
    *   Add more detailed logging to this function to make it easier to debug.

*   **Review the Data Structures:**
    *   Consider if the relationship between `Acquisition`, `CardLot`, and `Transaction` can be made more explicit in the data model. For example, should a `Transaction` always have an `acquisitionId`?

## 4. Long-Term Vision

The long-term goal should be to have a fully automated and reliable import system that can handle data from any source without manual intervention. This will require a significant investment in building a robust import pipeline and a comprehensive test suite.

By following the recommendations in this document, we can move closer to this goal and ensure that the app's data is always accurate and up-to-date.