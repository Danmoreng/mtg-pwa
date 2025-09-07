Below is a thorough, source‑based review of your repo and a **step‑by‑step implementation playbook** tailored for your AI agent to execute alongside you.

---

## High‑impact review (what to keep / what to change)

### What’s working well

* **Lot‑based inventory + valuation:** You’ve introduced `card_lots` and shifted valuation to query **historical price points** from `price_points`. This is the right foundation for FIFO and accurate P/L. &#x20;
* **Price caching & persistence:** Price snapshots are persisted via `PriceUpdateService` and background worker; the dashboard reads from DB rather than the API—good for performance and rate limits. &#x20;
* **Unified card component:** Centralizing card display and surfacing price via the store simplifies the views.&#x20;
* **Service Worker caching for Scryfall + images:** `workbox` is wired for API/image caching, which is a solid start for a PWA.&#x20;

### Problems & recommended fixes (prioritized)

1. **SPA navigation doesn’t work offline (no navigation fallback).**
   Your `src/sw.ts` precaches and caches APIs/images but does **not** register a Workbox `NavigationRoute`. Dev SW shows navigation support; the custom SW doesn’t. Add a navigation fallback so deep links work offline. &#x20;

2. **PWA icons are mis‑referenced.**
   The PWA manifest icons point to `src/assets/logo.png`, but there is no `src/assets/` folder with icons; ship real icons under `public/icons` and reference them correctly in `vite.config.ts`.&#x20;

3. **Backups can lose lot data.**
   `BackupService` exports/imports many tables but **omits** `card_lots` and `scan_sale_links`, which are core to your new inventory model—this risks data loss on restore. Include them.&#x20;

4. **Unrealized cost basis overcounts on partially disposed lots.**
   `calculateLotCostBasis` multiplies **unit cost × full lot quantity**; unrealized basis should use **remaining** quantity (qty − disposedQty), consistent with your FIFO logic and how you value lots. &#x20;

5. **Release‑date sorting option doesn’t match the schema.**
   `CardsView.vue` offers “Release Date” sorting and reads `card.releasedAt`, but your `Card` schema has no such field—so the sort is effectively a no‑op. Either remove the option for now or persist `released_at` from Scryfall into the card record. &#x20;

6. **Import idempotency + “IDs first” lookup need consolidation.**
   You’ve started “product‑ID first” + batch lookup direction in docs/tests, but code paths remain inconsistent. Unify all Cardmarket ingests to generate consistent `externalRef`s and prefer Scryfall **/cards/collection** by Cardmarket ID(s); only fall back to set+number; never pass set **names**. (You already wrote this guidance in `ai_docs`.) &#x20;

7. **Minor TS import quirk.**
   `HomeView.vue` imports `ValuationEngine.ts` with an explicit `.ts` extension—unnecessary under Vite and can trip lint/type configs. Remove the extension or make sure `tsconfig.app.json` explicitly allows it.&#x20;

8. **Two ESLint configurations.**
   You have both `eslint.config.js` (flat) and `.eslintrc.json` (legacy). Keep **one** (recommend flat) to avoid drift.&#x20;

9. **Index title/branding.**
   `index.html` still says “Vite + Vue + TS.” Brand it as your app and align the favicon with your shipped PWA icons.&#x20;

10. **Tests are present but commented out.**
    A number of unit tests (regex, pricing batch, valuation) are commented. Re‑enable and align them with the current services to prevent regressions. &#x20;

> **Already fixed:** The deck‑import regex in `DeckImportService.ts` is correct now; leave as is, keep the unit test that asserts it.&#x20;

---

## Implementation playbook for your AI agent

> The tasks below are small, reviewable PRs with exact file edits and acceptance checks. Use Conventional Commits (e.g., `fix:`, `feat:`, `chore:`). Update `docs/AI_CHANGELOG.md` after each PR.

### PR 1 — **feat(pwa): add offline navigation fallback**

**Files**

* `src/sw.ts` (edit)

**Patch (minimal, safe)**

```ts
// src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
// ... existing imports

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Add this block right after precacheAndRoute:
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('index.html')
  )
);

// keep your existing API/image routes below
```

**Why:** Mirrors your dev SW behavior; enables offline deep links.
**Verify:** Build, then offline‑refresh `/decks` or `/cards`—app shell loads. &#x20;

---

### PR 2 — **fix(pwa): correct icons + branding**

**Files**

* `vite.config.ts` (manifest icons)
* `index.html` (title + favicon)
* Add files: `public/icons/icon-192.png`, `public/icons/icon-512.png` (real images)

**Patch (manifest)**

```ts
// vite.config.ts
VitePWA({
  // ...
  manifest: {
    name: 'MTG Collection Value Tracker',
    short_name: 'MTG Tracker',
    start_url: '/mtg-pwa/',
    scope: '/mtg-pwa/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
});
```

**Patch (index)**

```html
<!-- index.html -->
<title>MTG Collection Value Tracker</title>
<link rel="icon" href="icons/icon-192.png" />
```

**Verify:** Lighthouse → “Installable” with correct icons; title shows in the tab. &#x20;

---

### PR 3 — **fix(backup): include lots & scan sale links**

**File**

* `src/features/backup/BackupService.ts`

**Patch**

```ts
// In exportData():
const data: any = {
  cards: await db.cards.toArray(),
  holdings: await db.holdings.toArray(),
  transactions: await db.transactions.toArray(),
  scans: await db.scans.toArray(),
  decks: await db.decks.toArray(),
  deck_cards: await db.deck_cards.toArray(),
  price_points: await db.price_points.toArray(),
  valuations: await db.valuations.toArray(),
  settings: await db.settings.toArray(),
  card_lots: await db.card_lots.toArray(),            // ⬅ add
  scan_sale_links: await db.scan_sale_links.toArray()  // ⬅ add
};

// In importData() (after clear):
if (data.card_lots) await db.card_lots.bulkAdd(data.card_lots);             // ⬅ add
if (data.scan_sale_links) await db.scan_sale_links.bulkAdd(data.scan_sale_links); // ⬅ add
```

**Why:** Prevents data loss when restoring; lots are canonical.
**Verify:** Export → clear DB → import → lots & links restored.&#x20;

---

### PR 4 — **fix(valuation): cost basis uses remaining units**

**File**

* `src/features/analytics/ValuationEngine.ts`

**Patch**

```ts
// Replace calculateLotCostBasis with:
static async calculateLotCostBasis(lot: any): Promise<Money> {
  const unitCost = new Money(lot.unitCost, lot.currency || 'EUR');
  const remaining = lot.disposedQuantity ? (lot.quantity - lot.disposedQuantity) : lot.quantity;
  return unitCost.multiply(remaining);
}
```

**Also ensure** `calculateTotalCostBasis()` sums cost basis across active lots (it already does).
**Verify:** Unit test for partial disposal: qty=3, disposed=1, unit=10.00 → cost basis = 20.00. &#x20;

---

### PR 5 — **chore(cards): hide release‑date sort OR persist it**

**Option A (quick):** remove “Release Date” from `CardsView.vue`.
**Option B:** extend card writes to include Scryfall `released_at` and enable sort.

**File**

* `src/features/cards/views/CardsView.vue`

**Patch (Option A)**

```diff
- <option value="releasedAt">Release Date</option>
```

**Verify:** Sort menu shows only working options; no console warnings. &#x20;

---

### PR 6 — **chore(ts): remove .ts extension in import**

**File**

* `src/features/dashboard/HomeView.vue`

**Patch**

```diff
- import { ValuationEngine } from '../analytics/ValuationEngine.ts';
+ import { ValuationEngine } from '../analytics/ValuationEngine';
```

**(Alternative)** If you prefer extensionful imports, set `allowImportingTsExtensions: true` in `tsconfig.app.json`.
**Verify:** Typecheck & build pass.&#x20;

---

### PR 7 — **chore(lint): single ESLint config**

**Files**

* Remove `.eslintrc.json`, merge its settings into `eslint.config.js` (flat).

**Verify:** `npm run lint` passes with one config.&#x20;

---

### PR 8 — **feat(import): unify Cardmarket “IDs first” + idempotency**

**Files**

* `src/features/pricing/ScryfallProvider.ts` — add `getByCardmarketIds(ids: string[])`.
* `src/features/imports/ImportService.ts` — prefer batch by ID; standardize `externalRef`.
* `src/workers/cardmarketCsv.ts` — ensure we extract Product IDs and stable row identifiers.

**Hints**

* Batch: `POST /cards/collection` with `{ identifiers: [{ cardmarket_id: '...' }, ...] }`.
* `externalRef` examples:

    * Transactions: `cardmarket:tx:{ShipmentNr or uniqueRef}`
    * Orders/articles: `cardmarket:article:{ShipmentNr}:{line}`

**Verify:** Re‑import same CSVs → 0 new rows; logs show batch lookups executed once.  &#x20;

---

### PR 9 — **test: re‑enable critical tests**

**Files**

* `src/test/features/deckImportRegex.test.ts`
* `src/test/features/scryfallProviderBatch.test.ts`
* `src/test/features/valuationEngine.test.ts`

**Actions**

* Un‑comment suites; update imports/mocks to match current services; add new test for partial disposal cost basis.
  **Verify:** `npm test` green. &#x20;

---

## Commands & checks (agent checklist)

1. **Install & build**

    * `npm ci`
    * `npm run lint && npm run typecheck`
    * `npm run build`

2. **Run tests**

    * `npm test` (after re‑enabling test files)

3. **Manual QA**

    * Import sample Cardmarket CSV → confirm lots created and prices recorded.&#x20;
    * Export → clear DB → import backup → confirm lots & links restored.&#x20;
    * Open `/cards` and sort by **Price**; verify it uses store price points. &#x20;
    * Install PWA; toggle offline; refresh `/decks` route → app shell loads.&#x20;

4. **Docs/Changelog**

    * Update `docs/AI_CHANGELOG.md` with each PR’s summary (date, scope, verification steps). (You’re already doing this—keep it going.)&#x20;

---

## Notes on a couple of edge cases

* **Money math across currencies:** Your `Money` ops assume same currency; pricing + costs are EUR across the app today, which is fine. If a non‑EUR path ever appears, enforce currency equality in operations. (Watch realized P/L where transaction currency might differ from lot currency.)&#x20;

* **Holdings vs. lots:** The repo treats holdings as transitional (derived). Prefer lots as the single source of truth; if you keep holdings for legacy views, ensure they’re written from lots (not vice‑versa).&#x20;