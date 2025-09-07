# Cardmarket Import Fixes Documentation

## Problem Summary

Based on the `BUGS.md` file, there are issues with resolving Cardmarket set names to Scryfall set codes during CSV imports. Specifically:

1. Set resolver fails to map Cardmarket set names to correct Scryfall set codes
2. Even when sets are apparently resolved, the wrong printing/version is selected
3. This results in cards not being fetched or being fetched from incorrect sets

## Current Implementation Analysis

### SetCodeResolver.ts

The current `resolveSetCode` function has several strategies for resolving set names:

1. **Alias lookup**: Checks predefined aliases for known mappings
2. **Exact match**: Matches normalized set names directly
3. **Special pattern handling**:
   - "Commander: ... : Extras" pattern
   - "Commander:" prefix
   - ": Extras" suffix
   - "Universes Beyond:" prefix
   - "Magic: The Gathering -" prefix (e.g., for FINAL FANTASY sets)
   - "Secret Lair Drop Series:" prefix
   - Special case for "Stellar Sights"

### Identified Issues from BUGS.md

1. **Missing/wrong aliases**: "Stellar Sights" mapped to `sld` incorrectly (should be `eos`)
2. **Product family confusion**: Commander vs. main expansion vs. box toppers vs. Secret Lair/30th Anniversary/UB crossovers
3. **Calling `/cards/named` with set name instead of set code**: Scryfall expects 3-5 character codes
4. **Not using Cardmarket product IDs**: The importer has authoritative Cardmarket product IDs but doesn't use them for lookup

### Current Code Flow

1. **Cardmarket CSV Worker** (`cardmarketCsv.ts`): Parses CSV files and extracts Product IDs, card names, and expansions
2. **ImportService** (`ImportService.ts`): Processes parsed data and calls `resolveSetCode` to map Cardmarket set names to Scryfall codes
3. **SetCodeResolver** (`SetCodeResolver.ts`): Attempts to resolve set names to codes using various heuristics
4. **ScryfallProvider** (`ScryfallProvider.ts`): Makes API calls to Scryfall using resolved set codes or names

## Solution Approach

According to the `BUGS.md` file, the proposed fix follows this priority order:

1. **Primary strategy**: Resolve by Cardmarket product ID(s) first using `POST /cards/collection`
2. **Secondary strategy**: Resolve via set code + collector number if ID lookup fails
3. **Tertiary strategy**: Strengthen `SetCodeResolver` with product-family awareness

## Example Data Structures

### Cardmarket CSV Data

From the CSV examples, we can see the following relevant fields:

#### Purchased Articles CSV:
```
Shipment nr.;Date of purchase;Article;Product ID;Localized Product Name;Expansion;Category;Amount;Article Value;Total;Currency;Comments
1219026706;2025-07-03 11:21:43;Clever Concealment;824528;Clever Concealment;Commander: Magic: The Gathering - FINAL FANTASY;Magic Single;1;8;8;EUR;#432 #1bA #101
1223095833;2025-07-29 22:19:35;Ancient Tomb (V.1);835390;Ancient Tomb (V.1);Stellar Sights;Magic Single;1;69.3;69.3;EUR;booster to sleeve to toploader
```

#### Purchased Orders CSV:
```
OrderID;Username;Name;Street;City;Country;Is Professional;VAT Number;Date of Purchase;Article Count;Merchandise Value;Shipment Costs;Trustee service fee;Total Value;Currency;Description;Product ID;Localized Product Name
1223095833;Deemor;Gerrit Kolb;Käthe-Kollwitz-Str. 9;68723 Oftersheim;Germany;;;2025-07-29 22:19:35;1;69,30;3,95;0,70;73,95;EUR;1x Ancient Tomb (V.1) (Stellar Sights) - 1 - Mythic - NM - English - 69,30 EUR;835390;Ancient Tomb (V.1)
```

### Cardmarket products_singles_1.json Structure

Based on the JSON file, the structure includes:

```json
{
  "version": 1,
  "createdAt": "2025-09-05T08:25:02+0200",
  "products": [
    {
      "idProduct": 822859,
      "name": "Ragavan Token (Red 2/1)",
      "idCategory": 1,
      "categoryName": "Magic Single",
      "idExpansion": 6117,
      "idMetacard": 436061,
      "dateAdded": "2025-04-25 16:25:10"
    }
  ]
}
```

### Scryfall API Approaches

#### 1. Primary Strategy - Cardmarket Product ID Lookup
```http
POST https://api.scryfall.com/cards/collection
{
  "identifiers": [
    { "cardmarket_id": 835390 }
  ]
}
```

#### 2. Secondary Strategy - Set Code + Collector Number
```http
GET https://api.scryfall.com/cards/sta/1
```

Or with search query:
```http
GET https://api.scryfall.com/cards/search?q=!"Ancient Tomb" e:sta cn:1 include:extras include:variations unique:prints
```

## Implementation Recommendations

### Phase 1: Enhance SetCodeResolver with Product-Family Awareness

1. **Eliminate hardcoded mappings**: Remove hardcoded set mappings like "Stellar Sights" → `sld` and implement proper resolution using Cardmarket product IDs.
2. **Add product family classifier**: Detect patterns like:
   - Commander sets: `^Commander:\s*(.+)` → Search Scryfall for `set_type = 'commander'`
   - Universes Beyond sets: Map to appropriate main codes (e.g., AC → acr)
   - "Extras" handling: Only fold to base set when variants are actually stored there
3. **Improve error handling**: Add better logging when set resolution fails

### Phase 2: Implement Cardmarket Product ID-Based Lookup

1. **Modify ScryfallProvider** to add a new method `getByCardmarketId` that uses `POST /cards/collection` with `cardmarket_id` identifiers
2. **Update ImportService** to prioritize Product ID lookup before set code resolution
3. **Handle multiple Product IDs**: Implement logic to parse and try multiple IDs (e.g., "827014 | 665760") in sequence until a match is found

### Phase 3: Improve Set Code Resolution Logic

1. **Never call** Scryfall with `set=<set name>`; always require a 3–5 char code
2. **Cache Scryfall sets** with TTL and only refresh when stale
3. **Precompute normalized index** for set names and curated alias map
4. **Add collector number parsing**: Extract collector numbers from card descriptions when available for more precise lookups

## Technical Implementation Details

### Modifying ImportService.ts

The `ImportService.importCardmarketArticles` method currently:
1. Calls `resolveSetCode(article.expansion)` to get a set code
2. Uses `ScryfallProvider.hydrateCard` with the resolved set code or fallback to original expansion name

This needs to be modified to:
1. First attempt lookup by Product ID using `ScryfallProvider.getByCardmarketId`
2. If that fails, fall back to set code + collector number resolution
3. Only use the current name-based approach as a last resort

### Modifying ScryfallProvider.ts

Add new methods:
1. `getByCardmarketId(id: string)` - Uses `POST /cards/collection` with `cardmarket_id` identifier
2. `getBySetAndCollectorNumber(setCode: string, collectorNumber: string)` - Uses `GET /cards/{set}/{collectorNumber}`

These methods should:
- Implement proper rate limiting using the existing `enforceRateLimit()` mechanism
- Handle API errors gracefully and return null when cards are not found
- Include proper TypeScript typing for the response data
- Follow the existing code patterns in the file for consistency

### Modifying SetCodeResolver.ts

Enhance the resolver with:
1. Better handling of product family classifications
2. More accurate alias mappings
3. Improved error handling and logging

## Test Cases from BUGS.md

1. **Clever Concealment — Commander: FINAL FANTASY**
   - Input: Product ID 824528
   - Expected: Exact printing whose `cardmarket_id == 824528`

2. **Ancient Tomb — "Stellar Sights"**
   - Input: Product ID 835390, Description with "Stellar Sights"
   - Expected: Correct set mapping and successful fetch

3. **Multiple Product IDs** (e.g., "827014 | 665760")
   - Input: Row with multiple IDs
   - Expected: Try each ID via `/cards/collection` and pick best match

4. **Commander Sets with Extras**
   - Input: "Commander: The Lord of the Rings: Tales of Middle-earth: Extras"
   - Expected: Resolve to correct Commander set, not main expansion

5. **Versioned Cards**
   - Input: "Lightning, Army of One (V.1) (Magic: The Gathering - FINAL FANTASY)"
   - Expected: Resolve to correct printing with version information

## Logging and Diagnostics

Enhance logging to include:
- Source row info (name, product IDs, parsed CN, human set label)
- Final, normalized request (endpoint, set code, CN)
- Structured "resolution report" per row:
  ```json
  {
    "product_ids": [],
    "resolved_via": "cardmarket_id|set+cn|search",
    "set_code": "sta",
    "collector_number": "1",
    "final_uri": "/cards/sta/1"
  }
  ```

## Next Steps

1. **Eliminate hardcoded mappings**: Remove hardcoded set mappings and implement proper resolution using Cardmarket product IDs
2. **Implement Cardmarket product ID lookup**: 
   - Add `getByCardmarketId` method to ScryfallProvider.ts
   - Modify ImportService.ts to use Product ID lookup as the primary strategy
3. **Enhance SetCodeResolver**: Add better product family classification logic
4. **Add collector number parsing**: Extract collector numbers from card descriptions in ImportService.ts
5. **Improve error handling and logging**: Add structured logging for diagnostic purposes
6. **Create test cases**: Implement unit tests for the specific examples in BUGS.md
7. **Update documentation**: Ensure all changes are properly documented