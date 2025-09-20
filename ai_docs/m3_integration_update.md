# Merge Strategy (minimal risk)

**Phase 1 — “Adapter”**
Keep all existing service entry points under `src/features/**` and make them call the new implementations. This preserves all imports and tests.

**Phase 2 — “Consolidate”**
Once tests/UI are green, gradually move call sites to the new modules (or relocate the new modules into `features/**`), then delete adapters.

This two-phase approach avoids churn in your components, wizards, and tests.

---

# 1) Unify the project layout (decision)

Your repo uses `src/features/**` for domain services. The new code lives in `src/services/**`. To avoid two service layers:

**Option A (recommended): keep `features/**` canonical.**

* Move new modules into feature folders:

    * `src/services/importService.ts` → `src/features/imports/ImportPipelines.ts`
    * `src/services/reconciler.ts` → `src/features/scans/ReconcilerService.ts`
    * `src/services/costAllocation.ts` → `src/features/analytics/CostAllocationService.ts` (or `features/acquisitions/…`)
    * `src/services/pnlCalculation.ts` → `src/features/analytics/PnLService.ts`
    * `src/utils/normalization.ts` → `src/features/imports/Normalization.ts` (or `core/Normalization.ts`)
* Keep **existing** entry points (e.g., `features/imports/ImportService.ts`) and make them call into the new files above.

**Option B: keep `src/services/**` canonical.**

* Leave the new files where they are and change **existing** feature services into thin wrappers that re-export the new code.

Both work; below I assume **Option A** (fits your current architecture).

---

# 2) File-by-file merge map

| Area                   | Old entry point (keep)                                                                                | New implementation (move/rename)                                                  | Adapter action                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Imports**            | `features/imports/ImportService.ts`                                                                   | `features/imports/ImportPipelines.ts` (from `services/importService.ts`)          | ImportService calls ImportPipelines functions (manabox scans with box cost, CMK sells, deck imports). Keep the old method names/signatures.                     |
| **Scans/Matching**     | `features/scans/ScanMatchingService.ts`                                                               | `features/scans/ReconcilerService.ts` (from `services/reconciler.ts`)             | ScanMatchingService becomes a facade that calls ReconcilerService (scans→lots, sells→lots, runReconciler).                                                      |
| **Acquisitions (new)** | —                                                                                                     | `features/acquisitions/AcquisitionService.ts` (wraps repos + cost allocation)     | New feature folder; the Import wizards can call this through ImportService.                                                                                     |
| **Cost Allocation**    | `features/analytics/ValuationEngine.ts` (exists)                                                      | `features/analytics/CostAllocationService.ts` (from `services/costAllocation.ts`) | ValuationEngine should **use** CostAllocationService for unit costs instead of duplicating logic.                                                               |
| **PnL**                | `features/analytics/ValuationEngine.ts`, `FinanceService.ts`                                          | `features/analytics/PnLService.ts` (from `services/pnlCalculation.ts`)            | ValuationEngine composes PnLService for realized/unrealized per acquisition.                                                                                    |
| **Normalization**      | `utils/finishMapper.ts`, `features/pricing/SetCodeResolver.ts`, `utils/collectorNumberParser.test.ts` | `core/Normalization.ts` (from `utils/normalization.ts`)                           | Create **NormalizationGateway** that wraps finishMapper + SetCodeResolver + new normalizeFingerprint(). All importers & reconciler should only use the gateway. |

---

# 3) Keep public APIs stable (wrappers)

## 3.1 ImportService facade (existing)

* Keep current exported functions (whatever your wizards call). Internally call `ImportPipelines`:

    * `importManaboxScansWithBoxCost(...)`
    * `importCardmarketSells(...)`
    * `importDecks(...)`
* If old names differ, add 1–2 line adapters that translate args.

## 3.2 ScanMatchingService facade (existing)

* Re-export or delegate to `ReconcilerService`:

    * `reconcileScansToLots(...)`
    * `reconcileSellsToLots(...)`
    * `runReconciler(...)`
* If old API had a different return shape, adapt it here.

## 3.3 ValuationEngine & FinanceService

* Wire in:

    * `CostAllocationService.allocateAcquisitionCosts(...)`
    * `PnLService.getAcquisitionPnL(...)`
* Keep ValuationEngine’s public API the same. Internally, switch to PnLService for realized/unrealized and to lot `unitCostCent` for COGS.

---

# 4) Data & repos (already started)

You already:

* Added **Version 9** with `acquisitions` and `scans.acquisitionId`.
* Added `acquisitionRepository`, `scanRepository.getByAcquisitionId`, `transactionRepository.getBySourceRef`.
* Fixed `pricePointRepository` to use **provider**.

**Action**

* Create `AcquisitionService` using your repos: `create/get/update`, `getOrCreateByExternalRef`, and helper `listLots(acquisitionId)`.

---

# 5) Normalization unification (remove duplication)

Right now you have pieces in:

* `utils/finishMapper.ts`
* `features/pricing/SetCodeResolver.ts`
* `utils/collectorNumberParser.test.ts` (implies a parser util)
* new `utils/normalization.ts`

**Action (single gateway):**

* Create `core/Normalization.ts` exporting:

    * `normalizeFingerprint(input)` (uses finishMapper + SetCodeResolver + collector number parser).
    * `mapFinish(...)`, `normalizeLang(...)`, `resolveSetCode(...)`.
* Update:

    * `ImportPipelines`, `ReconcilerService`, `DeckImportService`, and any CSV workers to use only **Normalization**.
* Keep existing tests; add a new `Normalization.test.ts` that covers the gateway end-to-end.

---

# 6) Workers & long jobs (no duplicate paths)

You already have a Worker system:

* `workers/WorkerManager.ts`
* `workers/*` for price sync etc.

**Action**

* Add **Reconciler worker** and **Allocation worker** thin wrappers that call `ReconcilerService` and `CostAllocationService` respectively.
* Add a lightweight lock via `BroadcastChannel` inside services (so UI-triggered or worker-triggered runs do not collide).
* Don’t put logic into workers; keep logic in services.

---

# 7) Routing/UI touchpoints (minimal changes)

* Add a simple **Acquisitions view**:

    * Create/edit acquisition (box) with totals.
    * “Import scans into this acquisition”.
    * “Materialize lots”.
    * “Allocate costs”.
    * P\&L summary (call PnLService).
* Keep existing import wizards pointing at `ImportService` — they won’t notice the underlying refactor.
* Scans view: add filter by `acquisitionId`, show `lotId` and residuals if you have that already.

---

# 8) What (if anything) I’d need from the old services

Not required to start. The plan above works generically.
If you want **file-ready wrappers** with exact signatures preserved, share just these **public exports** (function names + types):

* `src/features/imports/ImportService.ts`
* `src/features/scans/ScanMatchingService.ts`
* `src/features/analytics/ValuationEngine.ts`
* `src/features/analytics/FinanceService.ts` (if used by UI)
* `src/features/pricing/SetCodeResolver.ts` (public API only)

With those, I’ll generate adapter files that forward to the new implementations with zero churn to callers.

---

# 9) Concrete step-by-step (git-friendly)

**Commit 1 — add/move new modules (no references)**

* Move/rename new files per §2 (create `ImportPipelines.ts`, `ReconcilerService.ts`, `CostAllocationService.ts`, `PnLService.ts`, `Normalization.ts`).
* Fix imports inside the moved files.

**Commit 2 — wire facades**

* Update `features/imports/ImportService.ts` to call `ImportPipelines`.
* Update `features/scans/ScanMatchingService.ts` to call `ReconcilerService`.
* Update `ValuationEngine.ts` to use `PnLService` + `CostAllocationService`.

**Commit 3 — normalization gateway**

* Replace direct references to finishMapper/SetCodeResolver with `core/Normalization.ts` in importers + reconciler.
* Keep finishMapper/SetCodeResolver as **implementation dependencies** of the gateway (do not delete).

**Commit 4 — workers**

* Add `workers/reconcile.ts`, `workers/allocate.ts` that call the services.
* Extend `WorkerManager` to start these jobs.

**Commit 5 — tests green**

* Run the existing tests (they should still pass).
* Add tests for `Normalization`, `ReconcilerService` (integration with Dexie in-memory), `CostAllocationService`, `PnLService`.
* Ensure `milestone2.test.ts`, pricing tests, and deck tests remain green.

**Commit 6 — optional consolidation**

* If desired, update call sites to import new services directly (skip facades).
* Remove adapters once the app compiles & tests pass without them.

---

# 10) Risk register & mitigations

* **Duplicate services imported in different places** → enforce **one facade** per area (Imports/Scans/Analytics). Run ESLint rule to flag uses of the new files directly until consolidation.
* **Normalization divergence** → gateway (single import path).
* **Index mismatch** (`provider` vs `source`) → already fixed; ensure no callers rely on old index.
* **Breaking types** → adapters shield the UI/tests; only adapters know both shapes.
* **Concurrency** → keep locks in services (not workers), so both UI and workers are safe.

---

# 11) Quick adapters (pattern)

**features/imports/ImportService.ts**

```ts
// keep existing exports, delegate to new pipelines
import * as Pipelines from './ImportPipelines';

export async function importManaboxScansWithBoxCost(args: /* existing type */) {
  return Pipelines.importManaboxScansWithBoxCost(args);
}
// ...repeat per function
```

**features/scans/ScanMatchingService.ts**

```ts
import * as Reconciler from './ReconcilerService';

export const runAutoMatch = Reconciler.runReconciler;
export const reconcileScansToLots = Reconciler.reconcileScansToLots;
export const reconcileSellsToLots = Reconciler.reconcileSellsToLots;
```

**features/analytics/ValuationEngine.ts (internal changes only)**

```ts
import { getAcquisitionPnL } from '../analytics/PnLService';
import { allocateAcquisitionCosts } from '../analytics/CostAllocationService';
// Keep ValuationEngine’s public API; use the above for implementation.
```

---

# 12) Done criteria

* All existing UI compiles with **no import path changes**.
* All existing tests green (especially import, pricing, valuation, deck, and milestone2 suites).
* New services covered by unit + a few integration tests.
* New Acquisitions view functional (create box → import scans → materialize lots → allocate → PnL).

---

If you want, send the **public exports** (just the function names & types) for the 5 files in §8 and I’ll return **ready-to-paste adapter code** that preserves their signatures exactly while delegating to the new implementations.
