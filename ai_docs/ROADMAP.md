# ROADMAP.md

## TL;DR Status
- **M2: Enhanced Data Model** — ✅ Complete  
- **M3: Cardmarket Import (UI & polish)** — ⏳ ~85–90%  
- **M4: Pricing & Automatic Tracking** — ⏳ In progress  
- **M6: Moxfield Decks** — ⏳ ~90%  

---

## Now
- SW navigation fallback for SPA routes  
- Backup includes lots and provenance  
- Compute deck coverage from lots  
- Idempotency consistency across Cardmarket ingests  
- Regex fix in deck text import  
- Branding polish: PWA icons, title/favicon  
- ESLint config: flat config only  
- `.ts` SFC imports cleanup  
- Docs refresh (align with lots + wizard)  

## Next
- **M4 complete**  
  - Batch price sync by set; 24h TTL; exponential backoff  
  - Show last/next price update (card + dashboard)  
  - Valuation uses only `price_points`  
- **Tests**  
  - Idempotency  
  - SetCodeResolver edge cases  
  - FIFO math with partial disposals  
- **Performance**  
  - Virtualized card grids/tables  
  - Chunked CSV processing with progress  

## Later
- **M5: ManaBox scans + Sold/Owned matching**  
- **M7: Offline UX** (background sync + import retry)  
- **M8: Analytics deep-dive** (KPIs, P/L charts)  
- UI refactor with tokens and reusable components  

---

## Milestones & Acceptance

### M2 — Enhanced Data Model (✅)
**Outcome:** Lot-based inventory + provenance  
**Acceptance:** Traceable purchase → scan → deck/sale; valuation constrained to lots  

### M3 — Cardmarket Import (⏳ ~85–90%)
**Outcome:** Idempotent, pleasant import UX  
**Tasks:** Wizard complete; unify idempotency keys; tests  
**Acceptance:** Re-import = zero changes  

### M4 — Pricing & Automatic Tracking (⏳)
**Outcome:** Trustworthy current value + history  
**Tasks:** Worker scheduling; UI surfacing; valuation from `price_points`  
**Acceptance:** Daily automatic updates, accurate history  

### M5 — ManaBox Scans + Matching
**Outcome:** Sold vs owned clear via provenance  

### M6 — Moxfield Decks (⏳ ~90%)
**Outcome:** Coverage from lots; export need list  
**Acceptance:** Handles private decks + missing images  

### M7 — PWA & Offline UX
**Outcome:** Offline-first, resilient sync/import  

### M8 — Analytics Deep-Dive
**Outcome:** KPIs + charts + reconciled FIFO math  

---

## Quality Track
- Strict TypeScript + ESLint hygiene  
- Vitest unit tests + Playwright happy path  
- Structured logs for imports; row-level counters  

---

## Migration Notes
- On restore, derive holdings from lots if legacy views need them  
- All exports include `card_lots` & `scan_sale_links`  
