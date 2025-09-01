---
name: "M2: Valuation Engine + Dashboard"
about: "Create the valuation engine and dashboard UI"
title: "Implement Valuation Engine + Dashboard"
labels: ["milestone-2", "analytics", "ui"]
assignees: ""
---

## Description

Create the valuation engine and dashboard as specified in the project plan:

1. Create `src/features/analytics/valuationEngine.ts` 
2. Create `src/features/dashboard/Dashboard.vue`
3. Tests: snapshot correctness with mixed buys/sells

## Acceptance Criteria

- [x] Valuation engine calculates portfolio value
- [x] Valuation engine calculates cost basis with FIFO
- [x] Valuation engine calculates realized/unrealized P/L
- [ ] Dashboard displays KPIs correctly
- [ ] Dashboard shows sparkline charts
- [ ] Unit tests pass for valuation calculations