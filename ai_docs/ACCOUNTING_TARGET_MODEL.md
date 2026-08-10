# Accounting Target Model

_Design contract updated: 2026-08-10_

This document is the canonical, text-searchable contract for the planned
accounting and inventory model. It describes the target of the release-hardening
work; it is not a claim that every table or flow is implemented already.

The companion [Tldraw architecture diagram](MTG%20Accounting%20Architecture.tldraw)
visualizes the current application, the target entities, their relationships,
the migration phases, and the manual-correction UI. If prose and drawing ever
diverge, this Markdown document takes precedence until both are reconciled.

## Goals

- Keep IndexedDB/Dexie as the local-first source of persisted state.
- Start the rebuilt model at a fresh schema version 1; no legacy browser data
  needs to be migrated.
- Keep every monetary amount as integer cents in EUR.
- Separate immutable import evidence from reproducible canonical projections.
- Derive inventory, cost basis, realized P/L, and deck availability through one
  shared accounting kernel.
- Keep imported and manual changes attributable, reversible where appropriate,
  and safe to include in backup/restore.

## Data layers

### Raw and audit layer

Imported files receive a stable file hash and retain their original rows and
parse errors. Representative tables are:

- `import_files`
- `cm_orders_raw`
- `cm_order_lines_raw`
- `cm_ledger_entries_raw`
- `cm_order_ledger_links_raw`
- optional isolated `cm_order_parties`
- `scans_raw`
- `deck_import_raw`
- `deck_import_runs`

Raw records are not inventory. A versioned projection service resolves card
printings, normalizes values, deduplicates records, allocates cents, and upserts
canonical rows using deterministic `sourceRef` values.

### Canonical master data

- `cards` identifies a specific printing. Inventory-specific finish, language,
  and condition belong to lots rather than to the shared card record.
- `price_points` is keyed by card, provider, finish, and date. A missing price is
  unknown, never zero.
- `settings` contains configuration only.

### Acquisition and inventory data

#### `acquisitions`

An acquisition groups the cost and provenance of an inventory entry. Relevant
kinds include purchases, boxes/collections, confirmed deck gaps, and
`manual_entry`. Merchandise, fee, shipping, and total-cost cents may be unknown.

#### `inventory_lots`

A lot represents physically interchangeable copies with the same card printing,
finish, language, condition, provenance, and cost-basis treatment.

Important fields include:

- `acquisitionId` and `cardId`
- immutable `initialQuantity`
- `allocatedCostCent` when known
- `costBasisStatus: known | estimated | unknown`
- `origin: purchase | scan | manual | deck_import`
- `ownershipStatus: imported | user_confirmed`
- finish, language, condition, and acquisition date

Sales, removals, profit, and remaining quantity are not stored as mutable lot
summary fields.

#### `inventory_lot_sources`

This table allows one lot to retain multiple pieces of provenance. A deck-created
lot can later be confirmed by a matching Cardmarket or ManaBox import without
losing either source.

#### `inventory_adjustments`

Manual quantity changes are immutable ledger entries attached to a lot:

- signed, non-zero `quantityDelta`
- signed `costBasisDeltaCent` when known
- `costBasisStatus: known | estimated | unknown`
- reason such as `found`, `correction`, `lost`, `gifted`, `transferred`,
  `damaged`, or `other`
- effective date, optional note, stable manual `sourceRef`, and confirmation time
- optional `reversesAdjustmentId`

A newly entered card normally creates `acquisition(kind=manual_entry)` and a new
lot. Increasing a compatible existing lot may use a positive adjustment, but its
cost-basis effect must be recorded. Removing a copy creates a negative adjustment
with a snapshot of the removed cost basis. It is not a sale and does not create
sale proceeds or realized sale P/L.

Adjustments are never edited or deleted after confirmation. Undo creates an equal
and opposite entry linked through `reversesAdjustmentId`.

## Sales and allocation

- `sales` stores order-level income, fees, and shipping amounts.
- `sale_lines` stores card, quantity, finish/language, and line-level allocated
  amounts.
- `lot_allocations` is the only source of truth connecting sold quantities to
  inventory lots. It snapshots cost basis and net proceeds at allocation time.
- Manually locked allocations survive reprojection.

A sale line must either be completely allocated or have an open reconciliation
issue. No provisional or zero-quantity lot may be invented to hide a mismatch.

## Decks and physical inventory

- `decks` and `deck_cards` describe requirements. A `deck_card` has no direct
  lot identifier.
- `deck_inventory_allocations` is the many-to-many reservation between deck
  requirements and inventory lots.
- A deck can be `requirements_only` or `physical_exclusive`.
- Released allocations no longer reserve inventory.

For a deck import, existing free lots are considered first. The missing-quantity
policy is an explicit choice stored in `deck_import_runs`:

- `leave_missing` leaves the deficit visible.
- `create_deficit` creates only the confirmed deficit after a preview.

The default is `leave_missing`. A created deficit becomes a user-confirmed
`deck_gap` acquisition/lot. Its cost basis can be entered, estimated, or unknown;
it is never silently zero.

If a later Cardmarket or ManaBox import appears to describe the same physical
copy, it creates `possible_duplicate_inventory`. The user resolves it as:

- `same_physical_copy`: attach provenance and applicable cost evidence to the
  existing lot.
- `additional_copy`: retain the old lot and create genuinely additional stock.

## Reconciliation issues

`reconciliation_issues` keeps ambiguity visible instead of mutating inventory to
make an import appear successful. Relevant kinds include:

- `unmatched`
- `oversold`
- `ambiguous`
- `quantity_conflict`
- `possible_duplicate_inventory`

Issues contain stable source references, candidate identifiers, details, status,
resolution, and timestamps.

## Accounting kernel

All stores and views use the same tested selectors. For one lot:

```text
effectiveQuantity = initialQuantity
                  + sum(inventory_adjustments.quantityDelta)

soldQuantity      = sum(lot_allocations.quantity)
remainingQuantity = effectiveQuantity - soldQuantity

deckReserved      = sum(active deck_inventory_allocations.quantity)
availableForDecks = remainingQuantity - deckReserved

openCostBasis     = allocatedCostCent
                  + sum(inventory_adjustments.costBasisDeltaCent)
                  - sum(lot_allocations.costBasisCentSnapshot)

realizedPnL       = sum(lot_allocations.netProceedsCentSnapshot
                  - lot_allocations.costBasisCentSnapshot)
```

If any required cost component is unknown, the corresponding cost basis and P/L
result remains unknown. Unknown is never interpreted as zero.

Manual removals can be reported separately as inventory write-offs or transfers;
they do not enter realized sale P/L.

## Enforced invariants

1. `effectiveQuantity >= 0` for every lot.
2. Sold quantity never exceeds effective quantity.
3. Active physical-deck reservations never exceed the remaining quantity after
   sales.
4. Known monetary totals allocate exactly to their children in integer cents.
5. Reimporting the same source is idempotent.
6. Locked manual decisions are not overwritten by reprojection.
7. Referenced lots are never hard-deleted. A lot with zero effective quantity is
   absent from active holdings but remains auditable.
8. Backup/restore includes every source-of-truth table and restores atomically.

## Manual correction UI

The UI is a guided action flow rather than a raw database editor:

1. Select the exact card printing or existing lot.
2. Choose add, correct quantity, remove, or reverse.
3. Enter quantity, effective date, reason, note, and cost-basis status.
4. Preview the resulting active/free quantity, deck reservations, sale conflicts,
   cost basis, valuation impact, and possible duplicates.
5. Confirm one atomic write.

Removing inventory requires a reason. Conflicts with sold quantities or
`physical_exclusive` decks are blocked until explicitly resolved. After a
successful correction, the UI offers a reversal rather than destructive deletion.

## Derived and auxiliary data

- `valuations` is a rebuildable snapshot cache, never inventory truth.
- Holdings, dashboard, finance/P&L, booster-box analytics, deck coverage, and the
  correction UI consume the same accounting selectors.
- Every source-of-truth table and open issue is visible to backup, restore, and
  diagnostics.

## Implementation order

1. Freeze terms, signs, constraints, table keys, and executable invariants.
2. Implement the accounting kernel and canonical repositories.
3. Project Cardmarket, ManaBox, deck, and manual actions into the canonical model.
4. Cut all screens over to shared selectors, including the manual-correction UI.
5. Remove legacy quantity/profit fields and duplicate reconciliation paths.
6. Complete golden-path, reimport, multi-lot sale, deck-deficit, correction,
   backup/restore, and performance tests before release.
