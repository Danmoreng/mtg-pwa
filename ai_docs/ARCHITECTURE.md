# Architecture (Authoritative)

_Status updated: 2025-09-07_

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
- **price_points** — Historical price snapshots per cardId/provider/asOf  
- **transactions** — BUY/SELL with fees/shipping, `externalRef` idempotency key, timestamps  
- **decks**, **deck_cards** — Imported Moxfield decks and their cards  
- **settings** — Key/value app configuration  

### Inventory Layer (lots)
- **card_lots**  
  - `id` (uuid)  
  - `cardId` → cards.id  
  - `quantity`  
  - `disposedQuantity` (derived)  
  - `unitCost` (cents)  
  - `currency` (\"EUR\")  
  - `source` (e.g., cardmarket, deck-import)  
  - `acquiredAt`, `createdAt`, `updatedAt`  

- **scan_sale_links**  
  - `id`  
  - `scanId` → scans.id  
  - `soldTransactionId` → transactions.id  
  - `assignedUnits` (int)  
  - `createdAt`, `updatedAt`  

### Transitional Entity
- **holdings** — derived from lots; retained for backward compatibility  

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
- **Scryfall integration**: Product-ID-first lookups via `/cards/collection`  
- **Deduplication**: Link transactions/imports to existing lots  

## Deck Ownership
- Computed from lots (remaining units); UI highlights coverage  

## PWA / Offline Strategy
- **App shell caching** for instant loads  
- **Navigation fallback** to `/index.html` for offline deep-link refresh  
- **Background sync**: planned for periodic price updates and offline import staging  
- **Backup/Restore**: Full DB export/import including lots + provenance  

## State Management
- Pinia stores for cards/holdings/transactions/decks/settings  
- Cards store centralizes price data with getters/selectors  

## Current Capabilities
- Database v3+ with pricing indices; v4 adds lots + provenance  
- Price sync worker with TTL checks  
- SW caching for Scryfall API + images  
- Cardmarket Import Wizard  
- Unified CardComponent with modal details  
- Deck import from Moxfield; ownership from lots  
