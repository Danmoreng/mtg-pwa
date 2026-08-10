# Architecture (Authoritative)

_Status updated: 2026-08-10_

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
│  │ MTGJSON     │  │ PriceGuide  │  │ Reconciler  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Dexie Repositories                       │
├─────────────────────────────────────────────────────────────┤
│                    IndexedDB Storage                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Model
All monetary values are stored as integer cents (EUR) to avoid float drift.

The current operational schema contains the canonical accounting model plus
legacy compatibility tables retained by older ingestion/reconciliation paths.
All user-facing accounting screens use canonical selectors.
The accounting contract is specified in
[Accounting Target Model](ACCOUNTING_TARGET_MODEL.md) and visualized in
[MTG Accounting Architecture.tldraw](MTG%20Accounting%20Architecture.tldraw).
The Markdown target-model document is canonical when implementation notes and
the visual diagram differ.

The active browser database is the intentional fresh baseline `MtgTrackerDbAccounting`
at Dexie schema version 1. It has no migration path from prototype databases and
never deletes an older database automatically.

### Core Entities
- **cards** — Scryfall-identified print (id, oracleId, setCode, number, lang, finish, imageUrl, timestamps)  
- **acquisitions** — Grouped purchases with total cost (id, kind, source, externalRef, currency, happenedAt, total cost fields, allocation metadata)  
- **inventory_lots** — Canonical physical inventory with immutable starting quantity and explicit cost-basis status
- **inventory_adjustments** — Reversible manual quantity/cost ledger
- **sales**, **sale_lines**, **lot_allocations** — Canonical sale evidence, net proceeds, and sold-cost snapshots
- **deck_inventory_allocations** — Active/released reservations of physical lots for deck requirements
- **price_points** — Historical price snapshots per cardId/provider/asOf  
- **transactions** — BUY/SELL with fees/shipping, `externalRef` idempotency key, timestamps  
- **decks**, **deck_cards** — Imported Moxfield decks and their cards  
- **settings** — Key/value app configuration  
- **valuations** — Daily portfolio valuation snapshots  
- **scan_sale_links** — Links between scans and sales for reconciliation
- **sell_allocations** — Allocation of SELL transactions across multiple CardLots (id, transactionId, lotId, quantity, unitCostCentAtSale)  

### Canonical Accounting Entities (Phases 1–3)

- **inventory_lots** — Immutable starting quantity, allocated cost basis,
  provenance origin, ownership status, finish/language/condition, and acquisition date
- **inventory_lot_sources** — Many provenance records for a physical lot
- **inventory_adjustments** — Immutable, reversible manual quantity/cost ledger
- **sales**, **sale_lines** — Order- and line-level net proceeds in integer cents
- **lot_allocations** — FIFO/manual sale-to-lot allocation with cost/proceeds snapshots
- **deck_inventory_allocations** — Active/released physical deck reservations
- **deck_import_runs** — Explicit inventory and missing-quantity policy per deck import
- **reconciliation_issues** — Visible unmatched, oversold, ambiguous, quantity,
  and possible-duplicate conflicts

`AccountingProjectionCoordinator` runs sales before recomputing unlocked deck
reservations. Cardmarket, ManaBox, and deck projections use stable source
references and deterministic cent allocation, so reimporting converges without
duplicating inventory. `AccountingQueryService` is the only accounting read
model used by the dashboard, holdings/cards, P/L, valuations, boxes, decks, and
manual inventory/reconciliation UI.

### Inventory Layer (lots)
- `inventory_lots.initialQuantity` plus `inventory_adjustments` derives effective quantity.
- `lot_allocations` derives sold and remaining quantity.
- Active `deck_inventory_allocations` derives reserved and freely available quantity.
- `inventory_lot_sources` retains multiple pieces of provenance for one physical lot.
- Unknown cost and price are first-class states and are never represented as zero.

- **scan_sale_links**  
  - `id`  
  - `scanId` → scans.id  
  - `soldTransactionId` → transactions.id  
  - `assignedUnits` (int)  
  - `createdAt`, `updatedAt`  

### Derived Store
- **holdings** — computed from canonical lots/allocations; not persisted

### Scans
- **scans** — ManaBox exports, normalized fingerprint; may resolve to `cardId` post-linking  

## Pricing Pipeline
Multi-layer caching with standardized Cardmarket EUR pricing:
1. **Service Worker caching** (stale-while-revalidate ~24h API; images cache-first ~30d)
2. **In-memory cache**
3. **Database storage** in `price_points` with provider precedence
4. **Rate limiting** (~100ms between API requests)

### Price Update Flow
- On app start, check TTL; if stale, queue price sync worker → batch fetch by set/card → persist `price_points` → update stores/UI
- Daily price updates via Cardmarket Price Guide ingestion
- Historical backfill via MTGJSON AllPrices data
- Finish-aware processing for foil/nonfoil/etched variants
- Automatic valuation snapshots after price updates  

## Valuation Engine
- FIFO/manual `lot_allocations` snapshot sold cost and net proceeds.
- Unrealized P/L uses canonical remaining cost basis and finish-aware prices.
- Daily snapshots are written only when required price/cost inputs are complete.

## Import Infrastructure
- **Cardmarket Import Wizard** (UI): multi-step (Upload → Map → Preview → Conflicts → Summary)  
- **CSV parser worker**: tolerant column mapping, date/price normalization, idempotent writes via `externalRef`  
- **MTGJSON Import Wizard** (UI): file upload for AllPrices.json.gz with progress tracking
- **MTGJSON upload worker**: decompresses and parses large JSON files, extracts pricing data for owned cards
- **Scryfall integration**: Product-ID-first lookups via `/cards/collection` with fallback to name/set resolution  
- **Deduplication**: Link transactions/imports to existing lots using external references  
- **Idempotency**: All imports are idempotent with external references preventing duplicate data  

## Deck Ownership
- Computed from `deck_cards` requirements and active
  `deck_inventory_allocations`; UI shows per-card deficits and total coverage.
- Deck imports default to visible deficits and only create inventory after
  explicit user confirmation. Archiving releases reservations without deleting history.

## PWA / Offline Strategy
- **App shell caching** for instant loads  
- **Navigation fallback** to `/index.html` for offline deep-link refresh  
- **Background sync**: planned for periodic price updates and offline import staging  
- **Backup/Restore**: Versioned full-schema JSON export/import with validation,
  Date revival, and atomic replacement. The UI is available at `/backup`.

## State Management
- Pinia stores for cards/holdings/transactions/decks/settings  
- Cards store centralizes price data with getters/selectors  

## Current Capabilities
- Fresh `MtgTrackerDbAccounting` schema 1 baseline with canonical, operational,
  and Cardmarket staging tables
- Price sync worker with TTL checks  
- SW caching for Scryfall API + images  
- Cardmarket Import Wizard with ID-first resolution  
- MTGJSON Import Wizard for historical pricing data  
- Price history with finish-aware time series  
- Provider precedence system (Price Guide > MTGJSON > Scryfall)  
- Automatic valuation snapshots  
- Unified CardComponent with modal details and price history charts  
- Deck import from Moxfield; ownership computed from lots  
- Real-time import progress tracking  
- Interactive card image flipping for transform cards  
- Idempotent imports with external references for deduplication  
- Acquisition-based inventory management with cost allocation  
- Sell allocation system for precise P&L tracking across multiple lots  
- Reconciler service for matching scans to lots and sales to lots (currently experiencing DataError and NotFoundError issues that require fixing)

## Current Issues
- Legacy `card_lots`/`transactions` and the old provisional-lot reconciler still
  exist for compatibility and should be removed after manual import acceptance.
- Large-dataset performance budgets and populated/offline browser acceptance
  remain release-hardening work.
