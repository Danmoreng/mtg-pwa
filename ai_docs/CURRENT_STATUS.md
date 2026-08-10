# Current Project Status — August 10, 2026

## Release-hardening baseline

Development currently continues on `stabilize/release-hardening`. The project is
being recovered as an advanced alpha: existing UI and import integrations are
kept, while persistence and the financial accounting kernel are hardened before
new product features are added.

The active IndexedDB database is the deliberate fresh start `MtgTrackerDbV2`,
Dexie schema version 1. There is no legacy v10 migration because no legacy user
database needs to be retained. The app does not delete or overwrite older
prototype databases.

## Phase 0 — completed baseline work

- All 18 current schema tables are declared in one baseline schema.
- `examples_temp/` is ignored because local Cardmarket exports can contain
  personal or financial data.
- Automatic database deletion on `VersionError`/`UpgradeError` was removed.
- Backup/restore is exposed through the main navigation.
- Backups contain every table, format and schema metadata, and all records.
- Restore validates the complete snapshot before writing, revives Date fields,
  and replaces all tables inside one Dexie transaction.
- Database and backup round-trip tests cover the complete schema and transaction
  rollback.

## Existing capabilities retained

- Cardmarket multi-file CSV import and normalized `cm_*` staging tables
- ManaBox scan/acquisition import
- Scryfall card hydration and price updates
- MTGJSON and Cardmarket PriceGuide imports
- Card, lot, transaction, price history, valuation, and portfolio screens
- Deck text import and Moxfield URL import
- Booster-box views
- Local-first PWA and offline caching

## Known correctness gaps

The following items remain intentionally open for the next phases:

- Remaining inventory is not yet derived consistently from
  `card_lots.quantity - sell_allocations.quantity`.
- Some screens still use `disposedQuantity`/`disposedAt` and can disagree with
  reconciliation and P&L.
- Provisional-lot creation and lot merging need allocation-safe rules.
- Acquisition/box costs are not consistently allocated to lots.
- Shipping and fee semantics differ across analytics services.
- The Cardmarket `cm_*` shadow-write path has not yet become the single canonical
  projection path.
- ManaBox UI imports do not yet use deterministic external references.

Until these items are resolved, displayed holdings and P&L figures should not be
treated as authoritative accounting results.

## Next implementation order

1. Phase 1: define and implement one accounting kernel for remaining quantity,
   acquisition cost, net sale proceeds, and realized/unrealized P&L.
2. Phase 2: make Cardmarket raw/staging data project idempotently into the
   canonical model and remove duplicate import paths.
3. Phase 3: add end-to-end golden-path, migration/baseline, re-import,
   multi-lot sale, backup, and performance coverage.
4. Only then continue manual correction UI, deck coverage, box analytics, and
   deployment automation.
