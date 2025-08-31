---
name: "M3: ManaBox Scans & Matching"
about: "Create ManaBox CSV parser and scans view with matching algorithm"
title: "Implement ManaBox Scans & Matching"
labels: ["milestone-3", "import", "matching"]
assignees: ""
---

## Description

Create ManaBox scans and matching as specified in the project plan:

1. Create `workers/manaboxCsv.ts` 
2. Create `src/features/scans/ScansView.vue`
3. Implement matching algo and resolved/unknown states
4. Tests: unit matching (scan→sale) including multi-quantity

## Acceptance Criteria

- [ ] Worker parses ManaBox CSV files
- [ ] Scans are stored in database with fingerprints
- [ ] Matching algorithm correctly links scans to sales
- [ ] Scans view shows sold/owned status
- [ ] Multi-quantity scans are handled correctly
- [ ] Unit tests pass for matching algorithm