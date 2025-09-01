---
name: "M3 Enhancement: 24h Price Caching"
about: "Implement 24-hour caching for card prices"
title: "Implement 24h Price Caching"
labels: ["milestone-3", "pricing", "caching"]
assignees: ""
---

## Description

Add caching logic to prevent unnecessary API calls to Scryfall, with a 24-hour refresh interval.

## Rationale

This will:
- Reduce API usage and avoid rate limits
- Improve application performance
- Provide a better user experience with faster loading times

## Implementation Plan

1. Add caching logic to ScryfallProvider
2. Store last fetch timestamp in database or localStorage
3. Implement cache validation logic (24h expiry)
4. Add UI indicators for cached vs fresh data

## Files to Modify

- src/features/pricing/ScryfallProvider.ts
- src/data/db.ts (potentially)
- src/core/SettingsService.ts (for cache settings)

## Acceptance Criteria

- [ ] Prices are fetched from API only once per 24 hours
- [ ] Cached prices are used within the 24-hour window
- [ ] UI indicates when data is cached
- [ ] Unit tests pass for caching functionality

## Dependencies

Depends on Issue #8 (General API Caching for Scryfall Requests)