# Implemented Fixes for MTG PWA Issues

This document summarizes all the fixes implemented to resolve the issues described in `ai_docs/bugfixes.md`.

## 1. CSV Worker Issues Fixed

**File:** `src/workers/cardmarketCsv.ts`

### Issues Resolved:
- Fixed duplicate interface declaration for `CardmarketTransaction`
- Improved `parseCurrency` function to handle NaN values properly
- Ensured correct function signatures for `getValue` functions

### Changes Made:
1. Removed duplicate `CardmarketTransaction` interface
2. Updated `parseCurrency` function to return 0 for invalid values:
   ```typescript
   function parseCurrency(value: string): number {
     if (!value) return 0;
     const cleaned = value.replace(',', '.').replace(/[^0-9.-]+/g, '');
     const n = parseFloat(cleaned);
     return Number.isFinite(n) ? n : 0;
   }
   ```

## 2. Price Store Issues Fixed

**File:** `src/stores/cards.ts`

### Issues Resolved:
- Fixed price store to use `priceCent` instead of `price`
- Implemented use of `PriceQueryService` for provider precedence

### Changes Made:
1. Updated import to include `PriceQueryService`
2. Refactored `loadCardPrices` action to use `PriceQueryService.getLatestPriceForCard`:
   ```typescript
   // Load prices for all cards from the database
   async loadCardPrices() {
     this.loadingPrices = true;
     this.error = null;
     
     try {
       // Get all cards to know which card IDs we need prices for
       const allCards = await cardRepository.getAll();
       const pricesMap: Record<string, Money> = {};
       
       // Get latest price for each card using PriceQueryService (respects provider precedence)
       for (const card of allCards) {
         const priceResult = await PriceQueryService.getLatestPriceForCard(card.id);
         if (priceResult) {
           pricesMap[card.id] = priceResult.price;
         }
       }
       
       this.cardPrices = pricesMap;
     } catch (error) {
       this.error = error instanceof Error ? error.message : 'Failed to load card prices';
       console.error('Error loading card prices:', error);
     } finally {
       this.loadingPrices = false;
     }
   }
   ```

## 3. MTGJSON Wiring Issues Fixed

**Files:** 
- `src/features/pricing/MTGJSONBackfillService.ts`
- `src/workers/mtgjsonBackfill.ts`

### Issues Resolved:
- Fixed incorrect message destructuring in service
- Confirmed correct implementation in worker

### Changes Made:
1. Updated `MTGJSONBackfillService.ts` to use proper message handling:
   ```typescript
   // Handle messages from worker
   worker.onmessage = (e) => {
     const msg = e.data; // { type, ...payload }
     if (msg.type === 'progress') {
       progressCallback?.(msg.processed, msg.total);
     } else if (msg.type === 'mtgjsonBackfillComplete') {
       WorkerManager.terminateWorker(worker);
       resolve(msg); // { success, processedPoints, message? }
     }
   };
   ```

## 4. Price Guide Upload Issues Fixed

**File:** `src/features/pricing/PriceGuideUploadWorker.ts`

### Issues Resolved:
- Added support for header variants
- Improved product ID mapping
- Added empty line skipping

### Changes Made:
1. Updated Papa.parse options to skip empty lines
2. Added `pick` function to handle header variants:
   ```typescript
   const pick = (row: any, ...keys: string[]) =>
     keys.map(k => row[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '';
   ```
3. Updated header parsing to accept multiple variants:
   ```typescript
   const cardmarketId = parseInt(
     pick(row, 'idProduct', 'Product ID', 'product_id', 'id_product'),
     10
   );
   ```
4. Updated price parsing to accept multiple header variants:
   ```typescript
   const price  = parseFloat(pick(row, 'Avg. Sell Price', 'Average Sell Price', 'Avg Sell Price'));
   const avg7d  = parseFloat(pick(row, '7-Day Avg.', '7 Days Average', '7 Day Average', '7 day avg'));
   const avg30d = parseFloat(pick(row, '30-Day Avg.', '30 Days Average', '30 Day Average', '30 day avg'));
   ```

## 5. Cardmarket ID Persistence Fixed

**File:** `src/features/imports/ImportService.ts`

### Issues Resolved:
- Ensured `cardmarketId` is persisted when adding new cards

### Changes Made:
1. Updated `ensureCardInDb` method to include `cardmarketId`:
   ```typescript
   cardmarketId: typeof scryfallData?.cardmarket_id === 'number' ? scryfallData.cardmarket_id : undefined,
   ```

## 6. Price Guide Sync Service Issues Fixed

**File:** `src/features/pricing/PriceGuideSyncService.ts`

### Issues Resolved:
- Fixed incorrect message destructuring in service

### Changes Made:
1. Updated message handling to use proper destructuring:
   ```typescript
   // Handle messages from worker
   worker.onmessage = (e) => {
     const msg = e.data;
     if (msg.type === 'progress') {
       progressCallback?.(msg.processed, msg.total);
     } else if (msg.type === 'priceGuideSyncComplete') {
       WorkerManager.terminateWorker(worker);
       resolve(msg);
     }
   };
   ```

## Verification Checklist

All fixes have been implemented. The following verification steps should be performed:

1. **Build**: `npm run build` (confirms the CSV worker compiles again)
2. **Cardmarket CSV import**: Upload a transactions/orders/articles set → wizard shows parsed rows; importing creates cards & lots; prices no longer NaN in list/grid
3. **Price Guide upload**: Upload the daily CSV; confirm >0 points written (synonym headers + `cardmarketId` mapping)
4. **MTGJSON**: Use the upload wizard step to ingest last 90 days; verify price points with `provider = 'mtgjson.cardmarket'`
5. **Provider precedence**: Spot-check a card that has both Scryfall (today) and MTGJSON (history) and Price Guide (daily) — ensure `cardmarket.priceguide` wins