# Bug: Card fetcher sometimes resolves the wrong Scryfall set and/or pulls the wrong printing

## Summary

When importing Cardmarket CSVs, the importer queries Scryfall to fetch card data. In certain cases:

1. the **set resolver** fails to map Cardmarket set names to the correct Scryfall set code before calling the API, leading to 404s; and
2. even when a set is (apparently) resolved, the **printing/version selector** returns the wrong or no printing because the request does not uniquely identify the desired print (e.g., commander vs main set, box toppers, “extras”/variants, Secret Lair/30th Anniversary/UB crossovers).

This results in cards not being fetched or being fetched from an incorrect set/printing.

## Environment & scope

* Source: Cardmarket CSVs (purchased orders/articles in July 2025)
* Fetch: Scryfall `/cards/named` (sometimes with `set=` and `include_variations=true`) and `/sets` cache
* Code areas implicated: `SetCodeResolver.ts`, the fetch routine that builds Scryfall queries (likely in `CardmarketImportWizard.vue` worker call path)

## Evidence

### Console log highlights (your excerpt)

* **Set not resolved → 404 with set name (not code):**

    * `Set code unresolved: Commander: Magic: The Gathering - FINAL FANTASY`
    * Calls made with **set name**, not code:

        * `.../cards/named?exact=Clever Concealment&set=Commander: Magic: The Gathering - FINAL FANTASY` → **404**
        * `.../cards/named?fuzzy=Clever Concealment&set=Commander: Magic: The Gathering - FINAL FANTASY` → **404**
* **Wrong base for nested “Commander: … : Extras”:**

    * Resolver says: `commander + extras nested (base): Commander: The Lord of the Rings: Tales of Middle-earth: Extras -> ltr`
    * Then fetch:

        * `.../cards/named?exact=Oboro, Palace in the Clouds&set=ltr` → **404** (set/printing mismatch)
* **Alias likely incorrect:**

    * `Set code resolved from stellar sights fallback: Stellar Sights -> sld` then

        * `.../cards/named?exact=Ancient Tomb&set=sld` → **404** (indicates alias mapping problem or wrong product family)

Other resolver lines (OK and not-OK) show the resolver’s heuristic nature:

* OK samples: `exact match: Ixalan -> xln`, `Double Masters 2022 -> 2x2`, `Modern Horizons 3 -> mh3`
* Ambiguous/fishy: repeated “alias → fin”, “extras suffix → khm”, and the LTR vs. LOTR Commander confusion

### CSV rows that trigger these cases (extracted from your **Purchased Orders**)

I inspected your July orders and found concrete rows that match the failing patterns:

* `1x Clever Concealment (Commander: Magic: The Gathering - FINAL FANTASY)` → **Product ID 824528**
* `1x Ultima (Magic: The Gathering - FINAL FANTASY)` → **Product ID “827014 | 665760”**
* `1x Beast Whisperer (Commander: Ikoria) - 167 - ...` → **Product ID 453993**
* `1x Lightning, Army of One (V.1) (Magic: The Gathering - FINAL FANTASY)` → **Product ID 824257**

(Those are the exact “Description” and Product IDs captured from your CSV; they mirror the set labels that your resolver struggled with.)

## How to reproduce (minimal)

1. Import the July 2025 **Purchased Orders** CSV.
2. Ensure the process reaches the worker step that resolves sets and fetches from Scryfall.
3. Observe:

    * For **Clever Concealment** in “Commander: Magic: The Gathering - FINAL FANTASY”, the resolver sometimes doesn’t produce a set code before the fetch → the code calls `/cards/named` with a **set name**, not a set code → **404**.
    * For **Beast Whisperer (Commander: Ikoria)**, resolver logs `Set code unresolved: Commander: Ikoria` then fetches with **set name** → **404**.
    * For **Oboro, Palace in the Clouds** under “Commander: The Lord of the Rings: … : Extras” the resolver picks base **`ltr`** and fetches with `set=ltr` → **404** (printing is special/boxtopper/commander vs main-set mismatch).
    * For **Ancient Tomb** from “Stellar Sights”, the resolver maps to **`sld`** → **404** (likely wrong family; mapping needs correction).

## Expected vs. actual

* **Expected:** For each CSV line, fetch the **exact intended printing** (correct set family and variation) from Scryfall.
* **Actual:** Some lines 404 (set cannot be resolved or the wrong set is used), or the wrong printing is returned.

## Root cause analysis (most likely)

### A) Set resolution gaps & wrong-family mapping

* The resolver assumes rules like “Extras → base set code” or uses aliases that aren’t always valid across product families (e.g., **Commander vs. main expansion vs. box toppers vs. Secret Lair/30th** vs. Universes Beyond special products).
* Examples:

    * **“Commander: Ikoria”** should map to the **Commander 2020** set code (e.g., *c20*), but resolver reports it **unresolved**, then fetches using the literal set name.
    * **“Commander: The Lord of the Rings: … : Extras”** mapped to **`ltr`** (main set), while commander decks are a **different set family** (e.g., LOTR Commander), so name+set fails.
    * **“Stellar Sights”** mapped to **`sld`** (Secret Lair Drop) but Ancient Tomb likely belongs to a **different product line**; the alias table is off.

### B) Printing/version selection too coarse

* Using `/cards/named` with just `name` + `set` (and sometimes `include_variations=true`) is not enough to pin the **exact** print when:

    * The Cardmarket line refers to **Commander** decks vs. main set.
    * The print is a **boxtopper/list/bonus** series within (or adjacent to) the base set.
    * The CSV includes a **collector number** (e.g., “- 167 - …”) that isn’t used to target the exact print.
    * Some lines carry **multiple Product IDs** (e.g., `"827014 | 665760"`), which should be used to disambiguate but aren’t.

### C) Calling `/cards/named` with a **set name** (not a set code)

* The Scryfall “set” query parameter expects the **set code**; passing the full **set name** causes immediate 404s.

# Example of wrong resolutions
* found: https://scryfall.com/card/pone/10p/elesh-norn-mother-of-machines
* shouldve been: https://scryfall.com/card/one/416/elesh-norn-mother-of-machines

* found: https://scryfall.com/card/acr/99/sword-of-feast-and-famine
* should have been: https://scryfall.com/card/acr/124/sword-of-feast-and-famine

* found: https://scryfall.com/card/fin/233/lightning-army-of-one
* should have been: https://scryfall.com/card/fin/320/lightning-army-of-one

## Proposed fix (order of operations)

> The key is to **stop guessing** when you don’t have to. You already have the authoritative Cardmarket product IDs; Scryfall supports looking up by Cardmarket IDs.

1. **Primary strategy: resolve by Cardmarket product ID(s) first**

    * Use Scryfall **`POST /cards/collection`** with `"identifiers": [{"cardmarket_id": <ID>}, ...]` for each CSV line.
    * If the CSV provides **multiple IDs** (e.g., `827014 | 665760`), **try each** until a match is found (or fetch both and choose the one whose name matches best).
    * This bypasses nearly all alias and “extras” headaches and guarantees the **exact** printing.

2. **Secondary strategy: resolve via set code + collector number if ID lookup fails**

    * Parse **collector number** if present in the description (e.g., `"- 167 -"`).
    * Once a **set code** is known (see step 3 below), call **`GET /cards/{set}/{collector_number}`** to get the precise printing.
    * If {set}/{number} 404s (suffix letters / promo CNs), fall back to **`/cards/search`** with a fully constrained query:

        * `!"<exact name>" e:<setcode> cn:<number> include:extras include:variations unique:prints`

3. **Strengthen SetCodeResolver with “product-family aware” mapping**

    * Add a **product family classifier** that looks at the Cardmarket “Description” string and/or Scryfall set metadata:

        * Detect **Commander** lines: `^Commander:\s*(.+)` → search Scryfall `/sets` for a set with **set\_type = 'commander'** and a name/title that contains the base (e.g., “Ikoria” → Commander 2020). Prefer matches where the set name **starts with** the base title or where **parent/series** matches.
        * Detect **Universes Beyond** (e.g., Assassin’s Creed) and map to their main codes (e.g., *acr* for AC).
        * Handle **“Extras”** explicitly: only map to base set **if the product family actually stores variants under the base code**; otherwise look for the specific family (e.g., Commander extras under the **Commander** set, LOTR **Commander** vs **LOTR main set**).
        * Fix specific aliases (e.g., **“Stellar Sights”**): verify its true Scryfall set family and update the alias table.
    * **Never call** Scryfall with `set=<set name>`; require a **3–5 char code**. If resolution fails, **don’t fetch**—drop into the secondary or primary strategies.

4. **Use the data you already have**

    * Prefer **Cardmarket product ID** over name parsing when available.
    * Use **collector numbers** when present to disambiguate variations.
    * If language/finish is part of your CSVs (not in July sample), include `lang`/finish filters in the selection phase.

5. **Make resolver deterministic and cache-friendly**

    * Cache Scryfall sets with a **TTL** and only refresh when stale (your logs already show caching, but sets get refetched multiple times in one run).
    * Precompute a **normalized index** (lowercased, punctuation-stripped) for set names and a curated alias map for known Cardmarket label patterns.

## Acceptance criteria (add these as tests)

1. **Clever Concealment — Commander: FINAL FANTASY**

    * Input: Description contains `Commander: Magic: The Gathering - FINAL FANTASY` and **Product ID 824528**.
    * Expected: The importer returns the printing whose **cardmarket\_id == 824528** (or exact commander FF printing if ID lookup unavailable). No `/cards/named?...&set=Commander: ...` calls.

2. **Beast Whisperer — Commander: Ikoria — CN 167**

    * Input: Description contains `Commander: Ikoria`, `- 167 -`, **Product ID 453993**.
    * Expected: The importer selects **Commander 2020** set (code like *c20*) and **collector number 167**, or resolves by **cardmarket\_id** if available.

3. **Oboro, Palace in the Clouds — LOTR Commander Extras (nested)**

    * Input: Description indicates the LOTR Commander product line (not main `ltr`).
    * Expected: Correct **Commander** family set code or cardmarket\_id lookup; named fetch with `set=ltr` must not be used if that printing doesn’t exist there.

4. **Ancient Tomb — “Stellar Sights”**

    * Input: Description with **Stellar Sights**.
    * Expected: Correct set mapping for that product line (verify alias) and successful fetch; no 404s due to wrong `set=`.

5. **Multiple Product IDs on one line (e.g., “827014 | 665760”)**

    * Input: Row with multiple IDs.
    * Expected: Try each `cardmarket_id` via `/cards/collection` and pick the one whose name/expansion best matches the row; no wrong-print outcomes.

## Implementation notes (low-risk, robust path)

* **Always** attempt:

  ```http
  POST /cards/collection
  {
    "identifiers": [
      { "cardmarket_id": 824528 }
    ]
  }
  ```

  If multiple IDs are present, include them all in one call or loop one-by-one.

* If that fails, and you have set code + CN:

  ```http
  GET /cards/{set}/{collector_number}
  ```

  Otherwise:

  ```http
  GET /cards/search?q=%21"Beast Whisperer"+e:c20+cn:167&unique=prints&include_extras=true&include_variations=true
  ```

* **Do not** use `/cards/named` with a `set` string unless you’re 100% sure you have the **set code**, not the human readable name.

* **Resolver refactor sketch** (pseudocode):

  ```ts
  // Given Cardmarket label (e.g., "Commander: Ikoria", "Magic: The Gathering - FINAL FANTASY", "...: Extras")
  function resolveSetCode(label: string, scryfallSets: SetMeta[]): string | null {
    const norm = normalize(label);

    // 1) Known hard aliases (map of norm -> code), e.g. final fantasy, assassin's creed, stellar sights, etc.
    if (ALIASES[norm]) return ALIASES[norm];

    // 2) Commander pattern
    const commanderMatch = /^commander:\s*(.+?)(?::\s*extras)?$/.exec(norm);
    if (commanderMatch) {
      const base = commanderMatch[1];              // e.g., "ikoria"
      // Find commander-family set where name includes base and set_type is commander
      const hit = scryfallSets.find(s =>
        s.set_type === 'commander' && normalize(s.name).includes(base)
      );
      if (hit) return hit.code;
    }

    // 3) Extras handling — only fold to base when that product actually stores extras under base
    const extrasMatch = /(.+?):\s*extras$/.exec(norm);
    if (extrasMatch) {
      const base = extrasMatch[1];
      const set = findBestBaseSet(base, scryfallSets);  // prefer expansion matching base, else alias lookup
      if (set) return set.code;
    }

    // 4) Fallback: exact/startsWith match on set names
    const exact = scryfallSets.find(s => normalize(s.name) === norm);
    if (exact) return exact.code;
    const starts = scryfallSets.find(s => normalize(s.name).startsWith(norm));
    if (starts) return starts.code;

    return null;
  }
  ```

## Logging & diagnostics to add

* When building Scryfall requests, **log both** the *source row info* (name, product IDs, parsed CN, human set label) and the **final, normalized request** (endpoint, set code, CN).
* Emit a **single structured “resolution report”** per row: `{product_ids:[], resolved_via: 'cardmarket_id'|'set+cn'|'search', set_code, collector_number, final_uri}`.
* If `set_code` is **null**, **do not** call Scryfall with a set parameter; switch to ID-based or to a constrained search query.

## Why this will fix it

* Cardmarket → Scryfall by **cardmarket\_id** is one-to-one for prints; it eliminates guessing.
* When IDs aren’t present/usable, **set code + collector number** uniquely identifies the printing (and is resilient to “extras”).
* The resolver becomes **product-family aware**, preventing commander/main-set/box-topper mixups.
