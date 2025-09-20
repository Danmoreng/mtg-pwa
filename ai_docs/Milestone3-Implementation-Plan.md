# Milestone M3+ Guide — Lots as single source of truth, Scans as evidence, Box pricing via Acquisitions

## Scope (what this delivers)

* **Acquisitions (“boxes”)** to group lots & scans and carry **total cost** (price+fees+shipping).
* **Lots as the only inventory** (active + historical). Remaining quantity is derived from SELL transactions.
* **Scans as evidence** that link to lots (and optionally to SELLs via audit links).
* **Order-agnostic reconciler**: works regardless of the import order of scans, buys, sells, decks.
* **Cost allocation** from acquisition total → lots (equal/price-weighted/manual/rarity).
* **Per-box analytics**: realized & unrealized P\&L.
* **Clean migrations, indexes, tests, and acceptance criteria.**

---

# 0) Principles & invariants

* **Single source of inventory truth:** `card_lots` (never delete lots; compute remaining).
* **Scans are observations, not inventory.** Each scan links to **one** lot (`scan.lotId`), and may have audit links to SELL transactions (`ScanSaleLink`).
* **SELL transactions consume lots.** Eventually every SELL has a `lotId`. (If you later need multi-lot consumption per line, add a `sell_allocations` table.)
* **Optional parent:** `acquisitions` hold a box’s total cost and group its lots/scans.
* **Idempotency:** Imports use deterministic keys (`[source+externalRef]`, row hashes).
* **Derived fields:** If you cache derived fields for performance (e.g., `scan.status`), keep them in sync in the same transaction that changes source data.

---

# 1) Data model changes (TypeScript interfaces)

> These extend/clarify what you already have.

```ts
// 1.1 New: parent entity for boxes/collections
export interface Acquisition {
  id: string; // ulid/uuid
  kind: 'box'|'sealed'|'single'|'collection'|'other';
  source: string;               // 'manabox', 'cardmarket', ...
  externalRef?: string;         // import/order id
  currency: 'EUR';
  happenedAt: Date;

  // Total cost at acquisition level
  totalPriceCent?: number;
  totalFeesCent?: number;
  totalShippingCent?: number;
  totalCostCent?: number;       // derived = sum of above

  allocationMethod?: 'equal_per_card'|'by_market_price'|'manual'|'by_rarity';
  allocationAsOf?: Date;        // last allocation timestamp
  allocationSourceRev?: string; // e.g., 'cardmarket.priceguide:avg7d:2025-09-01'

  createdAt: Date;
  updatedAt: Date;
}

// 1.2 Lots remain the canonical inventory
export interface CardLot {
  id: string;
  cardId: string;
  acquisitionId?: string;       // groups into an Acquisition (box)
  quantity: number;             // acquired qty
  condition: string;
  language: string;             // normalized 'EN'|'DE'...
  finish: 'nonfoil'|'foil'|'etched';
  unitCostCent?: number;        // allocated from acquisition totals
  source: string;
  purchasedAt: Date;

  // derived convenience
  disposedAt?: Date;

  // (keep your detailed cost fields if you prefer)
  acquisitionPriceCent?: number;
  acquisitionFeesCent?: number;
  acquisitionShippingCent?: number;
  totalAcquisitionCostCent?: number;

  createdAt: Date;
  updatedAt: Date;
}

// 1.3 Transactions (SELL must eventually attach to a lot)
export interface Transaction {
  id: string;
  kind: 'BUY'|'SELL';
  cardId?: string;              // useful at import time
  lotId?: string;               // set by reconciler
  quantity: number;
  unitPrice: number;            // cents
  fees: number;                 // cents
  shipping: number;             // cents
  currency: 'EUR';
  source: string;               // 'cardmarket'
  externalRef: string;          // order+line id etc. (idempotency)
  happenedAt: Date;
  notes?: string;
  relatedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 1.4 Scans as evidence (no sold fields)
export interface Scan {
  id: string;
  cardFingerprint: string;
  cardId?: string;
  lotId?: string;               // link to the lot this scan evidences
  acquisitionId?: string;       // (optional) box tag before lot exists
  source: string;               // 'manabox', ...
  scannedAt: Date;
  quantity: number;
  boosterPackId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 1.5 Audit link between scans and SELLs (many-to-many)
export interface ScanSaleLink {
  id: string;
  scanId: string;
  transactionId: string;        // SELL
  quantity: number;
  matchedAt: Date;
  strategy: 'AUTO_FIFO'|'MANUAL'|'RETRY';
  score?: number;
  createdAt: Date;
}
```

---

# 2) Dexie schema migration

## 2.1 Add Version 9 (or next) stores & indexes

```ts
// Version 9 – acquisitions + strengthened indexes + scans.acquisitionId
this.version(9).stores({
  acquisitions: 'id, kind, source, externalRef, currency, happenedAt, createdAt, updatedAt, [source+externalRef]',

  cards: 'id, oracleId, name, set, setCode, number, lang, finish, layout, imageUrl, imageUrlBack, cardmarketId, createdAt, updatedAt',

  card_lots: 'id, cardId, acquisitionId, source, purchasedAt, createdAt, updatedAt, externalRef, ' +
             '[cardId+purchasedAt], [acquisitionId+purchasedAt], [externalRef]',

  transactions: 'id, kind, cardId, lotId, source, externalRef, happenedAt, relatedTransactionId, createdAt, updatedAt, ' +
                '[lotId+kind], [cardId+kind], [source+externalRef], happenedAt',

  scans: 'id, cardFingerprint, cardId, lotId, acquisitionId, source, scannedAt, boosterPackId, createdAt, updatedAt, ' +
         '[lotId+scannedAt], [acquisitionId+scannedAt], [cardId+scannedAt]',

  decks: 'id, platform, name, importedAt, createdAt, updatedAt',
  deck_cards: 'id, deckId, cardId, lotId, addedAt, removedAt, createdAt, [deckId+cardId], [lotId+addedAt]',

  // ensure provider index matches repository API (see §7.3)
  price_points: 'id, cardId, provider, finish, date, currency, priceCent, asOf, createdAt, ' +
                '[cardId+date], [cardId+asOf], [provider+asOf], [cardId+provider+finish+date]',

  valuations: 'id, asOf, createdAt, [asOf+createdAt]',
  settings: 'k, createdAt, updatedAt',
  scan_sale_links: 'id, scanId, transactionId, quantity, matchedAt, createdAt, strategy, score'
}).upgrade(async tx => {
  // Backfill scans.acquisitionId = null; leave existing data intact
  // Ensure disposedAt stays consistent (optional pass to set disposedAt where remaining==0)
});
```

> Deprecate but don’t remove `Scan.sold*` fields in code; **stop writing** to them.

---

# 3) Repository additions & fixes

## 3.1 New acquisition repository

```ts
export const acquisitionRepository = {
  async add(a: Acquisition): Promise<string> { return db.acquisitions.add(a); },
  async getById(id: string) { return db.acquisitions.get(id); },
  async getByExternalRef(source: string, externalRef: string) {
    return db.acquisitions.where('[source+externalRef]').equals([source, externalRef]).first();
  },
  async update(id: string, patch: Partial<Acquisition>) { return db.acquisitions.update(id, patch); },
};
```

## 3.2 Scan repo additions

```ts
async getByAcquisitionId(acquisitionId: string) {
  return db.scans.where('acquisitionId').equals(acquisitionId).toArray();
}
```

## 3.3 Transaction repo idempotency helper

```ts
async getBySourceRef(source: string, externalRef: string) {
  return db.transactions.where('[source+externalRef]').equals([source, externalRef]).toArray();
}
```

## 3.4 Fix `pricePointRepository` method name/index

```ts
async getByCardIdAndProviderAndFinishAndDate(cardId: string, provider: string, finish: string, date: string) {
  return await db.price_points
    .where('[cardId+provider+finish+date]')
    .equals([cardId, provider, finish, date])
    .toArray();
}
```

---

# 4) Normalization utilities (shared, pure)

```ts
export type Finish = 'nonfoil'|'foil'|'etched';
export type Lang = 'EN'|'DE'|'FR'|'IT'|'ES'|'JA'|'KO'|'PT'|'RU'|'ZH'|'HE'|'LA'|'GR'|'AR'|'UNKNOWN';

export interface NormalizedKey {
  cardId?: string;
  setCode: string;
  number: string;   // keep suffix like '123a'
  lang: Lang;
  finish: Finish;
  fingerprint: string; // `${setCode}:${number}:${lang}:${finish}` or name fallback
}

export function normalizeFingerprint(input: {
  cardId?: string; setCode?: string; number?: string; name?: string;
  lang?: string; finish?: string | boolean;
}): NormalizedKey {
  // 1) normalize setCode using alias map
  // 2) normalize number: trim, lower, keep letter suffix; drop '/360' style denominator
  // 3) normalize lang to Lang union
  // 4) normalize finish (foil boolean -> 'foil', strings -> 'nonfoil'|'foil'|'etched')
  // 5) build fingerprint (prefer set/number-based; fallback to name)
}
```

* Add **alias maps** for set codes, finishes, language variants.
* Unit test this with tricky inputs (numbers like `123a`, promos, language synonyms).

---

# 5) Import pipelines (order-agnostic & idempotent)

## 5.1 Manabox scans with box cost

**Input:** CSV rows + total cost (price/fees/shipping) + date.

Steps:

1. `getOrCreate Acquisition` by `[source+externalRef]`; persist total costs & happenedAt.
2. Parse rows → build normalized keys → insert `Scan` rows with `acquisitionId = A.id`.
3. (Optional same pass) **Materialize lots** from scans (see §6) and `linkScanToLot()`.

## 5.2 Cardmarket SELLs

**Input:** Order lines (each with card identity, qty, unit price, fees, shipping, refs, happenedAt).

Steps:

1. For each line, check idempotency via `[source+externalRef]`; insert `Transaction(kind='SELL')`.
2. Reconciler later attaches `lotId` and optionally `ScanSaleLink`s.

## 5.3 Deck imports

Insert `deck_cards` (idempotent on `deckId+cardId+addedAt`). Reconciler will attach `lotId` when a suitable lot exists as of `addedAt`.

---

# 6) Reconciler (order-agnostic core)

## 6.1 Overview

* **Goal:** converge data so each `scan` → one `lot`, each `SELL` → one `lot`.
* **Supports out-of-order:** creates **provisional lots** when needed and merges/reassigns later.

## 6.2 Helper APIs

```ts
function remainingQty(lotId: string): Promise<number>;
function findLotsByIdentity(identity: {cardId?: string; fingerprint: string; finish: Finish; lang: Lang}, at?: Date): Promise<CardLot[]>;
function findOrCreateProvisionalLot(identity, when: Date, source: string, acquisitionId?: string): Promise<CardLot>;
async function linkScanToLot(scanId: string, lotId: string): Promise<void>;
async function reassignSellToLot(transactionId: string, lotId: string): Promise<void>;
async function mergeLots(targetLotId: string, fromLotId: string): Promise<void>; // moves scans & transactions
```

## 6.3 Algorithm (per identity bucket)

* Group candidates by **(cardId || fingerprint, finish, language)**.
* **Scans → lots**

    * Prefer lots in the same `acquisitionId` (if scan has one).
    * Else near in time (± window, bidirectional).
    * If none exist: **create provisional lot** with `purchasedAt = scan.scannedAt` and `source='scan'`, `acquisitionId = scan.acquisitionId`.
    * `linkScanToLot`.
* **SELLs → lots**

    * For each SELL without `lotId`, pick a lot with `remainingQty > 0` and nearest `purchasedAt` ≤ or near `happenedAt` (configurable).
    * If none exist: **create provisional lot** (`source='backfill'`, `purchasedAt = happenedAt`) and attach the SELL.
* **Consolidation**

    * When a BUY or an Acquisition appears that matches identity/time for one or more provisional lots, **merge** provisional lots into the “real” lot (or rehome to acquisition), moving scans and transactions.

> Run the reconciler: after every import and/or on demand.

---

# 7) Cost allocation service (per acquisition)

## 7.1 Methods

* `equal_per_card` — distributes total cost equally per physical card across all lots (by quantity).
* `by_market_price` — weight by `PricePoint` (e.g., `avg7dCent`) near `happenedAt`.
* `by_rarity` — heuristic weights (mythic > rare > uncommon > common).
* `manual` — UI provides per-lot overrides.

## 7.2 Implementation outline

```ts
type AllocationMethod = 'equal_per_card'|'by_market_price'|'manual'|'by_rarity';

async function allocateAcquisitionCosts(
  acquisitionId: string,
  method: AllocationMethod,
  opts?: { provider?: 'scryfall'|'mtgjson.cardmarket'|'cardmarket.priceguide'; date?: string }
) {
  return db.transaction('rw', db.card_lots, db.acquisitions, db.price_points, async () => {
    const A = await db.acquisitions.get(acquisitionId);
    if (!A) throw new Error('Acquisition not found');

    const total = (A.totalPriceCent ?? 0) + (A.totalFeesCent ?? 0) + (A.totalShippingCent ?? 0);
    const lots = await db.card_lots.where('acquisitionId').equals(acquisitionId).toArray();
    const weights = await computeWeights(lots, method, opts); // number[] same length as lots

    const sumW = weights.reduce((a,b)=>a+b,0) || 1;
    // sum-preserving rounding
    let allocated = 0;
    for (let i=0; i<lots.length; i++) {
      const raw = Math.round(total * (weights[i]/sumW));
      const isLast = i === lots.length - 1;
      const alloc = isLast ? (total - allocated) : raw;
      allocated += alloc;

      const unit = Math.floor(alloc / Math.max(1, lots[i].quantity));
      await db.card_lots.update(lots[i].id, {
        totalAcquisitionCostCent: alloc,
        unitCostCent: unit,
        acquisitionPriceCent: alloc, // optional: keep quartet in sync
        updatedAt: new Date()
      });
    }

    await db.acquisitions.update(acquisitionId, {
      totalCostCent: total,
      allocationMethod: method,
      allocationAsOf: new Date(),
      allocationSourceRev: opts?.provider ? `${opts.provider}:${opts?.date ?? ''}` : undefined,
      updatedAt: new Date()
    });
  });
}
```

> **Tip:** For `by_market_price`, use `price_points` with the fixed repo method name (`provider`, not `source`), selecting the row whose `date` is nearest to `A.happenedAt` (or the user-provided `opts.date`).

---

# 8) Per-box analytics (P\&L)

## 8.1 Realized P\&L (sold)

```
revenue_t           = t.quantity * t.unitPrice - t.fees + t.shipping
cogs_t              = t.quantity * lot.unitCostCent
realized_pnl_t      = revenue_t - cogs_t
box_realized_pnl    = Σ realized_pnl_t  for all SELL t where lot.acquisitionId = A.id
total_revenue       = Σ revenue_t        (same scope)
```

## 8.2 Unrealized P\&L (remaining)

```
remaining_q         = lot.quantity - Σ SELL.quantity for t.lotId = lot.id
mtm_lot             = remaining_q * current_price(cardId, finish)
unrealized_pnl_lot  = mtm_lot - (remaining_q * lot.unitCostCent)
box_unrealized_pnl  = Σ unrealized_pnl_lot
```

## 8.3 API

```ts
async function getAcquisitionPnL(acquisitionId: string, asOf = new Date()) {
  // returns { totalCostCent, totalRevenueCent, realizedPnLCent, unrealizedPnLCent, lots: [...] }
}
```

---

# 9) UI/UX touchpoints (minimal to enable workflows)

* **Boxes page** (Acquisitions):

    * Create/edit box with total cost and date.
    * “Import scans to this box”.
    * “Materialize lots” from scans.
    * “Allocate cost” (method selector) + “Reallocate” if stale.
    * Box P\&L summary (realized/unrealized).

* **Scans view**:

    * Filters: `acquisitionId`, card identity, date.
    * Action: “Attach to lot” (if not yet), showing candidate lots (same acquisition preferred).

* **Transactions view (SELLs)**:

    * Highlight SELLs without `lotId`; action: “Attach to lot”.

* **Decks**:

    * Show `lotId` when available; flag entries that reference lots with `remaining=0`.

---

# 10) Concurrency & safety

* Wrap multi-table mutations in **Dexie transactions**.
* Use a **BroadcastChannel** lock (e.g., `reconciler-lock`) to avoid multiple tabs running reconciliation simultaneously.
* Maintain a lightweight heartbeat in `settings['job.reconciler.heartbeat']` to detect/replace stale locks.

---

# 11) Tests

## 11.1 Unit

* `normalizeFingerprint()` edge cases (set code aliases, language synonyms, finishes, numbers like `123a`, `123/360`).
* Allocation weights & sum-preserving rounding.

## 11.2 Integration (Dexie in-memory)

* **Order-agnostic scenarios**:

    1. SELL → later SCAN → later Acquisition (box) → reconciler merges provisional to box lot.
    2. SCAN → later SELL; both attach to same lot.
    3. Manabox scans with total price → materialize lots → allocate costs → SELL links reduce remaining, P\&L matches expectation.
* Idempotent imports via `[source+externalRef]`.
* Reallocate after adding more scans/lots under same box.

## 11.3 E2E (Playwright, if you have UI)

* Create acquisition, import scans, allocate, import sells, verify P\&L.

---

# 12) Acceptance criteria

* **Inventory single source:** Remaining quantity is `lot.quantity - Σ SELL.quantity`; no code path writes `disposedQuantity` or per-scan sold fields.
* **Order-agnostic:** All four permutations (scan→sell, sell→scan, both before box, box before both) converge to identical final state after reconciliation.
* **Allocation:** Sum of per-lot allocations equals acquisition `totalCostCent` (± rounding fixed on last lot). Method switch produces consistent results.
* **Per-box P\&L:** Realized & unrealized computed as specified; numbers stable across re-runs.
* **Idempotent imports:** Re-importing same files creates no duplicates.
* **Performance:** 10k scans imported & materialized in ≤60s baseline; reconciling and allocating in ≤20s.

---

# 13) Step-by-step task list (for your AI agent)

### A) Migrate schema & repos

* [ ] Add **Version 9** with `acquisitions` table; add `scans.acquisitionId`; add indexes listed in §2.1.
* [ ] Implement `acquisitionRepository` (add/get/update/getByExternalRef).
* [ ] Add repo helpers: `transactions.getBySourceRef`, `scans.getByAcquisitionId`.
* [ ] Fix `pricePointRepository` method to use **provider**.

**DoD:** App runs; existing data visible; new tables available.

---

### B) Normalization utilities

* [ ] Implement `normalizeFingerprint()` + alias maps.
* [ ] Unit tests for tricky inputs.

**DoD:** 100% pass on normalization tests.

---

### C) Importers

* **Manabox scans + box cost**

    * [ ] `getOrCreate Acquisition(source, externalRef)`; persist total cost & happenedAt.
    * [ ] Import scans with `acquisitionId`.
    * [ ] Idempotent by row hash; skip duplicates.

* **Cardmarket SELLs**

    * [ ] Insert `Transaction(kind='SELL')` per line idempotently via `[source+externalRef]`.

* **Deck imports**

    * [ ] Insert `deck_cards`; dedupe on `deckId+cardId+addedAt`.

**DoD:** Re-importing same files results in 0 new rows; counters reflect “skipped duplicates”.

---

### D) Reconciler

* [ ] Implement helper APIs (remainingQty, findOrCreateProvisionalLot, linkScanToLot, reassignSellToLot, mergeLots).
* [ ] Implement **scans→lots** then **SELLs→lots** per identity bucket.
* [ ] Respect `acquisitionId` preference and time windows (bidirectional).
* [ ] Create provisional lots when needed; merge/rehome when “real” lot appears.

**DoD:** All order-permutation integration tests pass; SELLs & scans get attached to lots.

---

### E) Cost allocation

* [ ] Implement `allocateAcquisitionCosts(acquisitionId, method, opts)`.
* [ ] Implement `computeWeights()` for each method; for `by_market_price`, fetch `price_points` closest to `happenedAt`.
* [ ] Sum-preserving rounding; write per-lot `totalAcquisitionCostCent` & `unitCostCent`.
* [ ] Update acquisition allocation metadata.

**DoD:** Total per-lot allocations sum exactly to acquisition total; method switching works.

---

### F) P\&L

* [ ] Implement `getAcquisitionPnL(acquisitionId, asOf?)` computing realized/unrealized as in §8.
* [ ] Add small UI/CLI to display P\&L for quick verification.

**DoD:** Numbers match expected small fixtures.

---

### G) Concurrency

* [ ] Add BroadcastChannel lock for long runs (imports/reconciler/allocation).
* [ ] Heartbeat + takeover if stale.

**DoD:** Two tabs cannot both reconcile at once; no double attachments.

---

# 14) Migration notes from current code

* **Scans:** Stop writing `soldTransactionId/soldAt/soldQuantity`.
* **Lots:** Stop writing `disposedQuantity`; compute remaining; set `disposedAt` when remaining hits 0.
* **Transactions:** Prefer a SELL row per order line; ensure `[source+externalRef]` uniqueness (logical).
* **Deck cards:** Keep current design; reconciler fills `lotId` later.
* **Price points:** Update repo to use `provider` in compound index.

---

# 15) Example flows to validate

1. **Box upfront → scans later → sells later**

    * Create Acquisition with total cost → import scans (acqId) → materialize lots → allocate cost → import SELLs → reconciler attaches → P\&L shows realized & unrealized.

2. **Sells first → scans later**

    * Import SELLs (attach provisional lot) → later scans arrive → reconciler merges provisional into real lot (same acquisition) → SELL reattached → P\&L stable.

3. **Deck import any time**

    * Deck rows link to lots when they exist; if a lot reaches remaining 0 while in deck, flag.

---

# 16) Risks & mitigations

* **Ambiguous identity:** rely on normalized keys + manual override UI for rare conflicts.
* **Rounding noise:** use sum-preserving rounding; correct last lot to guarantee totals.
* **Provider drift:** record `allocationSourceRev` to explain allocations later.
* **Performance:** batch reads, `bulkPut`, and compound indexes as specified.