Below is a focused, actionable review of your MTG Collection Value Tracker repo. I’ll start with what’s working well, then call out specific risks/bugs, followed by architectural improvements and concrete, PR‑sized fixes (with code). All observations are based on the files you shared.&#x20;

---

## What’s good?

* **Clear, living docs & roadmap.** You ship an “authoritative” architecture, importer specs, and a prioritized roadmap that line up with the code. This makes it easy to reason about scope and next steps.&#x20;
  (See `ai_docs/ARCHITECTURE.md`, `ai_docs/IMPORTERS.md`, `ai_docs/ROADMAP.md`.)

* **Local‑first PWA with sane caching.** You use `vite-plugin-pwa` (injectManifest) and a custom service worker that caches Scryfall API and images. That’s the right direction for an offline‑capable app shell.&#x20;
  (See `vite.config.ts`, `src/sw.ts`.)

* **Typed, versioned IndexedDB via Dexie.** Well‑structured tables, indices, and multi‑version upgrades; you’ve thought about historical pricing, valuations, and lot tracking (v4). The migration code sets defaults and attempts to keep data consistent.&#x20;
  (See `src/data/db.ts` versions 1–4; tests in `src/data/db.test.ts`.)

* **Pinia + stores + repositories.** Repos are typed and keep DB access in one place, leaving components thinner. Stores (cards, holdings, etc.) are in place and used on the dashboard.&#x20;
  (See `src/data/repos.ts`, `src/stores/*`, `src/features/dashboard/HomeView.vue`.)

* **Workers for heavy work.** CSV parsing and price sync run in web workers to avoid blocking the UI, which is exactly what you want for large Cardmarket exports.&#x20;
  (See `src/workers/cardmarketCsv.ts`, `src/workers/priceSync.ts`.)

* **Money utility + tests.** Money is stored as integer cents with a small helper that has unit tests. This avoids float pitfalls and keeps formatting centralized.&#x20;
  (See `src/core/Money.ts`, `src/core/Money.test.ts`.)

* **Importer design acknowledges real-world mess.** The docs and code clearly grapple with Cardmarket ↔ Scryfall mapping; you’ve planned to prefer `cardmarket_id` and only fall back to heuristics. That’s the correct priority.&#x20;
  (See `ai_docs/BUGS.md`, `ai_docs/CARDMARKET_IMPORT_FIXES.md`, `src/features/imports/ImportService.ts`.)

---

## What’s bad / risky (specific, fixable)

1. **PWA icons reference files that don’t exist in the repo.**
   Your manifest points to `src/assets/logo.png` (192 & 512), but there’s no `src/assets/` folder. This will break install badges and icons. Put icons in `public/` (or add the missing files).&#x20;
   (See `vite.config.ts` → `VitePWA({ manifest.icons ... })`.)

2. **No navigation fallback route in the SW (offline deep link can 404).**
   You precache but don’t register a SPA navigation route in `src/sw.ts`. In dev, the generated SW uses `NavigationRoute`, but your production SW doesn’t. Add a navigation fallback to `index.html`.&#x20;
   (Compare `dev-dist/sw.js` vs `src/sw.ts`.)

3. **Backup doesn’t include new “lot” tables.**
   `BackupService` exports/imports many tables but **omits** `card_lots` and `scan_sale_links`, which are now central to your data model. Users will think they backed up everything… and haven’t.&#x20;
   (See `src/features/backup/BackupService.ts`.)

4. **Regex bug in `DeckImportService` (deck text parser).**
   The regex has stray anchors/characters:
   `... \s*$([^)]+)$\s* ...` — that `$(` is invalid and will never match lines like `1 Captain America, First Avenger (SLD) 1726`. Your other view uses the correct form.&#x20;
   (See `src/features/decks/DeckImportService.ts` vs `src/features/decks/views/DeckImportView.vue`.)

5. **Coverage logic mixes “holdings” vs “lots”.**
   Deck coverage in `DeckDetailView.vue` reads `holdings` to compute owned/coverage, but your ingestion increasingly records ownership via `card_lots`. That will underreport ownership unless holdings are also written. Either compute from lots, or keep holdings in sync.&#x20;
   (See `src/features/decks/views/DeckDetailView.vue` and `src/data/db.ts`.)

6. **`.ts` extension in SFC import likely breaks typecheck.**
   In `HomeView.vue`: `import { ValuationEngine } from '../analytics/ValuationEngine.ts';`. With `vue-tsc` strict settings, importing with “.ts” often fails unless `allowImportingTsExtensions` is on in the app tsconfig (it isn’t). Prefer extensionless import.&#x20;
   (See `src/features/dashboard/HomeView.vue`, `tsconfig.app.json`.)

7. **Two ESLint configurations (flat + legacy).**
   You’ve got `eslint.config.js` (flat) **and** `.eslintrc.json`. This can cause rule drift and dev confusion. Pick one (prefer flat config) and delete the other.&#x20;

8. **Idempotency keys for imports are inconsistent.**
   `importCardmarketTransactions` uses `externalRef = cardmarket:{reference}:{lineNumber}` (transactions CSV may not even have `lineNumber`). Orders use `cardmarket:order:{orderId}:{lineNumber}` (again, orders CSV usually isn’t line‑oriented). Articles logic uses a different scheme in docs. Tighten these to your documented `"cardmarket:{orderId}:{lineNo}"` per importer.&#x20;
   (See `src/features/imports/ImportService.ts`, `ai_docs/IMPORTERS.md`.)

9. **Unrealized cost basis is overstated for partially disposed lots.**
   `ValuationEngine.calculateLotCostBasis` multiplies unit cost by **full** lot quantity; in the total you filter fully disposed lots, but partially disposed lots still use full quantity. Use “remaining” quantity, same as you do for valuation.&#x20;
   (See `src/features/analytics/ValuationEngine.ts`.)

10. **Key choice in deck card list can be non‑unique.**
    `:key="`\${deckCard.deckId}-\${deckCard.cardId}`"` will collide if a deck has the same card twice in different lots/roles. Use `deckCard.id`.&#x20;
    (See `src/features/decks/views/DeckDetailView.vue`.)

11. **`ImageCacheService` likely redundant with SW caching.**
    You maintain an IndexedDB image cache and also a Workbox `CacheFirst` images cache. Unless you have a firm use case (e.g., base64 exporting), drop one to reduce complexity. It also isn’t referenced elsewhere.&#x20;
    (See `src/core/ImageCacheService.ts`, `src/sw.ts`.)

12. **UI polish / branding gaps.**
    `index.html` title is still “Vite + Vue + TS”, and the favicon references `vite.svg`. Small, but hurts perceived quality.&#x20;
    (See `index.html`.)

13. **`CardsView` sorts by a field that doesn’t exist.**
    There’s a “releasedAt” sort path in the component, but `Card` has no such field; the code branches handle `undefined`, but the choice adds complexity without effect. Consider removing or populating it.&#x20;
    (See `src/features/cards/views/CardsView.vue`, `src/data/db.ts`.)

---

## Where the architecture could be improved

**Unify ownership into one source of truth (lots).**
Right now “holdings” and “lots” coexist. Your v4 schema (and valuation engine) are clearly lot‑centric; the UI and older logic still assume holdings. Pick *lots* as canonical, update Deck coverage & Cards pages to query lots, and write shims/migrations so holdings are either derived or removed entirely. This removes double‑entry drift.&#x20;

**Introduce a domain/application layer (use cases) with atomic writes.**
Your services write across multiple tables (e.g., importing articles touches `cards`, `card_lots`, `transactions`, `price_points`). Wrap these in Dexie transactions so each import row is applied atomically and idempotently; move these “use cases” to a `application/` layer that depends on repos only. Components would call `ImportCardmarketArticlesUseCase.run()`.&#x20;

**Typed validation at edges (e.g., zod) and structured logs.**
Your importers will benefit from schema‑validated parsing (CSV→DTO→domain). Use Zod (or similar) to validate rows and produce typed, normalized objects. Enhance logs to one structured “resolution report” per row (you’ve begun this), then show a summarized UI for unknown sets/failed lookups.&#x20;
(See the structured log example already in `ImportService.importCardmarketArticles` and the guidance in `ai_docs/BUGS.md`.)

**Background jobs orchestration.**
You already have workers; add a tiny job scheduler that:

* queues price updates and long imports,
* persists job status in `settings` (or a `jobs` table),
* surfaces progress/toasts.
  This makes periodic price sync and “resume on reload” trivial.&#x20;

**SW routing & offline staging.**
Docs promise “offline import staging” and “background sync”; you’ve got caching, but no navigation fallback or background sync wiring yet. Add a `NavigationRoute` fallback, then a (future) periodic sync registration for price updates.&#x20;

---

## Concrete fixes you can ship as small PRs

### 1) Fix the deck text regex (critical parsing bug)

**File:** `src/features/decks/DeckImportService.ts`
**Replace** the broken regex with the one you already use in `DeckImportView.vue`:

```ts
// BEFORE (buggy)
const match = trimmedLine.match(/^(\d+)\s+(.+?)\s*$([^)]+)$\s*(\d+)(?:\s*\*F\*\s*)?$/i);

// AFTER (works; consistent with DeckImportView)
const match = trimmedLine.match(/^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i);
```

This allows lines like `1 Captain America, First Avenger (SLD) 1726` to parse.&#x20;

---

### 2) Make SPA navigation work offline

**File:** `src/sw.ts`
Add a navigation fallback so route refreshes work offline (similar to your dev SW):

```ts
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { createHandlerBoundToURL } from 'workbox-precaching';

// after precacheAndRoute(self.__WB_MANIFEST)
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/index.html'), // precached by __WB_MANIFEST
    { allowlist: [/^\/(?!dev-sw)/] }
  )
);
```

Without this, deep links 404 when offline.&#x20;

---

### 3) Ship real icons & fix the manifest

**File:** `vite.config.ts`
Place icons in `/public/icons/` and reference them with absolute paths:

```ts
VitePWA({
  // ...
  manifest: {
    // ...
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
})
```

Also update `index.html` title & favicon for branding.&#x20;

---

### 4) Include lots in backup & restore

**File:** `src/features/backup/BackupService.ts`
Add `card_lots` and `scan_sale_links` to export/import:

```ts
// export
data.card_lots = await db.card_lots.toArray();
data.scan_sale_links = await db.scan_sale_links.toArray();

// import (after clears)
if (data.card_lots) await db.card_lots.bulkAdd(data.card_lots);
if (data.scan_sale_links) await db.scan_sale_links.bulkAdd(data.scan_sale_links);
```

This prevents silent data loss for lot‑based ownership after restore.&#x20;

---

### 5) Correct unrealized cost basis for partial disposals

**File:** `src/features/analytics/ValuationEngine.ts`
Use remaining quantity for lot cost basis:

```ts
static async calculateLotCostBasis(lot: any): Promise<Money> {
  const unitCost = new Money(lot.unitCost, lot.currency || 'EUR');
  const remaining = lot.disposedQuantity ? (lot.quantity - lot.disposedQuantity) : lot.quantity;
  return unitCost.multiply(remaining);
}
```

And keep the same condition in `calculateTotalCostBasis`. This aligns with how you value lots.&#x20;

---

### 6) Compute deck coverage from lots (or keep holdings in sync)

**File:** `src/features/decks/views/DeckDetailView.vue`
Replace the holdings lookup with a lot‑based sum of **remaining** quantities for the card (mirroring the logic you already have in `CardsView.vue`). Alternatively, write holdings in the import path whenever you add a lot—but having one canonical source (lots) is cleaner.&#x20;

---

### 7) Make imports consistent & robust (idempotency + IDs first)

**File:** `src/features/imports/ImportService.ts`

* Ensure **all** Cardmarket ingests use a consistent `externalRef` format (`cardmarket:{orderId}:{lineNo}` for row‑based CSVs; `cardmarket:tx:{reference}` for summary rows).
* Keep “Cardmarket Product ID → Scryfall cards/collection” as the **first** lookup path (you began implementing `getByCardmarketId` – great).
* Use collector number fallback only if needed and **never** pass a set **name** to Scryfall’s `set=` param.&#x20;
  (See your own guidance in `ai_docs/BUGS.md` / `ai_docs/CARDMARKET_IMPORT_FIXES.md`.)

---

### 8) Remove the `.ts` extension in SFC imports

**File:** `src/features/dashboard/HomeView.vue`

```ts
// BEFORE
import { ValuationEngine } from '../analytics/ValuationEngine.ts';

// AFTER
import { ValuationEngine } from '../analytics/ValuationEngine';
```

If you do prefer extensionful imports, set `allowImportingTsExtensions: true` in **tsconfig.app.json** as well (it’s only in `tsconfig.node.json` now).&#x20;

---

### 9) Use stable keys in deck lists

**File:** `src/features/decks/views/DeckDetailView.vue`
Use `:key="deckCard.id"` instead of `${deckId}-${cardId}` to avoid collisions.&#x20;

---

### 10) Choose one ESLint config

Delete either `eslint.config.js` (flat) **or** `.eslintrc.json` (legacy). I’d keep flat config and migrate the rules from `.eslintrc.json` into it for one source of truth.&#x20;

---

## Other suggestions

* **Virtualize large card grids** to keep the UI snappy once collections grow (e.g., Vue Virtual Scroller). Wire it into `CardsView.vue`.&#x20;

* **Expose “Last price update” and “Next eligible update”** on card and dashboard using a setting keyed by provider. You’re already checking in `HomeView.vue`—surface it in the UI.&#x20;

* **More tests where it hurts:**

  * SetCodeResolver edge cases from `ai_docs/BUGS.md` (Commander/Extras/UB “Stellar Sights”).
  * Import idempotency (re‑import same CSV → 0 new rows).
  * FIFO realized P/L reconciliation with mixed partial disposals.&#x20;

* **Consistency polish**: rename `CsvImportView.vue` to be specific (`CardmarketImportView.vue`) or remove if the wizard fully replaces it; align `README` quick start title and `index.html` title; ensure router links match your final UX.&#x20;

---

### TL;DR priorities

1. Fix deck text regex; 2) Add SW navigation fallback; 3) Include `card_lots` in backup; 4) Compute coverage/cost basis from **lots**; 5) Unify idempotency + product‑ID‑first lookups; 6) Clean up icons, titles, ESLint, and `.ts` imports. These are quick wins that materially improve correctness and UX.&#x20;

If you want, I can draft the exact patches for any of the above as a ready‑to‑paste diff.
