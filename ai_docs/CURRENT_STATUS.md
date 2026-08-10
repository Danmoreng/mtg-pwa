# Current Project Status — August 10, 2026

## Release-hardening baseline

Development continues on `stabilize/release-hardening`. The active IndexedDB is
the deliberate fresh start `MtgTrackerDbAccounting`, Dexie schema version 1.
There is no migration from prototype databases and the app never deletes those
older databases automatically.

The accounting rebuild is complete through Phase 4. All user-facing inventory,
deck coverage, dashboard, P/L, valuation, and box consumers now use the shared
canonical selectors. Legacy tables remain only as import compatibility/staging
until the dedicated cleanup phase.

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

## Completed Phase 4 — canonical consumers and guided actions

- `AccountingQueryService` is the shared read model for lots, holdings,
  portfolio totals, card activity, acquisition/box P/L, and deck coverage.
- Unknown and estimated prices/costs remain visible in totals; partial known
  amounts are labelled instead of silently coercing missing values to zero.
- Dashboard, cards/holdings, card history, finance/P&L, valuation snapshots,
  booster boxes, deck lists, and deck details use canonical lots and allocations.
- `/inventory` provides manual printing lookup, inventory creation, auditable
  quantity correction/removal, reversal, and open/resolved issue handling.
- Possible deck/import duplicates can be confirmed as the same physical copy,
  retained as additional inventory, ignored, or reopened. Decisions survive
  reprojection.
- Deck import exposes requirements-only, allocate-existing, and confirmed
  create-deficit policies, with unknown, total, or per-card cost entry.
- Archiving a deck preserves its history while releasing active inventory
  reservations.

## Existing capabilities retained

- Cardmarket multi-file CSV import and normalized `cm_*` staging tables
- ManaBox scan/acquisition import
- Scryfall card hydration and price updates
- MTGJSON and Cardmarket PriceGuide imports
- Deck text import and Moxfield URL import
- Booster-box views, local-first PWA, offline caching, and complete backup/restore

## Pending Phase 5 cleanup and acceptance

- Manually exercise the Phase 4 screens with representative personal imports.
- Remove legacy mutable accounting fields/tables and the provisional-lot
  reconciler after confirming no import compatibility path still needs them.
- Add large-collection benchmarks and explicit selector/projection budgets.
- Complete browser acceptance for import files, offline behavior, and
  backup/restore with populated canonical data.

## Verification commands

```text
npm run test:accounting
npm run check
npm run verify
```

`npm run verify` also rebuilds tracked production artifacts in `docs/`.
