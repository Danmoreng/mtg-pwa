# Current Project Status — August 10, 2026

## Release-hardening baseline

Development continues on `stabilize/release-hardening`. The active IndexedDB is
the deliberate fresh start `MtgTrackerDbAccounting`, Dexie schema version 1.
There is no migration from prototype databases and the app never deletes those
older databases automatically.

The accounting rebuild is complete through Phase 3. Phase 4 (switching the
existing stores, analytics, and UI to the canonical selectors) is intentionally
not started until the user reviews the behavior and data model.

## Completed Phase 0 — safety and verification

- One fresh v1 schema declares legacy compatibility, raw import, and canonical
  accounting tables.
- `examples_temp/` is ignored because exports can contain personal/financial data.
- Backup/restore is visible in the main navigation, includes every schema table,
  validates before writing, revives dates, and restores atomically.
- CI runs lint, typecheck, and the complete test suite on Node 22.
- `npm run check`, `npm run test:accounting`, and isolated uniquely named Dexie
  test databases provide repeatable local verification.

## Completed Phase 1 — accounting kernel

- One pure kernel derives effective, sold, remaining, deck-reserved, and freely
  available quantities per canonical lot.
- Open cost basis, realized P/L, and unrealized P/L propagate
  `known | estimated | unknown`; unknown is never treated as zero.
- Executable invariants reject negative inventory, overselling, invalid
  allocations, and over-reservation.
- Deterministic largest-remainder allocation preserves every integer cent,
  including signed totals.

## Completed Phase 2 — canonical persistence and manual commands

- Canonical tables: `inventory_lots`, `inventory_lot_sources`,
  `inventory_adjustments`, `sales`, `sale_lines`, `lot_allocations`,
  `deck_inventory_allocations`, `deck_import_runs`, and
  `reconciliation_issues`.
- `AccountingRepository` exposes the shared lot snapshot and FIFO availability.
- `AccountingCommandService` atomically creates manual inventory and applies or
  reverses immutable adjustments. Stable source references are idempotent and
  conflicting reuse is rejected.

## Completed Phase 3 — deterministic projections

- Cardmarket purchases project to acquisitions/lots; sales project to sales,
  lines, and FIFO lot allocations with exact fee/shipping distribution.
- ManaBox acquisitions allocate known box cost by scan quantity; missing costs
  remain unknown.
- Deck imports store requirements without direct lot links. Existing inventory
  is reserved first; the default leaves missing copies visible. Explicit
  `create_deficit` creates only the confirmed shortage as user-owned
  `deck_gap` inventory with known or unknown cost basis.
- Later Cardmarket/ManaBox evidence for deck-created inventory raises a visible
  `possible_duplicate_inventory` issue.
- Import projections converge across import order: sales take priority over
  unlocked deck reservations, then decks are recomputed. Locked manual choices
  survive reprojection.
- Unmatched, oversold, invalid-quantity, deck-deficit, and duplicate cases remain
  visible in `reconciliation_issues`; projection never invents provisional stock.

## Existing capabilities retained

- Cardmarket multi-file CSV import and normalized `cm_*` staging tables
- ManaBox scan/acquisition import
- Scryfall card hydration and price updates
- MTGJSON and Cardmarket PriceGuide imports
- Deck text import and Moxfield URL import
- Booster-box views, local-first PWA, offline caching, and complete backup/restore

## Deliberately pending Phase 4

The following consumers still read legacy `card_lots`, `transactions`,
`sell_allocations`, or mutable disposal/profit fields and are not yet
authoritative against the new accounting model:

- holdings/cards store and dashboard totals
- portfolio and P/L analytics
- booster-box analytics
- deck coverage/details
- guided manual-correction UI and reconciliation issue UI

Phase 4 should first present the proposed screens/selectors for review, then cut
these consumers over together. Only after that cutover should legacy accounting
fields, provisional-lot paths, and duplicate reconciler code be removed.

## Verification commands

```text
npm run test:accounting
npm run check
npm run verify
```

`npm run verify` also rebuilds tracked production artifacts in `docs/`.
