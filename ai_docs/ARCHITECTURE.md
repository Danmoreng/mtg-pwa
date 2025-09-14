# Architecture (Authoritative)

_Status updated: 2025-09-13_

## Overview
Client-only Vue 3 + TypeScript PWA with IndexedDB (Dexie) and plain CSS. Local-first design; all card data, pricing history, and user state live on-device. Background work handled via Web Workers.


### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      App Shell (PWA)                        │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Holdings  │  Decks  │  Scans  │  Settings    │
├─────────────────────────────────────────────────────────────┤
│                   Pinia State Stores                        │
├─────────────────────────────────────────────────────────────┤
│  Valuation  │  Pricing  │  Import  │  Linker  │  Backup     │
├─────────────────────────────────────────────────────────────┤
│                Web Workers (Background)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ CSV Parser  │  │ Price Sync  │  │ Snapshot    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Dexie Repositories                       │
├─────────────────────────────────────────────────────────────┤
│                    IndexedDB Storage                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Model
All monetary values are stored as integer cents (EUR) to avoid float drift.

### Core Entities
- **cards** — Scryfall-identified print (id, oracleId, setCode, number, lang, finish, imageUrl, timestamps)  
- **card_lots** — Inventory lots with financial tracking (id, cardId, quantity, unitCost, acquisitionPriceCent, totalAcquisitionCostCent, salePriceCent, totalSaleRevenueCent, source, acquiredAt, disposedAt, externalRef, timestamps)  
- **price_points** — Historical price snapshots per cardId/provider/asOf  
- **transactions** — BUY/SELL with fees/shipping, `externalRef` idempotency key, timestamps  
- **decks**, **deck_cards** — Imported Moxfield decks and their cards  
- **settings** — Key/value app configuration  
- **valuations** — Daily portfolio valuation snapshots  
- **scan_sale_links** — Links between scans and sales for reconciliation  

### Inventory Layer (lots)
- **card_lots**  
  - `id` (uuid)  
  - `cardId` → cards.id  
  - `quantity`  
  - `disposedQuantity` (derived)  
  - `unitCost` (cents)  
  - `currency` ("EUR")  
  - `source` (e.g., cardmarket, deck-import)  
  - `acquiredAt`, `createdAt`, `updatedAt`  
  - Enhanced financial tracking fields (acquisitionPriceCent, acquisitionFeesCent, acquisitionShippingCent, totalAcquisitionCostCent, salePriceCent, saleFeesCent, saleShippingCent, totalSaleRevenueCent)

- **scan_sale_links**  
  - `id`  
  - `scanId` → scans.id  
  - `soldTransactionId` → transactions.id  
  - `assignedUnits` (int)  
  - `createdAt`, `updatedAt`  

### Derived Store
- **holdings** — computed from lots; no longer persisted in database  

### Scans
- **scans** — ManaBox exports, normalized fingerprint; may resolve to `cardId` post-linking  

## Pricing Pipeline
Provider: Scryfall. Multi-layer caching:  
1. **Service Worker caching** (stale-while-revalidate ~24h API; images cache-first ~30d)  
2. **In-memory cache**  
3. **Database storage** in `price_points`  
4. **Rate limiting** (~100ms between API requests)  

### Price Update Flow
- On app start, check TTL; if stale, queue price sync worker → batch fetch by set/card → persist `price_points` → update stores/UI  

## Valuation Engine
- FIFO per-lot; realized P/L from sells uses proportional FIFO  
- Unrealized cost basis uses remaining lot quantities  
- Daily snapshots in `valuations`  

## Import Infrastructure
- **Cardmarket Import Wizard** (UI): multi-step (Upload → Map → Preview → Conflicts → Summary)  
- **CSV parser worker**: tolerant column mapping, date/price normalization, idempotent writes via `externalRef`  
- **MTGJSON Import Wizard** (UI): file upload for AllPrices.json.gz with progress tracking
- **MTGJSON upload worker**: decompresses and parses large JSON files, extracts pricing data for owned cards
- **Scryfall integration**: Product-ID-first lookups via `/cards/collection` with fallback to name/set resolution  
- **Deduplication**: Link transactions/imports to existing lots using external references  
- **Idempotency**: All imports are idempotent with external references preventing duplicate data  

## Deck Ownership
- Computed from lots (remaining units); UI highlights coverage  
- All deck operations now use lots as the source of truth  

## PWA / Offline Strategy
- **App shell caching** for instant loads  
- **Navigation fallback** to `/index.html` for offline deep-link refresh  
- **Background sync**: planned for periodic price updates and offline import staging  
- **Backup/Restore**: Full DB export/import including lots + provenance  

## State Management
- Pinia stores for cards/holdings/transactions/decks/settings  
- Cards store centralizes price data with getters/selectors  

## Current Capabilities
- Database v7 with lots as source of truth; holdings derived from lots  
- Price sync worker with TTL checks  
- SW caching for Scryfall API + images  
- Cardmarket Import Wizard with ID-first resolution  
- MTGJSON Import Wizard for historical pricing data  
- Unified CardComponent with modal details and price history charts  
- Deck import from Moxfield; ownership computed from lots  
- Real-time import progress tracking  
- Interactive card image flipping for transform cards  
- Idempotent imports with external references for deduplication  
