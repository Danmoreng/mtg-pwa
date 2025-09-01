---
name: "M2: Cardmarket CSV Parser"
about: "Create the Cardmarket CSV parser worker"
title: "Implement Cardmarket CSV Parser"
labels: ["milestone-2", "import", "csv"]
assignees: ""
---

## Description

Create the Cardmarket CSV parser as specified in the project plan:

1. Create `workers/cardmarketCsv.ts` with robust column mapping & type guards
2. Wire to `transactions` upsert & holdings updates
3. Tests: idempotency by `externalRef`, correct FIFO & fees

## Acceptance Criteria

- [x] Worker parses Cardmarket transaction CSVs
- [x] Worker parses Cardmarket order CSVs
- [x] Worker parses Cardmarket article CSVs
- [x] Parsed data is correctly stored in database
- [x] Duplicate imports are handled correctly
- [ ] Unit tests pass for CSV parsing and storage