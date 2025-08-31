---
name: "M1: Scryfall Provider & EntityLinker"
about: "Create Scryfall provider and EntityLinker for resolving card fingerprints"
title: "Implement Scryfall Provider & EntityLinker"
labels: ["milestone-1", "api", "linking"]
assignees: ""
---

## Description

Create Scryfall provider and EntityLinker as specified in the project plan:

1. Create `src/features/pricing/scryfallProvider.ts` with `getPrice(cardId): Promise<Money>` and `hydrateCard(cardFingerprint): Promise<Card>`
2. Create `src/features/linker/entityLinker.ts` to resolve fingerprints to `cardId`
3. Tests: mock fetch, resolve sample cards, fallback by set/collector

## Acceptance Criteria

- [ ] ScryfallProvider can fetch prices by card ID
- [ ] ScryfallProvider can fetch prices by set/collector number
- [ ] ScryfallProvider can hydrate cards with full data
- [ ] EntityLinker can resolve fingerprints to card IDs
- [ ] EntityLinker handles fallback resolution
- [ ] Unit tests pass with mocked API calls