# M3 Implementation — Agent Fix Plan

## 0) Prep & Safety Net

**Goal:** Create a safe workspace, run everything once, and enable feature flags.

* Create branch: `git checkout -b chore/m3-hardening`
* Full install & typecheck: `npm ci && npm run build && npm run typecheck`
* Run tests: `npm test`
* Add env flag for rollout: `M3_RECONCILER_ONLY=false` (default).
  **DoD:** Build/Tests run; new branch created; flag recognized by code.

---

## 1) Critical Worker Bug (undefined `scan` in tx loop)

**Goal:** Stop runtime errors and unify identity parsing.

* File: `src/workers/reconcile.ts`

    * Replace any `scan.cardFingerprint` usage inside **transactions** loops with the loop variable (likely `tx.cardFingerprint`).
    * Extract `parseIdentity(cardFingerprint: string) => { game, set, number, foil, lang }` into `src/shared/identity.ts`.
    * Replace all ad-hoc `split(':')` parsing with `parseIdentity`.
* Add unit test: `__tests__/identity.parse.test.ts` (edge cases: missing segments, extra segments, foil markers, language codes).
  **DoD:** Worker compiles; tests pass; one canonical identity parser used everywhere.

---

## 2) Fix Object-Spread Typos (syntax that won’t compile at runtime)

**Goal:** Replace pseudo-spread properties like `.transaction`, `.acquisition`, `.patch`, `.defaults` with actual spreads.

* Likely files:

    * `src/services/AcquisitionService.ts`
    * `src/importers/cardmarket.ts` (SELL import path)
* Action:

    * Search: `rg -nE '\.(transaction|acquisition|patch|defaults)\b' src`
    * In object literals, replace:

        * `{ ..., .transaction, ... }` ➜ `{ ..., ...transaction, ... }`
        * `{ ..., .acquisition, ... }` ➜ `{ ..., ...acquisition, ... }`
        * `{ ..., .patch, ... }` ➜ `{ ..., ...patch, ... }`
        * `{ ..., .defaults, ... }` ➜ `{ ..., ...defaults, ... }`
* Add unit test covering the path that constructs those objects (create minimal inputs and assert resulting shape).
  **DoD:** Build succeeds; tests cover at least one real construction site.

---

## 3) Finish `findOrCreateProvisionalLot`

**Goal:** Ensure reconciler can create placeholder lots for unmatched scans.

* File: `src/features/reconciler/lots.ts` (or wherever it lives)
* Implement:

    * Lookup by `(identity, state='provisional', source='scan')`
    * If none, create with fields: `identity`, `state='provisional'`, `purchasedAt=scan.scannedAt || new Date()`, `acquisitionId=null`, `quantity=0`, `sourceRef=scan.id`
    * Return lot entity (persisted)
* Add tests: create + reuse behavior (idempotent on repeated calls with same scan).
  **DoD:** Reconciler no longer throws; creates or reuses provisional lot; tests passing.

---

## 4) Remove / Gate Legacy Matcher

**Goal:** Avoid double-assignment conflicts between legacy matcher and M3 reconciler.

* File: `src/services/ScanMatchingService.ts`
* Action:

    * Wrap legacy `matchScansToSales()` body with feature flag:

      ```ts
      if (process.env.M3_RECONCILER_ONLY === 'true') {
        return reconciler.run(identity); // new path
      }
      // else: legacy code path (temporary)
      ```
    * Add deprecation comment + TODO to delete after rollout.
* Add smoke test to ensure when flag = true only the reconciler path runs.
  **DoD:** Single source of matching when flag is on; no duplicate mutations.

---

## 5) Wire PnL Unrealized to Price Service

**Goal:** Replace placeholder `currentPriceCent` with real price.

* Files: `src/features/pnl/PnLService.ts`, `src/services/PriceQueryService.ts`
* Action:

    * Inject/require `PriceQueryService` in PnL service (memoize by identity).
    * When computing unrealized PnL for open lots, call `PriceQueryService.getLatestPrice(identity)`.
    * Handle “no price” gracefully (treat as 0 or skip with warning).
* Tests:

    * With price available ➜ correct unrealized PnL
    * Without price ➜ deterministic behavior (documented)
      **DoD:** Unrealized PnL no longer 0 when market price exists; tests passing.

---

## 6) Consolidate to `features/*` as Source of Truth

**Goal:** Avoid drift by keeping only the new “feature” services.

* Action:

    * Identify duplicates in `src/services/*` vs `src/features/*` (Reconciler, CostAllocation, PnL).
    * Update imports across codebase to reference `src/features/*` versions.
    * Mark old `src/services/*` counterparts with `@deprecated` JSDoc and re-export to maintain API temporarily.
    * Open tracking issue “Delete legacy services after 2 releases”.
* Test:

    * Typecheck + project-wide lint for unused exports.
      **DoD:** All logic executes from `features/*`; legacy code is thin wrappers only.

---

## 7) Idempotency & Import Hardening

**Goal:** Prevent duplicate transactions/lots across repeated imports.

* DB / Repo:

    * Ensure unique index: `(source, externalRef)` on transactions & acquisitions.
    * Repos: enforce `getBySourceRef(source, externalRef)` before create; use upsert semantics where appropriate.
* Importers:

    * Verify assumptions like `row.id` truly equals `cardId`; if not, map explicitly; add validation with throw/warn.
    * Add retry-safe writes wrapped by idempotency checks.
* Tests:

    * Import same SELL/SCAN twice ➜ only one record; no duplicate lots; reconciler stable.
      **DoD:** Double imports do not create duplicates; tests cover importer+repo path.

---

## 8) Ensure `mergeLots` Exists & Is Correct

**Goal:** Lot consolidation must work or be removed.

* Locate `mergeLots` implementation; if missing:

    * Add to `src/features/reconciler/lots.ts`
    * Merge rules: same `identity` only; `state` rules (prefer ‘active’ over ‘provisional’), sum quantity, combine references, keep earliest `purchasedAt`.
    * Update all callers.
* Tests:

    * Merge two provisionals; merge provisional + active; error if identity mismatch.
      **DoD:** Merge behavior deterministic and tested.

---

## 9) Deterministic Rounding for Cost Allocation

**Goal:** Sum-preserving rounding across acquisitions.

* File: `src/features/allocation/CostAllocationService.ts`
* Implement or keep: distribute cents with Largest Remainder Method (LRM).
* Tests:

    * Fuzzy: random splits sum to total; no off-by-one drift; negative/return cases handled.
      **DoD:** Allocation is sum-preserving; tests pass (100+ randomized cases).

---

## 10) Concurrency Controls & Observability

**Goal:** Avoid race conditions and make failures diagnosable.

* Add per-identity mutex (e.g., `p-limit` keyed by identity) around reconcilers.
* Add structured logs (`logger.info/debug/error`) at step boundaries: import, match, create lot, merge, allocate, pnl compute.
* Emit metrics: counts, durations, failure rates.
  **DoD:** No overlapping reconcile runs for the same identity; logs show clear step traces.

---

## 11) E2E Flow Test (Happy Path & Edge)

**Goal:** Protect the full pipeline.

* Create `__e2e__/reconcile.e2e.test.ts`:

    * Seed: scans (N), buys (M), sells (K) for one identity with partial coverage.
    * Expect: lots created, sells matched FIFO (or chosen policy), allocations consistent, pnl computed, no duplicates on re-run.
    * Run twice to assert idempotency.
      **DoD:** E2E green; re-run safe.

---

## 12) Data Migrations & Backfill Script

**Goal:** Prepare prod data for M3.

* Migration:

    * Unique constraints (see §7), new columns for lots if needed (state, sourceRef).
* Backfill:

    * Script `scripts/backfill-m3.ts`:

        * For each identity, build provisional/active lots from historical acquisitions.
        * Run reconciler once to link existing sells.
* Dry-run mode + progress logs.
  **DoD:** Migration runs locally; backfill dry-run produces sane stats; script committed.

---

## 13) Rollout Plan (Feature Flags)

**Goal:** Safe, incremental enablement.

* Flags:

    * `M3_RECONCILER_ONLY` (default false ➜ true after bake-in)
    * `M3_UNREALIZED_PRICE` (guard price integration)
* Staged rollout:

    1. Enable in staging, compare metrics vs legacy.
    2. Shadow in prod (run but don’t persist, or persist to a shadow table if available).
    3. Flip `M3_RECONCILER_ONLY=true` for 10% of identities, then 100%.
* Add a quick script to flip flag per environment.
  **DoD:** Flags documented; staged plan written in `docs/m3-rollout.md`.

---

## 14) Clean-up & Removal

**Goal:** Remove dead paths after stabilization.

* When §13 reaches 100% and metrics stable 2 weeks:

    * Delete legacy matcher body and legacy services.
    * Remove flags, keep only `parseIdentity` util and reconciler pipeline.
      **DoD:** No legacy code remains; CI green.

---

# Prompts / Commands You Can Paste into Your Agent

### A. Create identity parser + refactor usages

```
Create file src/shared/identity.ts exporting:
  export function parseIdentity(fp: string): { game: string; set: string; number: string; foil: boolean; lang?: string }
Rules:
  - split by ':'
  - recognized shapes: game:set:number[:foil][:lang]
  - foil markers: "foil", "F"
  - normalize lang to lowercase two-letter if present

Refactor all direct "split(':')" identity parsing to use parseIdentity().
Add unit tests in __tests__/identity.parse.test.ts covering typical and malformed inputs.
```

### B. Fix worker bug

```
In src/workers/reconcile.ts, inside any loop over transactions, replace references to "scan.cardFingerprint" with the loop variable (likely "tx.cardFingerprint"). Use parseIdentity() from src/shared/identity.ts. Add tests for reconcile worker to ensure it doesn't throw on a batch of transactions.
```

### C. Replace pseudo-spreads

```
Search for ".transaction", ".acquisition", ".patch", ".defaults" used inside object literals.
Replace with spread syntax: "...transaction", "...acquisition", "...patch", "...defaults".
Add a unit test that builds an object via the allocation/import path and asserts key presence.
```

### D. Implement provisional lot + merge

```
Implement findOrCreateProvisionalLot(identity, scan) and ensure mergeLots(identity, a, b) exists.
Rules for merge:
  - identities must match
  - pick non-provisional state if any
  - sum quantities; min(purchasedAt)
  - union sourceRefs (dedup)
Add tests: merging two provisionals and provisional+active.
```

### E. Gate legacy matcher behind flag

```
In src/services/ScanMatchingService.ts, at the entry point add:

if (process.env.M3_RECONCILER_ONLY === 'true') {
  return reconciler.run(identity);
}

Ensure no legacy code path runs when flag=true. Add a unit test toggling the env var.
```

### F. Price wiring for PnL

```
Inject PriceQueryService into PnLService; replace placeholder currentPriceCent with real price from PriceQueryService.getLatestPrice(identity). Add tests for both "price present" and "price missing".
```

### G. Idempotency & constraints

```
Add unique constraints on (source, externalRef) for Transactions and Acquisitions (migration).
Enforce getBySourceRef() before create in repos. Add import test to re-run the same input twice with no duplicates.
```

### H. E2E test

```
Add __e2e__/reconcile.e2e.test.ts that seeds buys/scans/sells for one identity and asserts lots, allocations, realized/unrealized PnL, idempotency on re-run.
```

---

# Commit Message Templates

* `fix(worker): use tx variable instead of scan; add parseIdentity util`
* `fix(import): replace pseudo-spread fields with proper spreads`
* `feat(reconciler): implement findOrCreateProvisionalLot + mergeLots`
* `feat(pnl): wire unrealized price via PriceQueryService`
* `chore(flags): gate legacy matcher behind M3_RECONCILER_ONLY`
* `chore: consolidate to features/*; deprecate legacy services`
* `feat(db): unique (source, externalRef); importer idempotency`
* `test(e2e): end-to-end reconcile/allocate/pnl + idempotency`

---

# Acceptance Checklist (Final DoD)

* [ ] Build passes, lints clean, 95%+ of changed files covered by unit tests.
* [ ] E2E test passes twice (idempotent).
* [ ] With `M3_RECONCILER_ONLY=true`, only reconciler path runs.
* [ ] Unrealized PnL non-zero where market prices exist.
* [ ] Double imports do **not** create duplicates (enforced by unique constraints & repo checks).
* [ ] No legacy identity parsing remains; only `parseIdentity`.
* [ ] Logs/metrics present for each pipeline step.
* [ ] Staged rollout doc exists and is followed.
* 
