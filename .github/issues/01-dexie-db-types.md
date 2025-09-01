---
name: "M1: Create Dexie DB & Types"
about: "Create the Dexie database and type definitions as specified in the project plan"
title: "Implement Dexie DB & Types"
labels: ["milestone-1", "database", "types"]
assignees: ""
---

## Description

Create the Dexie database and type definitions as specified in the project plan:

1. Create `src/data/db.ts` with Dexie init and schema v1
2. Create types in `src/core/types.ts` (Card, Holding, Transaction, Scan, Deck, DeckCard, PricePoint, Valuation, Money)
3. Add repositories in `src/data/repos/*` for CRUD and indexed queries
4. Tests: insert/select/migrate, money arithmetic

## Acceptance Criteria

- [x] Dexie database is initialized with correct schema
- [x] All required types are defined
- [x] Repositories provide CRUD operations
- [x] Repositories support indexed queries
- [x] Unit tests pass for database operations