# Roadmap (Authoritative)

_Status updated: 2025-09-02_

## Now
- Finish Cardmarket Import wizard (idempotent, error surfaces)
- Finalize pricing snapshots and manual "Take snapshot"
- Fix ESLint/TS configuration issues

## Next
- ManaBox scans + Sold/Owned matching
- Moxfield polish (Need list export)
- PWA offline staging + background sync

## Later
- Analytics deep-dive: KPIs, per-card FIFO P/L, time series chart
- UI component refactor (tables, virtualized lists)
- Historical pricing analysis tools

## Milestones & Acceptance

### M2 Finish: Cardmarket Import (UI & polish)

**Outcome:** fully idempotent, pleasant import UX; holdings & valuation update deterministically.

**Key Tasks:**
- Complete Import Wizard screens (drop/preview → column map → conflicts → summary)
- Strict idempotency: `externalRef = cardmarket:{orderId}:{lineNo}`
- Error surfaces: unknown set/number, currency parse, malformed rows
- Unit tests: parser variants; repo writes; dupe-skip

**Acceptance:** Importing the same CSV twice changes **0** rows; dashboard updates immediately.

**Linked Issues:** 
- #03-import-wizard-framework.md
- #04-cardmarket-csv-parser.md

### M3 Finish: Pricing & Snapshots (ship it)

**Outcome:** "Current value" and "History" are trustworthy without manual fiddling.

**Key Tasks:**
- Price sync worker: batch by set; respect 24h TTL; exponential backoff
- Snapshot writer: one snapshot/day; manual "Take snapshot" action
- Use **price_points** as the only source for valuation (no live calls during calc)
- Display "Last price update" + "Next eligible update" per card

**Acceptance:** After pressing "Take snapshot", a new `valuations(asOf=YYYY-MM-DD)` appears and the chart updates.

**Linked Issues:**
- #07-historical-pricing.md
- #08-scryfall-api-caching.md
- #09-24h-price-caching.md

### M4: ManaBox Scans + Sold/Owned Matching

**Outcome:** Scanned rares clearly marked **Sold** or **Still owned**; traceable to sale.

**Key Tasks:**
- ManaBox CSV worker: variant detection; `cardFingerprint` from `(name,set,collector,finish,language)`
- Matching algorithm (greedy FIFO by sale date; allow fingerprint matching until cardId resolves)
- Scans view with filters; per-scan sale link; partial matches supported
- Reconciliation job re-runs when a fingerprint becomes a `cardId`

**Acceptance:** Import scans → selling the same card later marks the corresponding scans as **Sold** with sale reference.

**Linked Issues:**
- #06-manabox-scans-matching.md

### M5 Wrap: Moxfield Decks (90% → Done)

**Outcome:** Deck page clearly shows ownership coverage and missing pieces.

**Key Tasks:**
- Empty/edge cases (private deck, missing images)
- "Owned / Need / Extra" breakdown; export "Need list" CSV
- Retry/resume import on failure

**Acceptance:** Given a deck URL, details load without blocking UI; ownership % is correct for proxy and language variants.

**Linked Issues:**
- #05-valuation-engine-dashboard.md (partially)

### M6: PWA Polish & Offline UX

**Outcome:** Offline-first, resilient; imports and price sync recover gracefully.

**Key Tasks:**
- SW caching strategies: `app-shell`, `images`, `scryfall`, `moxfield`
- Background sync (periodic & on-retry) for price updates
- Offline import staging: store file + parse result, apply writes when online
- Backup/restore JSON (full DB)

**Acceptance:** Turn off network: app still opens, holdings visible, staged imports queue until online.

**Linked Issues:**
- #10-pinia-state-management.md (partially)

### M7: Analytics Deep-Dive

**Outcome:** Clear KPIs and history, per-card P/L with FIFO.

**Key Tasks:**
- KPIs: Money Spent, Sales (net fees/ship), Realized P/L, Unrealized P/L
- Per-card lots, FIFO cost basis, realized/unrealized split
- Time series chart from snapshots (SVG, no lib); tooltips and range selector

**Acceptance:** KPIs match test fixtures; per-card detail shows lot math that reconciles to totals.

**Linked Issues:**
- #05-valuation-engine-dashboard.md (partially)
- #11-ui-component-refactoring.md (partially)

## Cross-Cutting "Quality First" Track

### Lint/Type hygiene (do this first)
- Fix ESLint and TS config; enable `strict: true`, `noUncheckedIndexedAccess`, and path aliases
- Pre-commit hook: `eslint --max-warnings=0` + `tsc --noEmit`

### Testing (get signal early)
- Vitest: Money math, CSV parsers, FIFO, matching algorithm
- Playwright "happy path": import → price sync → snapshot → dashboard checks

### Performance
- Web workers for all heavy tasks; chunk large CSV imports; virtualized tables in holdings
- IndexedDB: compound indices for `(cardId, happenedAt)` and `(fingerprint, scannedAt)`

### UX consistency (no UI lib, but tidy)
- Small design tokens, reusable table/card/button components, consistent spacing & keyboard focus

## Non-Goals & Constraints

- Client-only application (no server required)
- Primary currency: EUR (extensible to other currencies later)
- No secrets stored in client (Scryfall public pricing only)
- Plain CSS only (no external UI libraries)
- Offline-first design