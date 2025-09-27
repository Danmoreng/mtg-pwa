# 0) Goals (what you’re adding/changing)

1. **Sell allocations**: allow a single SELL line to consume inventory from **multiple lots** (e.g., 3 copies from lot A, 1 from lot B). Today each SELL ends up attached to one lot; this makes realized P&L and remaining quantities exact across mixed inventory. Your principles already point to this table as the right extension.

2. **Order grouping via relatedTransactionId**: treat “Orders” as lightweight headers and “Articles/Lines” as line items, linking line rows to their order header using `relatedTransactionId`. Your `Transaction` shape already includes this field; your importer code paths already parse Orders and Articles. We’ll wire them together and **exclude header rows from analytics** to avoid double counting.

3. **Leave BUY side as-is**: BUYs create/augment **lots**; order-level fees/shipping are allocated at import/acquisition level, so no “buy allocations” table is needed. Your importer already handles Cardmarket **Purchased Articles** and Orders; we’ll just link them cleanly using the header/line pattern.

---

# 1) Data model & Dexie schema changes

## 1.1 Add a new store: `sell_allocations`

Create a dedicated store to split a SELL line across lots:

```ts
// Dexie v9+ addition
sell_allocations: 'id, transactionId, lotId, quantity, unitCostCentAtSale, createdAt, ' +
                  '[transactionId+lotId], [lotId], [transactionId]'
```

* **Fields**

    * `id: string` (ulid/uuid)
    * `transactionId: string` (SELL line id)
    * `lotId: string`
    * `quantity: number`
    * `unitCostCentAtSale?: number` (snapshot for P&L accuracy)
    * `createdAt: Date`

* **Indexes**: `[transactionId+lotId]` unique (one allocation per lot per line).

This is a **new store** only; no destructive schema changes. Your v9 store block shows how related stores are defined (follow the same pattern).

## 1.2 (Keep existing stores as-is)

* `transactions` already has `relatedTransactionId` and idempotency index `[source+externalRef]`.
* `acquisitions`, `card_lots`, `scans`, and `scan_sale_links` remain unchanged.
* Types for `Acquisition`, `CardLot`, `Transaction`, `Scan`, `ScanSaleLink` are already defined in your docs—keep them; we add a `SellAllocation` interface.

**Acceptance**

* DB opens with new store present, old data intact.
* A fresh DB shows the new store in `db.tables`.

---

# 2) Repository & service layer

## 2.1 Repos

Add a repo with the minimal surface:

```ts
export const sellAllocationRepository = {
  async add(a: SellAllocation) { return db.sell_allocations.add(a); },
  async bulkAdd(rows: SellAllocation[]) { return db.sell_allocations.bulkAdd(rows); },
  async getByTransactionId(txId: string) { return db.sell_allocations.where('transactionId').equals(txId).toArray(); },
  async getByLotId(lotId: string) { return db.sell_allocations.where('lotId').equals(lotId).toArray(); },
  async deleteByTransactionId(txId: string) {
    const rows = await db.sell_allocations.where('transactionId').equals(txId).toArray();
    await db.sell_allocations.bulkDelete(rows.map(r => r.id));
  }
};
```

(Style mirrors your existing repos for acquisitions, scan links, etc.)

## 2.2 Helper APIs (consistent with your reconciler helpers)

You already sketched reconciler helpers like `remainingQty()`, `reassignSellToLot()`, `mergeLots()`. Keep those, but add a new helper:

```ts
async function allocateSellAcrossLots(sell: Transaction, lots: {id:string, purchasedAt:Date}[]): Promise<void>
```

Your reconciler scaffolding & algorithm outline are already present (scans→lots, SELLs→lots, consolidation, provisional lots, merge). We’ll slot allocation here.

---

# 3) Reconciler changes (SELL allocation)

## 3.1 Strategy

For a SELL line with `quantity = q`, walk candidate lots (nearest `purchasedAt` to `happenedAt`, with `remainingQty>0`), and allocate until `q==0`. This extends your existing SELL→lot logic.

**Pseudo:**

```ts
// inside reconcileSellsToLots(identity)
for (const sell of sells) {
  if (!needsAllocation(sell)) continue;

  const candidates = await findLotsByIdentity(identity, sell.happenedAt);
  const ranked = await rankByTimeAndAvailability(candidates, sell.happenedAt); // you already sort by proximity
  let remaining = sell.quantity;

  // clear prior allocations (re-import idempotency)
  await sellAllocationRepository.deleteByTransactionId(sell.id);

  for (const lot of ranked) {
    const free = await remainingQty(lot.id); // lots - sum(allocations & linked SELLs)
    if (free <= 0) continue;
    const take = Math.min(free, remaining);

    await sellAllocationRepository.add({
      id: ulid(),
      transactionId: sell.id,
      lotId: lot.id,
      quantity: take,
      unitCostCentAtSale: await snapshotUnitCost(lot.id, sell.happenedAt),
      createdAt: new Date()
    });

    remaining -= take;
    if (remaining === 0) break;
  }

  // If still >0, create provisional lot as you do today and allocate the remainder from it
  if (remaining > 0) {
    const prov = await findOrCreateProvisionalLot({...identity}, sell.happenedAt, 'backfill');
    await sellAllocationRepository.add({ /* ... quantity: remaining ... */ });
  }

  // (Backward compat) keep sell.lotId:
  // - set to the first allocated lotId (or null if none)
  const first = (await sellAllocationRepository.getByTransactionId(sell.id))[0];
  await transactionRepository.update(sell.id, { lotId: first?.lotId ?? null });
}
```

Your current reconciler already:

* Buckets by identity (card/finish/lang), supports provisional lots, sorts lots by time proximity, and runs after imports. We extend the SELL step only.

**Acceptance**

* SELL line of 4 with two lots having 3 and 5 remaining → allocations [3 from A, 1 from B].
* If no real lot exists, you already create a provisional lot—do the same and allocate remainder.

---

# 4) Derived logic updates

## 4.1 `remainingQty(lotId)`

Update to subtract **sum of allocations** (not just linked transactions) to compute remaining:

```
remaining = lot.quantity
          - Σ sell_allocations.quantity for that lot
```

(Scans do not affect remaining; they’re evidence only.) This aligns with your “lots are source of truth; remaining derived from SELLs” invariant.

## 4.2 Realized P&L per SELL

Compute COGS from allocations:

```
COGS = Σ (allocation.quantity * allocation.unitCostCentAtSale)
Realized P&L = Σ SELL.lineNetCent - COGS
```

Where `lineNetCent = quantity*unitPrice - fees - shipping` for the SELL line. Your cost model and allocation service already exist for BUY/acquisition side; we’re simply snapshotting unit cost at sale time for precision.

**Acceptance**

* P&L equals the sum over allocations for each sell line; totals stable under re-imports.

---

# 5) Importers: Orders vs Articles linkage

## 5.1 What you already parse

Your CSV UI explains **Transaction Summary**, **Sold Articles**, **Purchased Articles**, and optional **Orders**. The code paths parse both Orders and Articles and call `ImportService.importCardmarketOrders(orders)` etc.

## 5.2 Implementation

* For **Orders**: insert one **header Transaction** per order with `cardId = null`, `quantity = 0`, costs set to **order-level** fees/shipping/total, `kind = 'SELL'|'BUY'` depending on direction, and **a stable** `[source+externalRef]` (e.g., `cardmarket:order:<orderId>`). Keep `relatedTransactionId = null` for headers. (Your `Transaction` shape supports headers already.)

* For **Articles/Lines**: insert one **line Transaction** per article with actual `cardId/quantity/unitPrice` etc., and set `relatedTransactionId = <header.id>`. Use idempotency `[source+externalRef]` like `cardmarket:order:<orderId>:line:<lineNo>`—your transaction interface and store indexes support this.

* **Analytics/exports must ignore header rows** (e.g., any transaction with `cardId == null`) so you don’t double count order totals. This is the only code path change outside import/reconcile.

**Acceptance**

* After importing Orders + Articles:

    * Each line has `relatedTransactionId` pointing to its header.
    * Dashboard totals match **sum of lines only**; headers are filtered out.

---

# 6) Idempotency & re-import behavior

* Keep using `[source+externalRef]` to dedupe transactions and acquisitions; the repository helper mirrors this.
* On re-import of a SELL line, **replace** its allocations:

    1. `sellAllocationRepository.deleteByTransactionId(txId)`
    2. Re-run allocation policy (nearest-in-time / FIFO alike).
* Orders re-import should **upsert** the header and **link** existing lines via `relatedTransactionId`.

**Acceptance**

* Re-importing the same CSV leaves identical rows, allocations, and P&L.

---

# 7) UI/UX minimal changes

* **Importer preview**: show that “Orders” create 0-qty headers; “Articles” are the counted lines. You already display file types and guidance; add a note “headers are for grouping only.”
* **Transaction detail**: display allocations for SELL lines (lot chips with qty).
* **Lot detail**: add “Allocated to SELLs: N (list)”.

(Everything else can remain as-is; flags still gate the new reconciler path.)

---

# 8) Tests (unit + integration)

### 8.1 Reconciler allocation

* **Single-lot sale**: SELL qty ≤ remaining of the nearest lot → one allocation.
* **Multi-lot sale**: SELL qty spans lots A and B → two allocations with correct quantities and first lot copied to `sell.lotId`.
* **No lot available**: creates provisional lot and allocates remainder.
* **Re-import idempotency**: allocations are replaced deterministically.

### 8.2 P&L math

* For known unit costs and fees, COGS = Σ(q_i * unitCost_i); realized P&L matches expected.

### 8.3 Import linkage

* Import an **Order** and two **Articles**:

    * Header inserted with `cardId=null`.
    * Articles inserted with `relatedTransactionId=header.id`.
    * Analytics that filter out headers match sums of lines.

### 8.4 Stores & indexes

* Dexie v9 opens; `sell_allocations` exists; transactions store shows `[source+externalRef]` and `relatedTransactionId` present.

---

# 9) Migration & rollout

1. **Dexie upgrade**: add `sell_allocations` store in the **next** version block. Keep upgrade function **no-op** for existing data (this is additive). Your v9 example shows the pattern for additive migrations.

2. **Backfill (optional)**:

    * For existing SELLs with `lotId` set and `quantity=q`, backfill a **single** allocation row `(transactionId, lotId, q)`.

3. **Feature flag**:

    * Keep `M3_RECONCILER_ONLY=false` in prod; test allocation on staging, then enable. Your toggling logic in ScanMatchingService already respects the flag.

4. **Monitoring**:

    * Log when (a) SELL allocation creates a provisional lot, (b) an allocation is split across >1 lot, (c) headers without any lines are imported.

---

# 10) Edge cases to handle

* **Partial fills** (remaining goes to zero on a lot mid-allocation).
* **Negative or zero quantities** in messy CSV rows → reject early.
* **Currency**: currently assumed EUR; ensure consistent in P&L math. (Your types default to EUR.)
* **Ambiguous identity**: if `cardId` is missing on Articles, rely on your product id normalization; you already have mapping guidance and normalization logic in importer paths.

---

# 11) Developer notes for the agent (where in code)

* **Schema**: extend the Dexie `version(n).stores({ ... })` with `sell_allocations` next to `scan_sale_links`.
* **Types**: add `SellAllocation` interface alongside `Transaction`/`ScanSaleLink`.
* **Repos**: mirror the style in `acquisitionRepository`, `scanSaleLinkRepository`.
* **Reconciler**: modify `reconcileSellsToLots()` to call the new `allocateSellAcrossLots()` instead of a single `reassignSellToLot()`. Keep the consolidation step unchanged.
* **Importers**: in the Cardmarket Orders importer, create the **header** transaction; in Articles importer, set `relatedTransactionId` on each line. You already parse both; just connect them.
* **Analytics**: Filter out transactions where `cardId == null` from item-level P&L/quantity dashboards.

---

## TL;DR for the agent

* Add **`sell_allocations`** store + repo.
* Update reconciler to **split a SELL** across lots and **snapshot unit cost** at sale time.
* Keep `transaction.lotId` for backward compat (first allocated lot), but compute **remaining & COGS** from **allocations**.
* Wire **Orders (header)** → **Articles (lines)** via `relatedTransactionId`; **ignore header rows** in analytics.
* Tests: multi-lot allocation, re-import idempotency, header/lines linkage, P&L math.

If you want, I can also provide ready-to-paste TypeScript stubs for `SellAllocation`, the Dexie `stores` delta, the repo, and a minimal `allocateSellAcrossLots()` implementation.
