# MTG PWA — Current Work

_Updated: 2026-08-10_

## Completed on `stabilize/release-hardening`

- [x] Phase 0: fresh v1 IndexedDB baseline, complete backup/restore, isolated
  database tests, CI, and verification scripts
- [x] Phase 1: shared accounting kernel, invariant validation, and exact cent
  allocator
- [x] Phase 2: canonical accounting tables/repository and atomic, reversible
  manual commands
- [x] Phase 3: idempotent Cardmarket, ManaBox, and deck projections with visible
  reconciliation issues and import-order convergence

## Phase 4 — canonical consumers and UI

- [x] Implement the reviewed holdings/dashboard/accounting presentation
- [x] Add the guided manual add/remove/correct/reverse workflow
- [x] Add deck coverage and deficit/duplicate-resolution UX
- [x] Cut holdings and cards store over to canonical selectors
- [x] Cut dashboard, P/L, valuations, and booster analytics over together
- [x] Cut deck details/coverage over to `deck_inventory_allocations`
- [x] Add correction and reconciliation issue screens

## Cleanup after Phase 4

- [ ] Remove legacy mutable disposal/profit fields and compatibility tables
- [ ] Retire provisional-lot creation and duplicate legacy reconciliation paths
- [ ] Add large-dataset projection benchmarks and performance budgets
- [ ] Complete manual acceptance with representative Cardmarket, ManaBox, and
  deck imports (automated empty-state/browser smoke coverage is complete)
- [ ] Run browser-level acceptance tests for populated import, backup/restore,
  and offline workflows
- [ ] Prepare the release and deployment only after canonical UI acceptance

See `ai_docs/ACCOUNTING_TARGET_MODEL.md` for the data contract and
`ai_docs/CURRENT_STATUS.md` for the exact implementation boundary.
