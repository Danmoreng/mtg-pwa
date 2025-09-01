---
name: "M3 Enhancement: Historical Pricing"
about: "Enhance database structure to store historical pricing data for cards"
title: "Enhance Database Structure for Historical Pricing"
labels: ["milestone-3", "database", "pricing"]
assignees: ""
---

## Description

Modify the database schema to store historical pricing data for cards to enable time-series analysis and charting.

## Rationale

Currently, only the latest price is available. Storing historical prices will enable:
- Price trend analysis
- Better valuation accuracy
- Portfolio value history tracking

## Implementation Plan

1. Update the PricePoint interface to ensure proper indexing
2. Ensure the database schema properly supports multiple price points per card
3. Implement price history retrieval methods
4. Update pricing service to store historical data

## Files to Modify

- src/data/db.ts
- src/features/pricing/ScryfallProvider.ts
- src/features/analytics/* (valuation components)

## Acceptance Criteria

- [ ] Database properly stores multiple price points per card
- [ ] Historical data is queryable by date ranges
- [ ] Existing price functionality continues to work
- [ ] Unit tests pass for new functionality

## Dependencies

This enhances Milestone 3: Pricing & Snapshots work